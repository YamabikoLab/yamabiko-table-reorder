const TABLE_SECTION_NAMES = [ 'head', 'body', 'foot' ] as const;

/**
 * Table属性内で行を保持するsection名。
 */
export type TableSectionName = ( typeof TABLE_SECTION_NAMES )[ number ];

/**
 * Drop Target ResolutionとData Updateが扱うTable cell。
 */
export type TableCell = Record< string, unknown >;

/**
 * Drop Target ResolutionとData Updateが扱うTable row。
 */
export type TableRow = Record< string, unknown > & {
	cells: readonly TableCell[];
};

/**
 * 対応blockのTable属性。
 *
 * block固有の追加属性は保持したまま、Table構造として必要なsectionだけを参照する。
 */
export type TableBlockAttributes = Readonly< Record< string, unknown > >;

/**
 * Core TableとFlexible Table Blockのcell属性名の差を表す。
 */
export type TableBlockSupport = {
	colspanProperty: string;
	rowspanProperty: string;
};

/**
 * logical column上でのcell配置。
 *
 * `columnStart`はcellが占有する先頭columnの0-based logical indexを表す。
 */
export type TableCellPlacement = {
	cell: TableCell;
	cellIndex: number;
	columnSpan: number;
	columnStart: number;
	rowSpan: number;
};

/**
 * 1行のcellをlogical columnへ展開した結果。
 */
export type TableRowLayout = {
	placements: TableCellPlacement[];
	row: TableRow;
	rowIndex: number;
};

/**
 * 1つのTable sectionをlogical columnへ展開した結果。
 */
export type TableSectionLayout = {
	columnCount: number;
	rows: TableRowLayout[];
};

/**
 * 対応Table block全体のlogical構造。
 */
export type TableStructure = {
	columnCount: number;
	sections: Partial< Record< TableSectionName, TableSectionLayout > >;
};

const BLOCK_SUPPORTS: Readonly< Record< string, TableBlockSupport > > = {
	'core/table': {
		colspanProperty: 'colspan',
		rowspanProperty: 'rowspan',
	},
	'flexible-table-block/table': {
		colspanProperty: 'colSpan',
		rowspanProperty: 'rowSpan',
	},
};

const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object';

const isTableCell = ( value: unknown ): value is TableCell => isRecord( value );

const isTableRow = ( value: unknown ): value is TableRow =>
	isRecord( value ) && Array.isArray( value.cells ) && value.cells.every( isTableCell );

const getSpan = ( cell: TableCell, property: string ): number | null => {
	const rawValue = cell[ property ];
	if ( rawValue === undefined || rawValue === null || rawValue === '' ) {
		return 1;
	}

	if ( typeof rawValue !== 'number' && typeof rawValue !== 'string' ) {
		return null;
	}

	const value = Number( rawValue );
	return Number.isInteger( value ) && value >= 1 ? value : null;
};

const findFreeColumnStart = (
	occupiedColumns: readonly boolean[],
	fromIndex: number,
	columnSpan: number
): number => {
	let candidate = fromIndex;

	while ( true ) {
		let available = true;
		for ( let offset = 0; offset < columnSpan; offset++ ) {
			if ( occupiedColumns[ candidate + offset ] ) {
				available = false;
				candidate += offset + 1;
				break;
			}
		}

		if ( available ) {
			return candidate;
		}
	}
};

/**
 * block名に対応するTable構造の差分を返す。
 *
 * @param blockName Gutenberg block名。
 * @return 対応blockのsupport。非対応blockでは`null`。
 */
export const getTableBlockSupport = ( blockName: string ): TableBlockSupport | null =>
	BLOCK_SUPPORTS[ blockName ] ?? null;

/**
 * Table属性から指定sectionの行配列を取得する。
 *
 * sectionが未定義の場合は空配列を返し、定義済みsectionのshapeが不正な場合は`null`を返す。
 *
 * @param attributes Table block attributes。
 * @param sectionName 取得するsection名。
 */
export const getTableSectionRows = (
	attributes: TableBlockAttributes,
	sectionName: TableSectionName
): readonly TableRow[] | null => {
	const section = attributes[ sectionName ];
	if ( section === undefined ) {
		return [];
	}

	return Array.isArray( section ) && section.every( isTableRow ) ? section : null;
};

/**
 * Table sectionをrowspanとcolspanを考慮したlogical column配置へ変換する。
 *
 * 各rowのlogical column数が一致しない場合やspan値が不正な場合は、有効なTable構造として
 * 扱えないため`null`を返す。
 *
 * @param rows section内の行配列。
 * @param support block固有のspan property情報。
 */
export const createTableSectionLayout = (
	rows: readonly TableRow[],
	support: TableBlockSupport
): TableSectionLayout | null => {
	if ( rows.length === 0 ) {
		return {
			columnCount: 0,
			rows: [],
		};
	}

	let remainingRowSpans: number[] = [];
	let expectedColumnCount: number | null = null;
	const rowLayouts: TableRowLayout[] = [];

	for ( let rowIndex = 0; rowIndex < rows.length; rowIndex++ ) {
		const row = rows[ rowIndex ];
		const occupiedColumns = remainingRowSpans.map( ( remaining ) => remaining > 0 );
		const placements: TableCellPlacement[] = [];
		const nextRowSpans = remainingRowSpans.map( ( remaining ) => Math.max( remaining - 1, 0 ) );
		let searchFrom = 0;

		for ( let cellIndex = 0; cellIndex < row.cells.length; cellIndex++ ) {
			const cell = row.cells[ cellIndex ];
			const columnSpan = getSpan( cell, support.colspanProperty );
			const rowSpan = getSpan( cell, support.rowspanProperty );
			if ( columnSpan === null || rowSpan === null ) {
				return null;
			}

			const columnStart = findFreeColumnStart( occupiedColumns, searchFrom, columnSpan );
			for ( let offset = 0; offset < columnSpan; offset++ ) {
				const columnIndex = columnStart + offset;
				occupiedColumns[ columnIndex ] = true;
				if ( rowSpan > 1 ) {
					nextRowSpans[ columnIndex ] = Math.max( nextRowSpans[ columnIndex ] ?? 0, rowSpan - 1 );
				}
			}

			placements.push( {
				cell,
				cellIndex,
				columnSpan,
				columnStart,
				rowSpan,
			} );
			searchFrom = columnStart + columnSpan;
		}

		const lastOccupiedColumn = occupiedColumns.lastIndexOf( true );
		const columnCount = lastOccupiedColumn + 1;
		if ( expectedColumnCount === null ) {
			expectedColumnCount = columnCount;
		} else if ( columnCount !== expectedColumnCount ) {
			return null;
		}

		rowLayouts.push( {
			placements,
			row,
			rowIndex,
		} );
		remainingRowSpans = nextRowSpans;
	}

	if ( remainingRowSpans.some( ( remaining ) => remaining > 0 ) ) {
		return null;
	}

	return {
		columnCount: expectedColumnCount ?? 0,
		rows: rowLayouts,
	};
};

/**
 * Core TableまたはFlexible Table Blockのattributesを共通logical構造へ変換する。
 *
 * 存在するsection間でlogical column数が一致しない場合は`null`を返す。
 *
 * @param blockName Gutenberg block名。
 * @param attributes Table block attributes。
 */
export const createTableStructure = (
	blockName: string,
	attributes: TableBlockAttributes
): TableStructure | null => {
	const support = getTableBlockSupport( blockName );
	if ( support === null ) {
		return null;
	}

	const sections: Partial< Record< TableSectionName, TableSectionLayout > > = {};
	let columnCount: number | null = null;

	for ( const sectionName of TABLE_SECTION_NAMES ) {
		const rows = getTableSectionRows( attributes, sectionName );
		if ( rows === null ) {
			return null;
		}

		if ( rows.length === 0 ) {
			continue;
		}

		const layout = createTableSectionLayout( rows, support );
		if ( layout === null || layout.columnCount === 0 ) {
			return null;
		}

		if ( columnCount === null ) {
			columnCount = layout.columnCount;
		} else if ( layout.columnCount !== columnCount ) {
			return null;
		}

		sections[ sectionName ] = layout;
	}

	return columnCount === null
		? null
		: {
				columnCount,
				sections,
		  };
};
