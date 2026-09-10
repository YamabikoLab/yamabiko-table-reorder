/**
 * #910の大規模Table並び替えPoCとして、確認UI、Table退避、全Block編集抑止、反映・投稿保存・画面離脱を接続する。
 *
 * PoC状態はDnD Sessionと分離し、対象Core TableのBlockEditだけを反映開始前に退避する。
 * 保存失敗時はTable退避と編集抑止を維持した終端状態とする。
 */

import { useBlockEditingMode } from '@wordpress/block-editor';
import { Button, Modal } from '@wordpress/components';
import { dispatch, select } from '@wordpress/data';
import type { ReactNode } from '@wordpress/element';
import { useEffect, useSyncExternalStore } from 'react';

import {
	getLargeReorderApplyConfirmBody,
	getLargeReorderApplyConfirmTitle,
	getLargeReorderApplyingMessage,
	getLargeReorderApplyFailedMessage,
	getLargeReorderCancelLabel,
	getLargeReorderContinueLabel,
} from '@/messages';
import {
	cancelLargeReorderPoc,
	confirmLargeReorderPoc,
	failLargeReorderPoc,
	getLargeReorderPocState,
	subscribeLargeReorderPoc,
} from '@/reorder/large-reorder-poc';
import { isRowReorderTargetMovable } from '@/reorder/row-reorder/domain/target-validity';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

type EditorDispatch = {
	savePost: () => Promise< unknown >;
};

type EditorSelect = {
	didPostSaveRequestSucceed: () => boolean;
};

const selectByName = select as unknown as ( storeName: string ) => unknown;
const dispatchByName = dispatch as unknown as ( storeName: string ) => unknown;
let applyInFlight = false;

/** 現在のPoC状態をReact componentから購読する。 */
export const useLargeReorderPocState = () =>
	useSyncExternalStore( subscribeLargeReorderPoc, getLargeReorderPocState );

/**
 * Continue後のPoC中は各Blockの編集をWordPress公開APIで無効化する。
 *
 * 保存失敗後もfailed終端状態で編集不可を維持し、Store上に残る並び替え結果を後続の手動保存へ混入させない。
 */
export const useLargeReorderPocEditingGuard = (): void => {
	const state = useLargeReorderPocState();
	const editingDisabled = state.phase === 'applying' || state.phase === 'failed';
	useBlockEditingMode( editingDisabled ? 'disabled' : undefined );
};

/**
 * Table退避完了後に現在構造を再照合して行移動を反映し、WordPress標準の投稿保存と投稿一覧への離脱まで実行する。
 *
 * React Strict Mode等でEffectが再実行されても同じPoCを二重反映しない。
 */
const applyAndSave = async (): Promise< void > => {
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

		/* Continue後の外部状態変化で移動が成立しなくなった場合は、Tableを更新せずfailed終端状態へ移る。 */
		if ( ! moveStillValid ) {
			failLargeReorderPoc();
			return;
		}

		performance.mark( 'ytr-910-update-start' );
		const applied = rowTableIntegration.applyRowMove( {
			clientId: state.move.tableIdentity,
			sourceRowIndex: state.move.sourceRowIndex,
			destinationBoundaryIndex: state.move.destinationBoundaryIndex,
		} );
		performance.mark( 'ytr-910-update-end' );
		performance.measure( 'ytr-910-update', 'ytr-910-update-start', 'ytr-910-update-end' );

		if ( ! applied ) {
			failLargeReorderPoc();
			return;
		}

		const editorDispatch = dispatchByName( 'core/editor' ) as EditorDispatch;
		performance.mark( 'ytr-910-save-start' );
		await editorDispatch.savePost();
		performance.mark( 'ytr-910-save-end' );
		performance.measure( 'ytr-910-save', 'ytr-910-save-start', 'ytr-910-save-end' );

		const editorSelect = selectByName( 'core/editor' ) as EditorSelect;
		if ( ! editorSelect.didPostSaveRequestSucceed() ) {
			failLargeReorderPoc();
			return;
		}

		globalThis.location.assign( 'edit.php' );
	} catch {
		failLargeReorderPoc();
	}
};

/**
 * 対象Core TableのBlockEditをPoC状態に応じて確認UIまたは軽量表示へ切り替える。
 *
 * @param props          対象Tableの識別情報と元のBlockEdit表示。
 * @param props.clientId 対象Table個体のclientId。
 * @param props.children 通常時に表示するGutenberg本来のTable編集UI。
 * @return PoC対象でなければ通常UI、確認中は確認ダイアログ、反映開始後はTableを退避した軽量表示。
 */
export const LargeReorderPocTableBoundary = ( props: {
	clientId: string;
	children: ReactNode;
} ) => {
	const { clientId, children } = props;
	const state = useLargeReorderPocState();
	const isTarget = state.phase !== 'idle' && state.move.tableIdentity === clientId;
	const shouldApply = isTarget && state.phase === 'applying';

	useEffect( () => {
		if ( ! shouldApply ) {
			return;
		}

		performance.mark( 'ytr-910-block-edit-unmounted' );
		void applyAndSave();
	}, [ shouldApply ] );

	if ( isTarget && state.phase === 'applying' ) {
		return <div role="status">{ getLargeReorderApplyingMessage() }</div>;
	}

	if ( isTarget && state.phase === 'failed' ) {
		return <div role="alert">{ getLargeReorderApplyFailedMessage() }</div>;
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
