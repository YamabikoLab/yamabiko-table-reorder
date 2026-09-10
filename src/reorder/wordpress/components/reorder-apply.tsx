/**
 * 確認付き大規模反映をWordPressのTable編集表示へ接続する。
 *
 * Row / Columnそれぞれが所有する反映Lifecycleを購読し、確認中は通常TableとModalを表示する。
 * Continue後は対象TableのBlockEditを一度退避し、反映中表示をpaintしてから現在Tableを再照合・更新する。
 * 再mount後は移動結果へscroll / focusを戻し、表示が安定するまで反映中表示を維持する。
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
	applyLargeColumnReorder,
	cancelLargeColumnReorderApply,
	completeLargeColumnReorderApply,
	confirmLargeColumnReorderApply,
	getLargeColumnReorderApplyState,
	subscribeLargeColumnReorderApply,
} from '@/reorder/column-reorder/responsibilities/reorder-apply';
import {
	applyLargeRowReorder,
	cancelLargeRowReorderApply,
	completeLargeRowReorderApply,
	confirmLargeRowReorderApply,
	getLargeRowReorderApplyState,
	subscribeLargeRowReorderApply,
} from '@/reorder/row-reorder/responsibilities/reorder-apply';

/** Reactから行の確認付き大規模反映状態を購読する。 */
const useLargeRowReorderApplyState = () =>
	useSyncExternalStore( subscribeLargeRowReorderApply, getLargeRowReorderApplyState );

/** Reactから列の確認付き大規模反映状態を購読する。 */
const useLargeColumnReorderApplyState = () =>
	useSyncExternalStore( subscribeLargeColumnReorderApply, getLargeColumnReorderApplyState );

/**
 * 行反映後の移動先行をEditor内で表示して、先頭の編集可能セルへfocusする。
 *
 * @param editorDocument 対象Tableが存在するEditor Document。
 * @param clientId 対象Table個体のclientId。
 * @param rowIndex 反映後のtbody内0-based行位置。
 */
const focusMovedRow = ( editorDocument: Document, clientId: string, rowIndex: number ): void => {
	const table = editorDocument.querySelector( `[data-block="${ clientId }"] table` );
	const row = table?.querySelector( 'tbody' )?.querySelectorAll( 'tr' ).item( rowIndex ) ?? null;
	if ( ! row ) {
		return;
	}

	const editable = row.querySelector< HTMLElement >( '[contenteditable="true"]' );
	const firstCell = row.querySelector< HTMLElement >( 'th, td' );
	const displayTarget = editable ?? firstCell ?? ( row as HTMLElement );
	displayTarget.scrollIntoView( { block: 'center', inline: 'start' } );
	editable?.focus( { preventScroll: true } );
};

/**
 * 列反映後の移動先論理列を先頭側のTable行で解決し、該当セルへscroll / focusする。
 *
 * @param editorDocument 対象Tableが存在するEditor Document。
 * @param clientId 対象Table個体のclientId。
 * @param columnIndex 反映後の0-based論理列位置。
 */
const focusMovedColumn = ( editorDocument: Document, clientId: string, columnIndex: number ): void => {
	const firstRow = editorDocument.querySelector< HTMLTableRowElement >(
		`[data-block="${ clientId }"] table tr`
	);
	if ( ! firstRow ) {
		return;
	}

	let logicalColumnStart = 0;
	let targetCell: HTMLTableCellElement | null = null;
	for ( const cell of Array.from( firstRow.cells ) ) {
		const logicalColumnEnd = logicalColumnStart + cell.colSpan;
		if ( columnIndex >= logicalColumnStart && columnIndex < logicalColumnEnd ) {
			targetCell = cell;
			break;
		}
		logicalColumnStart = logicalColumnEnd;
	}
	if ( ! targetCell ) {
		return;
	}

	const editable = targetCell.querySelector< HTMLElement >( '[contenteditable="true"]' );
	const displayTarget = editable ?? targetCell;
	displayTarget.scrollIntoView( { block: 'center', inline: 'center' } );
	editable?.focus( { preventScroll: true } );
};

/**
 * 対象TableのBlockEditへ確認付き大規模反映UIを接続する。
 *
 * @param props 対象Tableと通常表示。
 * @param props.clientId 対象Table個体のclientId。
 * @param props.children 通常時に表示するGutenberg本来のTable編集UI。
 * @return 通常Table、確認Modal、または反映中表示。
 */
export const ReorderApplyTableBoundary = ( props: { clientId: string; children: ReactNode } ) => {
	const { clientId, children } = props;
	const rowState = useLargeRowReorderApplyState();
	const columnState = useLargeColumnReorderApplyState();
	const placeholder = useRef< HTMLDivElement | null >( null );
	const editorDocument = useRef< Document | null >( null );

	const rowIsTarget = rowState.phase !== 'idle' && rowState.move.tableIdentity === clientId;
	const columnIsTarget =
		columnState.phase !== 'idle' && columnState.move.tableIdentity === clientId;
	const activeDirection = rowIsTarget ? 'row' : columnIsTarget ? 'column' : null;
	const activeState = activeDirection === 'row' ? rowState : activeDirection === 'column' ? columnState : null;
	const shouldApply = activeState?.phase === 'applying';

	useEffect( () => {
		if ( ! shouldApply || ! activeDirection ) {
			return;
		}

		editorDocument.current = placeholder.current?.ownerDocument ?? null;
		const editorWindow = editorDocument.current?.defaultView ?? null;
		const apply = activeDirection === 'row' ? applyLargeRowReorder : applyLargeColumnReorder;
		if ( ! editorWindow ) {
			apply();
			return;
		}

		let secondFrame = 0;
		const firstFrame = editorWindow.requestAnimationFrame( () => {
			secondFrame = editorWindow.requestAnimationFrame( apply );
		} );
		return () => {
			editorWindow.cancelAnimationFrame( firstFrame );
			if ( secondFrame !== 0 ) {
				editorWindow.cancelAnimationFrame( secondFrame );
			}
		};
	}, [ activeDirection, shouldApply ] );

	useEffect( () => {
		if ( ! activeState || activeState.phase !== 'remounting' || ! activeDirection ) {
			return;
		}

		if ( activeState.applied && editorDocument.current ) {
			if ( activeDirection === 'row' ) {
				const insertionIndex =
					activeState.move.destinationBoundaryIndex > activeState.move.sourceRowIndex
						? activeState.move.destinationBoundaryIndex - 1
						: activeState.move.destinationBoundaryIndex;
				focusMovedRow( editorDocument.current, clientId, insertionIndex );
			} else {
				const insertionIndex =
					activeState.move.destinationBoundaryIndex > activeState.move.sourceColumnIndex
						? activeState.move.destinationBoundaryIndex - 1
						: activeState.move.destinationBoundaryIndex;
				focusMovedColumn( editorDocument.current, clientId, insertionIndex );
			}
		}

		const editorWindow = editorDocument.current?.defaultView ?? null;
		const complete =
			activeDirection === 'row' ? completeLargeRowReorderApply : completeLargeColumnReorderApply;
		if ( ! editorWindow ) {
			complete();
			return;
		}

		let secondFrame = 0;
		const firstFrame = editorWindow.requestAnimationFrame( () => {
			secondFrame = editorWindow.requestAnimationFrame( complete );
		} );
		return () => {
			editorWindow.cancelAnimationFrame( firstFrame );
			if ( secondFrame !== 0 ) {
				editorWindow.cancelAnimationFrame( secondFrame );
			}
		};
	}, [ activeDirection, activeState, clientId ] );

	if ( shouldApply ) {
		return (
			<div ref={ placeholder } role="status">
				{ getLargeReorderApplyingMessage() }
			</div>
		);
	}

	const confirming = activeState?.phase === 'confirming';
	const remounting = activeState?.phase === 'remounting';
	const confirm = activeDirection === 'row' ? confirmLargeRowReorderApply : confirmLargeColumnReorderApply;
	const cancel = activeDirection === 'row' ? cancelLargeRowReorderApply : cancelLargeColumnReorderApply;

	return (
		<>
			{ children }
			{ remounting && <div role="status">{ getLargeReorderApplyingMessage() }</div> }
			{ confirming && activeDirection && (
				<Modal title={ getLargeReorderApplyConfirmTitle() } onRequestClose={ cancel }>
					<p>{ getLargeReorderApplyConfirmBody() }</p>
					<Button variant="primary" onClick={ confirm }>
						{ getLargeReorderContinueLabel() }
					</Button>
					<Button variant="tertiary" onClick={ cancel }>
						{ getLargeReorderCancelLabel() }
					</Button>
				</Modal>
			) }
		</>
	);
};
