/**
 * Row Reorderの移動対象行を、実Tableの配置を変えない独立した移動表示として描画する。
 *
 * Row DnDの意味上のLifecycleはDnD InteractionのReact境界から受け取り、表示に必要な移動対象DOMと物理位置だけをDnD Engineから直接利用する。
 * 移動表示は縦方向だけ現在位置へ追従し、横方向は対象Tableと現在のeditor表示領域が重なる範囲へ制限する。
 * 元行は実DOM上の位置と大きさを維持したまま半透明で残し、移動表示側の独立した視覚表現によって現在の移動対象を識別できるようにする。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import { useRowDndPhase } from '../dnd-interaction-react';

import './moving-row.scss';

const SOURCE_ROW_CLASS = 'yamabiko-table-reorder-moving-row-source';

/** Row DnD開始時に確定し、そのDnD中の移動表示で維持する配置情報。 */
type RowMovingDisplayLayout = {
	sourceRow: HTMLTableRowElement;
	sourceTable: HTMLTableElement;
	rowHeight: number;
	tableWidth: number;
	visibleLeft: number;
	visibleWidth: number;
	tableOffsetLeft: number;
	cellWidths: number[];
	initialPositionY: number;
	initialTop: number;
	editorDocument: Document;
};

/**
 * 移動対象行から、そのDnD中に維持する移動表示の配置を解決する。
 *
 * @param sourceElement    DnD Engineが現在の移動対象として管理するDOM要素。
 * @param initialPositionY DnD Engineが示すDnD開始時の縦位置。
 * @return 移動表示に必要な配置情報。表示を成立させられない場合はnull。
 */
const resolveMovingDisplayLayout = (
	sourceElement: Element | undefined,
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
	const tableRectangle = sourceTable.getBoundingClientRect();
	const visibleLeft = Math.max( tableRectangle.left, 0 );
	const visibleRight = Math.min( tableRectangle.right, editorContext.window.innerWidth );
	const visibleWidth = visibleRight - visibleLeft;

	/* Tableと現在表示領域が重ならない場合、または元行の表示寸法を確定できない場合はoverlayを描画しない。 */
	if ( visibleWidth <= 0 || tableRectangle.width <= 0 || rowRectangle.height <= 0 ) {
		return null;
	}

	const cellWidths = Array.from( sourceRow.cells, ( cell ) => cell.getBoundingClientRect().width );

	return {
		sourceRow,
		sourceTable,
		rowHeight: rowRectangle.height,
		tableWidth: tableRectangle.width,
		visibleLeft,
		visibleWidth,
		tableOffsetLeft: tableRectangle.left - visibleLeft,
		cellWidths,
		initialPositionY,
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
 * @param layout    DnD開始時に確定した元行とTableの表示配置。
 * @param tableBody 移動表示を描画するtbody。
 */
const renderMovingRow = (
	layout: RowMovingDisplayLayout,
	tableBody: HTMLTableSectionElement
): void => {
	const clonedRow = layout.sourceRow.cloneNode( true ) as HTMLTableRowElement;
	removeDuplicatedIds( clonedRow );

	/* 元行だけに適用する半透明表示をcloneへ持ち込まず、overlayの内容は通常濃度で表示する。 */
	clonedRow.classList.remove( SOURCE_ROW_CLASS );
	clonedRow.style.height = `${ layout.rowHeight }px`;

	/* 空セルを含む場合も元行のセル幅を維持し、内容量による列位置の変化を発生させない。 */
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
 * DnD開始時に確定した行表示を、現在の縦位置へ追従する独立overlayとして描画する。
 *
 * @param props        移動表示に必要な配置と現在位置。
 * @param props.layout DnD開始時に確定した元行とTableの配置情報。
 * @param props.top    現在の移動表示上端位置。
 * @return 現在のeditor contextへ描画する移動対象行overlay。
 */
const RowMovingOverlay = ( props: { layout: RowMovingDisplayLayout; top: number } ) => {
	const { layout, top } = props;
	const tableBodyRef = useRef< HTMLTableSectionElement | null >( null );

	useEffect( () => {
		const tableBody = tableBodyRef.current;
		if ( tableBody === null ) {
			return;
		}

		renderMovingRow( layout, tableBody );
	}, [ layout ] );

	const viewportStyle: CSSProperties = {
		top,
		left: layout.visibleLeft,
		width: layout.visibleWidth,
		height: layout.rowHeight,
	};
	const tableStyle: CSSProperties = {
		left: layout.tableOffsetLeft,
		width: layout.tableWidth,
	};
	const sourceTableClasses = layout.sourceTable.className;
	const movingTableClasses =
		`${ sourceTableClasses } yamabiko-table-reorder-moving-row-table`.trim();

	return createPortal(
		<div aria-hidden="true" className="yamabiko-table-reorder-moving-row" style={ viewportStyle }>
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
 * 元行はactive Session中も実Tableに残し、レイアウトを変えない半透明表示だけで移動元として区別する。
 *
 * @return activeなRow DnD中は移動対象行overlay。それ以外はnull。
 */
export const RowMovingDisplay = () => {
	const phase = useRowDndPhase();
	const activeLayout = useRef< RowMovingDisplayLayout | null >( null );
	const sessionBecameActive = useRef( false );
	const [ layout, setLayout ] = useState< RowMovingDisplayLayout | null >( null );
	const [ top, setTop ] = useState( 0 );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			const position = event.operation.position;
			const nextLayout = resolveMovingDisplayLayout(
				event.operation.source?.element,
				position.initial.y
			);

			activeLayout.current = nextLayout;
			setLayout( nextLayout );

			if ( nextLayout !== null ) {
				setTop( nextLayout.initialTop );
			}
		},
		onDragMove: ( event ) => {
			const currentLayout = activeLayout.current;
			if ( currentLayout === null ) {
				return;
			}

			const currentPositionY = event.operation.position.current.y;
			const verticalMovement = currentPositionY - currentLayout.initialPositionY;
			setTop( currentLayout.initialTop + verticalMovement );
		},
	} );

	useEffect( () => {
		/* 物理DnD開始直後のidleはSession開始前の一時状態であり、一度activeになったSessionがidleへ戻った場合だけ終了として扱う。 */
		if ( phase === 'idle' ) {
			if ( sessionBecameActive.current ) {
				sessionBecameActive.current = false;
				activeLayout.current = null;
				setLayout( null );
			}
			return;
		}

		sessionBecameActive.current = true;
	}, [ phase ] );

	useEffect( () => {
		if ( phase !== 'active' || layout === null ) {
			return;
		}

		layout.sourceRow.classList.add( SOURCE_ROW_CLASS );
		return () => {
			layout.sourceRow.classList.remove( SOURCE_ROW_CLASS );
		};
	}, [ phase, layout ] );

	const visible = phase === 'active' && layout !== null;
	if ( ! visible ) {
		return null;
	}

	return <RowMovingOverlay layout={ layout } top={ top } />;
};
