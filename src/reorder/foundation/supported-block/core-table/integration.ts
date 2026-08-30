/**
 * Core Table固有の属性構造をTable Integration共通のTable区画表現へ適応する。
 *
 * Core Tableが保持する`head`、`body`、`foot`と、セルの`rowspan` / `colspan`を解釈し、
 * Supported Blockに依存しないTable Integration共通表現へ変換する。
 * 論理Tableグリッドの復元やReorder固有の行・列規則はこのファイルでは扱わない。
 */

import type {
	SupportedBlockIntegration,
	TableIntegrationCell,
	TableIntegrationRow,
	TableIntegrationSections,
} from '@/reorder/foundation/table-integration';

/**
 * 値をCore Table属性、行、セルとして安全に参照できるオブジェクトか判定する。
 *
 * Core Table構造を推測しないため、属性を持つデータとして扱えるのは`null`でも配列でもないオブジェクトだけとする。
 *
 * @param value 判定対象の値。
 * @return Core Tableデータのオブジェクトとして安全に参照できる場合は`true`。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * Core Tableセルに保存された結合範囲を、Table Integration共通の占有数へ正規化する。
 *
 * 結合範囲の指定がないセルは通常セルとして1を返す。指定がある場合は1以上の整数だけを受け入れる。
 * Core Tableデータとして数値文字列を許容し、それ以外は安全に構造を適応できないため`null`とする。
 *
 * @param span Core Tableセルから取得した結合範囲値。
 * @return 1以上の占有数。解釈できない値の場合は`null`。
 */
const parseSpan = ( span: unknown ): number | null => {
	// 結合範囲が指定されていないセルは、1行1列を占有する通常セルとして扱う。
	if ( span === undefined ) {
		return 1;
	}

	// Core Tableが結合範囲として表現できる数値または数値文字列以外は受け入れない。
	if ( typeof span !== 'number' && typeof span !== 'string' ) {
		return null;
	}

	const value = Number( span );
	// Table上の占有数は1以上の整数である必要があり、それ以外では共通区画表現を確定しない。
	const normalizedSpan = Number.isInteger( value ) && value >= 1 ? value : null;
	return normalizedSpan;
};

/**
 * Core Table固有の1区画をTable Integration共通の行表現へ正規化する。
 *
 * Core Tableではセルの結合範囲を`rowspan`と`colspan`で表す。区画や行、セルの構造を安全に解釈できない
 * 場合は`null`とし、不完全なデータをTable Integration共通処理へ渡さない。
 *
 * @param section  Core Table固有の区画値。
 * @param optional 区画欠落を空区画として許容する場合は`true`。
 * @return 正規化済み行一覧。区画を安全に解釈できない場合は`null`。
 */
const normalizeRows = (
	section: unknown,
	optional: boolean
): readonly TableIntegrationRow[] | null => {
	// `head`と`foot`は省略を許容するが、Table本体である`body`は必須とする。
	if ( section === undefined ) {
		if ( optional ) {
			return [];
		}

		return null;
	}

	// 存在するCore Table区画は行の一覧として解釈できる必要がある。
	if ( ! Array.isArray( section ) ) {
		return null;
	}

	const rows: TableIntegrationRow[] = [];
	// 区画を構成するすべての行を確認し、1行でも解釈できない場合は部分的な区画を作らない。
	for ( const row of section ) {
		// 各行はセル一覧を持つCore Table行として解釈できる場合だけ共通表現へ取り込む。
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const cells: TableIntegrationCell[] = [];
		// 行内のすべてのセルを正規化し、行全体の結合範囲を共通表現として成立させる。
		for ( const cell of row.cells ) {
			// 各セルはCore Tableの結合範囲属性を安全に参照できるセルデータである必要がある。
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = parseSpan( cell.rowspan );
			const columnSpan = parseSpan( cell.colspan );
			// 縦横どちらかの結合範囲を確定できないセルがあれば、区画全体を不完全として扱う。
			if ( rowSpan === null || columnSpan === null ) {
				return null;
			}

			cells.push( { rowSpan, columnSpan } );
		}

		rows.push( { cells } );
	}

	return rows;
};

/**
 * Core Table固有属性をTable Integration共通のTable区画一覧へ正規化する。
 *
 * `head`と`foot`は省略可能とし、`body`はTable本体として必須とする。いずれかの区画を安全に解釈できない
 * 場合は部分的なTable構造を作らず`null`を返す。
 *
 * @param attributes 要求時点のCore Table属性。
 * @return 共通のTable区画一覧。安全に正規化できない場合は`null`。
 */
const normalizeAttributes = ( attributes: unknown ): TableIntegrationSections | null => {
	// Core Table属性そのものを安全に参照できない場合は、区画構造を推測しない。
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const head = normalizeRows( attributes.head, true );
	const body = normalizeRows( attributes.body, false );
	const foot = normalizeRows( attributes.foot, true );
	const hasUnavailableSection = head === null || body === null || foot === null;

	// 共通Table区画は`head`、`body`、`foot`を一組として成立させ、部分的に解釈できた区画だけでは作らない。
	if ( hasUnavailableSection ) {
		return null;
	}

	return { head, body, foot };
};

/**
 * Core Table固有属性をTable Integrationへ接続するSupported Block Integration。
 *
 * Core Tableの属性構造と結合セル表現を共通区画へ適応し、安全に解釈できない場合は`null`を返す。
 */
export const coreTableIntegration: SupportedBlockIntegration = {
	getSections: ( attributes ) => normalizeAttributes( attributes ),
};
