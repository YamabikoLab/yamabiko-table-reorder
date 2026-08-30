/**
 * Flexible Table Block固有の属性構造と`rowSpan` / `colSpan`表現が、
 * Table Integration共通のTable区画表現へ安全に適応されることを確認する。
 */

import { flexibleTableBlockIntegration } from './integration';

describe( 'Flexible Table Block Integration', () => {
	/**
	 * Flexible Table Blockのsectionと結合範囲を共通Table区画へ正規化できることを確認する。
	 *
	 * 事前条件:
	 * - bodyには縦結合セルと横結合セルが存在する。
	 *
	 * 操作:
	 * - Flexible Table Block Integrationへattributesを渡す。
	 *
	 * 期待結果:
	 * - `rowSpan`と`colSpan`が共通表現の同名プロパティへ変換される。
	 * - span指定のない通常セルは1行1列を占有する共通セルとして保持される。
	 */
	it( 'when Flexible Table Block attributes are valid, should normalize its span fields', () => {
		expect(
			flexibleTableBlockIntegration.getSections( {
				body: [
					{
						cells: [ { content: 'A', rowSpan: 2 }, { content: 'B' } ],
					},
					{
						cells: [ { content: 'C', colSpan: 2 } ],
					},
				],
			} )
		).toEqual( {
			head: [],
			body: [
				{
					cells: [
						{ rowSpan: 2, columnSpan: 1 },
						{ rowSpan: 1, columnSpan: 1 },
					],
				},
				{
					cells: [ { rowSpan: 1, columnSpan: 2 } ],
				},
			],
			foot: [],
		} );
	} );

	/**
	 * headまたはfootを持たないFlexible Table Blockも有効なTable区画として適応できることを確認する。
	 *
	 * 事前条件:
	 * - attributesはbodyだけを持ち、headとfootは存在しない。
	 *
	 * 操作:
	 * - Flexible Table Block Integrationへattributesを渡す。
	 *
	 * 期待結果:
	 * - 存在しないheadとfootは空sectionとして扱われる。
	 * - bodyは共通Table区画へ変換される。
	 */
	it( 'when optional Flexible Table Block sections are absent, should treat them as empty sections', () => {
		expect(
			flexibleTableBlockIntegration.getSections( {
				body: [ { cells: [ { colSpan: 2 } ] } ],
			} )
		).toEqual( {
			head: [],
			body: [
				{
					cells: [ { rowSpan: 1, columnSpan: 2 } ],
				},
			],
			foot: [],
		} );
	} );

	/**
	 * 必須のbodyが欠落したFlexible Table Blockを有効な空Tableとして扱わないことを確認する。
	 *
	 * 事前条件:
	 * - attributesにはfootが存在する。
	 * - bodyは存在しない。
	 *
	 * 操作:
	 * - Flexible Table Block Integrationへattributesを渡す。
	 *
	 * 期待結果:
	 * - body欠落を空sectionへ変換せずnullになる。
	 */
	it( 'when the required Flexible Table Block body section is absent, should reject the Table sections', () => {
		expect(
			flexibleTableBlockIntegration.getSections( {
				foot: [ { cells: [ {} ] } ],
			} )
		).toBeNull();
	} );

	/**
	 * Flexible Table Blockのattributes、row、cellを安全に解釈できない場合に部分的な区画を返さないことを確認する。
	 *
	 * 事前条件:
	 * - attributes自体がobjectではないケースがある。
	 * - body内のrowがobjectではないケースがある。
	 * - row.cells内のcellがobjectではないケースがある。
	 *
	 * 操作:
	 * - 各不完全構造をFlexible Table Block Integrationへ渡す。
	 *
	 * 期待結果:
	 * - いずれも共通Table区画を推測せずnullになる。
	 */
	it( 'when Flexible Table Block data shape is incomplete, should reject the entire section set', () => {
		expect( flexibleTableBlockIntegration.getSections( null ) ).toBeNull();
		expect( flexibleTableBlockIntegration.getSections( { body: [ null ] } ) ).toBeNull();
		expect(
			flexibleTableBlockIntegration.getSections( {
				body: [ { cells: [ null ] } ],
			} )
		).toBeNull();
	} );

	/**
	 * Table grid上の占有数として成立しないFlexible Table Block spanを含む場合に部分的な区画を返さないことを確認する。
	 *
	 * 事前条件:
	 * - bodyのセルに無効な`rowSpan`または`colSpan`が保存されている。
	 *
	 * 操作:
	 * - 不正spanを含むattributesをFlexible Table Block Integrationへ渡す。
	 *
	 * 期待結果:
	 * - Table全体を変換不能としてnullになる。
	 */
	it( 'when a Flexible Table Block span value is invalid, should reject the entire section set', () => {
		expect(
			flexibleTableBlockIntegration.getSections( {
				body: [ { cells: [ { rowSpan: 0 } ] } ],
			} )
		).toBeNull();
		expect(
			flexibleTableBlockIntegration.getSections( {
				body: [ { cells: [ { colSpan: 'invalid' } ] } ],
			} )
		).toBeNull();
	} );
} );
