import { createTableIntegration } from './table-integration';

describe( 'Table Integration', () => {
	/**
	 * Core Tableの各sectionから結合セルだけを共通Table structureとして取得できることを確認する。
	 *
	 * 事前条件:
	 * - 対象clientIdはCore Tableを指している。
	 * - headには横結合、bodyには縦結合、footには通常セルだけが存在する。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - 通常セルは保持されない。
	 * - `colspan`と`rowspan`がlogical Table grid上の位置と範囲へ変換される。
	 */
	it( 'when Core Table structure is requested, should return only merged cells on the logical grid', () => {
		const getBlock = jest.fn().mockReturnValue( {
			name: 'core/table',
			attributes: {
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
			},
		} );
		const integration = createTableIntegration( { getBlock } );

		expect( integration.getStructure( 'core-client-id' ) ).toEqual( {
			mergedCells: [
				{
					section: 'head',
					rowStart: 0,
					columnStart: 0,
					rowSpan: 1,
					columnSpan: 2,
				},
				{
					section: 'body',
					rowStart: 0,
					columnStart: 1,
					rowSpan: 2,
					columnSpan: 1,
				},
			],
		} );
		expect( getBlock ).toHaveBeenCalledWith( 'core-client-id' );
	} );

	/**
	 * rowSpanによる占有列を考慮して次行の横結合セルの論理開始列を算出できることを確認する。
	 *
	 * 事前条件:
	 * - 対象clientIdはFlexible Table Blockを指している。
	 * - 1行目の先頭セルが2行を占有する。
	 * - 2行目の先頭物理セルが2列を占有する。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - Flexible Table Block固有の`rowSpan` / `colSpan`が解釈される。
	 * - 2行目の横結合セルは占有中の0列目を避け、logical column 1から開始する。
	 */
	it( 'when Flexible Table Block has overlapping spans, should restore logical column positions', () => {
		const integration = createTableIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'flexible-table-block/table',
				attributes: {
					body: [
						{
							cells: [ { content: 'A', rowSpan: 2 }, { content: 'B' }, { content: 'C' } ],
						},
						{
							cells: [ { content: 'D', colSpan: 2 } ],
						},
					],
				},
			} ),
		} );

		expect( integration.getStructure( 'flexible-client-id' ) ).toEqual( {
			mergedCells: [
				{
					section: 'body',
					rowStart: 0,
					columnStart: 0,
					rowSpan: 2,
					columnSpan: 1,
				},
				{
					section: 'body',
					rowStart: 1,
					columnStart: 1,
					rowSpan: 1,
					columnSpan: 2,
				},
			],
		} );
	} );

	/**
	 * 同じclientIdへの複数要求で毎回現在のblockを再取得することを確認する。
	 *
	 * 事前条件:
	 * - 1回目はCore Table、2回目は同じclientIdでFlexible Table Blockが返る。
	 *
	 * 操作:
	 * - 同じTable IntegrationへgetStructure()を2回実行する。
	 *
	 * 期待結果:
	 * - getBlock()が要求ごとに呼ばれる。
	 * - 2回目は1回目のblock nameやattributesを再利用せず、現在blockに対応するIntegrationが選ばれる。
	 */
	it( 'when the same clientId is requested again, should reacquire the current block and integration', () => {
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { rowspan: 2 } ] }, { cells: [] } ],
				},
			} )
			.mockReturnValueOnce( {
				name: 'flexible-table-block/table',
				attributes: {
					body: [ { cells: [ { colSpan: 2 } ] } ],
				},
			} );
		const integration = createTableIntegration( { getBlock } );

		expect( integration.getStructure( 'table-client-id' ) ).toEqual( {
			mergedCells: [
				{
					section: 'body',
					rowStart: 0,
					columnStart: 0,
					rowSpan: 2,
					columnSpan: 1,
				},
			],
		} );
		expect( integration.getStructure( 'table-client-id' ) ).toEqual( {
			mergedCells: [
				{
					section: 'body',
					rowStart: 0,
					columnStart: 0,
					rowSpan: 1,
					columnSpan: 2,
				},
			],
		} );
		expect( getBlock ).toHaveBeenCalledTimes( 2 );
	} );

	/**
	 * 非対応Tableまたは不完全なattributesでは共通Table structureを提供しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象clientIdから取得したblockが非対応、または対応blockのsection shapeが不正である。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - 不完全な共通Table structureを返さずnullになる。
	 */
	it( 'when the current block cannot be integrated, should return null', () => {
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( {
				name: 'core/paragraph',
				attributes: {},
			} )
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: { body: 'invalid' },
			} );
		const integration = createTableIntegration( { getBlock } );

		expect( integration.getStructure( 'unsupported-client-id' ) ).toBeNull();
		expect( integration.getStructure( 'invalid-client-id' ) ).toBeNull();
	} );
} );
