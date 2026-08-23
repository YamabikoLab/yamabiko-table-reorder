/**
 * Table Reorder の列順序計算を扱う pure module。
 *
 * Gutenberg block attributes を source of truth とし、DOM / React / SortableJS に依存せず
 * `head` / `body` / `foot` の各 row で同じ physical column index を移動する。
 */

const TABLE_SECTIONS = [ 'head', 'body', 'foot' ] as const;

type TableSectionName = ( typeof TABLE_SECTIONS )[ number ];

type TableRow = Record< string, unknown > & {
	cells: readonly unknown[];
};

type ParsedSection = {
	name: TableSectionName;
	rows: readonly TableRow[];
};

const isTableRow = ( value: unknown ): value is TableRow => {
	return (
		typeof value === 'object' &&
		value !== null &&
		'cells' in value &&
		Array.isArray( ( value as { cells?: unknown } ).cells )
	);
};

const parseSection = (
	attributes: Readonly< Record< string, unknown > >,
	name: TableSectionName
): ParsedSection | null => {
	const section = attributes[ name ];
	if ( section === undefined ) {
		return { name, rows: [] };
	}

	if ( ! Array.isArray( section ) || ! section.every( isTableRow ) ) {
		return null;
	}

	return { name, rows: section };
};

const moveArrayItem = < T >( items: readonly T[], oldIndex: number, newIndex: number ): T[] => {
	const reordered = [ ...items ];
	const [ movedItem ] = reordered.splice( oldIndex, 1 );
	reordered.splice( newIndex, 0, movedItem );
	return reordered;
};

/**
 * Table block attributes の1列を別の位置へ移動した新しい attributes を返す。
 *
 * 存在する `head` / `body` / `foot` の全 row に同じ移動を適用する。
 * section の shape が不正、row ごとの cell 数が一致しない、または index が不正な場合は
 * attributes を変更せず `null` を返す。
 *
 * @param attributes     Gutenberg Table block attributes。
 * @param oldColumnIndex 移動する physical column の 0-based index。
 * @param newColumnIndex 移動後の physical column の 0-based index。
 * @return 列順序を変更した新しい attributes。不正な入力では `null`。
 */
export const moveColumn = < TAttributes extends Record< string, unknown > >(
	attributes: TAttributes,
	oldColumnIndex: number,
	newColumnIndex: number
): TAttributes | null => {
	if ( ! Number.isInteger( oldColumnIndex ) || ! Number.isInteger( newColumnIndex ) ) {
		return null;
	}

	const sections: ParsedSection[] = [];
	for ( const name of TABLE_SECTIONS ) {
		const section = parseSection( attributes, name );
		if ( ! section ) {
			return null;
		}
		sections.push( section );
	}

	const rows = sections.flatMap( ( section ) => section.rows );
	if ( rows.length === 0 ) {
		return null;
	}

	const columnCount = rows[ 0 ].cells.length;
	if (
		columnCount === 0 ||
		rows.some( ( row ) => row.cells.length !== columnCount ) ||
		oldColumnIndex < 0 ||
		newColumnIndex < 0 ||
		oldColumnIndex >= columnCount ||
		newColumnIndex >= columnCount
	) {
		return null;
	}

	const nextAttributes: Record< string, unknown > = { ...attributes };
	for ( const section of sections ) {
		if ( attributes[ section.name ] === undefined ) {
			continue;
		}

		nextAttributes[ section.name ] = section.rows.map( ( row ) => ( {
			...row,
			cells: moveArrayItem( row.cells, oldColumnIndex, newColumnIndex ),
		} ) );
	}

	return nextAttributes as TAttributes;
};
