/**
 * Row Reorderの現在の有効な挿入位置を、対象Tableの行境界へ独立した水平線として描画する。
 *
 * 挿入位置そのものはDnD Interactionが提供する0-based移動先境界だけを利用し、Presentation独自の移動先状態を持たない。
 * DnD Engineからは描画対象Tableの特定と物理移動に伴う再計測のきっかけだけを受け取り、対象Tableと現在のeditor表示領域が重なる範囲だけを表示する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import { useRowDndDestinationBoundaryIndex } from '@/reorder/row-reorder/dnd-interaction-react';

import './insertion-line.scss';

/** 挿入線を現在のeditor表示領域へ描画するための配置情報。 */
type RowInsertionLineLayout = {
	top: number;
	left: number;
	width: number;
	editorDocument: Document;
};

/**
 * 現在の有効な移動先境界から、挿入線の表示位置を解決する。
 *
 * @param sourceRow                現在のRow DnDで移動対象となっている行。
 * @param destinationBoundaryIndex DnD Interactionが有効と判定した0-based移動先境界。
 * @return 現在のeditor表示領域内へ描画できる挿入線配置。描画できない場合はnull。
 */
const resolveInsertionLineLayout = (
	sourceRow: HTMLTableRowElement,
	destinationBoundaryIndex: number
): RowInsertionLineLayout | null => {
	const tableBody = sourceRow.parentElement;
	const sourceTable = sourceRow.closest( 'table' ) as HTMLTableElement | null;

	/* Row Reorderの対象Tableとtbody直下行の関係を確認できない場合は、挿入線を成立させない。 */
	if ( ! tableBody || tableBody.tagName !== 'TBODY' || sourceTable === null ) {
		return null;
	}

	const rows = ( tableBody as HTMLTableSectionElement ).rows;
	const rowCount = rows.length;

	/* DnD Interactionが扱う行境界の範囲外は、表示側で推測して補正しない。 */
	if ( destinationBoundaryIndex < 0 || destinationBoundaryIndex > rowCount || rowCount === 0 ) {
		return null;
	}

	const editorContext = resolveEditorDomContext( sourceRow );

	/* 現在のeditor contextを解決できない場合は、別の表示環境を代用して描画しない。 */
	if ( editorContext === null ) {
		return null;
	}

	const tableRectangle = sourceTable.getBoundingClientRect();
	const visibleLeft = Math.max( tableRectangle.left, 0 );
	const visibleRight = Math.min( tableRectangle.right, editorContext.window.innerWidth );
	const visibleWidth = visibleRight - visibleLeft;

	/* 対象Tableと現在表示領域が横方向に重ならない場合は、挿入位置を表示しない。 */
	if ( visibleWidth <= 0 ) {
		return null;
	}

	const boundaryRow = rows.item( destinationBoundaryIndex );

	/* 先頭から行間までの境界は直後の行上端へ対応し、最後の要素の後ろだけは最終行下端へ対応する。 */
	const top =
		boundaryRow !== null
			? boundaryRow.getBoundingClientRect().top
			: rows.item( rowCount - 1 )?.getBoundingClientRect().bottom;

	/* 行境界を計測できない場合、または現在表示領域外の境界は描画しない。 */
	if ( top === undefined || top < 0 || top > editorContext.window.innerHeight ) {
		return null;
	}

	return {
		top,
		left: visibleLeft,
		width: visibleWidth,
		editorDocument: editorContext.document,
	};
};

/**
 * DnD Interactionが示す現在の有効な移動先境界を、対象Table上の挿入線として描画する。
 *
 * DnD Engineの移動通知は、スクロール等で同じ移動先境界の物理位置が変化した場合に再計測するためだけに利用する。
 * `destinationBoundaryIndex`がnullの場合は表示しない。
 *
 * @return 現在の有効な挿入位置を示す水平線。有効な表示位置がない場合はnull。
 */
export const RowInsertionLine = () => {
	const destinationBoundaryIndex = useRowDndDestinationBoundaryIndex();
	const [ sourceRow, setSourceRow ] = useState< HTMLTableRowElement | null >( null );
	const [ measurementRevision, setMeasurementRevision ] = useState( 0 );
	const [ layout, setLayout ] = useState< RowInsertionLineLayout | null >( null );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			const sourceElement = event.operation.source?.element;

			/* Row Reorderの物理開始対象として行要素を確認できる場合だけ、そのDnDの挿入位置表示対象として保持する。 */
			const nextSourceRow =
				sourceElement?.tagName === 'TR' ? ( sourceElement as HTMLTableRowElement ) : null;
			setSourceRow( nextSourceRow );
		},
		onDragMove: () => {
			setMeasurementRevision( ( current ) => current + 1 );
		},
		onDragEnd: () => {
			setSourceRow( null );
			setLayout( null );
		},
	} );

	useEffect( () => {
		/* 有効な移動先境界または対象行を確認できない期間は、挿入線を残さない。 */
		if ( destinationBoundaryIndex === null || sourceRow === null ) {
			setLayout( null );
			return;
		}

		setLayout( resolveInsertionLineLayout( sourceRow, destinationBoundaryIndex ) );
	}, [ destinationBoundaryIndex, measurementRevision, sourceRow ] );

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
