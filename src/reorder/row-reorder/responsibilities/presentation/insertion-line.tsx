/**
 * Row Reorderの現在の有効な挿入位置を、対象Tableの論理境界上へ水平線として描画する。
 *
 * 挿入位置そのものはDnD Interactionが提供する0-based移動先境界だけを利用し、Presentation独自の移動先状態を持たない。
 * DnD Engineからは描画対象Tableの特定と物理移動に伴う再計測のきっかけだけを受け取り、スクロールによるTable全体の現在位置へ追従する。
 * 正常なphysical drop後は、最後に表示していた挿入線だけを短時間維持し、dropした位置を追跡できるようにする。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import { DND_POST_DROP_INSERTION_LINE_DURATION_MS } from '@/reorder/reorder-tuning';
import { useRowDndDestinationBoundaryIndex } from '@/reorder/row-reorder/integration/dnd-interaction-react';
import {
	measureTableBodyRowGeometry,
	resolveRowBoundaryOffsets,
} from '@/reorder/row-reorder/infrastructure/row-geometry';

import './insertion-line.scss';

/** 1回のRow DnD中に維持する挿入線配置基準。 */
type RowInsertionLineSessionLayout = {
	tableBody: HTMLTableSectionElement;
	sourceTable: HTMLTableElement;
	boundaryOffsets: readonly number[];
	editorDocument: Document;
	editorWindow: Window;
};

/** 挿入線を現在のeditor表示領域へ描画するための配置情報。 */
type RowInsertionLineLayout = {
	top: number;
	left: number;
	width: number;
	editorDocument: Document;
};

/**
 * 移動対象行から、そのDnD中の挿入線表示で維持する論理配置を解決する。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 挿入線の基準となる論理配置。Row Reorder対象として成立しない場合はnull。
 */
const resolveInsertionLineSessionLayout = (
	sourceElement: Element | undefined
): RowInsertionLineSessionLayout | null => {
	/* Row Reorderの移動対象としてtbody直下行を確認できない場合は、挿入線を成立させない。 */
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

	/* 行境界を確定できないTable状態では、そのDnDの挿入線表示を成立させない。 */
	if ( rowGeometry.length === 0 ) {
		return null;
	}

	return {
		tableBody: typedTableBody,
		sourceTable,
		boundaryOffsets: resolveRowBoundaryOffsets( rowGeometry ),
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
		editorDocument: sessionLayout.editorDocument,
	};
};

/**
 * DnD Interactionが示す現在の有効な移動先境界を、対象Table上の挿入線として描画する。
 *
 * DnD開始時の論理境界をそのSession中の表示基準として維持し、DnD Engineの移動通知ごとに現在のTable位置を再計測する。
 * 正常なphysical drop時に挿入線が表示されていた場合だけ、その最終位置を短時間維持する。
 * cancelまたは有効な表示位置がない終了ではdrop後表示を行わない。
 *
 * @return 現在の有効な挿入位置、または正常なdrop直後の最終挿入位置を示す水平線。表示位置がない場合はnull。
 */
export const RowInsertionLine = () => {
	const destinationBoundaryIndex = useRowDndDestinationBoundaryIndex();
	const [ sessionLayout, setSessionLayout ] = useState< RowInsertionLineSessionLayout | null >(
		null
	);
	const [ measurementRevision, setMeasurementRevision ] = useState( 0 );
	const [ layout, setLayout ] = useState< RowInsertionLineLayout | null >( null );
	const [ postDropLayout, setPostDropLayout ] = useState< RowInsertionLineLayout | null >( null );
	const postDropTimerRef = useRef< ReturnType< typeof setTimeout > | null >( null );

	/** 前回のdrop後表示が新しい操作やunmountへ持ち越されないよう、保留中のtimerを破棄する。 */
	const clearPostDropTimer = () => {
		if ( postDropTimerRef.current === null ) {
			return;
		}

		clearTimeout( postDropTimerRef.current );
		postDropTimerRef.current = null;
	};

	useEffect( () => {
		return () => {
			clearPostDropTimer();
		};
	}, [] );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			clearPostDropTimer();
			setPostDropLayout( null );
			setLayout( null );
			setSessionLayout( resolveInsertionLineSessionLayout( event.operation.source?.element ) );
		},
		onDragMove: () => {
			/* 同じ移動先境界でもスクロール等でTable全体の画面上の位置が変わるため、現在位置を再計測する。 */
			setMeasurementRevision( ( current ) => current + 1 );
		},
		onDragEnd: ( event ) => {
			clearPostDropTimer();
			setSessionLayout( null );
			setLayout( null );

			/* cancelまたは有効な挿入線が表示されていない終了では、drop位置の表示を残さない。 */
			if ( event.canceled || layout === null ) {
				setPostDropLayout( null );
				return;
			}

			setPostDropLayout( layout );
			postDropTimerRef.current = setTimeout( () => {
				setPostDropLayout( null );
				postDropTimerRef.current = null;
			}, DND_POST_DROP_INSERTION_LINE_DURATION_MS );
		},
	} );

	useEffect( () => {
		/* 有効な移動先境界またはDnD開始時の論理配置を確認できない期間は、DnD中の挿入線を表示しない。 */
		if ( destinationBoundaryIndex === null || sessionLayout === null ) {
			setLayout( null );
			return;
		}

		setLayout( resolveInsertionLineLayout( sessionLayout, destinationBoundaryIndex ) );
	}, [ destinationBoundaryIndex, measurementRevision, sessionLayout ] );

	const visibleLayout = layout ?? postDropLayout;

	/* 現在描画できる挿入位置またはdrop直後の最終挿入位置がない期間は、表示要素自体を生成しない。 */
	if ( visibleLayout === null ) {
		return null;
	}

	const style: CSSProperties = {
		top: visibleLayout.top,
		left: visibleLayout.left,
		width: visibleLayout.width,
	};

	return createPortal(
		<div aria-hidden="true" className="yamabiko-table-reorder-insertion-line" style={ style } />,
		visibleLayout.editorDocument.body
	);
};
