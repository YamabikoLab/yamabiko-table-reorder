/**
 * 対応するテーブルブロック固有の保存形式を、並び替え機能の共通形式へ安全に読み書きできることを確認する。
 */

import { getTableBlockAdapter } from './table-block-adapter';

describe( 'Table Block Adapter', () => {
	/**
	 * 概要: Core Tableの行・セルと結合セル情報を共通形式として読み書きできることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableのbodyにrowspanとcolspanを持つセルを含む行が存在する。
	 * - テーブル以外の追加属性も存在する。
	 *
	 * 操作:
	 * - Core Tableの変換処理でbodyを読み取り、結合数を解釈し、別の行を書き戻す。
	 *
	 * 期待結果:
	 * - bodyの行を取得でき、rowspanとcolspanは数値として解釈される。
	 * - 書き戻しではbodyだけが置き換わり、その他の属性は保持される。
	 */
	it( 'when Core Table data is adapted, should read and write the common table contract', () => {
		const adapter = getTableBlockAdapter( 'core/table' );
		expect( adapter ).not.toBeNull();
		if ( adapter === null ) {
			return;
		}

		const firstCell = { content: 'A', colspan: 2, rowspan: '3' };
		const originalRow = { cells: [ firstCell ], custom: 'row-a' };
		const attributes = {
			body: [ originalRow ],
			caption: 'caption',
		};
		const rows = adapter.readSectionRows( attributes, 'body' );

		expect( rows ).toEqual( [ originalRow ] );
		expect( adapter.getColumnSpan( firstCell ) ).toBe( 2 );
		expect( adapter.getRowSpan( firstCell ) ).toBe( 3 );

		const replacementRow = { cells: [ { content: 'B' } ] };
		expect( adapter.writeSectionRows( attributes, 'body', [ replacementRow ] ) ).toEqual( {
			body: [ replacementRow ],
			caption: 'caption',
		} );
	} );

	/**
	 * 概要: Flexible Table Block固有のcolSpanとrowSpanを共通の結合数として解釈できることを確認する。
	 *
	 * 事前条件:
	 * - Flexible Table BlockのセルがcolSpanとrowSpanを使用している。
	 *
	 * 操作:
	 * - Flexible Table Blockの変換処理で列方向と行方向の結合数を取得する。
	 *
	 * 期待結果:
	 * - 呼び出し側が保存属性名を意識せず、それぞれの結合数を取得できる。
	 */
	it( 'when Flexible Table Block spans are adapted, should expose common span values', () => {
		const adapter = getTableBlockAdapter( 'flexible-table-block/table' );
		expect( adapter ).not.toBeNull();
		if ( adapter === null ) {
			return;
		}

		const cell = { content: 'Merged', colSpan: '2', rowSpan: 3 };
		expect( adapter.getColumnSpan( cell ) ).toBe( 2 );
		expect( adapter.getRowSpan( cell ) ).toBe( 3 );
	} );

	/**
	 * 概要: 明示的に対応していないテーブルブロックを並び替え対象にしないことを確認する。
	 *
	 * 事前条件:
	 * - 対応登録のないブロック名が指定される。
	 *
	 * 操作:
	 * - ブロック名から保存形式の変換処理を取得する。
	 *
	 * 期待結果:
	 * - 未知の保存形式を推測せず`null`が返される。
	 */
	it( 'when a Table block has no registered adapter, should return null', () => {
		expect( getTableBlockAdapter( 'unknown/table' ) ).toBeNull();
	} );
} );
