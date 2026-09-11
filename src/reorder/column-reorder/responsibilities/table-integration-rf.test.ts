/**
 * 列専用Table IntegrationがRFへ提供する最小列記述、構造診断、Apply前評価、更新直前再照合のContractを確認する。
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

describe( 'Column Table Integration RF contract', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * 明示的なhead sectionから、論理列Identity、利用者向け列番号、利用可能な見出しだけを取得できることを確認する。
	 *
	 * 事前条件:
	 * - Core Tableは3論理列で、一行のheadに商品名、価格、空見出しがある。
	 *
	 * 操作:
	 * - RF用最小列記述を取得する。
	 *
	 * 期待結果:
	 * - columnIndexは0-based、columnNumberは1-basedになる。
	 * - 空見出しだけheadingがnullになる。
	 */
	it( 'when a simple head is available, should return minimal column descriptors with usable headings', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					head: [
						{
							cells: [ { content: '商品名' }, { content: '価格' }, { content: '   ' } ],
						},
					],
					body: [ { cells: [ {}, {}, {} ] } ],
				},
			} ),
		} );

		expect( columnTableIntegration.getColumnInputDescriptors( 'table-a' ) ).toEqual( [
			{ columnIndex: 0, columnNumber: 1, heading: '商品名' },
			{ columnIndex: 1, columnNumber: 2, heading: '価格' },
			{ columnIndex: 2, columnNumber: 3, heading: null },
		] );
	} );

	/**
	 * headが存在しない場合にbody先頭行を見出しとして推測しないことを確認する。
	 *
	 * 事前条件:
	 * - body先頭行には文字列contentがあるがheadは存在しない。
	 *
	 * 操作:
	 * - RF用最小列記述を取得する。
	 *
	 * 期待結果:
	 * - 論理列Identityと列番号だけが返り、すべてのheadingはnullになる。
	 */
	it( 'when head is absent, should not infer headings from the first body row', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { content: 'A' }, { content: 'B' } ] } ],
				},
			} ),
		} );

		expect( columnTableIntegration.getColumnInputDescriptors( 'table-a' ) ).toEqual( [
			{ columnIndex: 0, columnNumber: 1, heading: null },
			{ columnIndex: 1, columnNumber: 2, heading: null },
		] );
	} );

	/**
	 * 横結合見出しを単一論理列の表示値として流用しないことを確認する。
	 *
	 * 事前条件:
	 * - head先頭セルは2論理列を占有し、3列目だけ単一列見出しを持つ。
	 * - bodyは同じ3論理列で構成される。
	 *
	 * 操作:
	 * - RF用最小列記述を取得する。
	 *
	 * 期待結果:
	 * - 横結合セルが占有する1・2列目のheadingはnullになり、3列目だけ見出しを利用する。
	 */
	it( 'when a head cell spans multiple columns, should not use it as a single-column heading', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					head: [ { cells: [ { content: '商品', colspan: 2 }, { content: '価格' } ] } ],
					body: [ { cells: [ {}, {}, {} ] } ],
				},
			} ),
		} );

		expect( columnTableIntegration.getColumnInputDescriptors( 'table-a' ) ).toEqual( [
			{ columnIndex: 0, columnNumber: 1, heading: null },
			{ columnIndex: 1, columnNumber: 2, heading: null },
			{ columnIndex: 2, columnNumber: 3, heading: '価格' },
		] );
	} );

	/**
	 * source側とdestination側の両方が横結合により拒否される場合、source側のblocking rangeを優先することを確認する。
	 *
	 * 事前条件:
	 * - 0〜1列と2〜3列を占有する二つの横結合セルがある。
	 * - 移動元は後者の範囲内、移動先境界は前者の内部にある。
	 *
	 * 操作:
	 * - blocking merged rangeを取得する。
	 *
	 * 期待結果:
	 * - destination側よりsource側が優先され、2〜3列の0-based・両端inclusive範囲が返る。
	 */
	it( 'when source and destination are both blocked, should return the source column range first', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { colspan: 2 }, { colspan: 2 } ] } ],
				},
			} ),
		} );

		expect(
			columnTableIntegration.getBlockingMergedRange( {
				clientId: 'table-a',
				sourceColumnIndex: 2,
				destinationBoundaryIndex: 1,
			} )
		).toEqual( { columnStart: 2, columnEnd: 3 } );
	} );

	/**
	 * RF Apply前評価が現在Tableへ候補を再照合し、成立時だけ同じ評価から更新対象セル数を返すことを確認する。
	 *
	 * 事前条件:
	 * - 4論理列の通常Tableで3列目を先頭へ移動する。
	 *
	 * 操作:
	 * - Apply assessmentを要求する。
	 *
	 * 期待結果:
	 * - 現在候補が成立し、影響する0〜2列の物理セル数3が返る。
	 */
	it( 'when the current column move is valid, should assess it with the affected cell count', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ {}, {}, {}, {} ] } ],
				},
			} ),
		} );

		expect(
			columnTableIntegration.assessColumnMoveForApply( {
				clientId: 'table-a',
				sourceColumnIndex: 2,
				destinationBoundaryIndex: 0,
			} )
		).toEqual( { affectedCellCount: 3 } );
	} );

	/**
	 * assessment後にTable構造が変化して現在候補が横結合制約へ抵触した場合、確定更新を行わないことを確認する。
	 *
	 * 事前条件:
	 * - assessment時点では4列の通常Tableで候補が成立する。
	 * - 更新要求時点では移動元列を含む横結合セルが追加されている。
	 *
	 * 操作:
	 * - assessment後に同じ候補をapplyColumnMove()へ渡す。
	 *
	 * 期待結果:
	 * - assessmentは成功するが、更新直前再照合ではfalseになり、WordPress属性更新は行われない。
	 */
	it( 'when merged-cell constraints change after assessment, should reject the final column update', () => {
		const updateBlockAttributes = jest.fn();
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ {}, {}, {}, {} ] } ],
				},
			} )
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ {}, { colspan: 2 }, {} ] } ],
				},
			} );
		selectMock.mockReturnValue( { getBlock } );
		dispatchMock.mockReturnValue( { updateBlockAttributes } );
		const move = {
			clientId: 'table-a',
			sourceColumnIndex: 2,
			destinationBoundaryIndex: 0,
		};

		expect( columnTableIntegration.assessColumnMoveForApply( move ) ).toEqual( {
			affectedCellCount: 3,
		} );
		expect( columnTableIntegration.applyColumnMove( move ) ).toBe( false );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );
} );
