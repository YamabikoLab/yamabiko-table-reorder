/**
 * 列専用Table Integrationについて、WordPress Store境界の外側から、対応Table Block差を漏らさず現在の列制約取得とTable全体への確定済み列移動を提供する内部仕様を確認する。
 */

import { columnTableIntegration } from './table-integration';

jest.mock( '@wordpress/block-editor', () => ( {
	store: Symbol( 'block-editor-store' ),
} ) );

jest.mock( '@wordpress/data', () => ( {
	dispatch: jest.fn(),
	select: jest.fn(),
} ) );

const { dispatch: dispatchMock, select: selectMock } = jest.requireMock( '@wordpress/data' ) as {
	dispatch: jest.Mock;
	select: jest.Mock;
};

describe( 'Column Table Integration', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * Core TableのTable全体から論理列数とcolspanによる列制約を取得できることを確認する。
	 *
	 * 事前条件:
	 * - head・body・footは4論理列で構成される。
	 * - body先頭行には2列を占有する横結合セルがある。
	 * - bodyには縦結合セルがあり、後続行ではその論理列の物理セルが省略される。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからgetConstraints()を実行する。
	 *
	 * 期待結果:
	 * - Table全体のcolumnCountは4になる。
	 * - 横結合セル内部の境界1だけが移動先不可になる。
	 * - rowspanだけでは列制約を生成しない。
	 */
	it( 'when Core Table constraints are requested, should return logical column constraints across all sections', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					head: [ { cells: [ {}, {}, {}, {} ] } ],
					body: [ { cells: [ { colspan: 2 }, { rowspan: 2 }, {} ] }, { cells: [ {}, {}, {} ] } ],
					foot: [ { cells: [ {}, {}, {}, {} ] } ],
				},
			} ),
		} );

		expect( columnTableIntegration.getConstraints( 'table-a' ) ).toEqual( {
			columnCount: 4,
			blockedBoundaries: [ 1 ],
		} );
	} );

	/**
	 * Flexible Table Block固有の結合属性名をCore Tableと同じ論理列制約へ変換できることを確認する。
	 *
	 * 事前条件:
	 * - bodyは3論理列で構成される。
	 * - 先頭行には2列を占有する横結合セルと、2行を占有する縦結合セルがある。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからgetConstraints()を実行する。
	 *
	 * 期待結果:
	 * - `colSpan`と`rowSpan`が解釈される。
	 * - 横結合セル内部の境界1だけが列制約になる。
	 */
	it( 'when Flexible Table Block constraints are requested, should adapt camel-case merged-cell attributes', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'flexible-table-block/table',
				attributes: {
					body: [ { cells: [ { colSpan: 2 }, { rowSpan: 2 } ] }, { cells: [ {}, {} ] } ],
				},
			} ),
		} );

		expect( columnTableIntegration.getConstraints( 'table-b' ) ).toEqual( {
			columnCount: 3,
			blockedBoundaries: [ 1 ],
		} );
	} );

	/**
	 * 複数sectionの横結合セルが同じ境界または異なる境界を塞ぐ場合でも、Table全体の列制約を一意な昇順で取得できることを確認する。
	 *
	 * 事前条件:
	 * - headは境界2、bodyは境界1、footは再び境界2を横結合セルで塞ぐ4列Tableである。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからgetConstraints()を実行する。
	 *
	 * 期待結果:
	 * - 分断不可境界はsectionの出現順や重複に依存せず、境界1、2が一度ずつ昇順で返る。
	 */
	it( 'when merged cells block boundaries across sections, should return unique boundaries in ascending order', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					head: [ { cells: [ {}, { colspan: 2 }, {} ] } ],
					body: [ { cells: [ { colspan: 2 }, {}, {} ] } ],
					foot: [ { cells: [ {}, { colspan: 2 }, {} ] } ],
				},
			} ),
		} );

		expect( columnTableIntegration.getConstraints( 'table-a' ) ).toEqual( {
			columnCount: 4,
			blockedBoundaries: [ 1, 2 ],
		} );
	} );

	/**
	 * 行間またはsection間で論理列数が一致しないTableでは列制約を提供しないことを確認する。
	 *
	 * 事前条件:
	 * - 一つ目のTableはbody内の行が3列と2列で不一致である。
	 * - 二つ目のTableはheadが2列、bodyが3列で不一致である。
	 *
	 * 操作:
	 * - 各TableについてgetConstraints()を実行する。
	 *
	 * 期待結果:
	 * - どちらも安全なTable全体の列構造を提供できないためnullになる。
	 */
	it( 'when logical column counts do not match, should return null', () => {
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ {}, {}, {} ] }, { cells: [ {}, {} ] } ],
				},
			} )
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: {
					head: [ { cells: [ {}, {} ] } ],
					body: [ { cells: [ {}, {}, {} ] } ],
				},
			} );
		selectMock.mockReturnValue( { getBlock } );

		expect( columnTableIntegration.getConstraints( 'row-mismatch' ) ).toBeNull();
		expect( columnTableIntegration.getConstraints( 'section-mismatch' ) ).toBeNull();
	} );

	/**
	 * 対応外Block、消失したBlock、不完全なTable構造では列制約を提供しないことを確認する。
	 *
	 * 事前条件:
	 * - 要求ごとに非対応Block、null、body欠落、無効な結合属性を持つCore Tableが返る。
	 *
	 * 操作:
	 * - 各clientIdについてgetConstraints()を実行する。
	 *
	 * 期待結果:
	 * - いずれも正常な利用不能としてnullが返る。
	 */
	it( 'when the current Table cannot be integrated, should return null', () => {
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( { name: 'core/paragraph', attributes: {} } )
			.mockReturnValueOnce( null )
			.mockReturnValueOnce( { name: 'core/table', attributes: {} } )
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: { body: [ { cells: [ { colspan: 0 } ] } ] },
			} );
		selectMock.mockReturnValue( { getBlock } );

		expect( columnTableIntegration.getConstraints( 'unsupported' ) ).toBeNull();
		expect( columnTableIntegration.getConstraints( 'removed' ) ).toBeNull();
		expect( columnTableIntegration.getConstraints( 'missing-body' ) ).toBeNull();
		expect( columnTableIntegration.getConstraints( 'invalid-span' ) ).toBeNull();
	} );

	/**
	 * 右方向への確定済み列移動をhead・body・footへ一つの更新として反映できることを確認する。
	 *
	 * 事前条件:
	 * - head・body・footはA、B、C、Dに対応する4列で構成される。
	 * - B列をD列の後ろへ移動する確定済みColumnMoveを受け取る。
	 * - 各セルには内容以外の保持対象属性も存在する。
	 *
	 * 操作:
	 * - applyColumnMove()を実行する。
	 *
	 * 期待結果:
	 * - すべてのsectionがA、C、D、Bの列順になる。
	 * - セルオブジェクトと保持対象属性は変更されない。
	 * - Table属性は1回だけ更新される。
	 */
	it( 'when a confirmed column moves right, should update every section once while preserving cell data', () => {
		const updateBlockAttributes = jest.fn();
		const createRow = ( prefix: string ) => {
			const cells = [ 'A', 'B', 'C', 'D' ].map( ( suffix ) => ( {
				content: `${ prefix }-${ suffix }`,
				className: `cell-${ suffix }`,
			} ) );
			return { row: { cells, className: `${ prefix }-row` }, cells };
		};
		const head = createRow( 'head' );
		const body = createRow( 'body' );
		const foot = createRow( 'foot' );
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					head: [ head.row ],
					body: [ body.row ],
					foot: [ foot.row ],
				},
			} ),
		} );
		dispatchMock.mockReturnValue( { updateBlockAttributes } );

		expect(
			columnTableIntegration.applyColumnMove( {
				clientId: 'table-a',
				sourceColumnIndex: 1,
				destinationBoundaryIndex: 4,
			} )
		).toBe( true );

		expect( updateBlockAttributes ).toHaveBeenCalledTimes( 1 );
		expect( updateBlockAttributes ).toHaveBeenCalledWith( 'table-a', {
			head: [
				{
					...head.row,
					cells: [ head.cells[ 0 ], head.cells[ 2 ], head.cells[ 3 ], head.cells[ 1 ] ],
				},
			],
			body: [
				{
					...body.row,
					cells: [ body.cells[ 0 ], body.cells[ 2 ], body.cells[ 3 ], body.cells[ 1 ] ],
				},
			],
			foot: [
				{
					...foot.row,
					cells: [ foot.cells[ 0 ], foot.cells[ 2 ], foot.cells[ 3 ], foot.cells[ 1 ] ],
				},
			],
		} );
	} );

	/**
	 * rowspanで後続行の物理セルが省略されるTableでも、同じ論理列移動をTable全体へ反映できることを確認する。
	 *
	 * 事前条件:
	 * - body先頭行のAセルは2行を占有し、2行目にはA列の物理セルが存在しない。
	 * - 3列目をTable先頭へ移動する確定済みColumnMoveを受け取る。
	 *
	 * 操作:
	 * - applyColumnMove()を実行する。
	 *
	 * 期待結果:
	 * - 先頭行はC、A、Bの物理セル順になる。
	 * - 2行目はC列相当セル、B列相当セルの順になり、rowspanによる省略を保つ。
	 * - 縦結合属性は変更されない。
	 */
	it( 'when a column moves across a rowspan, should preserve the logical grid and omitted physical cells', () => {
		const updateBlockAttributes = jest.fn();
		const a = { content: 'A', rowspan: 2 };
		const b = { content: 'B' };
		const c = { content: 'C' };
		const b2 = { content: 'B2' };
		const c2 = { content: 'C2' };
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ a, b, c ] }, { cells: [ b2, c2 ] } ],
				},
			} ),
		} );
		dispatchMock.mockReturnValue( { updateBlockAttributes } );

		expect(
			columnTableIntegration.applyColumnMove( {
				clientId: 'table-a',
				sourceColumnIndex: 2,
				destinationBoundaryIndex: 0,
			} )
		).toBe( true );
		expect( updateBlockAttributes ).toHaveBeenCalledWith( 'table-a', {
			body: [ { cells: [ c, a, b ] }, { cells: [ c2, b2 ] } ],
		} );
	} );

	/**
	 * 横結合セルを分断しない移動先であれば、通常列を横結合範囲の反対側へ移動できることを確認する。
	 *
	 * 事前条件:
	 * - bodyは、先頭2列を占有する横結合セルと、C列、D列で構成される4列Tableである。
	 * - D列をTable先頭へ移動する確定済みColumnMoveを受け取る。
	 *
	 * 操作:
	 * - applyColumnMove()を実行する。
	 *
	 * 期待結果:
	 * - D列は横結合セルを分断せず、その前へ移動する。
	 * - 横結合セルは一つのセルとして保持され、colspanも変更されない。
	 */
	it( 'when a column crosses a merged range without splitting it, should preserve the merged cell as one unit', () => {
		const updateBlockAttributes = jest.fn();
		const merged = { content: 'AB', colspan: 2 };
		const c = { content: 'C' };
		const d = { content: 'D' };
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ merged, c, d ] } ],
				},
			} ),
		} );
		dispatchMock.mockReturnValue( { updateBlockAttributes } );

		expect(
			columnTableIntegration.applyColumnMove( {
				clientId: 'table-a',
				sourceColumnIndex: 3,
				destinationBoundaryIndex: 0,
			} )
		).toBe( true );
		expect( updateBlockAttributes ).toHaveBeenCalledWith( 'table-a', {
			body: [ { cells: [ d, merged, c ] } ],
		} );
	} );

	/**
	 * 現在の結合セル制約と矛盾する確定済み列移動ではTableを更新しないことを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableには列0、1を占有する横結合セルがある。
	 * - 横結合セルの左右の論理列を移動元にする要求と、横結合セル内部境界を移動先にする要求を順に受け取る。
	 *
	 * 操作:
	 * - 各要求についてapplyColumnMove()を実行する。
	 *
	 * 期待結果:
	 * - 横結合セルの各論理列は、直前または直後の分断不可境界によって移動元不可になる。
	 * - 横結合セル内部境界は移動先不可になる。
	 * - いずれもfalseになり、属性更新は行われない。
	 */
	it( 'when the current merged-cell constraints reject a confirmed move, should not update the Table', () => {
		const updateBlockAttributes = jest.fn();
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { colspan: 2 }, {} ] } ],
				},
			} ),
		} );
		dispatchMock.mockReturnValue( { updateBlockAttributes } );

		expect(
			columnTableIntegration.applyColumnMove( {
				clientId: 'table-a',
				sourceColumnIndex: 0,
				destinationBoundaryIndex: 3,
			} )
		).toBe( false );
		expect(
			columnTableIntegration.applyColumnMove( {
				clientId: 'table-a',
				sourceColumnIndex: 1,
				destinationBoundaryIndex: 3,
			} )
		).toBe( false );
		expect(
			columnTableIntegration.applyColumnMove( {
				clientId: 'table-a',
				sourceColumnIndex: 2,
				destinationBoundaryIndex: 1,
			} )
		).toBe( false );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );

	/**
	 * 確定後に現在Tableの列範囲が変化した場合は列移動を反映しないことを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableは3列である。
	 * - 現在の移動元範囲外を指す要求と、現在の移動先境界範囲外を指す要求を順に受け取る。
	 *
	 * 操作:
	 * - 各要求についてapplyColumnMove()を実行する。
	 *
	 * 期待結果:
	 * - どちらも外部状態変化による確定不能としてfalseになる。
	 * - Table属性は更新されない。
	 */
	it( 'when the current Table no longer matches the confirmed column range, should not update it', () => {
		const updateBlockAttributes = jest.fn();
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ {}, {}, {} ] } ],
				},
			} ),
		} );
		dispatchMock.mockReturnValue( { updateBlockAttributes } );

		expect(
			columnTableIntegration.applyColumnMove( {
				clientId: 'table-a',
				sourceColumnIndex: 3,
				destinationBoundaryIndex: 0,
			} )
		).toBe( false );
		expect(
			columnTableIntegration.applyColumnMove( {
				clientId: 'table-a',
				sourceColumnIndex: 0,
				destinationBoundaryIndex: 4,
			} )
		).toBe( false );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );

	/**
	 * 一部sectionを安全に解釈できない場合はTableのどこも更新しないことを確認する。
	 *
	 * 事前条件:
	 * - bodyは3列で有効である。
	 * - footは2列しかなく、Table全体の論理列数と一致しない。
	 *
	 * 操作:
	 * - applyColumnMove()を実行する。
	 *
	 * 期待結果:
	 * - falseが返り、bodyを含めて属性更新は一度も行われない。
	 */
	it( 'when any section cannot participate in the same logical column move, should not partially update the Table', () => {
		const updateBlockAttributes = jest.fn();
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ {}, {}, {} ] } ],
					foot: [ { cells: [ {}, {} ] } ],
				},
			} ),
		} );
		dispatchMock.mockReturnValue( { updateBlockAttributes } );

		expect(
			columnTableIntegration.applyColumnMove( {
				clientId: 'table-a',
				sourceColumnIndex: 0,
				destinationBoundaryIndex: 3,
			} )
		).toBe( false );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );
} );
