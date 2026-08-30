/**
 * Table Integrationが対応Table Blockの現在データから共通Table構造を提供する主要な振る舞いを確認する。
 *
 * Core TableとFlexible Table Blockの結合範囲属性差、論理Tableグリッド上の位置復元、要求ごとの
 * current Block再取得、大規模Tableでの構造復元、および安全に構造を提供できない場合の振る舞いを確認する。
 */
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
	 * 1,000行×20列の大規模Tableで複数の縦結合・横結合が入り組んでも、共通Table構造を正しく復元できることを確認する。
	 *
	 * 事前条件:
	 * - bodyは1,000行×20論理列で構成され、通常セルが大部分を占める。
	 * - body内の複数箇所に、縦結合・横結合・縦横両方の結合セルが合計20個存在する。
	 * - 近接する結合セル同士が後続行の論理列配置へ影響する領域を含む。
	 *
	 * 操作:
	 * - getStructure()を1回実行し、その処理時間を計測する。
	 *
	 * 期待結果:
	 * - 20個すべての結合セルについて、区画、開始行、開始列、縦結合数、横結合数が期待値と一致する。
	 * - 計測結果から1,000行×20列の構造取得に要した時間を確認できる。
	 */
	it( 'when a 1000 by 20 table has complex merged cells, should restore every merged cell and report processing time', () => {
		const rowCount = 1_000;
		const columnCount = 20;
		const mergedCellPlans = [
			{ rowStart: 12, columnStart: 2, rowSpan: 4, columnSpan: 2 },
			{ rowStart: 12, columnStart: 8, rowSpan: 3, columnSpan: 3 },
			{ rowStart: 13, columnStart: 5, rowSpan: 1, columnSpan: 2 },
			{ rowStart: 14, columnStart: 12, rowSpan: 4, columnSpan: 2 },
			{ rowStart: 15, columnStart: 4, rowSpan: 3, columnSpan: 3 },
			{ rowStart: 16, columnStart: 0, rowSpan: 2, columnSpan: 2 },
			{ rowStart: 16, columnStart: 8, rowSpan: 2, columnSpan: 3 },
			{ rowStart: 18, columnStart: 1, rowSpan: 5, columnSpan: 2 },
			{ rowStart: 18, columnStart: 5, rowSpan: 2, columnSpan: 4 },
			{ rowStart: 19, columnStart: 10, rowSpan: 4, columnSpan: 2 },
			{ rowStart: 20, columnStart: 4, rowSpan: 3, columnSpan: 3 },
			{ rowStart: 21, columnStart: 13, rowSpan: 2, columnSpan: 4 },
			{ rowStart: 100, columnStart: 0, rowSpan: 10, columnSpan: 2 },
			{ rowStart: 102, columnStart: 3, rowSpan: 4, columnSpan: 3 },
			{ rowStart: 105, columnStart: 7, rowSpan: 2, columnSpan: 5 },
			{ rowStart: 500, columnStart: 15, rowSpan: 8, columnSpan: 2 },
			{ rowStart: 503, columnStart: 10, rowSpan: 3, columnSpan: 3 },
			{ rowStart: 700, columnStart: 2, rowSpan: 2, columnSpan: 6 },
			{ rowStart: 850, columnStart: 5, rowSpan: 6, columnSpan: 4 },
			{ rowStart: 995, columnStart: 12, rowSpan: 5, columnSpan: 3 },
		] as const;
		const mergeByStart = new Map(
			mergedCellPlans.map( ( mergedCell ) => [
				`${ mergedCell.rowStart }:${ mergedCell.columnStart }`,
				mergedCell,
			] )
		);
		const occupied = Array.from( { length: rowCount }, () =>
			Array< boolean >( columnCount ).fill( false )
		);

		// 大規模Tableの各論理行を構築し、結合セルで占有済みの位置を除いた物理セル列を再現する。
		const body = Array.from( { length: rowCount }, ( _, rowStart ) => {
			const cells: Record< string, number >[] = [];

			// 1行分の全論理列を評価し、結合セルの占有状態を反映した物理セル列を構築する。
			for ( let columnStart = 0; columnStart < columnCount; columnStart++ ) {
				// 先行する結合セルが占有する論理位置には、新しい物理セルを作成しない。
				if ( occupied[ rowStart ][ columnStart ] ) {
					continue;
				}

				const mergedCell = mergeByStart.get( `${ rowStart }:${ columnStart }` );
				// 結合計画のない位置は通常セルとして1行1列を占有する。
				if ( ! mergedCell ) {
					cells.push( {} );
					continue;
				}

				const cell: Record< string, number > = {};
				// 縦方向に複数行を占有する場合だけCore Tableの結合属性を付与する。
				if ( mergedCell.rowSpan > 1 ) {
					cell.rowspan = mergedCell.rowSpan;
				}
				// 横方向に複数列を占有する場合だけCore Tableの結合属性を付与する。
				if ( mergedCell.columnSpan > 1 ) {
					cell.colspan = mergedCell.columnSpan;
				}
				cells.push( cell );

				// 結合セルが占有する論理領域全体を記録し、後続行・後続列で重複する物理セルを生成しない。
				for ( let row = rowStart; row < rowStart + mergedCell.rowSpan; row++ ) {
					// 現在の結合セルが横方向に占有するすべての論理列を同じ占有領域として扱う。
					for (
						let column = columnStart;
						column < columnStart + mergedCell.columnSpan;
						column++
					) {
						occupied[ row ][ column ] = true;
					}
				}
			}

			return { cells };
		} );
		const integration = createTableIntegration( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: { body },
			} ),
		} );

		const startedAt = performance.now();
		const structure = integration.getStructure( 'large-core-table-client-id' );
		const elapsedMilliseconds = performance.now() - startedAt;

		process.stdout.write(
			`Table Integration: 1,000 rows x 20 columns processed in ${ elapsedMilliseconds.toFixed( 3 ) } ms\n`
		);

		expect( structure ).toEqual( {
			mergedCells: mergedCellPlans.map( ( mergedCell ) => ( {
				section: 'body',
				...mergedCell,
			} ) ),
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
