/**
 * Column Reorder が利用する table DOM context を解決する。
 */

import { resolveEditorEnvironment } from '@/common/editor-environment';

/** Column control prototype が必要とする DOM context。 */
export type ColumnTableContext = {
	blockElement: HTMLElement;
	columns: HTMLTableCellElement[];
	document: Document;
	table: HTMLTableElement;
	window: Window;
};

/**
 * 結合セルを含まない table から、列 geometry の代表 cell を返す。
 *
 * Phase 2 では logical grid を導入しないため、row / col span を含む table は対象外とする。
 *
 * @param table 対象 table element。
 * @return 各列の代表 cell。対象外 shape では null。
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
 * anchor の current editor context から Column Reorder の table context を組み立てる。
 *
 * @param anchor   editor context 探索の起点となる DOM element。
 * @param clientId 解決対象 Gutenberg block の clientId。
 * @return Column Reorder 用 context。対象外 shape / 未解決では null。
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
