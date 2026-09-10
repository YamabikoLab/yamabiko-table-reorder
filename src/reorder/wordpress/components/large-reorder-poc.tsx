/**
 * #912の大規模Table並び替えPoCとして、確認UI、Table退避、反映、再mountを接続する。
 *
 * PoC状態はDnD Sessionと分離し、対象Core TableのBlockEditだけを反映開始前に退避する。
 * 反映中表示を実際に描画してから更新し、反映完了または通常の反映不能後は現在Tableを再mountして通常編集へ戻す。
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

/** 確認ダイアログのContinueから反映開始までの計測を開始する。 */
const continueLargeReorderPoc = (): void => {
	performance.clearMarks( 'ytr-912-continue' );
	performance.clearMarks( 'ytr-912-block-edit-unmounted' );
	performance.clearMarks( 'ytr-912-update-start' );
	performance.clearMarks( 'ytr-912-update-end' );
	performance.clearMarks( 'ytr-912-remount-start' );
	performance.clearMarks( 'ytr-912-react-remount-complete' );
	performance.clearMarks( 'ytr-912-visual-complete' );
	performance.clearMeasures( 'ytr-912-update' );
	performance.clearMeasures( 'ytr-912-react-remount' );
	performance.clearMeasures( 'ytr-912-visual-remount' );
	performance.clearMeasures( 'ytr-912-total-visual' );
	performance.mark( 'ytr-912-continue' );
	confirmLargeReorderPoc();
};

/**
 * Table退避完了後に現在構造を再照合して行移動を反映し、反映成否にかかわらず通常表示へ戻す。
 *
 * React Strict Mode等でEffectが再実行されても同じPoCを二重反映しない。
 *
 * @return 反映成功時は再mount後にfocusする0-based行位置。反映しなかった場合はnull。
 */
const applyAndRemount = (): number | null => {
	if ( applyInFlight ) {
		return null;
	}

	const state = getLargeReorderPocState();
	if ( state.phase !== 'applying' ) {
		return null;
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
			return null;
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
			return null;
		}

		const movedRowIndex =
			state.move.destinationBoundaryIndex > state.move.sourceRowIndex
				? state.move.destinationBoundaryIndex - 1
				: state.move.destinationBoundaryIndex;

		performance.mark( 'ytr-912-remount-start' );
		completeLargeReorderPoc();
		return movedRowIndex;
	} finally {
		applyInFlight = false;
	}
};

/**
 * 再mountしたCore Tableで移動後の行を表示し、先頭の編集可能セルへfocusを移す。
 *
 * @param editorDocument 反映中placeholderから取得した現在のEditor Document。
 * @param clientId       対象Table個体のclientId。
 * @param rowIndex       並び替え後のtbody内0-based行位置。
 */
const focusMovedRow = ( editorDocument: Document, clientId: string, rowIndex: number ): void => {
	const block = editorDocument.querySelector( `[data-block="${ clientId }"]` );
	const tableBody = block?.querySelector( 'table' )?.tBodies.item( 0 ) ?? null;
	const row = tableBody?.rows.item( rowIndex ) ?? null;

	/* 再mount後の対象行を解決できない場合は、通常編集を妨げずfocus復元だけを行わない。 */
	if ( ! row ) {
		return;
	}

	const editable = row.querySelector< HTMLElement >( '[contenteditable="true"]' );
	const firstCell = row.cells.item( 0 );
	const displayTarget = editable ?? firstCell ?? row;

	/* 移動後行の先頭側を表示して、横スクロール位置が途中の列へ残らないようにする。 */
	displayTarget.scrollIntoView( { block: 'center', inline: 'start' } );
	editable?.focus( { preventScroll: true } );
};

/** PoCの計測結果を比較しやすい形で開発者consoleへ出力する。 */
const logPerformanceMeasurements = (): void => {
	const update = performance.getEntriesByName( 'ytr-912-update' ).at( -1 );
	const reactRemount = performance.getEntriesByName( 'ytr-912-react-remount' ).at( -1 );
	const visualRemount = performance.getEntriesByName( 'ytr-912-visual-remount' ).at( -1 );
	const totalVisual = performance.getEntriesByName( 'ytr-912-total-visual' ).at( -1 );

	globalThis.console.info( '[YTR #912 PoC]', {
		updateMs: update?.duration ?? null,
		reactRemountMs: reactRemount?.duration ?? null,
		visualRemountMs: visualRemount?.duration ?? null,
		totalVisualMs: totalVisual?.duration ?? null,
	} );
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
	const applyingPlaceholder = useRef< HTMLDivElement | null >( null );
	const editorDocument = useRef< Document | null >( null );
	const movedRowIndex = useRef< number | null >( null );
	const isTarget = state.phase !== 'idle' && state.move.tableIdentity === clientId;
	const shouldApply = isTarget && state.phase === 'applying';

	useEffect( () => {
		if ( ! shouldApply ) {
			return;
		}

		wasApplyingForTarget.current = true;
		editorDocument.current = applyingPlaceholder.current?.ownerDocument ?? null;
		performance.mark( 'ytr-912-block-edit-unmounted' );

		const editorWindow = editorDocument.current?.defaultView ?? null;
		if ( ! editorWindow ) {
			movedRowIndex.current = applyAndRemount();
			return;
		}

		let secondFrame = 0;
		const firstFrame = editorWindow.requestAnimationFrame( () => {
			/* Modalを閉じた反映中表示を1回paintした後に、Store更新と再mountを開始する。 */
			secondFrame = editorWindow.requestAnimationFrame( () => {
				movedRowIndex.current = applyAndRemount();
			} );
		} );

		return () => {
			editorWindow.cancelAnimationFrame( firstFrame );
			if ( secondFrame !== 0 ) {
				editorWindow.cancelAnimationFrame( secondFrame );
			}
		};
	}, [ shouldApply ] );

	useEffect( () => {
		if ( state.phase !== 'idle' || ! wasApplyingForTarget.current ) {
			return;
		}

		wasApplyingForTarget.current = false;
		performance.mark( 'ytr-912-react-remount-complete' );
		performance.measure(
			'ytr-912-react-remount',
			'ytr-912-remount-start',
			'ytr-912-react-remount-complete'
		);

		if ( editorDocument.current && movedRowIndex.current !== null ) {
			focusMovedRow( editorDocument.current, clientId, movedRowIndex.current );
		}

		const editorWindow = editorDocument.current?.defaultView ?? null;
		if ( ! editorWindow ) {
			performance.mark( 'ytr-912-visual-complete' );
			performance.measure(
				'ytr-912-visual-remount',
				'ytr-912-remount-start',
				'ytr-912-visual-complete'
			);
			performance.measure(
				'ytr-912-total-visual',
				'ytr-912-continue',
				'ytr-912-visual-complete'
			);
			logPerformanceMeasurements();
			editorDocument.current = null;
			movedRowIndex.current = null;
			return;
		}

		let secondFrame = 0;
		const firstFrame = editorWindow.requestAnimationFrame( () => {
			/* 再mountとfocus・scroll後の画面が1回paintされた次のframeを体感上の表示完了として記録する。 */
			secondFrame = editorWindow.requestAnimationFrame( () => {
				performance.mark( 'ytr-912-visual-complete' );
				performance.measure(
					'ytr-912-visual-remount',
					'ytr-912-remount-start',
					'ytr-912-visual-complete'
				);
				performance.measure(
					'ytr-912-total-visual',
					'ytr-912-continue',
					'ytr-912-visual-complete'
				);
				logPerformanceMeasurements();
				editorDocument.current = null;
				movedRowIndex.current = null;
			} );
		} );

		return () => {
			editorWindow.cancelAnimationFrame( firstFrame );
			if ( secondFrame !== 0 ) {
				editorWindow.cancelAnimationFrame( secondFrame );
			}
		};
	}, [ clientId, state.phase ] );

	if ( shouldApply ) {
		return (
			<div ref={ applyingPlaceholder } role="status">
				{ getLargeReorderApplyingMessage() }
			</div>
		);
	}

	return (
		<>
			{ children }
			{ isTarget && state.phase === 'confirming' && (
				<Modal title={ getLargeReorderApplyConfirmTitle() } onRequestClose={ cancelLargeReorderPoc }>
					<p>{ getLargeReorderApplyConfirmBody() }</p>
					<Button variant="primary" onClick={ continueLargeReorderPoc }>
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
