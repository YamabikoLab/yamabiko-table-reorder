/**
 * Column Reorderの現在の有効な移動先に、移動対象列と同じ幅の1つの挿入空間を独立表示として描画する。
 *
 * 周囲列の押しのけによって生じる見かけ上の空間から位置を推測せず、DnD開始時の論理列境界と移動対象列幅を基準にする。
 * 移動対象列の横罫線はDnD開始時に現在見えている実セル境界から固定し、縦結合セル内部へ存在しない境界を生成しない。
 * 移動方向はDnD Interactionが所有する移動元論理列と現在の有効移動先から判断し、スクロール中はTable自体の現在位置だけへ追従する。
 * 大規模TableではTable全高を覆わず、現在のeditor表示領域と重なる範囲だけを描画する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import {
	useColumnDndDestinationBoundaryIndex,
	useColumnDndSourceColumnIndex,
} from '@/reorder/column-reorder/integration/dnd-interaction-react';
import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
	type ColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import './insertion-gap.scss';

const VIEWPORT_SCAN_STEP = 8;

/**
 * 1回のColumn DnD開始時に確定し、そのDnD中の挿入空間表示で維持する論理配置。
 *
 * 論理列境界、移動対象列幅、開始時に見えている移動対象列のセル境界は開始時配置として固定し、DnD中は再計測しない。
 * 対象Tableの参照はスクロール後の現在位置を取得するためだけに保持する。
 */
type ColumnInsertionGapSessionLayout = {
	sourceTable: HTMLTableElement;
	sourceColumnWidth: number;
	boundaryOffsets: ReadonlyMap< number, number >;
	cellBoundaryOffsets: readonly number[];
	inlineDirection: ColumnInlineDirection;
	editorDocument: Document;
	editorWindow: Window;
};

/**
 * 現在のeditor表示領域へ描画する挿入空間配置。
 *
 * DnD開始時に固定した境界を現在のTable位置へ変換し、viewportと重なる範囲だけを保持する。
 */
type ColumnInsertionGapLayout = {
	top: number;
	left: number;
	width: number;
	height: number;
	cellBoundaryOffsets: readonly number[];
	tableOffsetTop: number;
	editorDocument: Document;
};

/**
 * 指定位置に現在描画されている対象Tableのセルを取得する。
 *
 * @param editorDocument 現在のeditor contextに対応するdocument。
 * @param table          Column Reorder対象Table。
 * @param x              移動対象列内の横位置。
 * @param y              editor表示領域内の縦位置。
 * @return 指定位置にある対象Tableのセル。対象外の場合はnull。
 */
const resolveTableCellAtPoint = (
	editorDocument: Document,
	table: HTMLTableElement,
	x: number,
	y: number
): HTMLTableCellElement | null => {
	const element = editorDocument.elementFromPoint?.( x, y ) ?? null;
	const cell = element?.closest( 'th, td' ) as HTMLTableCellElement | null;
	const sourceCell = cell?.closest( 'table' ) === table ? cell : null;
	return sourceCell;
};

/**
 * DnD開始時に現在見えている移動対象列セルから、挿入空間へ残す内部横罫線を確定する。
 *
 * 縦結合セル内部へ人工的な境界を生成せず、画面上で実際に移動対象列を構成しているセルの上下端だけを採用する。
 * 取得したviewport部分の先頭・末尾はTable内部境界なら保持し、Table全体の上端・下端だけを外周として除外する。
 *
 * @param table          Column Reorder対象Table。
 * @param sourceCell     DnD Engineが移動対象として管理する開始セル。
 * @param sourceX        DnD開始時に利用者が指した移動対象列内の横位置。
 * @param editorDocument 現在のeditor contextに対応するdocument。
 * @param editorWindow   現在のeditor contextに対応するwindow。
 * @return DnD開始時に現在見えているTable内部横罫線のTable相対offset。
 */
const collectVisibleCellBoundaryOffsets = (
	table: HTMLTableElement,
	sourceCell: HTMLTableCellElement,
	sourceX: number,
	editorDocument: Document,
	editorWindow: Window
): readonly number[] => {
	const tableRectangle = table.getBoundingClientRect();
	const visibleTop = Math.max( tableRectangle.top, 0 );
	const visibleBottom = Math.min( tableRectangle.bottom, editorWindow.innerHeight );
	const visibleCells = new Set< HTMLTableCellElement >();
	let y = visibleTop + 0.5;

	/* Table行数ではなく現在の表示領域を基準に、移動対象列で実際に見えているセル境界だけを収集する。 */
	while ( y < visibleBottom ) {
		const cell = resolveTableCellAtPoint( editorDocument, table, sourceX, y );
		if ( cell === null ) {
			y += VIEWPORT_SCAN_STEP;
			continue;
		}

		const rectangle = cell.getBoundingClientRect();
		if ( rectangle.bottom > visibleTop && rectangle.top < visibleBottom ) {
			visibleCells.add( cell );
		}
		y = rectangle.bottom > y ? rectangle.bottom + 0.5 : y + VIEWPORT_SCAN_STEP;
	}

	/* 表示領域端の判定差があっても、実際のDnD開始セルが見えている場合はその境界を失わない。 */
	const sourceRectangle = sourceCell.getBoundingClientRect();
	if ( sourceRectangle.bottom > visibleTop && sourceRectangle.top < visibleBottom ) {
		visibleCells.add( sourceCell );
	}

	const tableHeight = tableRectangle.height;
	const boundaryOffsets = new Set< number >();
	/* 実セルの上下端からTable内部境界だけを確定し、隣接セルが共有する同一境界は1本へまとめる。 */
	visibleCells.forEach( ( cell ) => {
		const rectangle = cell.getBoundingClientRect();
		const topOffset = rectangle.top - tableRectangle.top;
		const bottomOffset = rectangle.bottom - tableRectangle.top;
		if ( topOffset > 0 && topOffset < tableHeight ) {
			boundaryOffsets.add( topOffset );
		}
		if ( bottomOffset > 0 && bottomOffset < tableHeight ) {
			boundaryOffsets.add( bottomOffset );
		}
	} );

	return [ ...boundaryOffsets ].sort( ( first, second ) => first - second );
};

/**
 * DnD開始時の移動対象DOMから、そのDnD中の挿入空間表示で維持する論理配置を確定する。
 *
 * 移動元論理列はDOMから解決せず、DnD Interactionが所有する`sourceColumnIndex`を表示時の正本とする。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @param initialX      DnD開始時の物理横位置。取得できない場合は開始セル中央を使用する。
 * @return 挿入空間の基準となる開始時配置。Column Reorder対象として安全に確定できない場合はnull。
 */
const resolveInsertionGapSessionLayout = (
	sourceElement: Element | undefined,
	initialX: number | null
): ColumnInsertionGapSessionLayout | null => {
	if ( ! sourceElement ) {
		return null;
	}
	const sourceCell = sourceElement.closest( 'th, td' ) as HTMLTableCellElement | null;
	const sourceTable = sourceCell?.closest( 'table' ) as HTMLTableElement | null;
	/* Column Reorderの移動対象セルと対象Tableを確認できない場合は、別DOMから開始時配置を推測しない。 */
	if ( sourceCell === null || sourceTable === null ) {
		return null;
	}
	const editorContext = resolveEditorDomContext( sourceCell );
	/* 現在のeditor contextを解決できない場合は、別の表示環境を代用して描画しない。 */
	if ( editorContext === null ) {
		return null;
	}
	const sourceRectangle = sourceCell.getBoundingClientRect();
	const sourceColumnWidth = sourceRectangle.width;
	const boundaryGeometry = measureTableColumnBoundaryGeometry( sourceTable );
	/* 移動対象1列分の幅と論理列境界を開始時に確定できない状態では挿入空間を成立させない。 */
	if ( sourceColumnWidth <= 0 || boundaryGeometry.length === 0 ) {
		return null;
	}
	const boundaryOffsets = new Map(
		boundaryGeometry.map( ( boundary ) => [ boundary.index, boundary.offset ] )
	);
	const sourceX = initialX ?? sourceRectangle.left + sourceRectangle.width / 2;
	const cellBoundaryOffsets = collectVisibleCellBoundaryOffsets(
		sourceTable,
		sourceCell,
		sourceX,
		editorContext.document,
		editorContext.window
	);
	return {
		sourceTable,
		sourceColumnWidth,
		boundaryOffsets,
		cellBoundaryOffsets,
		inlineDirection: resolveTableColumnInlineDirection( sourceTable ),
		editorDocument: editorContext.document,
		editorWindow: editorContext.window,
	};
};

/**
 * DnD開始時の論理境界から、現在描画できる挿入空間の位置を解決する。
 *
 * DnD開始時に固定したTable相対の横罫線を現在のTable位置とviewport clipへ変換するため、Table上端offsetも返す。
 *
 * @param sessionLayout            DnD開始時に確定した論理配置。
 * @param sourceColumnIndex        DnD Interactionが所有する移動元論理列位置。
 * @param destinationBoundaryIndex DnD Interactionが有効とした移動先境界。
 * @return 現在描画できる挿入空間。表示不要または描画不能の場合はnull。
 */
const resolveInsertionGapLayout = (
	sessionLayout: ColumnInsertionGapSessionLayout,
	sourceColumnIndex: number | null,
	destinationBoundaryIndex: number | null
): ColumnInsertionGapLayout | null => {
	if ( sourceColumnIndex === null || destinationBoundaryIndex === null ) {
		return null;
	}
	const destinationBoundaryOffset = sessionLayout.boundaryOffsets.get( destinationBoundaryIndex );
	if ( destinationBoundaryOffset === undefined ) {
		return null;
	}
	let logicalGapStartOffset = destinationBoundaryOffset;
	if ( destinationBoundaryIndex > sourceColumnIndex ) {
		logicalGapStartOffset -= sessionLayout.sourceColumnWidth;
	}
	const tableRectangle = sessionLayout.sourceTable.getBoundingClientRect();
	let left = tableRectangle.left + logicalGapStartOffset;
	if ( sessionLayout.inlineDirection === 'rtl' ) {
		left = tableRectangle.right - logicalGapStartOffset - sessionLayout.sourceColumnWidth;
	}
	const top = Math.max( tableRectangle.top, 0 );
	const bottom = Math.min( tableRectangle.bottom, sessionLayout.editorWindow.innerHeight );
	const height = bottom - top;
	const right = left + sessionLayout.sourceColumnWidth;
	/* 現在のTableとeditor表示領域が重ならない場合は、画面外の挿入空間を生成しない。 */
	if ( height <= 0 || right <= 0 || left >= sessionLayout.editorWindow.innerWidth ) {
		return null;
	}
	return {
		top,
		left,
		width: sessionLayout.sourceColumnWidth,
		height,
		cellBoundaryOffsets: sessionLayout.cellBoundaryOffsets,
		tableOffsetTop: tableRectangle.top - top,
		editorDocument: sessionLayout.editorDocument,
	};
};

/**
 * DnD Interactionが示す現在の有効な移動先へ、移動対象1列分の独立した挿入空間を描画する。
 *
 * DnD開始時に現在見えている実セル境界を固定し、スクロール後は取得済み境界の現在位置だけへ追従する。
 * DnD開始後に新しくviewportへ入った行の境界は追加取得しない。
 *
 * @return 現在の有効な移動先を覆う1列分の挿入空間。表示条件が成立しない場合はnull。
 */
export const ColumnInsertionGap = () => {
	const sourceColumnIndex = useColumnDndSourceColumnIndex();
	const destinationBoundaryIndex = useColumnDndDestinationBoundaryIndex();
	const [ sessionLayout, setSessionLayout ] = useState< ColumnInsertionGapSessionLayout | null >( null );
	const [ measurementRevision, setMeasurementRevision ] = useState( 0 );
	const [ layout, setLayout ] = useState< ColumnInsertionGapLayout | null >( null );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			const initialX = event.operation.position?.initial.x ?? null;
			setSessionLayout( resolveInsertionGapSessionLayout( event.operation.source?.element, initialX ) );
		},
		onDragMove: () => {
			/* 同じ移動先境界でもスクロールでTableの画面位置が変わるため、現在位置を再計測する。 */
			setMeasurementRevision( ( current ) => current + 1 );
		},
		onDragEnd: () => {
			setSessionLayout( null );
			setLayout( null );
		},
	} );

	useEffect( () => {
		if ( sessionLayout === null ) {
			return;
		}
		let animationFrameId: number | null = null;
		/** Auto Scrollなど入力位置の更新を伴わないスクロールでも、固定した論理配置を現在のTable位置へ再変換する。 */
		const requestScrollMeasurement = (): void => {
			if ( animationFrameId !== null ) {
				return;
			}
			animationFrameId = sessionLayout.editorWindow.requestAnimationFrame( () => {
				animationFrameId = null;
				setMeasurementRevision( ( current ) => current + 1 );
			} );
		};
		sessionLayout.editorDocument.addEventListener( 'scroll', requestScrollMeasurement, true );
		return () => {
			sessionLayout.editorDocument.removeEventListener( 'scroll', requestScrollMeasurement, true );
			if ( animationFrameId !== null ) {
				sessionLayout.editorWindow.cancelAnimationFrame( animationFrameId );
			}
		};
	}, [ sessionLayout ] );

	useEffect( () => {
		if ( sessionLayout === null ) {
			setLayout( null );
			return;
		}
		setLayout( resolveInsertionGapLayout( sessionLayout, sourceColumnIndex, destinationBoundaryIndex ) );
	}, [ destinationBoundaryIndex, measurementRevision, sessionLayout, sourceColumnIndex ] );

	if ( layout === null ) {
		return null;
	}
	const style: CSSProperties = {
		top: layout.top,
		left: layout.left,
		width: layout.width,
		height: layout.height,
	};
	return createPortal(
		<div aria-hidden="true" className="yamabiko-table-reorder-column-insertion-gap" style={ style }>
			{ layout.cellBoundaryOffsets.map( ( boundaryOffset ) => {
				const separatorStyle: CSSProperties = {
					top: layout.tableOffsetTop + boundaryOffset,
				};
				return (
					<span
						key={ boundaryOffset }
						className="yamabiko-table-reorder-column-insertion-gap-cell-boundary"
						style={ separatorStyle }
					/>
				);
			} ) }
		</div>,
		layout.editorDocument.body
	);
};
