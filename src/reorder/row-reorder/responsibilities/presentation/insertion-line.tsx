/**
 * Row Reorderの現在の有効な挿入位置と、正常なdrop直後の行領域を対象Table上へ描画する。
 *
 * DnD中はDnD Interactionが提供する0-based移動先境界だけを利用し、Presentation独自の移動先状態を持たない。
 * DnD Engineからは描画対象Tableの特定と物理移動に伴う再計測のきっかけだけを受け取り、スクロールによるTable全体の現在位置へ追従する。
 * 有効な境界ではInsertion Lineに加えてVirtual Insertion Gapを重ね、実Tableを動かさずにdrop後の行領域を示す。
 * 正常なphysical drop後は、最後に表示していた境界と移動元行の実測高さからdrop位置の行領域を短時間だけ枠で示す。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import { DND_POST_DROP_ROW_OUTLINE_DURATION_MS } from '@/reorder/reorder-tuning';
import { useRowDndDestinationBoundaryIndex } from '@/reorder/row-reorder/integration/dnd-interaction-react';
import {
	measureTableBodyRowGeometry,
	resolveRowBoundaryOffsets,
} from '@/reorder/row-reorder/infrastructure/row-geometry';

import './insertion-line.scss';

/** 1回のRow DnD中に維持する挿入位置表示の論理配置基準。 */
type RowInsertionLineSessionLayout = {
	tableBody: HTMLTableSectionElement;
	sourceTable: HTMLTableElement;
	boundaryOffsets: readonly number[];
	sourceRowIndex: number;
	sourceRowHeight: number;
	editorDocument: Document;
	editorWindow: Window;
};

/** 挿入線を現在のeditor表示領域へ描画するための配置情報。 */
type RowInsertionLineLayout = {
	top: number;
	left: number;
	width: number;
	boundaryIndex: number;
	editorDocument: Document;
};

/** Virtual Insertion Gapを現在のeditor表示領域へ描画するための配置情報。 */
type RowVirtualInsertionGapLayout = {
	top: number;
	left: number;
	width: number;
	height: number;
};

/** drop位置の行領域を現在のeditor表示領域へ描画するための配置情報。 */
type RowPostDropOutlineLayout = {
	top: number;
	left: number;
	width: number;
	height: number;
	editorDocument: Document;
};

/**
 * 移動対象行から、そのDnD中の挿入位置表示で維持する論理配置を解決する。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 挿入位置表示の基準となる論理配置。Row Reorder対象として成立しない場合はnull。
 */
const resolveInsertionLineSessionLayout = (
	sourceElement: Element | undefined
): RowInsertionLineSessionLayout | null => {
	/* Row Reorderの移動対象としてtbody直下行を確認できない場合は、挿入位置表示を成立させない。 */
	if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
		return null;
	}

	const sourceRow = sourceElement as HTMLTableRowElement;
	const tableBody = sourceRow.parentElement;
	const sourceTable = sourceRow.closest( 'table' ) as HTMLTableElement | null;

	/* 対象Tableとtbody直下行の関係を確認できない場合は、別のDOM階層から挿入位置を推測しない。 */
	if ( ! tableBody || tableBody.tagName !== 'TBODY' || sourceTable === null ) {
		return null;
	}

	const editorContext = resolveEditorDomContext( sourceRow );

	/* 現在のeditor contextを解決できない場合は、別の表示環境を代用して描画しない。 */
	if ( editorContext === null ) {
		return null;
	}

	const typedTableBody = tableBody as HTMLTableSectionElement;
	const rowGeometry = measureTableBodyRowGeometry( typedTableBody );
	const sourceRowIndex = Array.from( typedTableBody.rows ).indexOf( sourceRow );
	const sourceRowGeometry = rowGeometry[ sourceRowIndex ];

	/* 行境界と移動元行の論理配置を確定できないTable状態では、そのDnDの挿入位置表示を成立させない。 */
	if ( rowGeometry.length === 0 || sourceRowGeometry === undefined ) {
		return null;
	}

	return {
		tableBody: typedTableBody,
		sourceTable,
		boundaryOffsets: resolveRowBoundaryOffsets( rowGeometry ),
		sourceRowIndex,
		sourceRowHeight: sourceRowGeometry.bottom - sourceRowGeometry.top,
		editorDocument: editorContext.document,
		editorWindow: editorContext.window,
	};
};

/**
 * DnD開始時の論理境界から、現在の挿入線表示位置を解決する。
 *
 * Table自体の現在位置と表示幅は再計測し、スクロールや表示領域の変化へ追従する。
 *
 * @param sessionLayout DnD開始時に確定した論理配置。
 * @param boundaryIndex DnD Interactionが有効とした0-based移動先境界。
 * @return 現在のeditor表示領域内へ描画できる挿入線配置。描画できない場合はnull。
 */
const resolveInsertionLineLayout = (
	sessionLayout: RowInsertionLineSessionLayout,
	boundaryIndex: number
): RowInsertionLineLayout | null => {
	const destinationBoundaryOffset = sessionLayout.boundaryOffsets[ boundaryIndex ];

	/* DnD Interactionが扱う行境界の範囲外は、表示側で推測して補正しない。 */
	if ( destinationBoundaryOffset === undefined ) {
		return null;
	}

	const tableRectangle = sessionLayout.sourceTable.getBoundingClientRect();
	const visibleLeft = Math.max( tableRectangle.left, 0 );
	const visibleRight = Math.min( tableRectangle.right, sessionLayout.editorWindow.innerWidth );
	const visibleWidth = visibleRight - visibleLeft;

	/* 対象Tableと現在表示領域が横方向に重ならない場合は、挿入位置を表示しない。 */
	if ( visibleWidth <= 0 ) {
		return null;
	}

	const bodyRectangle = sessionLayout.tableBody.getBoundingClientRect();
	const top = bodyRectangle.top + destinationBoundaryOffset;

	/* 現在表示領域外の境界は描画しない。 */
	if ( top < 0 || top > sessionLayout.editorWindow.innerHeight ) {
		return null;
	}

	return {
		top,
		left: visibleLeft,
		width: visibleWidth,
		boundaryIndex,
		editorDocument: sessionLayout.editorDocument,
	};
};

/**
 * 有効な挿入境界から、drop後に移動行が占める領域をVirtual Insertion Gapとして解決する。
 *
 * 上方向の移動では境界の下側、下方向の移動では境界の上側へ、移動元行の実測高さぶんだけ領域を展開する。
 * 実Tableのlayoutや行要素は変更せず、挿入線と同じ論理境界から表示領域だけを導出する。
 *
 * @param sessionLayout       DnD開始時に確定した移動元行と論理配置。
 * @param insertionLineLayout 現在表示している挿入線配置。
 * @return drop後に移動行が占める領域。移動元行の高さが成立しない場合はnull。
 */
const resolveVirtualInsertionGapLayout = (
	sessionLayout: RowInsertionLineSessionLayout,
	insertionLineLayout: RowInsertionLineLayout
): RowVirtualInsertionGapLayout | null => {
	/* 行領域として成立しない実測高さから、挿入予定領域を推測して表示しない。 */
	if ( sessionLayout.sourceRowHeight <= 0 ) {
		return null;
	}

	const isMovingDown = insertionLineLayout.boundaryIndex > sessionLayout.sourceRowIndex;
	const top = isMovingDown
		? insertionLineLayout.top - sessionLayout.sourceRowHeight
		: insertionLineLayout.top;

	return {
		top,
		left: insertionLineLayout.left,
		width: insertionLineLayout.width,
		height: sessionLayout.sourceRowHeight,
	};
};

/**
 * 最後に表示していた挿入境界から、drop位置を示す行領域の枠を解決する。
 *
 * 上方向の移動では境界の下側、下方向の移動では境界の上側へ、移動元行の実測高さぶんだけ領域を展開する。
 * この表示はdrop位置を示すだけで、Table更新成功の判定や更新後DOMの追跡は行わない。
 *
 * @param sessionLayout       DnD開始時に確定した移動元行と論理配置。
 * @param insertionLineLayout drop直前に実際に表示されていた挿入線配置。
 * @return drop位置の行領域を示す枠配置。移動元行の高さが成立しない場合はnull。
 */
const resolvePostDropOutlineLayout = (
	sessionLayout: RowInsertionLineSessionLayout,
	insertionLineLayout: RowInsertionLineLayout
): RowPostDropOutlineLayout | null => {
	const virtualInsertionGapLayout = resolveVirtualInsertionGapLayout(
		sessionLayout,
		insertionLineLayout
	);

	if ( virtualInsertionGapLayout === null ) {
		return null;
	}

	return {
		...virtualInsertionGapLayout,
		editorDocument: insertionLineLayout.editorDocument,
	};
};

/**
 * DnD中の有効な移動先境界を挿入線とVirtual Insertion Gapで描画し、正常なdrop直後はdrop位置の行領域を短時間だけ枠で示す。
 *
 * DnD開始時の論理境界と移動元行高をそのSession中の表示基準として維持し、DnD Engineの移動通知ごとに現在のTable位置を再計測する。
 * Virtual Insertion Gapは実Tableを変更せず、drop後に移動行が占める領域だけを1要素で示す。
 * cancelまたは有効な挿入線がない終了ではdrop後表示を行わない。
 *
 * @return DnD中の挿入線とVirtual Insertion Gap、または正常なdrop直後の行領域枠。表示位置がない場合はnull。
 */
export const RowInsertionLine = () => {
	const destinationBoundaryIndex = useRowDndDestinationBoundaryIndex();
	const [ sessionLayout, setSessionLayout ] = useState< RowInsertionLineSessionLayout | null >(
		null
	);
	const [ measurementRevision, setMeasurementRevision ] = useState( 0 );
	const [ layout, setLayout ] = useState< RowInsertionLineLayout | null >( null );
	const [ postDropOutlineLayout, setPostDropOutlineLayout ] =
		useState< RowPostDropOutlineLayout | null >( null );
	const postDropTimerRef = useRef< ReturnType< typeof setTimeout > | null >( null );

	/** 前回のdrop後表示が新しい操作へ持ち越されないよう、保留中のtimerを破棄する。 */
	const clearPostDropTimer = () => {
		if ( postDropTimerRef.current === null ) {
			return;
		}

		clearTimeout( postDropTimerRef.current );
		postDropTimerRef.current = null;
	};

	useEffect( () => {
		return () => {
			if ( postDropTimerRef.current !== null ) {
				clearTimeout( postDropTimerRef.current );
				postDropTimerRef.current = null;
			}
		};
	}, [] );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			clearPostDropTimer();
			setPostDropOutlineLayout( null );
			setLayout( null );
			setSessionLayout( resolveInsertionLineSessionLayout( event.operation.source?.element ) );
		},
		onDragMove: () => {
			/* 同じ移動先境界でもスクロール等でTable全体の画面上の位置が変わるため、現在位置を再計測する。 */
			setMeasurementRevision( ( current ) => current + 1 );
		},
		onDragEnd: ( event ) => {
			clearPostDropTimer();

			const postDropLayout =
				! event.canceled && sessionLayout !== null && layout !== null
					? resolvePostDropOutlineLayout( sessionLayout, layout )
					: null;

			setSessionLayout( null );
			setLayout( null );
			setPostDropOutlineLayout( postDropLayout );

			/* cancelまたは有効な行領域を確定できない終了では、drop後表示を開始しない。 */
			if ( postDropLayout === null ) {
				return;
			}

			postDropTimerRef.current = setTimeout( () => {
				setPostDropOutlineLayout( null );
				postDropTimerRef.current = null;
			}, DND_POST_DROP_ROW_OUTLINE_DURATION_MS );
		},
	} );

	useEffect( () => {
		/* 有効な移動先境界またはDnD開始時の論理配置を確認できない期間は、DnD中の挿入位置表示を行わない。 */
		if ( destinationBoundaryIndex === null || sessionLayout === null ) {
			setLayout( null );
			return;
		}

		setLayout( resolveInsertionLineLayout( sessionLayout, destinationBoundaryIndex ) );
	}, [ destinationBoundaryIndex, measurementRevision, sessionLayout ] );

	if ( layout !== null && sessionLayout !== null ) {
		const virtualInsertionGapLayout = resolveVirtualInsertionGapLayout( sessionLayout, layout );
		const lineStyle: CSSProperties = {
			top: layout.top,
			left: layout.left,
			width: layout.width,
		};
		const virtualGapStyle: CSSProperties | null =
			virtualInsertionGapLayout === null
				? null
				: {
						top: virtualInsertionGapLayout.top,
						left: virtualInsertionGapLayout.left,
						width: virtualInsertionGapLayout.width,
						height: virtualInsertionGapLayout.height,
					};

		return createPortal(
			<>
				{ virtualGapStyle !== null && (
					<div
						aria-hidden="true"
						className="yamabiko-table-reorder-virtual-insertion-gap"
						style={ virtualGapStyle }
					/>
				) }
				<div
					aria-hidden="true"
					className="yamabiko-table-reorder-insertion-line"
					style={ lineStyle }
				/>
			</>,
			layout.editorDocument.body
		);
	}

	/* drop直後の行領域を表示する期間以外は、表示要素自体を生成しない。 */
	if ( postDropOutlineLayout === null ) {
		return null;
	}

	const postDropStyle: CSSProperties = {
		top: postDropOutlineLayout.top,
		left: postDropOutlineLayout.left,
		width: postDropOutlineLayout.width,
		height: postDropOutlineLayout.height,
	};

	return createPortal(
		<div
			aria-hidden="true"
			className="yamabiko-table-reorder-post-drop-row-outline"
			style={ postDropStyle }
		/>,
		postDropOutlineLayout.editorDocument.body
	);
};
