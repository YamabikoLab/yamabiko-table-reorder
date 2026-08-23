/**
 * Column Reorderが利用するtable DOM contextを解決する。
 */

import { resolveEditorEnvironment } from '@/common/editor-environment';

/** Column control prototypeが必要とするDOM context。 */
export type ColumnTableContext = {
	blockElement: HTMLElement;
	columns: HTMLTableCellElement[];
	document: Document;
	table: HTMLTableElement;
	window: Window;
};

/**
 * 結合セルを含まないtableから、列geometryの代表cellを返す。
 *
 * logical gridを使用しない単純なphysical columnとして扱えるtableだけを対象とし、
 * rowSpan / colSpanを含むtableは対象外とする。
 *
 * @param table 対象table element。
 * @return 各列の代表cell。対象外shapeではnull。
 */
export const getColumnCells = ( table: HTMLTableElement ): HTMLTableCellElement[] | null => {
	const rows = Array.from( table.rows );
	if ( rows.length === 0 ) {
		return null;
	}

	const firstRowCells = Array.from( rows[ 0 ].cells );
	if ( firstRowCells.length === 0 ) {
		return null;
	}

	const columnCount = firstRowCells.length;
	const hasUnsupportedShape = rows.some( ( row ) => {
		const cells = Array.from( row.cells );
		return (
			cells.length !== columnCount ||
			cells.some( ( cell ) => cell.colSpan !== 1 || cell.rowSpan !== 1 )
		);
	} );

	return hasUnsupportedShape ? null : firstRowCells;
};

/**
 * anchorのcurrent editor contextからColumn Reorderのtable contextを組み立てる。
 *
 * @param anchor   editor context探索の起点となるDOM element。
 * @param clientId 解決対象Gutenberg blockのclientId。
 * @return Column Reorder用context。対象外shape / 未解決ではnull。
 */
export const resolveColumnTableContext = (
	anchor: Element,
	clientId: string
): ColumnTableContext | null => {
	const environment = resolveEditorEnvironment( anchor, clientId );
	if ( ! environment ) {
		return null;
	}

	const blockElement = environment.document.querySelector< HTMLElement >(
		`[data-block="${ clientId }"]`
	);
	const table = blockElement?.querySelector< HTMLTableElement >( 'table' ) ?? null;
	if ( ! blockElement || ! table ) {
		return null;
	}

	const columns = getColumnCells( table );
	if ( ! columns ) {
		return null;
	}

	return {
		blockElement,
		columns,
		document: environment.document,
		table,
		window: environment.window,
	};
};
