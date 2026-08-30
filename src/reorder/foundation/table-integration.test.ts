import { createTableIntegration } from './table-integration';

describe( 'Table Integration', () => {
	/**
	 * Core Tableの結合セルだけを共通Table構造として取得できることを確認する。
	 *
	 * 事前条件:
	 * - 対象BlockはCore Tableである。
	 * - headには横結合、bodyには縦結合、footには通常セルだけが存在する。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - 通常セルは保持されない。
	 * - `rowspan` / `colspan`が論理Tableグリッド上の結合範囲へ変換される。
	 */
	it( 'when Core Table structure is requested, should return only merged cells', () => {
		const getBlock = jest.fn().mockReturnValue( {
			name: 'core/table',
			attributes: {
				head: [ { cells: [ { colspan: 2 }, {} ] } ],
				body: [ { cells: [ {}, { rowspan: 2 }, {} ] }, { cells: [ {}, {} ] } ],
				foot: [ { cells: [ {}, {}, {} ] } ],
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
	 * Flexible Table Blockの属性名差分を吸収し、縦結合で占有された列を避けて論理列を復元できることを確認する。
	 *
	 * 事前条件:
	 * - 対象BlockはFlexible Table Blockである。
	 * - 1行目の先頭セルが2行を占有する。
	 * - 2行目の先頭物理セルが2列を占有する。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - `rowSpan` / `colSpan`が解釈される。
	 * - 2行目の横結合セルは論理列1から開始する。
	 */
	it( 'when Flexible Table Block has overlapping spans, should restore logical columns', () => {
		const integration = createTableIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'flexible-table-block/table',
				attributes: {
					body: [ { cells: [ { rowSpan: 2 }, {}, {} ] }, { cells: [ { colSpan: 2 } ] } ],
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
	 * 同じclientIdへの要求でも現在のBlockを毎回取得することを確認する。
	 *
	 * 事前条件:
	 * - 1回目と2回目で同じclientIdに対する現在Blockの内容が変わる。
	 *
	 * 操作:
	 * - getStructure()を2回実行する。
	 *
	 * 期待結果:
	 * - getBlock()が要求ごとに呼ばれる。
	 * - 2回目は1回目のBlockやTable構造を再利用しない。
	 */
	it( 'when the same clientId is requested again, should reacquire the current block', () => {
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: { body: [ { cells: [ { colspan: 2 } ] } ] },
			} )
			.mockReturnValueOnce( {
				name: 'flexible-table-block/table',
				attributes: { body: [ { cells: [ { colSpan: 3 } ] } ] },
			} );
		const integration = createTableIntegration( { getBlock } );

		expect( integration.getStructure( 'table-client-id' )?.mergedCells[ 0 ]?.columnSpan ).toBe( 2 );
		expect( integration.getStructure( 'table-client-id' )?.mergedCells[ 0 ]?.columnSpan ).toBe( 3 );
		expect( getBlock ).toHaveBeenCalledTimes( 2 );
	} );

	/**
	 * 非対応Blockまたは不完全なTableデータから部分的な共通Table構造を作らないことを確認する。
	 *
	 * 事前条件:
	 * - 非対応Block、body欠落、不正spanのケースが存在する。
	 *
	 * 操作:
	 * - 各ケースでgetStructure()を実行する。
	 *
	 * 期待結果:
	 * - いずれもnullを返す。
	 */
	it( 'when the current block cannot be integrated, should return null', () => {
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( { name: 'core/paragraph', attributes: {} } )
			.mockReturnValueOnce( { name: 'core/table', attributes: {} } )
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: { body: [ { cells: [ { rowspan: 0 } ] } ] },
			} );
		const integration = createTableIntegration( { getBlock } );

		expect( integration.getStructure( 'unsupported-client-id' ) ).toBeNull();
		expect( integration.getStructure( 'missing-body-client-id' ) ).toBeNull();
		expect( integration.getStructure( 'invalid-span-client-id' ) ).toBeNull();
	} );

	/**
	 * 省略可能なhead / footを空区画として扱い、bodyだけのTableを取得できることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableはbodyだけを持つ。
	 *
	 * 操作:
	 * - getStructure()を実行する。
	 *
	 * 期待結果:
	 * - bodyの結合セルだけを含む共通Table構造が返る。
	 */
	it( 'when optional sections are absent, should treat them as empty sections', () => {
		const integration = createTableIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: { body: [ { cells: [ { colspan: '2' }, {} ] } ] },
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
} );
