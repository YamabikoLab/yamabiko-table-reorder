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
	 * 保存用RichText表現を自前で解析せず、利用可能な見出しだけ表示値として公開することを確認する。
	 *
	 * 事前条件:
	 * - 1列目は実HTML markupを含むRichText文字列である。
	 * - 2列目はHTML entityを含む文字列である。
	 * - 3列目は通常のプレーンテキスト見出しである。
	 *
	 * 操作:
	 * - RF用最小列記述を取得する。
	 *
	 * 期待結果:
	 * - 実HTML markupを含む1列目はheadingがnullになり、列番号fallbackへ委ねる。
	 * - HTML entityはWordPressの変換APIで表示文字へ復元される。
	 * - プレーンテキストはそのままheadingとして返る。
	 */
	it( 'when head content contains markup or entities, should expose only safely normalized headings', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					head: [
						{
							cells: [
								{ content: '<strong>商品名</strong>' },
								{ content: 'A &amp; B' },
								{ content: '価格' },
							],
						},
					],
					body: [ { cells: [ {}, {}, {} ] } ],
				},
			} ),
		} );

		expect( columnTableIntegration.getColumnInputDescriptors( 'table-a' ) ).toEqual( [
			{ columnIndex: 0, columnNumber: 1, heading: null },
			{ columnIndex: 1, columnNumber: 2, heading: 'A & B' },
			{ columnIndex: 2, columnNumber: 3, heading: '価格' },
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
	 * 複数行headでは単一論理列の安定した見出しを決めず、列番号fallbackをPresentationへ委ねることを確認する。
	 *
	 * 事前条件:
	 * - headは2行で構成され、各行に同じ2論理列の文字列contentがある。
	 * - bodyも2論理列で構成される。
	 *
	 * 操作:
	 * - RF用最小列記述を取得する。
	 *
	 * 期待結果:
	 * - 論理列Identityと列番号だけが返り、すべてのheadingはnullになる。
	 */
	it( 'when head has multiple rows, should leave every heading unavailable', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					head: [
						{ cells: [ { content: '上段A' }, { content: '上段B' } ] },
						{ cells: [ { content: '下段A' }, { content: '下段B' } ] },
					],
					body: [ { cells: [ {}, {} ] } ],
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
	 * source側に問題がなくdestination側を複数の横結合範囲が塞ぐ場合、開始論理列が小さい範囲を決定的に返すことを確認する。
	 *
	 * 事前条件:
	 * - headには0〜2列を占有する横結合セル、bodyには1〜2列を占有する横結合セルがある。
	 * - 移動元列はどの横結合範囲にも含まれず、移動先境界2を両方の範囲が塞ぐ。
	 *
	 * 操作:
	 * - blocking merged rangeを取得する。
	 *
	 * 期待結果:
	 * - sectionの解析順序に依存せず、開始論理列が小さい0〜2列の範囲が返る。
	 */
	it( 'when multiple destination column ranges block a move, should return the range with the earliest start', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					head: [ { cells: [ { colspan: 3 }, {} ] } ],
					body: [ { cells: [ {}, { colspan: 2 }, {} ] } ],
				},
			} ),
		} );

		expect(
			columnTableIntegration.getBlockingMergedRange( {
				clientId: 'table-a',
				sourceColumnIndex: 3,
				destinationBoundaryIndex: 2,
			} )
		).toEqual( { columnStart: 0, columnEnd: 2 } );
	} );

	/**
	 * RF Apply前評価が現在Tableへ候補を再照合し、成立時に更新対象セル数と反映後の最終列位置を返すことを確認する。
	 *
	 * 事前条件:
	 * - 4論理列の通常Tableで3列目を先頭へ移動する。
	 *
	 * 操作:
	 * - Apply assessmentを要求する。
	 *
	 * 期待結果:
	 * - 影響する0〜2列の物理セル数3が返る。
	 * - 移動対象の反映後0-based最終列位置として0が返る。
	 */
	it( 'when the current column move is valid, should assess affected cells and the final column position', () => {
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
		).toEqual( { affectedCellCount: 3, destinationColumnIndex: 0 } );
	} );

	/**
	 * 後方へ移動するRF候補でも、移動元除去後の最終列位置を返すことを確認する。
	 *
	 * 事前条件:
	 * - 4論理列の通常Tableで先頭列を末尾境界へ移動する。
	 *
	 * 操作:
	 * - Apply assessmentを要求する。
	 *
	 * 期待結果:
	 * - 移動元除去後の0-based最終列位置として3が返る。
	 */
	it( 'when a column moves toward a later boundary, should assess the post-removal destination column index', () => {
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
				sourceColumnIndex: 0,
				destinationBoundaryIndex: 4,
			} )
		).toEqual( { affectedCellCount: 4, destinationColumnIndex: 3 } );
	} );

	/**
	 * 現在Tableの横結合制約により候補が成立しない場合、RF Apply前評価を成立させないことを確認する。
	 *
	 * 事前条件:
	 * - 0〜1列を占有する横結合セルを含む3論理列Tableである。
	 * - 移動元論理列がその横結合範囲に含まれる。
	 *
	 * 操作:
	 * - Apply assessmentを要求する。
	 *
	 * 期待結果:
	 * - 現在Tableでは候補が成立しないためnullが返る。
	 */
	it( 'when the current merged-cell constraints reject a column move, should not return an apply assessment', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { colspan: 2 }, {} ] } ],
				},
			} ),
		} );

		expect(
			columnTableIntegration.assessColumnMoveForApply( {
				clientId: 'table-a',
				sourceColumnIndex: 1,
				destinationBoundaryIndex: 3,
			} )
		).toBeNull();
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
			destinationColumnIndex: 0,
		} );
		expect( columnTableIntegration.applyColumnMove( move ) ).toBe( false );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );
} );
