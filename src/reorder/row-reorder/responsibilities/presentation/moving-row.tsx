/**
 * Row Reorderの移動対象行を、実Tableの配置を変えない独立した移動表示として描画する。
 *
 * Row DnDの意味上のLifecycleはDnD InteractionのReact境界から受け取り、表示に必要な移動対象DOMと物理位置だけをDnD Engineから直接利用する。
 * 移動表示は「どの行を掴み、現在どこへ動かしているか」を認識するための必要十分な表示に限定し、元Tableの可視範囲や計算済み背景色は再現しない。
 * 元行は実DOM上の位置と大きさを維持したままoutlineで識別し、移動表示はPortal内で現在のドラッグ位置へ縦横とも追従する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { useRowDndPhase } from '@/reorder/row-reorder/integration/dnd-interaction-react';

import './moving-row.scss';

const SOURCE_ROW_CLASS = 'yamabiko-table-reorder-moving-row-source';
const DRAGGING_CLASS = 'yamabiko-table-reorder-row-dragging';

/** Row DnD開始時に確定し、そのDnD中の移動表示で維持する配置情報。 */
type RowMovingDisplayLayout = {
	sourceRow: HTMLTableRowElement;
	sourceTableClasses: string;
	rowHeight: number;
	rowWidth: number;
	cellWidths: number[];
	initialPositionX: number;
	initialPositionY: number;
	initialLeft: number;
	initialTop: number;
	editorDocument: Document;
};

/** activeな物理DnDに対応する移動表示の配置と現在位置。 */
type RowMovingDisplayState = {
	layout: RowMovingDisplayLayout;
	position: {
		left: number;
		top: number;
	};
};

/**
 * 移動対象行から、そのDnD中に維持する移動表示の配置を解決する。
 *
 * @param sourceElement    DnD Engineが現在の移動対象として管理するDOM要素。
 * @param initialPositionX DnD Engineが示すDnD開始時の横位置。
 * @param initialPositionY DnD Engineが示すDnD開始時の縦位置。
 * @return 移動表示に必要な配置情報。表示を成立させられない場合はnull。
 */
const resolveMovingDisplayLayout = (
	sourceElement: Element | undefined,
	initialPositionX: number,
	initialPositionY: number
): RowMovingDisplayLayout | null => {
	/* Row Reorderの移動対象としてtbody直下行を確認できない場合は、移動表示を成立させない。 */
	if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
		return null;
	}

	const sourceRow = sourceElement as HTMLTableRowElement;
	const tableBody = sourceRow.parentElement;
	const sourceTable = sourceRow.closest( 'table' ) as HTMLTableElement | null;

	/* 移動対象行が対象Tableのtbody直下に属さない場合は、Row Reorderの移動表示対象として扱わない。 */
	if ( ! tableBody || tableBody.tagName !== 'TBODY' || sourceTable === null ) {
		return null;
	}

	const editorContext = resolveEditorDomContext( sourceRow );

	/* 現在のeditor contextを解決できない場合は、別の表示環境を代用して描画しない。 */
	if ( editorContext === null ) {
		return null;
	}

	const rowRectangle = sourceRow.getBoundingClientRect();

	/* 元行の表示寸法を確定できない場合は、識別可能な移動表示を成立させられない。 */
	if ( rowRectangle.width <= 0 || rowRectangle.height <= 0 ) {
		return null;
	}

	/* 内容量や空セルに左右されず元行の列配置を維持できるよう、DnD開始時の各セル幅を確定する。 */
	const cellWidths = Array.from( sourceRow.cells, ( cell ) => cell.getBoundingClientRect().width );

	return {
		sourceRow,
		sourceTableClasses: sourceTable.className,
		rowHeight: rowRectangle.height,
		rowWidth: rowRectangle.width,
		cellWidths,
		initialPositionX,
		initialPositionY,
		initialLeft: rowRectangle.left,
		initialTop: rowRectangle.top,
		editorDocument: editorContext.document,
	};
};

/**
 * 複製した移動表示から、元行との同時存在を許可できないDOM識別子を除去する。
 *
 * @param row 移動表示として複製した行。
 */
const removeDuplicatedIds = ( row: HTMLTableRowElement ): void => {
	row.removeAttribute( 'id' );

	/* 元行と移動表示が同時に存在しても、子要素のDOM識別子が重複しない状態にする。 */
	row.querySelectorAll( '[id]' ).forEach( ( element ) => {
		element.removeAttribute( 'id' );
	} );
};

/**
 * 元行の現在表示を基準に、セル幅と行高を維持した移動表示用の行を構成する。
 *
 * @param layout    DnD開始時に確定した元行の表示配置。
 * @param tableBody 移動表示を描画するtbody。
 */
const renderMovingRow = (
	layout: RowMovingDisplayLayout,
	tableBody: HTMLTableSectionElement
): void => {
	const clonedRow = layout.sourceRow.cloneNode( true ) as HTMLTableRowElement;
	removeDuplicatedIds( clonedRow );

	/* 元行だけに適用する識別表示を複製側へ持ち込まず、移動表示は独立したoutlineで区別する。 */
	clonedRow.classList.remove( SOURCE_ROW_CLASS );
	clonedRow.style.height = `${ layout.rowHeight }px`;

	/* 空セルを含む場合もDnD開始時のセル配置を維持し、内容量による大きな形崩れを防ぐ。 */
	Array.from( clonedRow.cells ).forEach( ( cell, index ) => {
		const width = layout.cellWidths[ index ];
		if ( width === undefined ) {
			return;
		}

		cell.style.boxSizing = 'border-box';
		cell.style.width = `${ width }px`;
		cell.style.minWidth = `${ width }px`;
		cell.style.maxWidth = `${ width }px`;
	} );

	tableBody.replaceChildren( clonedRow );
};

/**
 * DnD開始時に確定した行表示を、現在のドラッグ位置へ縦横とも追従する独立した移動表示として描画する。
 * 移動表示は視覚的な補助だけを担い、複製した編集可能要素を含めて入力・フォーカス対象にしない。
 *
 * @param props          移動表示に必要な配置と現在位置。
 * @param props.layout   DnD開始時に確定した元行の配置情報。
 * @param props.position 現在の移動表示位置。
 * @return 現在のeditor contextへ描画する移動対象行表示。
 */
const RowMovingOverlay = ( props: {
	layout: RowMovingDisplayLayout;
	position: RowMovingDisplayState[ 'position' ];
} ) => {
	const { layout, position } = props;
	const tableBodyRef = useRef< HTMLTableSectionElement | null >( null );

	useEffect( () => {
		const tableBody = tableBodyRef.current;

		/* 描画先がまだ成立していない段階では、移動対象行の複製を行わない。 */
		if ( tableBody === null ) {
			return;
		}

		renderMovingRow( layout, tableBody );
	}, [ layout ] );

	const frameStyle: CSSProperties = {
		top: position.top,
		left: position.left,
		width: layout.rowWidth,
		height: layout.rowHeight,
	};
	const tableStyle: CSSProperties = {
		width: layout.rowWidth,
	};
	const movingTableClasses =
		`${ layout.sourceTableClasses } yamabiko-table-reorder-moving-row-table`.trim();

	return createPortal(
		<div
			ref={ ( element ) => element?.setAttribute( 'inert', '' ) }
			aria-hidden="true"
			className="editor-styles-wrapper yamabiko-table-reorder-moving-row"
			style={ frameStyle }
		>
			<table className={ movingTableClasses } style={ tableStyle } aria-hidden="true">
				<tbody ref={ tableBodyRef } />
			</table>
		</div>,
		layout.editorDocument.body
	);
};

/**
 * Row DnDの意味上のLifecycleとDnD Engineの物理情報を組み合わせ、移動対象行の表示だけを管理する。
 *
 * DnD Interactionからはactive / idleだけを受け取り、物理座標やDOM参照をSessionへ複製しない。
 * 元行はactive Session中も実Tableに残し、レイアウトを変えないoutlineだけで移動元として区別する。
 * 移動表示はDnD Engineの物理移動へ縦横とも追従するが、行の移動先判定には関与しない。
 *
 * @return activeなRow DnD中は移動対象行表示。それ以外はnull。
 */
export const RowMovingDisplay = () => {
	const phase = useRowDndPhase();
	const sessionBecameActive = useRef( false );
	const [ movingRow, setMovingRow ] = useState< RowMovingDisplayState | null >( null );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			const dragPosition = event.operation.position;
			const initialPositionX = dragPosition.initial.x ?? 0;
			const layout = resolveMovingDisplayLayout(
				event.operation.source?.element,
				initialPositionX,
				dragPosition.initial.y
			);

			const nextMovingRow =
				layout === null
					? null
					: {
							layout,
							position: {
								left: layout.initialLeft,
								top: layout.initialTop,
							},
					  };
			setMovingRow( nextMovingRow );
		},
		onDragMove: ( event ) => {
			setMovingRow( ( currentMovingRow ) => {
				/* DnD開始時に移動表示が成立していない場合は、物理移動だけで途中から表示を開始しない。 */
				if ( currentMovingRow === null ) {
					return null;
				}

				const { layout } = currentMovingRow;
				const currentPosition = event.operation.position.current;
				const currentPositionX = currentPosition.x ?? layout.initialPositionX;
				const horizontalMovement = currentPositionX - layout.initialPositionX;
				const verticalMovement = currentPosition.y - layout.initialPositionY;

				return {
					layout,
					position: {
						left: layout.initialLeft + horizontalMovement,
						top: layout.initialTop + verticalMovement,
					},
				};
			} );
		},
	} );

	useEffect( () => {
		/* 物理DnD開始直後のidleはSession開始前の一時状態であり、一度activeになったSessionがidleへ戻った場合だけ終了として扱う。 */
		if ( phase === 'idle' ) {
			if ( sessionBecameActive.current ) {
				sessionBecameActive.current = false;
				setMovingRow( null );
			}
			return;
		}

		sessionBecameActive.current = true;
	}, [ phase ] );

	const activeLayout = movingRow?.layout ?? null;

	useEffect( () => {
		/* Row DnD Sessionと移動表示の両方が成立している期間だけ、移動元と掴んでいるポインター状態を表示する。 */
		if ( phase !== 'active' || activeLayout === null ) {
			return;
		}

		activeLayout.sourceRow.classList.add( SOURCE_ROW_CLASS );
		activeLayout.editorDocument.body.classList.add( DRAGGING_CLASS );
		return () => {
			activeLayout.sourceRow.classList.remove( SOURCE_ROW_CLASS );
			activeLayout.editorDocument.body.classList.remove( DRAGGING_CLASS );
		};
	}, [ phase, activeLayout ] );

	const visible = phase === 'active' && movingRow !== null;

	/* 意味上のRow DnD Sessionまたは移動表示のどちらかが成立しない間は、利用者向け表示を出さない。 */
	if ( ! visible ) {
		return null;
	}

	return <RowMovingOverlay layout={ movingRow.layout } position={ movingRow.position } />;
};
