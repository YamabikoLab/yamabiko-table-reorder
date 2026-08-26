/**
 * 対応するテーブルブロック固有の保存形式を、並び替え機能が共通に扱える形式へ変換する。
 *
 * セクション、行、セルの読み書きと結合セルの表現差をこの境界で吸収し、
 * 並び替えの共通処理がブロックごとの保存形式を意識せずに済むようにする。
 */

/**
 * 並び替え機能が共通に扱うテーブルのセクション名。
 */
export const TABLE_SECTION_NAMES = [ 'head', 'body', 'foot' ] as const;

/**
 * 並び替え機能が共通に扱うテーブルのセクション名。
 */
export type TableSectionName = ( typeof TABLE_SECTION_NAMES )[ number ];

/**
 * 並び替え中も内容や装飾を失わず保持するセルデータ。
 */
export type TableCell = Record< string, unknown >;

/**
 * 並び替え中も行固有の情報を保持したまま扱う1行分のデータ。
 */
export type TableRow = Record< string, unknown > & {
	cells: readonly TableCell[];
};

/**
 * 対応するテーブルブロックの現在の属性。
 */
export type TableBlockAttributes = Readonly< Record< string, unknown > >;

/**
 * ブロック固有の保存形式と、並び替え機能の共通形式を相互変換する境界。
 *
 * 新しいテーブルブロックへ対応するときは、セクション配置、行・セルの表現、結合セルの表現差をここで吸収する。
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
 * Core TableとFlexible Table Blockが共有するセクション保存形式を安全に読み取る。
 *
 * セクションが存在しない場合は、そのセクションを持たない有効なテーブルとして空配列を返す。
 * 存在するセクションを行とセルの集合として完全に解釈できない場合は、推測せず`null`を返す。
 *
 * @param attributes 読み取り元のテーブル属性。
 * @param sectionName 読み取るセクション。
 * @return 読み取った行。セクションが存在しない場合は空配列、解釈できない場合は`null`。
 */
const readStandardSectionRows = (
	attributes: TableBlockAttributes,
	sectionName: TableSectionName
): readonly TableRow[] | null => {
	const section = attributes[ sectionName ];

	if ( section === undefined ) {
		return [];
	}

	// 存在するセクションは、行とセルを欠損なく保持できる場合だけ並び替え対象として扱う。
	if ( ! Array.isArray( section ) || ! section.every( isTableRow ) ) {
		return null;
	}

	return section;
};

/**
 * Core TableとFlexible Table Blockのセクションへ、確定した行データを書き戻す。
 *
 * テーブル以外の属性は保持し、指定されたセクションだけを置き換える。
 *
 * @param attributes 更新前のテーブル属性。
 * @param sectionName 更新するセクション。
 * @param rows 書き戻す行データ。
 * @return 指定セクションだけを更新した属性。
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
 * 値が、テーブルの一部として安全に保持できるオブジェクトかを判定する。
 *
 * @param value 判定対象の値。
 * @return `null`ではないオブジェクトであれば`true`。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > => {
	const canBeTablePayload = value !== null && typeof value === 'object';
	return canBeTablePayload;
};

/**
 * 値を、内容を失わず保持できるセルとして扱えるかを判定する。
 *
 * @param value セルとして読み取った値。
 * @return セルとして保持できる場合は`true`。
 */
const isTableCell = ( value: unknown ): value is TableCell => {
	const canBePreservedAsCell = isRecord( value );
	return canBePreservedAsCell;
};

/**
 * 値を、内容を失わず保持できる行として扱えるかを判定する。
 *
 * @param value 行として読み取った値。
 * @return 行として安全に扱える場合は`true`。
 */
const isTableRow = ( value: unknown ): value is TableRow => {
	const canBePreservedAsRow =
		isRecord( value ) && Array.isArray( value.cells ) && value.cells.every( isTableCell );
	return canBePreservedAsRow;
};

/**
 * ブロック固有の保存値から、1つのセルが占有する行数または列数を取得する。
 *
 * 値が省略されている場合は通常のセルとして1を返す。占有範囲を一意に確定できない値は推測しない。
 *
 * @param cell 結合範囲を読み取るセル。
 * @param property 対象ブロックが結合範囲を保存する属性名。
 * @return 1以上の占有数。保存値を正しく解釈できない場合は`null`。
 */
const getSpan = ( cell: TableCell, property: string ): number | null => {
	const rawValue = cell[ property ];

	if ( rawValue === undefined || rawValue === null || rawValue === '' ) {
		return 1;
	}

	if ( typeof rawValue !== 'number' && typeof rawValue !== 'string' ) {
		return null;
	}

	const span = Number( rawValue );
	const isValidSpan = Number.isInteger( span ) && span >= 1;
	if ( ! isValidSpan ) {
		return null;
	}

	return span;
};

/**
 * 共通のセクション・行・セル保存形式に、ブロック固有の結合セル属性名を対応付ける。
 *
 * @param columnSpanProperty 列方向の結合数を保存する属性名。
 * @param rowSpanProperty 行方向の結合数を保存する属性名。
 * @return 対応ブロックの保存形式を共通形式へ接続する変換処理。
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
 * 正式v1で対応するテーブルブロックと、その保存形式の対応表。
 */
const TABLE_BLOCK_ADAPTERS: Readonly< Record< string, TableBlockAdapter > > = {
	'core/table': createStandardTableBlockAdapter( 'colspan', 'rowspan' ),
	'flexible-table-block/table': createStandardTableBlockAdapter( 'colSpan', 'rowSpan' ),
};

/**
 * Gutenbergブロック名から、対応するテーブル保存形式の変換処理を取得する。
 *
 * 未対応ブロックの保存形式は推測せず、明示的に登録されたブロックだけを並び替え対象とする。
 *
 * @param blockName 対象のGutenbergブロック名。
 * @return 対応する変換処理。未対応ブロックでは`null`。
 */
export const getTableBlockAdapter = ( blockName: string ): TableBlockAdapter | null => {
	const adapter = TABLE_BLOCK_ADAPTERS[ blockName ] ?? null;
	return adapter;
};
