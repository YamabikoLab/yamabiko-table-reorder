/**
 * Row Reorderの移動対象行を、実Tableの配置を変えない独立した移動表示として描画する。
 *
 * Row DnDの意味上のLifecycleはDnD InteractionのReact境界から受け取り、表示に必要な移動対象DOMと物理位置だけをDnD Engineから直接利用する。
 * 移動表示は現在の挿入位置を基準に移動方向の後ろ側へ配置し、挿入位置周辺を隠さない。横方向は対象Tableと現在のeditor表示領域が重なる範囲へ制限する。
 * 元行は実DOM上の位置と大きさを維持したまま半透明で残し、独立した移動表示によって現在の移動対象を識別できるようにする。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import {
	useRowDndDestinationBoundaryIndex,
	useRowDndPhase,
} from '@/reorder/row-reorder/dnd-interaction-react';

import './moving-row.scss';

const SOURCE_ROW_CLASS = 'yamabiko-table-reorder-moving-row-source';

/** 移動表示と挿入線の間に確保する距離。 */
const MOVING_DISPLAY_GAP = 2;

type RowMovingDirection = 'up' | 'down';

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
	initialTop: number;
	editorDocument: Document;
	editorWindow: Window;
};

/**
 * 移動対象行から、そのDnD中に維持する移動表示の配置を解決する。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 移動表示に必要な配置情報。表示を成立させられない場合はnull。
 */
const resolveMovingDisplayLayout = (
	sourceElement: Element | undefined
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

	/* Tableと現在表示領域が重ならない場合、または元行の表示寸法を確定できない場合は移動表示を成立させない。 */
	if ( visibleWidth <= 0 || tableRectangle.width <= 0 || rowRectangle.height <= 0 ) {
		return null;
	}

	/* 内容量に左右されず元行の列配置を維持できるよう、DnD開始時の各セル幅を確定する。 */
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
		initialTop: rowRectangle.top,
		editorDocument: editorContext.document,
		editorWindow: editorContext.window,
	};
};

/**
 * 現在の有効な移動先境界から、移動表示が基準にする挿入位置を解決する。
 *
 * @param layout                   DnD開始時に確定した元行とTableの表示配置。
 * @param destinationBoundaryIndex DnD Interactionが有効と判定した0-based移動先境界。
 * @return 現在の行境界の画面上の縦位置。解決できない場合はnull。
 */
const resolveDestinationBoundaryTop = (
	layout: RowMovingDisplayLayout,
	destinationBoundaryIndex: number
): number | null => {
	const tableBody = layout.sourceRow.parentElement;

	/* DnD開始後に対象行とtbodyの関係を確認できなくなった場合は、現在位置を推測しない。 */
	if ( ! tableBody || tableBody.tagName !== 'TBODY' ) {
		return null;
	}

	const rows = ( tableBody as HTMLTableSectionElement ).rows;
	const rowCount = rows.length;

	/* DnD Interactionが扱う行境界の範囲外は、表示側で補正しない。 */
	if ( destinationBoundaryIndex < 0 || destinationBoundaryIndex > rowCount || rowCount === 0 ) {
		return null;
	}

	const boundaryRow = rows.item( destinationBoundaryIndex );
	const boundaryTop =
		boundaryRow !== null
			? boundaryRow.getBoundingClientRect().top
			: rows.item( rowCount - 1 )?.getBoundingClientRect().bottom;

	const resolvedTop = boundaryTop ?? null;
	return resolvedTop;
};

/**
 * 現在の挿入位置と移動方向から、移動表示を挿入線の反対側かつeditor表示領域内へ配置する。
 *
 * @param layout                   DnD開始時に確定した元行とTableの表示配置。
 * @param destinationBoundaryIndex DnD Interactionが有効と判定した0-based移動先境界。
 * @param direction                現在の縦方向の移動方向。
 * @return 移動表示の画面上端位置。挿入位置を解決できない場合はnull。
 */
const resolveMovingDisplayTop = (
	layout: RowMovingDisplayLayout,
	destinationBoundaryIndex: number,
	direction: RowMovingDirection
): number | null => {
	const boundaryTop = resolveDestinationBoundaryTop( layout, destinationBoundaryIndex );

	if ( boundaryTop === null ) {
		return null;
	}

	const desiredTop =
		direction === 'down'
			? boundaryTop - layout.rowHeight - MOVING_DISPLAY_GAP
			: boundaryTop + MOVING_DISPLAY_GAP;
	const maximumTop = Math.max( layout.editorWindow.innerHeight - layout.rowHeight, 0 );
	const boundedTop = Math.min( Math.max( desiredTop, 0 ), maximumTop );

	return boundedTop;
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

	/* 元行だけに適用する半透明表示を複製側へ持ち込まず、移動表示の内容は通常濃度で表示する。 */
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
 * DnD開始時に確定した行表示を、現在の挿入位置に沿う独立した移動表示として描画する。
 * 移動表示は視覚的な補助だけを担い、複製した編集可能要素を含めて入力・フォーカス対象にしない。
 *
 * @param props        移動表示に必要な配置と現在位置。
 * @param props.layout DnD開始時に確定した元行とTableの配置情報。
 * @param props.top    現在の移動表示上端位置。
 * @return 現在のeditor contextへ描画する移動対象行表示。
 */
const RowMovingOverlay = ( props: { layout: RowMovingDisplayLayout; top: number } ) => {
	const { layout, top } = props;
	const tableBodyRef = useRef< HTMLTableSectionElement | null >( null );

	useEffect( () => {
		const tableBody = tableBodyRef.current;

		/* 描画先がまだ成立していない段階では、移動対象行の複製を行わない。 */
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
		<div
			ref={ ( element ) => element?.setAttribute( 'inert', '' ) }
			aria-hidden="true"
			className="editor-styles-wrapper yamabiko-table-reorder-moving-row"
			style={ viewportStyle }
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
 * DnD Interactionからはactive / idleと現在の有効な移動先境界を受け取り、DnD Engineからは移動方向と再計測のきっかけだけを利用する。
 * 元行はactive Session中も実Tableに残し、レイアウトを変えない半透明表示だけで移動元として区別する。
 *
 * @return activeなRow DnD中は移動対象行表示。それ以外はnull。
 */
export const RowMovingDisplay = () => {
	const phase = useRowDndPhase();
	const destinationBoundaryIndex = useRowDndDestinationBoundaryIndex();
	const activeLayout = useRef< RowMovingDisplayLayout | null >( null );
	const initialPositionY = useRef< number | null >( null );
	const sessionBecameActive = useRef( false );
	const [ layout, setLayout ] = useState< RowMovingDisplayLayout | null >( null );
	const [ direction, setDirection ] = useState< RowMovingDirection | null >( null );
	const [ measurementRevision, setMeasurementRevision ] = useState( 0 );
	const [ top, setTop ] = useState( 0 );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			const position = event.operation.position;
			const nextLayout = resolveMovingDisplayLayout( event.operation.source?.element );

			activeLayout.current = nextLayout;
			initialPositionY.current = position.initial.y;
			setLayout( nextLayout );
			setDirection( null );
			setMeasurementRevision( 0 );

			/* 表示を成立させられる場合だけ、移動開始位置を元行の表示位置へ合わせる。 */
			if ( nextLayout !== null ) {
				setTop( nextLayout.initialTop );
			}
		},
		onDragMove: ( event ) => {
			const currentLayout = activeLayout.current;
			const startY = initialPositionY.current;

			/* DnD開始時に移動表示が成立していない場合は、物理移動だけで途中から表示を開始しない。 */
			if ( currentLayout === null || startY === null ) {
				return;
			}

			const currentPositionY = event.operation.position.current.y;

			/* 開始位置から上下どちらへ進んでいるかが確定した場合だけ、挿入線に対する表示側を切り替える。 */
			if ( currentPositionY !== startY ) {
				const nextDirection: RowMovingDirection = currentPositionY > startY ? 'down' : 'up';
				setDirection( nextDirection );
			}

			/* 同じ移動先境界でもスクロールで画面上の位置が変わるため、物理移動のたびに現在の行境界を再計測する。 */
			setMeasurementRevision( ( current ) => current + 1 );
		},
	} );

	useEffect( () => {
		/* 有効な挿入位置または移動方向がまだ確定していない間は、開始時の表示位置を維持する。 */
		if ( layout === null || destinationBoundaryIndex === null || direction === null ) {
			return;
		}

		const nextTop = resolveMovingDisplayTop( layout, destinationBoundaryIndex, direction );

		/* 現在の挿入位置を解決できない場合は、直前に成立していた表示位置を維持する。 */
		if ( nextTop === null ) {
			return;
		}

		setTop( nextTop );
	}, [ destinationBoundaryIndex, direction, layout, measurementRevision ] );

	useEffect( () => {
		/* 物理DnD開始直後のidleはSession開始前の一時状態であり、一度activeになったSessionがidleへ戻った場合だけ終了として扱う。 */
		if ( phase === 'idle' ) {
			if ( sessionBecameActive.current ) {
				sessionBecameActive.current = false;
				activeLayout.current = null;
				initialPositionY.current = null;
				setLayout( null );
				setDirection( null );
			}
			return;
		}

		sessionBecameActive.current = true;
	}, [ phase ] );

	useEffect( () => {
		/* Row DnD Sessionと移動表示の両方が成立している期間だけ、元行を移動元として識別する。 */
		if ( phase !== 'active' || layout === null ) {
			return;
		}

		layout.sourceRow.classList.add( SOURCE_ROW_CLASS );
		return () => {
			layout.sourceRow.classList.remove( SOURCE_ROW_CLASS );
		};
	}, [ phase, layout ] );

	const visible = phase === 'active' && layout !== null;

	/* 意味上のRow DnD Sessionまたは表示配置のどちらかが成立しない間は、利用者向け移動表示を出さない。 */
	if ( ! visible ) {
		return null;
	}

	return <RowMovingOverlay layout={ layout } top={ top } />;
};
