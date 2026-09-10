/**
 * #912の大規模Table並び替えPoCとして、確認UI、Table退避、反映、再mountを接続する。
 *
 * PoC状態はDnD Sessionと分離し、対象Core TableのBlockEditだけを反映開始前に退避する。
 * 反映完了または通常の反映不能後はPoCを終了し、現在Tableを再mountして通常編集へ戻す。
 */

import { Button, Modal } from '@wordpress/components';
import type { ReactNode } from '@wordpress/element';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import {
	getLargeReorderApplyConfirmBody,
	getLargeReorderApplyConfirmTitle,
	getLargeReorderApplyingMessage,
	getLargeReorderCancelLabel,
	getLargeReorderContinueLabel,
} from '@/messages';
import {
	cancelLargeReorderPoc,
	completeLargeReorderPoc,
	confirmLargeReorderPoc,
	getLargeReorderPocState,
	subscribeLargeReorderPoc,
} from '@/reorder/large-reorder-poc';
import { isRowReorderTargetMovable } from '@/reorder/row-reorder/domain/target-validity';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

let applyInFlight = false;

/** 現在のPoC状態をReact componentから購読する。 */
export const useLargeReorderPocState = () =>
	useSyncExternalStore( subscribeLargeReorderPoc, getLargeReorderPocState );

/**
 * Table退避完了後に現在構造を再照合して行移動を反映し、反映成否にかかわらず通常表示へ戻す。
 *
 * React Strict Mode等でEffectが再実行されても同じPoCを二重反映しない。
 */
const applyAndRemount = (): void => {
	if ( applyInFlight ) {
		return;
	}

	const state = getLargeReorderPocState();
	if ( state.phase !== 'applying' ) {
		return;
	}

	applyInFlight = true;
	try {
		const constraints = rowTableIntegration.getConstraints( state.move.tableIdentity );
		const target = {
			tableIdentity: state.move.tableIdentity,
			sourceRowIndex: state.move.sourceRowIndex,
		};
		const destinationValid =
			constraints !== null &&
			Number.isInteger( state.move.destinationBoundaryIndex ) &&
			state.move.destinationBoundaryIndex >= 0 &&
			state.move.destinationBoundaryIndex <= constraints.rowCount &&
			! constraints.blockedBoundaries.includes( state.move.destinationBoundaryIndex );
		const moveStillValid =
			constraints !== null &&
			isRowReorderTargetMovable( target, constraints ) &&
			destinationValid;

		/* Continue後の外部状態変化で移動が成立しなくなった場合はTableを変更せず、現在Tableの再mountへ進む。 */
		if ( ! moveStillValid ) {
			performance.mark( 'ytr-912-remount-start' );
			completeLargeReorderPoc();
			return;
		}

		performance.mark( 'ytr-912-update-start' );
		const applied = rowTableIntegration.applyRowMove( {
			clientId: state.move.tableIdentity,
			sourceRowIndex: state.move.sourceRowIndex,
			destinationBoundaryIndex: state.move.destinationBoundaryIndex,
		} );
		performance.mark( 'ytr-912-update-end' );
		performance.measure( 'ytr-912-update', 'ytr-912-update-start', 'ytr-912-update-end' );

		/* 反映不能も通常の外部状態変化として扱い、placeholderを残さず現在Tableの再mountへ進む。 */
		if ( ! applied ) {
			performance.mark( 'ytr-912-remount-start' );
			completeLargeReorderPoc();
			return;
		}

		performance.mark( 'ytr-912-remount-start' );
		completeLargeReorderPoc();
	} finally {
		applyInFlight = false;
	}
};

/**
 * 対象Core TableのBlockEditをPoC状態に応じて確認UIまたは軽量表示へ切り替える。
 *
 * @param props          対象Tableの識別情報と元のBlockEdit表示。
 * @param props.clientId 対象Table個体のclientId。
 * @param props.children 通常時に表示するGutenberg本来のTable編集UI。
 * @return PoC対象でなければ通常UI、確認中は確認ダイアログ、反映中はTableを退避した軽量表示。
 */
export const LargeReorderPocTableBoundary = ( props: {
	clientId: string;
	children: ReactNode;
} ) => {
	const { clientId, children } = props;
	const state = useLargeReorderPocState();
	const wasApplyingForTarget = useRef( false );
	const isTarget = state.phase !== 'idle' && state.move.tableIdentity === clientId;
	const shouldApply = isTarget && state.phase === 'applying';

	useEffect( () => {
		if ( ! shouldApply ) {
			return;
		}

		wasApplyingForTarget.current = true;
		performance.mark( 'ytr-912-block-edit-unmounted' );
		applyAndRemount();
	}, [ shouldApply ] );

	useEffect( () => {
		if ( state.phase !== 'idle' || ! wasApplyingForTarget.current ) {
			return;
		}

		wasApplyingForTarget.current = false;
		performance.mark( 'ytr-912-remount-complete' );
		performance.measure(
			'ytr-912-remount',
			'ytr-912-remount-start',
			'ytr-912-remount-complete'
		);
	}, [ state.phase ] );

	if ( shouldApply ) {
		return <div role="status">{ getLargeReorderApplyingMessage() }</div>;
	}

	return (
		<>
			{ children }
			{ isTarget && state.phase === 'confirming' && (
				<Modal title={ getLargeReorderApplyConfirmTitle() } onRequestClose={ cancelLargeReorderPoc }>
					<p>{ getLargeReorderApplyConfirmBody() }</p>
					<Button variant="primary" onClick={ confirmLargeReorderPoc }>
						{ getLargeReorderContinueLabel() }
					</Button>
					<Button variant="tertiary" onClick={ cancelLargeReorderPoc }>
						{ getLargeReorderCancelLabel() }
					</Button>
				</Modal>
			) }
		</>
	);
};
