/**
 * Table Block Adapterが、対応Table固有の保存形式をReorderの共通Contractへ読み書きできることを確認する。
 */

import { getTableBlockAdapter } from './table-block-adapter';

describe( 'Table Block Adapter', () => {
	/**
	 * 概要: Core Tableのsection・row・cellとspan表現を共通Contractへ接続できることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableのbodyにrowspan / colspanを持つcellを含むrowが存在する。
	 * - Table以外の追加attributeも存在する。
	 *
	 * 操作:
	 * - Core TableのAdapterでbodyを読み取り、spanを解釈し、別のrow列を書き戻す。
	 *
	 * 期待結果:
	 * - bodyは共通row Contractとして取得でき、spanは数値として解釈される。
	 * - 書き戻しではbodyだけが置き換わり、その他のattributeは保持される。
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
	 * 概要: Flexible Table Block固有のspan propertyを共通のspanとして解釈できることを確認する。
	 *
	 * 事前条件:
	 * - Flexible Table BlockのcellがcolSpan / rowSpanを使用している。
	 *
	 * 操作:
	 * - Flexible Table BlockのAdapterでcolumn spanとrow spanを取得する。
	 *
	 * 期待結果:
	 * - block固有のproperty名を呼び出し側が指定せず、それぞれのspan数が返される。
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
	 * 概要: 明示的に対応していないTable blockを共通Reorderへ接続しないことを確認する。
	 *
	 * 事前条件:
	 * - Adapter登録のないblock名が指定される。
	 *
	 * 操作:
	 * - block名からTable Block Adapterを解決する。
	 *
	 * 期待結果:
	 * - 未知の保存形式を推測せず`null`が返される。
	 */
	it( 'when a Table block has no registered adapter, should return null', () => {
		expect( getTableBlockAdapter( 'unknown/table' ) ).toBeNull();
	} );
} );
