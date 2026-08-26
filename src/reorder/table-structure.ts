/**
 * 対応Table blockを、並び替え判断に共通利用できるTable Structureへ正規化する。
 *
 * block固有の保存形式はTable Block Adapterに委譲し、この責務ではrowspan / colspanを反映したLogical Index空間の
 * 成立条件と配置関係だけを扱う。Drop Target ResolutionとData Updateへblock非依存の基準構造を提供する。
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
 * 1つのcellがLogical Index空間で占有する位置と範囲。
 *
 * 物理cell indexとは別にcolumnStart・columnSpan・rowSpanを保持し、結合セルを含むTableでも
 * 行・列のDrop Target Resolutionが同じ座標系を利用できるようにする。
 */
export type TableCellPlacement = {
	cell: TableCell;
	cellIndex: number;
	columnSpan: number;
	columnStart: number;
	rowSpan: number;
};

/**
 * 1行をLogical Index空間へ展開した結果。
 *
 * 元のrowと、そのrow内の各cellが占有するlogical column位置を対応付ける。
 */
export type TableRowLayout = {
	placements: TableCellPlacement[];
	row: TableRow;
	rowIndex: number;
};

/**
 * 1つのTable sectionをLogical Index空間へ正規化した結果。
 *
 * section内の全rowが共有するcolumn数と各rowの配置を保持する。
 */
export type TableSectionLayout = {
	columnCount: number;
	rows: TableRowLayout[];
};

/**
 * 対応Table block全体で共有する正規化済み構造。
 *
 * 存在するsectionが同じlogical column数を持つことを前提とし、行・列の判定と更新の基準座標を提供する。
 */
export type TableStructure = {
	columnCount: number;
	sections: Partial< Record< TableSectionName, TableSectionLayout > >;
};

/**
 * 先行rowのrowspanを避け、現在のcellを配置できる最初のlogical columnを求める。
 *
 * cellはcolumnSpan分の連続領域を必要とするため、一部でも先行rowに占有されている位置には配置しない。
 *
 * @param occupiedColumns 先行rowのrowspanによって現在使用できないlogical column。
 * @param fromIndex       現在のrowで探索を開始するlogical column。
 * @param columnSpan      配置するcellが連続して必要とするcolumn数。
 * @return cell全体を配置できる先頭logical column index。
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
			// 1つでも占有済みの位置を含む候補は、同じcellの配置領域として利用できない。
			if ( occupiedColumns[ candidate + offset ] ) {
				available = false;
				candidate += offset + 1;
				break;
			}
		}

		// columnSpan全体を確保できた最初の位置を、そのcellのLogical Index上の開始位置とする。
		if ( available ) {
			return candidate;
		}
	}
};

/**
 * 1つのTable sectionを、rowspan / colspanを反映したLogical Index空間へ正規化する。
 *
 * すべてのrowが同じlogical column数で整合し、各spanの占有範囲をsection内で完結して解釈できる場合だけ
 * layoutを返す。spanの保存形式差はAdapterから共通の数値として受け取り、この責務では扱わない。
 *
 * @param rows    正規化するsectionのrow列。
 * @param adapter 対象blockの保存形式をReorderの共通Contractへ接続するAdapter。
 * @return 正規化済みsection layout。Table構造として成立しない場合は`null`。
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

			// 1つでも占有範囲を確定できないcellがあるsectionでは、共通のLogical Index空間を保証できない。
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
			// 同じsection内でrowごとの列数が一致しないTableは、列のLogical Indexを一意に共有できない。
			return null;
		}

		rowLayouts.push( {
			placements,
			row,
			rowIndex,
		} );
		remainingRowSpans = nextRowSpans;
	}

	// section末尾を越えて続くrowspanは、現在のTableデータだけでは占有範囲を完結して解釈できない。
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
 * 対応Table blockのattributes全体を、行・列の並び替えが共有するTable Structureへ変換する。
 *
 * block固有の保存形式はTable Block Adapterから共通のsection・row・cellとして受け取る。存在するsectionはすべて
 * 同じlogical column数を持つことを要求し、どのsectionを見ても同じcolumn indexが同じ列を指す状態だけを返す。
 *
 * @param blockName  正規化対象となるGutenberg block名。
 * @param attributes 並び替え前のTable block attributes。入力状態として変更しない。
 * @return 正規化済みTable Structure。対応外または構造を一意に解釈できない場合は`null`。
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

		// 存在するsectionは、有効な列構造を持つ場合だけTable全体の並び替えContractへ参加できる。
		if ( layout === null || layout.columnCount === 0 ) {
			return null;
		}

		if ( columnCount === null ) {
			columnCount = layout.columnCount;
		} else if ( layout.columnCount !== columnCount ) {
			// 全sectionで同じLogical Indexが同じ列を指せないTableは、列並び替えの共通基準にできない。
			return null;
		}

		sections[ sectionName ] = layout;
	}

	// 少なくとも1つの有効sectionがあり、Table全体で共通の列構造を確定できた場合だけStructureを公開する。
	const tableStructure =
		columnCount === null
			? null
			: {
					columnCount,
					sections,
			  };
	return tableStructure;
};
