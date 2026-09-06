/**
 * Row Reorderの現在の有効な挿入位置を、押しのけ表示から独立した水平線として描画する。
 *
 * 挿入位置そのものはDnD Interactionが提供する0-based移動先境界だけを利用し、Presentation独自の移動先状態を持たない。
 * 挿入線の表示側はオーバーレイの現在の縦移動方向へ追従し、上方向では挿入空間の上端、下方向では下端へ表示する。
 * DnD Engineからは描画対象Tableの特定と物理移動に伴う再計測のきっかけだけを受け取り、スクロールによるTable全体の現在位置へ追従する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import { useRowDndDestinationBoundaryIndex } from '@/reorder/row-reorder/dnd-interaction-react';
import {
	measureTableBodyRowGeometry,
	resolveRowBoundaryOffsets,
} from '@/reorder/row-reorder/row-geometry';

import './insertion-line.scss';

/** 挿入線の表示側を決める、オーバーレイの現在の縦移動方向。 */
type RowVerticalMovementDirection = 'upward' | 'downward' | null;

/** 1回のRow DnD中に維持する、押しのけ前の挿入線配置基準。 */
type RowInsertionLineSessionLayout = {
	tableBody: HTMLTableSectionElement;
	sourceTable: HTMLTableElement;
	sourceRowIndex: number;
	sourceRowHeight: number;
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
	const sourceRectangle = sourceRow.getBoundingClientRect();
	const rowGeometry = measureTableBodyRowGeometry( typedTableBody );

	/* 行境界と挿入空間の高さを確定できないTable状態では、そのDnDの挿入線表示を成立させない。 */
	if ( rowGeometry.length === 0 || sourceRectangle.height <= 0 ) {
		return null;
	}

	const boundaryOffsets = resolveRowBoundaryOffsets( rowGeometry );

	return {
		tableBody: typedTableBody,
		sourceTable,
		sourceRowIndex: sourceRow.sectionRowIndex,
		sourceRowHeight: sourceRectangle.height,
		boundaryOffsets,
		editorDocument: editorContext.document,
		editorWindow: editorContext.window,
	};
};

/**
 * DnD開始時の論理境界と現在の縦移動方向から、現在の挿入線表示位置を解決する。
 *
 * 押しのけ後の個別行位置には追従せず、現在の挿入空間に対して上方向移動では上端、下方向移動では下端を示す。
 * Table自体の現在位置と表示幅は再計測し、スクロールや表示領域の変化へ追従する。
 *
 * @param sessionLayout     DnD開始時に確定した論理配置。
 * @param boundaryIndex     DnD Interactionが有効とした0-based移動先境界。
 * @param movementDirection オーバーレイの現在の縦移動方向。未確定時は論理境界をそのまま表示する。
 * @return 現在のeditor表示領域内へ描画できる挿入線配置。描画できない場合はnull。
 */
const resolveInsertionLineLayout = (
	sessionLayout: RowInsertionLineSessionLayout,
	boundaryIndex: number,
	movementDirection: RowVerticalMovementDirection
): RowInsertionLineLayout | null => {
	const destinationBoundaryOffset = sessionLayout.boundaryOffsets[ boundaryIndex ];

	/* DnD Interactionが扱う行境界の範囲外は、表示側で推測して補正しない。 */
	if ( destinationBoundaryOffset === undefined ) {
		return null;
	}

	let lineOffset = destinationBoundaryOffset;

	/* 縦移動方向を確定できた期間だけ挿入空間のどちら側を示すか切り替え、未確定時は論理境界そのものを表示する。 */
	if ( movementDirection !== null ) {
		let insertionGapTopOffset = destinationBoundaryOffset;

		/* 現在の挿入空間はGap表示と同じ論理位置を基準とし、挿入線だけを移動方向に応じて反対側へ切り替える。 */
		if ( boundaryIndex > sessionLayout.sourceRowIndex ) {
			insertionGapTopOffset -= sessionLayout.sourceRowHeight;
		}

		lineOffset = insertionGapTopOffset;
		if ( movementDirection === 'downward' ) {
			lineOffset += sessionLayout.sourceRowHeight;
		}
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
	const top = bodyRectangle.top + lineOffset;

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
 * DnD開始時の論理境界をそのSession中の表示基準として維持し、DnD Engineの移動通知から現在の縦移動方向を更新する。
 * `destinationBoundaryIndex`がnullの場合は表示しない。
 *
 * @return 現在の有効な挿入位置を示す水平線。有効な表示位置がない場合はnull。
 */
export const RowInsertionLine = () => {
	const destinationBoundaryIndex = useRowDndDestinationBoundaryIndex();
	const [ sessionLayout, setSessionLayout ] = useState< RowInsertionLineSessionLayout | null >(
		null
	);
	const [ movementDirection, setMovementDirection ] =
		useState< RowVerticalMovementDirection >( null );
	const [ measurementRevision, setMeasurementRevision ] = useState( 0 );
	const [ layout, setLayout ] = useState< RowInsertionLineLayout | null >( null );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			setSessionLayout( resolveInsertionLineSessionLayout( event.operation.source?.element ) );
			setMovementDirection( null );
		},
		onDragMove: ( event ) => {
			const nextY = event.to?.y;
			const currentY = event.operation.position.current.y;

			/* 同一移動通知内の更新前後位置から現在方向を確定し、縦位置が変わらない通知では直前方向を維持する。 */
			if ( nextY !== undefined && nextY !== currentY ) {
				const nextDirection: RowVerticalMovementDirection =
					nextY < currentY ? 'upward' : 'downward';
				setMovementDirection( nextDirection );
			}

			/* 同じ移動先境界でもスクロール等でTable全体の画面上の位置が変わるため、現在位置を再計測する。 */
			setMeasurementRevision( ( current ) => current + 1 );
		},
		onDragEnd: () => {
			/* 物理DnD終了後は、そのSessionの論理配置・移動方向・挿入位置表示を次の操作へ持ち越さない。 */
			setSessionLayout( null );
			setMovementDirection( null );
			setLayout( null );
		},
	} );

	useEffect( () => {
		/* 有効な移動先境界またはDnD開始時の論理配置を確認できない期間は、挿入線を残さない。 */
		if ( destinationBoundaryIndex === null || sessionLayout === null ) {
			setLayout( null );
			return;
		}

		setLayout(
			resolveInsertionLineLayout( sessionLayout, destinationBoundaryIndex, movementDirection )
		);
	}, [ destinationBoundaryIndex, measurementRevision, movementDirection, sessionLayout ] );

	/* 現在描画できる有効な挿入位置がない期間は、表示要素自体を生成しない。 */
	if ( layout === null ) {
		return null;
	}

	const style: CSSProperties = {
		top: layout.top,
		left: layout.left,
		width: layout.width,
	};

	return createPortal(
		<div aria-hidden="true" className="yamabiko-table-reorder-insertion-line" style={ style } />,
		layout.editorDocument.body
	);
};
