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
	 * 非対応Tableまたは不完全なsectionでは共通Table structureを提供しないことを確認する。
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

	/**
	 * 対象clientIdに対応するcurrent blockが存在しない場合に過去のデータで代替しないことを確認する。
	 *
	 * 事前条件:
	 * - getBlock()がnullまたはundefinedを返す。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - 共通Table structureは提供されずnullになる。
	 */
	it( 'when the current block does not exist, should return null', () => {
		const getBlock = jest.fn().mockReturnValueOnce( null ).mockReturnValueOnce( undefined );
		const integration = createTableIntegration( { getBlock } );

		expect( integration.getStructure( 'removed-client-id' ) ).toBeNull();
		expect( integration.getStructure( 'missing-client-id' ) ).toBeNull();
	} );

	/**
	 * headまたはfootを持たないTableも有効なTableとして構造取得できることを確認する。
	 *
	 * 事前条件:
	 * - 対象Core Tableはbodyだけを持ち、headとfootは存在しない。
	 * - bodyには横結合セルが存在する。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - 存在しないheadとfootは空sectionとして扱われる。
	 * - bodyの結合セルは共通Table structureへ変換される。
	 */
	it( 'when optional Table sections are absent, should treat them as empty sections', () => {
		const integration = createTableIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { colspan: 2 }, {} ] } ],
				},
			} ),
		} );

		expect( integration.getStructure( 'body-only-client-id' ) ).toEqual( {
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
	} );

	/**
	 * 必須のbodyが欠落したsupported Tableを有効な空Tableとして扱わないことを確認する。
	 *
	 * 事前条件:
	 * - Core TableとFlexible Table Blockのattributesにheadまたはfootは存在する。
	 * - どちらのattributesにもbodyは存在しない。
	 *
	 * 操作:
	 * - 各TableについてgetStructure()を実行する。
	 *
	 * 期待結果:
	 * - body欠落を空sectionへ変換しない。
	 * - どちらも不完全なTableとしてnullになる。
	 */
	it( 'when the required body section is absent, should reject the Table structure', () => {
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: {
					head: [ { cells: [ {} ] } ],
				},
			} )
			.mockReturnValueOnce( {
				name: 'flexible-table-block/table',
				attributes: {
					foot: [ { cells: [ {} ] } ],
				},
			} );
		const integration = createTableIntegration( { getBlock } );

		expect( integration.getStructure( 'core-without-body-client-id' ) ).toBeNull();
		expect( integration.getStructure( 'flexible-without-body-client-id' ) ).toBeNull();
	} );

	/**
	 * pluginデータに数値文字列で保存されたspanを有効な占有数として扱えることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableの結合セルが`rowspan`と`colspan`を数値文字列で保持している。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - 数値文字列が正の整数へ変換される。
	 * - logical Table grid上の結合範囲として共通Table structureへ記録される。
	 */
	it( 'when span values are numeric strings, should normalize them as positive integers', () => {
		const integration = createTableIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { rowspan: '2', colspan: '2' } ] }, { cells: [] } ],
				},
			} ),
		} );

		expect( integration.getStructure( 'numeric-string-client-id' ) ).toEqual( {
			mergedCells: [
				{
					section: 'body',
					rowStart: 0,
					columnStart: 0,
					rowSpan: 2,
					columnSpan: 2,
				},
			],
		} );
	} );

	/**
	 * attributes、row、cellのいずれかを安全に解釈できない場合に部分的な構造を返さないことを確認する。
	 *
	 * 事前条件:
	 * - attributes自体がobjectではないケースがある。
	 * - body内のrowがobjectではないケースがある。
	 * - row.cells内のcellがobjectではないケースがある。
	 *
	 * 操作:
	 * - 各不完全構造についてgetStructure()を実行する。
	 *
	 * 期待結果:
	 * - いずれも共通Table structureを推測せずnullになる。
	 */
	it( 'when Table data shape is incomplete, should reject the entire structure', () => {
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: null,
			} )
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: { body: [ null ] },
			} )
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: { body: [ { cells: [ null ] } ] },
			} );
		const integration = createTableIntegration( { getBlock } );

		expect( integration.getStructure( 'invalid-attributes-client-id' ) ).toBeNull();
		expect( integration.getStructure( 'invalid-row-client-id' ) ).toBeNull();
		expect( integration.getStructure( 'invalid-cell-client-id' ) ).toBeNull();
	} );

	/**
	 * Table grid上の占有数として成立しないspanを含む場合に部分的な共通Table structureを返さないことを確認する。
	 *
	 * 事前条件:
	 * - 各Tableには先に有効な横結合セルが存在する。
	 * - 後続セルのrowspanが0、負数、小数、非数値文字列、objectのいずれかである。
	 *
	 * 操作:
	 * - 各不正spanについてgetStructure()を実行する。
	 *
	 * 期待結果:
	 * - 先に読み取れた結合セルだけを部分返却しない。
	 * - Table全体を変換不能としてnullになる。
	 */
	it( 'when any span value is invalid, should reject the entire structure without partial results', () => {
		const invalidSpans: readonly unknown[] = [ 0, -1, 1.5, 'invalid', {} ];
		let invalidSpanIndex = 0;
		const getBlock = jest.fn( () => {
			const rowspan = invalidSpans[ invalidSpanIndex ];
			invalidSpanIndex++;
			return {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { colspan: 2 }, { rowspan } ] } ],
				},
			};
		} );
		const integration = createTableIntegration( { getBlock } );

		// 仕様上許可しない各span表現について、いずれも部分的なTable構造を返さない同じ契約を確認する。
		for ( let index = 0; index < invalidSpans.length; index++ ) {
			expect( integration.getStructure( `invalid-span-client-id-${ index }` ) ).toBeNull();
		}
	} );
} );
