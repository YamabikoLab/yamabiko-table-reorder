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
	 * Core TableのRichText表現と文字列RichText表現を、利用者向け見出しへ正規化できることを確認する。
	 *
	 * 事前条件:
	 * - 1列目はtoPlainText()を提供する現在のRichText表現である。
	 * - 2列目は装飾markupを含む文字列である。
	 * - 3列目はHTML entityを含む文字列である。
	 *
	 * 操作:
	 * - RF用最小列記述を取得する。
	 *
	 * 期待結果:
	 * - RichText表現は表示用プレーンテキストとして公開される。
	 * - 装飾markupは除かれ、表示文字だけが公開される。
	 * - HTML entityは表示文字へ復元される。
	 */
	it( 'when head content uses RichText or HTML representations, should expose normalized plain-text headings', () => {
		const richTextHeading = {
			toPlainText: jest.fn().mockReturnValue( '商品名' ),
		};
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					head: [
						{
							cells: [
								{ content: richTextHeading },
								{ content: '<strong>価格</strong>' },
								{ content: 'A &amp; B' },
							],
						},
					],
					body: [ { cells: [ {}, {}, {} ] } ],
				},
			} ),
		} );

		expect( columnTableIntegration.getColumnInputDescriptors( 'table-a' ) ).toEqual( [
			{ columnIndex: 0, columnNumber: 1, heading: '商品名' },
			{ columnIndex: 1, columnNumber: 2, heading: '価格' },
			{ columnIndex: 2, columnNumber: 3, heading: 'A & B' },
		] );
		expect( richTextHeading.toPlainText ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * headが存在しない場合にbody先頭行を見出しとして推測しないことを確認する。
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

	/** 複数行headでは列番号fallbackへ委ねることを確認する。 */
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

	/** 横結合見出しを単一論理列の表示値として流用しないことを確認する。 */
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
	 * source側とdestination側の両方が横結合により拒否される場合、source側の原因セルを優先することを確認する。
	 */
	it( 'when source and destination are both blocked, should return the source merged cell first', () => {
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
		).toEqual( {
			section: 'body',
			rowStart: 0,
			rowEnd: 0,
			columnStart: 2,
			columnEnd: 3,
		} );
	} );

	/**
	 * destination側を複数の結合セルが塞ぐ場合、列範囲の決定順を優先することを確認する。
	 */
	it( 'when multiple destination merged cells block a move, should return the cell with the earliest column range', () => {
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
		).toEqual( {
			section: 'head',
			rowStart: 0,
			rowEnd: 0,
			columnStart: 0,
			columnEnd: 2,
		} );
	} );

	/**
	 * 同じ列範囲の原因セルが複数sectionにある場合、head、body、footの順で決定することを確認する。
	 */
	it( 'when equal column ranges block a move in multiple sections, should prefer the documented section order', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					head: [ { cells: [ { colspan: 2 }, {} ] } ],
					body: [ { cells: [ { colspan: 2 }, {} ] } ],
					foot: [ { cells: [ { colspan: 2 }, {} ] } ],
				},
			} ),
		} );

		expect(
			columnTableIntegration.getBlockingMergedRange( {
				clientId: 'table-a',
				sourceColumnIndex: 2,
				destinationBoundaryIndex: 1,
			} )
		).toEqual( {
			section: 'head',
			rowStart: 0,
			rowEnd: 0,
			columnStart: 0,
			columnEnd: 1,
		} );
	} );

	/** RF Apply前評価が更新対象セル数と反映後の最終列位置を返すことを確認する。 */
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

	/** 後方移動でも移動元除去後の最終列位置を返すことを確認する。 */
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

	/** 現在Tableの横結合制約で候補が成立しない場合、Apply前評価を成立させないことを確認する。 */
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

	/** assessment後に横結合制約が変化した場合、確定更新を行わないことを確認する。 */
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
