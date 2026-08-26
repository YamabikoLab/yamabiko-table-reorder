/**
 * Core TableとFlexible Table Blockの保存形式を、並び替え判断に共通利用できるTable Structureへ正規化する。
 *
 * blockごとのspan属性名や物理cell配列の違いをこの責務で吸収し、Drop Target ResolutionとData Updateには
 * rowspan / colspanを反映した同一のLogical Index空間を提供する。入力attributesは変更しない。
 */

/**
 * Table全体で同じlogical columnとして扱うsectionの一覧。
 *
 * 列並び替えでは、存在するsectionすべてが同じ列構造を共有することを前提とする。
 */
const TABLE_SECTION_NAMES = [ 'head', 'body', 'foot' ] as const;

/**
 * Table Structureが対象とするsection名。
 *
 * head / body / footを同じ列構造のContractへ参加させるための共通語彙として利用する。
 */
export type TableSectionName = ( typeof TABLE_SECTION_NAMES )[ number ];

/**
 * Table Structure内で保持するcellデータ。
 *
 * content・style・block固有属性は並び替え判断の対象にせず、そのまま保持すべきpayloadとして扱う。
 */
export type TableCell = Record< string, unknown >;

/**
 * Table Structure内で扱う1行のデータ。
 *
 * row固有属性を保持したまま、Logical Index計算に必要なcell列だけをContractとして要求する。
 */
export type TableRow = Record< string, unknown > & {
	cells: readonly TableCell[];
};

/**
 * 対応Table blockの現在attributes。
 *
 * Table Structureは必要なsectionだけを解釈し、その他のblock固有属性をData Updateで保持できるよう
 * 全体をreadonlyな入力状態として扱う。
 */
export type TableBlockAttributes = Readonly< Record< string, unknown > >;

/**
 * 対応blockごとの保存形式差をTable Structureへ接続する情報。
 *
 * Core TableとFlexible Table Blockで異なるrowspan / colspan属性名をこの境界で吸収する。
 */
export type TableBlockSupport = {
	colspanProperty: string;
	rowspanProperty: string;
};

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
 * 正式v1で対応するTable blockと、その保存形式差の対応表。
 *
 * block固有知識をTable Structure境界へ閉じ込め、下流の責務がblock名ごとのspan属性を意識しないようにする。
 */
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

/**
 * 値が、Table構造の一部としてpropertyを安全に参照できるobjectか判定する。
 *
 * @param value Table構造の一部として解釈しようとしている値。
 * @return Table構造のpayloadとして扱えるobjectであれば`true`。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > => {
	// Table構造のpayloadとして扱えるのは、nullではないobjectだけである。
	const canBeTablePayload = value !== null && typeof value === 'object';
	return canBeTablePayload;
};

/**
 * 値をTable cellのpayloadとして保持できるか判定する。
 *
 * @param value cell候補として読み取った値。
 * @return TableCellとして保持できる場合は`true`。
 */
const isTableCell = ( value: unknown ): value is TableCell => {
	const canBePreservedAsCell = isRecord( value );
	return canBePreservedAsCell;
};

/**
 * 値が、Data Updateで保持できるcell列を持つTable rowとして成立するか判定する。
 *
 * @param value row候補として読み取った値。
 * @return TableRowとして安全に解釈できる場合は`true`。
 */
const isTableRow = ( value: unknown ): value is TableRow => {
	// 並び替え対象のrowとして扱うには、row自身と全cellを欠損なく保持できる必要がある。
	const canBePreservedAsRow =
		isRecord( value ) && Array.isArray( value.cells ) && value.cells.every( isTableCell );
	return canBePreservedAsRow;
};

/**
 * block固有propertyから、cellがLogical Index空間で占有するspan数を解決する。
 *
 * span未指定は通常cellとして1を返す。Table構造を一意に解釈できない値は推測せず`null`とする。
 *
 * @param cell     spanを解決するTable cell。
 * @param property 対象blockがspanを保存するproperty名。
 * @return 1以上のspan数。構造として解釈できない場合は`null`。
 */
const getSpan = ( cell: TableCell, property: string ): number | null => {
	const rawValue = cell[ property ];

	// span未指定は、1つのLogical Indexだけを占有する通常cellとして扱う。
	if ( rawValue === undefined || rawValue === null || rawValue === '' ) {
		return 1;
	}

	// 対応blockがspanとして保存できる表現以外は、占有範囲を確定できないため受け入れない。
	if ( typeof rawValue !== 'number' && typeof rawValue !== 'string' ) {
		return null;
	}

	const span = Number( rawValue );
	// spanは、1つ以上の連続したLogical Indexを表す整数だけが有効である。
	const validSpan = Number.isInteger( span ) && span >= 1 ? span : null;
	return validSpan;
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
 * block名から、Table Structureが保存形式を解釈するためのsupport情報を返す。
 *
 * 正式v1の対象外blockは推測して扱わず、下流の責務へ未知のTable形式を渡さない。
 *
 * @param blockName Table Structureへ接続するGutenberg block名。
 * @return 対応blockの保存形式情報。正式v1の対象外であれば`null`。
 */
export const getTableBlockSupport = ( blockName: string ): TableBlockSupport | null => {
	const blockSupport = BLOCK_SUPPORTS[ blockName ] ?? null;
	return blockSupport;
};

/**
 * Table attributesから指定sectionのrow列を取得する。
 *
 * sectionが存在しないことは有効なTable状態として空配列で表す。sectionが存在してもrow列として一貫して
 * 解釈できない場合だけ`null`を返し、「sectionなし」と「構造不成立」を区別する。
 *
 * @param attributes  読み取り元となるTable block attributes。
 * @param sectionName head / body / footのうち読み取るsection。
 * @return sectionのrow列。section未定義では空配列、解釈不能な場合は`null`。
 */
export const getTableSectionRows = (
	attributes: TableBlockAttributes,
	sectionName: TableSectionName
): readonly TableRow[] | null => {
	const section = attributes[ sectionName ];
	if ( section === undefined ) {
		return [];
	}

	// 存在するsectionは、すべてのrowを同じTable Row Contractで保持できる場合だけ並び替えの基準にできる。
	const sectionRows = Array.isArray( section ) && section.every( isTableRow ) ? section : null;
	return sectionRows;
};

/**
 * 1つのTable sectionを、rowspan / colspanを反映したLogical Index空間へ正規化する。
 *
 * すべてのrowが同じlogical column数で整合し、各spanの占有範囲をsection内で完結して解釈できる場合だけ
 * layoutを返す。構造を一意に確定できないsectionは並び替え判断へ渡さない。
 *
 * @param rows    正規化するsectionのrow列。
 * @param support 対象blockでspan情報を読み取るための保存形式情報。
 * @return 正規化済みsection layout。Table構造として成立しない場合は`null`。
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
		const occupiedColumns = remainingRowSpans.map( ( remaining ) => {
			const occupiedByRowSpan = remaining > 0;
			return occupiedByRowSpan;
		} );
		const placements: TableCellPlacement[] = [];
		const nextRowSpans = remainingRowSpans.map( ( remaining ) => Math.max( remaining - 1, 0 ) );
		let searchFrom = 0;

		for ( let cellIndex = 0; cellIndex < row.cells.length; cellIndex++ ) {
			const cell = row.cells[ cellIndex ];
			const columnSpan = getSpan( cell, support.colspanProperty );
			const rowSpan = getSpan( cell, support.rowspanProperty );

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
 * 存在するsectionはすべて同じlogical column数を持つことを要求し、どのsectionを見ても同じcolumn indexが
 * 同じ列を指す状態だけを有効な基準構造として返す。
 *
 * @param blockName  正規化対象となるGutenberg block名。
 * @param attributes 並び替え前のTable block attributes。入力状態として変更しない。
 * @return 正規化済みTable Structure。対応外または構造を一意に解釈できない場合は`null`。
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
