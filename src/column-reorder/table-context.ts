/**
 * Column Reorderが利用するtable DOM contextを解決する。
 *
 * editor canvas referenceが属するdocumentを現在のeditor contextとして扱い、
 * 同じdocument内から対象Table blockとtableを組み立てる。
 */

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
 * editor canvas referenceのowning documentからColumn Reorderのtable contextを組み立てる。
 *
 * owning documentの`defaultView`、block、table、column geometryのいずれかを解決できない場合は
 * `null`を返す。
 *
 * @param referenceElement editor canvas内に所有するDOM reference element。
 * @param clientId         同じdocument内で解決するGutenberg blockのclientId。
 * @return Column Reorder用context。対象外shape / 未解決ではnull。
 */
export const resolveColumnTableContext = (
	referenceElement: Element,
	clientId: string
): ColumnTableContext | null => {
	const document = referenceElement.ownerDocument;
	const window = document.defaultView;
	if ( ! window ) {
		return null;
	}

	const blockElement = document.querySelector< HTMLElement >( `[data-block="${ clientId }"]` );
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
		document,
		table,
		window,
	};
};
