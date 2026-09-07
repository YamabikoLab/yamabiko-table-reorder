/**
 * Row Reorderの現在の有効な移動先に、移動対象行と同じ高さの1つの挿入空間を独立表示として描画する。
 *
 * 周囲行の押しのけによって生じる空間をTable本来の行境界から独立して覆い、可変高さの移動対象でも複数の空行ではなく
 * 移動対象1行が入る空間として示す。表示位置は押しのけ前の論理的な行境界を基準とし、スクロールによる現在位置だけへ追従する。
 * 挿入空間には移動対象行のセル境界を反映し、押しのけ後もTableの罫線が途切れないようにする。
 * 有効drop後はTable更新が完了するまで最後の挿入空間を維持し、確定処理中も移動完了後の配置を保つ。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import {
	useRowDndDestinationBoundaryIndex,
	useRowDndPhase,
} from '@/reorder/row-reorder/integration/dnd-interaction-react';
import {
	measureTableBodyRowGeometry,
	resolveRowBoundaryOffsets,
} from '@/reorder/row-reorder/infrastructure/row-geometry';

import './insertion-gap.scss';

/** 1回のRow DnD中に維持する、押しのけ前の挿入空間配置。 */
type RowInsertionGapSessionLayout = {
	tableBody: HTMLTableSectionElement;
	sourceTable: HTMLTableElement;
	sourceRowIndex: number;
	sourceRowHeight: number;
	boundaryOffsets: readonly number[];
	cellBoundaryOffsets: number[];
	editorDocument: Document;
	editorWindow: Window;
};

/** 現在のeditor表示領域へ描画する挿入空間の配置。 */
type RowInsertionGapLayout = {
	top: number;
	left: number;
	width: number;
	height: number;
	cellBoundaryOffsets: number[];
	tableOffsetLeft: number;
	editorDocument: Document;
};

/**
 * 移動対象行から、そのDnD中の挿入空間表示で維持する論理配置を解決する。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 挿入空間の基準となる論理配置。Row Reorder対象として成立しない場合はnull。
 */
const resolveInsertionGapSessionLayout = (
	sourceElement: Element | undefined
): RowInsertionGapSessionLayout | null => {
	/* Row Reorderの移動対象としてtbody直下行を確認できない場合は、挿入空間を成立させない。 */
	if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
		return null;
	}

	const sourceRow = sourceElement as HTMLTableRowElement;
	const tableBody = sourceRow.parentElement;
	const sourceTable = sourceRow.closest( 'table' ) as HTMLTableElement | null;

	/* 対象Tableとtbody直下行の関係を確認できない場合は、別のDOM階層から挿入空間を推測しない。 */
	if ( ! tableBody || tableBody.tagName !== 'TBODY' || sourceTable === null ) {
		return null;
	}

	const editorContext = resolveEditorDomContext( sourceRow );

	/* 現在のeditor contextを解決できない場合は、別の表示環境を代用して描画しない。 */
	if ( editorContext === null ) {
		return null;
	}

	const typedTableBody = tableBody as HTMLTableSectionElement;
	const sourceRectangle = sourceRow.getBoundingClientRect();
	const tableRectangle = sourceTable.getBoundingClientRect();
	const rowGeometry = measureTableBodyRowGeometry( typedTableBody );

	/* 1行分の挿入空間とセル境界を確定できないTable状態では表示を成立させない。 */
	if ( rowGeometry.length === 0 || sourceRectangle.height <= 0 || tableRectangle.width <= 0 ) {
		return null;
	}

	const boundaryOffsets = resolveRowBoundaryOffsets( rowGeometry );

	/* 押しのけ後の空間でも元Tableの列区切りが分かるよう、移動対象行のセル右境界をTable相対位置として確定する。 */
	const cellBoundaryOffsets = Array.from( sourceRow.cells, ( cell ) => {
		return cell.getBoundingClientRect().right - tableRectangle.left;
	} );
	cellBoundaryOffsets.pop();

	return {
		tableBody: typedTableBody,
		sourceTable,
		sourceRowIndex: sourceRow.sectionRowIndex,
		sourceRowHeight: sourceRectangle.height,
		boundaryOffsets,
		cellBoundaryOffsets,
		editorDocument: editorContext.document,
		editorWindow: editorContext.window,
	};
};

/**
 * DnD開始時の論理境界から、押しのけ後に実際に空いている1行分の表示位置を解決する。
 *
 * 上方向への移動では移動先境界から下へ、下方向への移動では移動先境界から移動元行高ぶん上へ空間が形成される。
 * Table自体の現在位置と表示幅は再計測し、スクロールや表示領域の変化へ追従する。
 *
 * @param sessionLayout DnD開始時に確定した論理配置。
 * @param boundaryIndex DnD Interactionが有効とした0-based移動先境界。
 * @return 現在描画できる1行分の挿入空間。表示不要または描画不能の場合はnull。
 */
const resolveInsertionGapLayout = (
	sessionLayout: RowInsertionGapSessionLayout,
	boundaryIndex: number | null
): RowInsertionGapLayout | null => {
	/* DnD Interactionが有効な移動先を持たない期間は、Presentation側で挿入位置を補完しない。 */
	if ( boundaryIndex === null ) {
		return null;
	}

	const { boundaryOffsets, sourceRowHeight, sourceRowIndex } = sessionLayout;
	const destinationBoundaryOffset = boundaryOffsets[ boundaryIndex ];

	/* DnD Interactionが扱う行境界の範囲外は、表示側で推測して補正しない。 */
	if ( destinationBoundaryOffset === undefined ) {
		return null;
	}

	let gapTopOffset = destinationBoundaryOffset;

	/* 下方向への移動では、押し上げられた行の直後に空く領域へ1行分の表示を合わせる。 */
	if ( boundaryIndex > sourceRowIndex ) {
		gapTopOffset -= sourceRowHeight;
	}

	const bodyRectangle = sessionLayout.tableBody.getBoundingClientRect();
	const tableRectangle = sessionLayout.sourceTable.getBoundingClientRect();
	const visibleLeft = Math.max( tableRectangle.left, 0 );
	const visibleRight = Math.min( tableRectangle.right, sessionLayout.editorWindow.innerWidth );
	const visibleWidth = visibleRight - visibleLeft;
	const top = bodyRectangle.top + gapTopOffset;
	const bottom = top + sourceRowHeight;

	/* Tableと表示領域が重ならない場合は、画面外の挿入空間を生成しない。 */
	if ( visibleWidth <= 0 || bottom <= 0 || top >= sessionLayout.editorWindow.innerHeight ) {
		return null;
	}

	return {
		top,
		left: visibleLeft,
		width: visibleWidth,
		height: sourceRowHeight,
		cellBoundaryOffsets: sessionLayout.cellBoundaryOffsets,
		tableOffsetLeft: tableRectangle.left - visibleLeft,
		editorDocument: sessionLayout.editorDocument,
	};
};

/**
 * DnD Interactionが示す現在の有効な移動先へ、移動対象1行分の独立した挿入空間を描画する。
 *
 * DnD開始時に押しのけ前の論理境界とセル境界を確定し、その後の物理移動ではTableの現在位置だけを再計測する。
 * 有効drop後は最後の挿入空間をTable更新完了まで維持し、確定完了後に破棄する。
 *
 * @return 現在の有効な移動先を覆う1行分の挿入空間。表示条件が成立しない場合はnull。
 */
export const RowInsertionGap = () => {
	const phase = useRowDndPhase();
	const destinationBoundaryIndex = useRowDndDestinationBoundaryIndex();
	const physicalDragEnded = useRef( false );
	const [ sessionLayout, setSessionLayout ] = useState< RowInsertionGapSessionLayout | null >(
		null
	);
	const [ measurementRevision, setMeasurementRevision ] = useState( 0 );
	const [ layout, setLayout ] = useState< RowInsertionGapLayout | null >( null );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			physicalDragEnded.current = false;
			setSessionLayout( resolveInsertionGapSessionLayout( event.operation.source?.element ) );
		},
		onDragMove: () => {
			/* 同じ移動先境界でもスクロール等で画面上の位置が変わるため、現在位置を再計測する。 */
			setMeasurementRevision( ( current ) => current + 1 );
		},
		onDragEnd: () => {
			physicalDragEnded.current = true;

			/* 有効な移動先がない終了では確定表示を維持する必要がないため、従来どおり直ちに破棄する。 */
			if ( destinationBoundaryIndex === null ) {
				setSessionLayout( null );
				setLayout( null );
			}
		},
	} );

	useEffect( () => {
		/* 有効dropの確定処理が終了してidleへ戻った時点で、最後の挿入空間を実Table表示へ引き継ぐ。 */
		if ( physicalDragEnded.current && phase === 'idle' ) {
			physicalDragEnded.current = false;
			setSessionLayout( null );
			setLayout( null );
			return;
		}

		/* DnD開始時の論理配置がない期間は、直前の挿入空間を表示へ残さない。 */
		if ( sessionLayout === null ) {
			setLayout( null );
			return;
		}

		/* 有効drop後はInteractionの移動先が消えても、確定完了まで最後の配置を変更しない。 */
		if ( physicalDragEnded.current ) {
			return;
		}

		setLayout( resolveInsertionGapLayout( sessionLayout, destinationBoundaryIndex ) );
	}, [ destinationBoundaryIndex, measurementRevision, phase, sessionLayout ] );

	/* 現在描画できる挿入空間がない期間は、表示要素自体を生成しない。 */
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
		<div aria-hidden="true" className="yamabiko-table-reorder-insertion-gap" style={ style }>
			{ layout.cellBoundaryOffsets.map( ( boundaryOffset ) => {
				const separatorStyle: CSSProperties = {
					left: layout.tableOffsetLeft + boundaryOffset,
				};
				return (
					<span
						key={ boundaryOffset }
						className="yamabiko-table-reorder-insertion-gap-cell-boundary"
						style={ separatorStyle }
					/>
				);
			} ) }
		</div>,
		layout.editorDocument.body
	);
};
