/**
 * 対応テーブルを、行・列の並び替えで共通利用できる構造へ変換する。
 *
 * ブロック固有の保存形式は変換処理へ委ね、この責務ではrowspanやcolspanを反映した行・列の対応関係と
 * その成立条件だけを扱う。移動先判定とデータ更新は、この共通構造を基準にする。
 */

import {
	getTableBlockAdapter,
	TABLE_SECTION_NAMES,
	type TableBlockAdapter,
	type TableBlockAttributes,
	type TableCell,
	type TableRow,
	type TableSectionName,
} from './table-block-adapter';

export type { TableBlockAttributes, TableCell, TableRow, TableSectionName } from './table-block-adapter';

/**
 * 1つのセルが、テーブル上で占有する列位置と結合範囲。
 */
export type TableCellPlacement = {
	cell: TableCell;
	cellIndex: number;
	columnSpan: number;
	columnStart: number;
	rowSpan: number;
};

/**
 * 1行について、元の行データと各セルの列位置を対応付けた結果。
 */
export type TableRowLayout = {
	placements: TableCellPlacement[];
	row: TableRow;
	rowIndex: number;
};

/**
 * 1つのテーブルセクションについて、列数と各行の配置を確定した結果。
 */
export type TableSectionLayout = {
	columnCount: number;
	rows: TableRowLayout[];
};

/**
 * 行・列の並び替えで共通利用するテーブル全体の構造。
 *
 * 存在するすべてのセクションで同じ列位置が同じ列を指す場合だけ成立する。
 */
export type TableStructure = {
	columnCount: number;
	sections: Partial< Record< TableSectionName, TableSectionLayout > >;
};

/**
 * 上の行から続くrowspanを避け、現在のセルを配置できる最初の列位置を求める。
 *
 * セルが複数列を占有する場合は、その全範囲が空いている位置だけを候補とする。
 *
 * @param occupiedColumns 上の行から続くrowspanによって現在使用できない列。
 * @param fromIndex 現在の行で探索を開始する列位置。
 * @param columnSpan 配置するセルが連続して必要とする列数。
 * @return セル全体を配置できる先頭列の位置。
 */
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
 * 1つのテーブルセクションについて、rowspanやcolspanを反映した列位置を確定する。
 *
 * すべての行が同じ列数で整合し、各結合セルの占有範囲をセクション内で完結して解釈できる場合だけ結果を返す。
 *
 * @param rows 構造を確定するセクションの行。
 * @param adapter 対象ブロックの保存形式を共通形式へ変換する処理。
 * @return 列位置を確定したセクション。テーブル構造として成立しない場合は`null`。
 */
export const createTableSectionLayout = (
	rows: readonly TableRow[],
	adapter: TableBlockAdapter
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
		const occupiedColumns = remainingRowSpans.map( ( remaining ) => {
			const occupiedByRowSpan = remaining > 0;
			return occupiedByRowSpan;
		} );
		const placements: TableCellPlacement[] = [];
		const nextRowSpans = remainingRowSpans.map( ( remaining ) => Math.max( remaining - 1, 0 ) );
		let searchFrom = 0;

		for ( let cellIndex = 0; cellIndex < row.cells.length; cellIndex++ ) {
			const cell = row.cells[ cellIndex ];
			const columnSpan = adapter.getColumnSpan( cell );
			const rowSpan = adapter.getRowSpan( cell );

			// 結合範囲を確定できないセルが1つでもあれば、安全な行・列位置を保証できない。
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
		const currentColumnCount = lastOccupiedColumn + 1;
		if ( expectedColumnCount === null ) {
			expectedColumnCount = currentColumnCount;
		} else if ( currentColumnCount !== expectedColumnCount ) {
			// 同じセクション内で行ごとの列数が一致しない場合、列の対応関係を一意に決められない。
			return null;
		}

		rowLayouts.push( {
			placements,
			row,
			rowIndex,
		} );
		remainingRowSpans = nextRowSpans;
	}

	// セクション末尾を越えて続くrowspanは、現在のテーブルデータだけでは結合範囲を確定できない。
	const hasUnfinishedRowSpan = remainingRowSpans.some( ( remaining ) => {
		const continuesBeyondSection = remaining > 0;
		return continuesBeyondSection;
	} );
	if ( hasUnfinishedRowSpan ) {
		return null;
	}

	return {
		columnCount: expectedColumnCount ?? 0,
		rows: rowLayouts,
	};
};

/**
 * 対応するテーブルブロック全体を、行・列の並び替えで共通利用する構造へ変換する。
 *
 * 存在するすべてのセクションで列数が一致し、どのセクションでも同じ列位置が同じ列を指す場合だけ結果を返す。
 * 未対応のブロックや、構造を一意に解釈できないテーブルは並び替え対象にしない。
 *
 * @param blockName 対象のGutenbergブロック名。
 * @param attributes 並び替え前のテーブル属性。入力値は変更しない。
 * @return 行・列の並び替えで共通利用できるテーブル構造。確定できない場合は`null`。
 */
export const createTableStructure = (
	blockName: string,
	attributes: TableBlockAttributes
): TableStructure | null => {
	const adapter = getTableBlockAdapter( blockName );
	if ( adapter === null ) {
		return null;
	}

	const sections: Partial< Record< TableSectionName, TableSectionLayout > > = {};
	let columnCount: number | null = null;

	for ( const sectionName of TABLE_SECTION_NAMES ) {
		const rows = adapter.readSectionRows( attributes, sectionName );
		if ( rows === null ) {
			return null;
		}

		if ( rows.length === 0 ) {
			continue;
		}

		const layout = createTableSectionLayout( rows, adapter );

		// 存在するセクションは、有効な列構造を持つ場合だけテーブル全体の構造へ含める。
		if ( layout === null || layout.columnCount === 0 ) {
			return null;
		}

		if ( columnCount === null ) {
			columnCount = layout.columnCount;
		} else if ( layout.columnCount !== columnCount ) {
			// セクションごとに列数が異なる場合、テーブル全体で列の対応関係を共有できない。
			return null;
		}

		sections[ sectionName ] = layout;
	}

	const tableStructure =
		columnCount === null
			? null
			: {
					columnCount,
					sections,
			  };
	return tableStructure;
};
