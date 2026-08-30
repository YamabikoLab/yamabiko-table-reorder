/**
 * Core Table固有の属性構造と`rowspan` / `colspan`表現が、
 * Table Integration共通のTable区画表現へ安全に適応されることを確認する。
 */

import { coreTableIntegration } from './integration';

describe( 'Core Table Integration', () => {
	/**
	 * Core Tableの各sectionと結合範囲を共通Table区画へ正規化できることを確認する。
	 *
	 * 事前条件:
	 * - head、body、footが存在する。
	 * - headには横結合、bodyには縦結合、footには通常セルだけが存在する。
	 *
	 * 操作:
	 * - Core Table Integrationへattributesを渡す。
	 *
	 * 期待結果:
	 * - `colspan`と`rowspan`が`columnSpan`と`rowSpan`へ変換される。
	 * - 通常セルは1行1列を占有する共通セルとして保持される。
	 */
	it( 'when Core Table attributes are valid, should normalize all sections and span fields', () => {
		expect(
			coreTableIntegration.getSections( {
				head: [
					{
						cells: [ { content: 'A', colspan: 2 }, { content: 'B' } ],
					},
				],
				body: [
					{
						cells: [ { content: 'C' }, { content: 'D', rowspan: 2 }, { content: 'E' } ],
					},
					{
						cells: [ { content: 'F' }, { content: 'G' } ],
					},
				],
				foot: [
					{
						cells: [ { content: 'H' }, { content: 'I' }, { content: 'J' } ],
					},
				],
			} )
		).toEqual( {
			head: [
				{
					cells: [
						{ rowSpan: 1, columnSpan: 2 },
						{ rowSpan: 1, columnSpan: 1 },
					],
				},
			],
			body: [
				{
					cells: [
						{ rowSpan: 1, columnSpan: 1 },
						{ rowSpan: 2, columnSpan: 1 },
						{ rowSpan: 1, columnSpan: 1 },
					],
				},
				{
					cells: [
						{ rowSpan: 1, columnSpan: 1 },
						{ rowSpan: 1, columnSpan: 1 },
					],
				},
			],
			foot: [
				{
					cells: [
						{ rowSpan: 1, columnSpan: 1 },
						{ rowSpan: 1, columnSpan: 1 },
						{ rowSpan: 1, columnSpan: 1 },
					],
				},
			],
		} );
	} );

	/**
	 * headまたはfootを持たないCore Tableも有効なTable区画として適応できることを確認する。
	 *
	 * 事前条件:
	 * - attributesはbodyだけを持ち、headとfootは存在しない。
	 *
	 * 操作:
	 * - Core Table Integrationへattributesを渡す。
	 *
	 * 期待結果:
	 * - 存在しないheadとfootは空sectionとして扱われる。
	 * - bodyは共通Table区画へ変換される。
	 */
	it( 'when optional Core Table sections are absent, should treat them as empty sections', () => {
		expect(
			coreTableIntegration.getSections( {
				body: [ { cells: [ { colspan: 2 }, {} ] } ],
			} )
		).toEqual( {
			head: [],
			body: [
				{
					cells: [
						{ rowSpan: 1, columnSpan: 2 },
						{ rowSpan: 1, columnSpan: 1 },
					],
				},
			],
			foot: [],
		} );
	} );

	/**
	 * 必須のbodyが欠落したCore Tableを有効な空Tableとして扱わないことを確認する。
	 *
	 * 事前条件:
	 * - attributesにはheadが存在する。
	 * - bodyは存在しない。
	 *
	 * 操作:
	 * - Core Table Integrationへattributesを渡す。
	 *
	 * 期待結果:
	 * - body欠落を空sectionへ変換せずnullになる。
	 */
	it( 'when the required Core Table body section is absent, should reject the Table sections', () => {
		expect(
			coreTableIntegration.getSections( {
				head: [ { cells: [ {} ] } ],
			} )
		).toBeNull();
	} );

	/**
	 * Core Tableデータに数値文字列で保存されたspanを有効な占有数として扱えることを確認する。
	 *
	 * 事前条件:
	 * - 結合セルが`rowspan`と`colspan`を数値文字列で保持している。
	 *
	 * 操作:
	 * - Core Table Integrationへattributesを渡す。
	 *
	 * 期待結果:
	 * - 数値文字列が正の整数へ変換される。
	 */
	it( 'when Core Table span values are numeric strings, should normalize them as positive integers', () => {
		expect(
			coreTableIntegration.getSections( {
				body: [ { cells: [ { rowspan: '2', colspan: '2' } ] }, { cells: [] } ],
			} )
		).toEqual( {
			head: [],
			body: [
				{
					cells: [ { rowSpan: 2, columnSpan: 2 } ],
				},
				{
					cells: [],
				},
			],
			foot: [],
		} );
	} );

	/**
	 * Core Tableのattributes、row、cellのいずれかを安全に解釈できない場合に部分的な区画を返さないことを確認する。
	 *
	 * 事前条件:
	 * - attributes自体がobjectではないケースがある。
	 * - body内のrowがobjectではないケースがある。
	 * - row.cells内のcellがobjectではないケースがある。
	 *
	 * 操作:
	 * - 各不完全構造をCore Table Integrationへ渡す。
	 *
	 * 期待結果:
	 * - いずれも共通Table区画を推測せずnullになる。
	 */
	it( 'when Core Table data shape is incomplete, should reject the entire section set', () => {
		expect( coreTableIntegration.getSections( null ) ).toBeNull();
		expect( coreTableIntegration.getSections( { body: [ null ] } ) ).toBeNull();
		expect(
			coreTableIntegration.getSections( {
				body: [ { cells: [ null ] } ],
			} )
		).toBeNull();
	} );

	/**
	 * Table grid上の占有数として成立しないCore Table spanを含む場合に部分的な区画を返さないことを確認する。
	 *
	 * 事前条件:
	 * - 各Tableには先に有効な横結合セルが存在する。
	 * - 後続セルのrowspanが0、負数、小数、非数値文字列、objectのいずれかである。
	 *
	 * 操作:
	 * - 各不正spanを含むattributesをCore Table Integrationへ渡す。
	 *
	 * 期待結果:
	 * - 先に読み取れたセルだけを部分返却せず、Table全体を変換不能としてnullになる。
	 */
	it( 'when any Core Table span value is invalid, should reject the entire section set without partial results', () => {
		const invalidSpans: readonly unknown[] = [ 0, -1, 1.5, 'invalid', {} ];

		// Core Tableで許可しない各span表現について、いずれも部分的なTable区画を返さない同じ契約を確認する。
		for ( const rowspan of invalidSpans ) {
			expect(
				coreTableIntegration.getSections( {
					body: [ { cells: [ { colspan: 2 }, { rowspan } ] } ],
				} )
			).toBeNull();
		}
	} );
} );
