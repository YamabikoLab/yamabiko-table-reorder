/**
 * 対応Table block固有の保存形式と、Reorderが共有するTable Contractの間を接続するAdapterを提供する。
 *
 * section・row・cellの読み書きとspan表現の解釈をこの境界に集約し、Table Structure、Drop Target Resolution、
 * Data Updateがblock名や保存propertyを意識せず同じContractを利用できるようにする。
 */

/**
 * Reorderが共通に扱うTable section名。
 *
 * 対応block固有の保存先が異なる場合でも、Adapterはhead / body / footの共通語彙へ変換して公開する。
 */
export const TABLE_SECTION_NAMES = [ 'head', 'body', 'foot' ] as const;

/**
 * Reorderが共通に扱うTable section名のContract。
 */
export type TableSectionName = ( typeof TABLE_SECTION_NAMES )[ number ];

/**
 * Reorderが保持するcell payloadのContract。
 *
 * content・style・block固有属性は並び替え判断の対象にせず、Data Updateで失わず保持する。
 */
export type TableCell = Record< string, unknown >;

/**
 * Reorderが共通に扱う1行のContract。
 *
 * row固有属性を保持したまま、Table Structureに必要なcell列を共通形式で公開する。
 */
export type TableRow = Record< string, unknown > & {
	cells: readonly TableCell[];
};

/**
 * 対応Table blockの現在attributes。
 *
 * Adapterは必要なTable情報だけを読み書きし、その他のblock固有属性は変更せず保持する。
 */
export type TableBlockAttributes = Readonly< Record< string, unknown > >;

/**
 * 対応Table blockの保存形式をReorderの共通Contractへ接続する境界。
 *
 * 新しいTable blockへ対応するときは、block固有のsection配置、row / cell表現、span表現をこのContractで吸収する。
 * Reorderの共通責務へblock名ごとの条件分岐を追加しない。
 */
export type TableBlockAdapter = {
	getColumnSpan: ( cell: TableCell ) => number | null;
	getRowSpan: ( cell: TableCell ) => number | null;
	readSectionRows: (
		attributes: TableBlockAttributes,
		sectionName: TableSectionName
	) => readonly TableRow[] | null;
	writeSectionRows: (
		attributes: TableBlockAttributes,
		sectionName: TableSectionName,
		rows: readonly TableRow[]
	) => Record< string, unknown > | null;
};

/**
 * 現在対応するCore TableとFlexible Table Blockが共有するsection保存形式を安全に解釈する。
 *
 * section未定義は「そのsectionを持たないTable」として空配列を返す。存在するsectionをrow列として完全に
 * 保持できない場合は、推測した変換を行わず`null`を返す。
 *
 * @param attributes  読み取り元となるTable block attributes。
 * @param sectionName Reorderの共通Contractで指定するsection。
 * @return 共通Contractへ変換したrow列。section未定義では空配列、解釈不能な場合は`null`。
 */
const readStandardSectionRows = (
	attributes: TableBlockAttributes,
	sectionName: TableSectionName
): readonly TableRow[] | null => {
	const section = attributes[ sectionName ];

	// sectionを持たないTableは、そのsectionに並び替え対象が存在しない有効な状態として扱う。
	if ( section === undefined ) {
		return [];
	}

	// 存在するsectionは、rowとcellを欠損なく保持できる場合だけReorderの共通Contractへ公開する。
	if ( ! Array.isArray( section ) || ! section.every( isTableRow ) ) {
		return null;
	}

	return section;
};

/**
 * 現在対応するCore TableとFlexible Table Blockのsectionへ、共通Contractのrow列を書き戻す。
 *
 * Table以外のattributesを保持し、指定sectionの内容だけを確定済みのrow列へ置き換える。
 *
 * @param attributes  更新前のTable block attributes。
 * @param sectionName Reorderの共通Contractで指定するsection。
 * @param rows        Data Updateで確定したrow列。
 * @return 指定sectionだけを更新したattributes。
 */
const writeStandardSectionRows = (
	attributes: TableBlockAttributes,
	sectionName: TableSectionName,
	rows: readonly TableRow[]
): Record< string, unknown > => {
	return {
		...attributes,
		[ sectionName ]: rows,
	};
};

/**
 * 値が、Table payloadとしてpropertyを安全に保持できるobjectか判定する。
 *
 * @param value Table構造の一部として解釈しようとしている値。
 * @return Table payloadとして保持できるobjectであれば`true`。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > => {
	// Table payloadとして保持できるのは、nullではないobjectだけである。
	const canBeTablePayload = value !== null && typeof value === 'object';
	return canBeTablePayload;
};

/**
 * 値をReorderで保持できるcell payloadとして扱えるか判定する。
 *
 * @param value cell候補として読み取った値。
 * @return TableCellとして保持できる場合は`true`。
 */
const isTableCell = ( value: unknown ): value is TableCell => {
	const canBePreservedAsCell = isRecord( value );
	return canBePreservedAsCell;
};

/**
 * 値をReorderの共通row Contractへ変換せずそのまま保持できるか判定する。
 *
 * @param value row候補として読み取った値。
 * @return TableRowとして安全に扱える場合は`true`。
 */
const isTableRow = ( value: unknown ): value is TableRow => {
	// rowとして公開するには、row自身と全cellを並び替え後も欠損なく保持できる必要がある。
	const canBePreservedAsRow =
		isRecord( value ) && Array.isArray( value.cells ) && value.cells.every( isTableCell );
	return canBePreservedAsRow;
};

/**
 * 対応blockの保存propertyから、1つのcellが占有するspan数を共通の数値へ変換する。
 *
 * span未指定は通常cellとして1を返し、占有範囲を一意に確定できない値は推測せず`null`とする。
 *
 * @param cell     spanを解釈するTable cell。
 * @param property 対応blockがspanを保存するproperty名。
 * @return 1以上のspan数。保存値を正しく解釈できない場合は`null`。
 */
const getSpan = ( cell: TableCell, property: string ): number | null => {
	const rawValue = cell[ property ];

	// span未指定は1つのLogical Indexだけを占有する通常cellとして扱う。
	if ( rawValue === undefined || rawValue === null || rawValue === '' ) {
		return 1;
	}

	// spanとして保証できる保存表現だけを共通Contractへ変換する。
	if ( typeof rawValue !== 'number' && typeof rawValue !== 'string' ) {
		return null;
	}

	const span = Number( rawValue );
	// Table Structureへ渡せるspanは、1つ以上の連続したLogical Indexを表す整数だけである。
	const isValidSpan = Number.isInteger( span ) && span >= 1;
	if ( ! isValidSpan ) {
		return null;
	}

	return span;
};

/**
 * 現在対応する標準的なsection / row / cell保存形式に、block固有のspan propertyだけを接続するAdapterを作る。
 *
 * @param columnSpanProperty 対象blockがcolumn spanを保存するproperty名。
 * @param rowSpanProperty    対象blockがrow spanを保存するproperty名。
 * @return Reorderの共通Contractへ接続するTable Block Adapter。
 */
const createStandardTableBlockAdapter = (
	columnSpanProperty: string,
	rowSpanProperty: string
): TableBlockAdapter => {
	return {
		getColumnSpan: ( cell ) => getSpan( cell, columnSpanProperty ),
		getRowSpan: ( cell ) => getSpan( cell, rowSpanProperty ),
		readSectionRows: readStandardSectionRows,
		writeSectionRows: writeStandardSectionRows,
	};
};

/**
 * 正式v1で対応するTable blockと、その保存形式をReorderへ接続するAdapterの対応表。
 *
 * 対応Tableを追加するときは、そのblock固有の読み書きとspan解釈をAdapterとして登録する。
 */
const TABLE_BLOCK_ADAPTERS: Readonly< Record< string, TableBlockAdapter > > = {
	'core/table': createStandardTableBlockAdapter( 'colspan', 'rowspan' ),
	'flexible-table-block/table': createStandardTableBlockAdapter( 'colSpan', 'rowSpan' ),
};

/**
 * Gutenberg block名から、対応するTable Block Adapterを解決する。
 *
 * 対応外blockを推測して処理せず、明示的に登録された保存形式だけをReorderの共通責務へ接続する。
 *
 * @param blockName Reorderへ接続するGutenberg block名。
 * @return 対応blockのAdapter。対応外blockであれば`null`。
 */
export const getTableBlockAdapter = ( blockName: string ): TableBlockAdapter | null => {
	const adapter = TABLE_BLOCK_ADAPTERS[ blockName ] ?? null;
	return adapter;
};
