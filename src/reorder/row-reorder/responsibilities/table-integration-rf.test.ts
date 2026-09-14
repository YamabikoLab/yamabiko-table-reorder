/**
 * 行専用Table IntegrationがRFへ提供する構造診断、Apply前評価、更新直前再照合のContractを確認する。
 */

import { rowTableIntegration } from './table-integration';

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

describe( 'Row Table Integration RF contract', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * source側とdestination側の両方が縦結合により拒否される場合、source側の原因セルを優先することを確認する。
	 */
	it( 'when source and destination are both blocked, should return the source merged cell first', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [
						{ cells: [ { rowspan: 2 } ] },
						{ cells: [ {} ] },
						{ cells: [ { rowspan: 3 } ] },
						{ cells: [ {} ] },
						{ cells: [ {} ] },
					],
				},
			} ),
		} );

		expect(
			rowTableIntegration.getBlockingMergedRange( {
				clientId: 'table-a',
				sourceRowIndex: 3,
				destinationBoundaryIndex: 1,
			} )
		).toEqual( { rowStart: 2, rowEnd: 4, columnStart: 0, columnEnd: 0 } );
	} );

	/**
	 * destination側を複数の縦結合セルが塞ぐ場合、行範囲の決定順を優先することを確認する。
	 */
	it( 'when multiple destination merged cells block a move, should return the cell with the earliest row range', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [
						{ cells: [ { rowspan: 3 } ] },
						{ cells: [ { rowspan: 2 } ] },
						{ cells: [ {} ] },
						{ cells: [ {} ] },
					],
				},
			} ),
		} );

		expect(
			rowTableIntegration.getBlockingMergedRange( {
				clientId: 'table-a',
				sourceRowIndex: 3,
				destinationBoundaryIndex: 2,
			} )
		).toEqual( { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 0 } );
	} );

	/**
	 * 同じ行範囲の縦結合セルが複数ある場合、論理列位置の小さい原因セルを決定的に返すことを確認する。
	 */
	it( 'when equal row ranges block a move, should prefer the merged cell with the earliest logical column', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [
						{ cells: [ { rowspan: 2 }, { rowspan: 2, colspan: 2 } ] },
						{ cells: [ {} ] },
						{ cells: [ {}, {}, {} ] },
					],
				},
			} ),
		} );

		expect(
			rowTableIntegration.getBlockingMergedRange( {
				clientId: 'table-a',
				sourceRowIndex: 2,
				destinationBoundaryIndex: 1,
			} )
		).toEqual( { rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 0 } );
	} );

	/**
	 * 先行する縦結合により物理セル位置と論理列位置がずれる場合も、原因セルの論理列を正しく返すことを確認する。
	 */
	it( 'when preceding rowspans shift physical cells, should report the logical column of the blocking cell', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [
						{ cells: [ { rowspan: 3 }, {} ] },
						{ cells: [ { rowspan: 2, colspan: 2 } ] },
						{ cells: [ {} ] },
						{ cells: [ {}, {}, {} ] },
					],
				},
			} ),
		} );

		expect(
			rowTableIntegration.getBlockingMergedRange( {
				clientId: 'table-a',
				sourceRowIndex: 3,
				destinationBoundaryIndex: 2,
			} )
		).toEqual( { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 0 } );

		expect(
			rowTableIntegration.getBlockingMergedRange( {
				clientId: 'table-a',
				sourceRowIndex: 3,
				destinationBoundaryIndex: 1,
			} )
		).toEqual( { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 0 } );
	} );

	/** RF Apply前評価が更新対象セル数と反映後の最終行位置を返すことを確認する。 */
	it( 'when the current row move is valid, should assess affected cells and the final row position', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [
						{ cells: [ {} ] },
						{ cells: [ {}, {} ] },
						{ cells: [ {}, {}, {} ] },
						{ cells: [ {}, {}, {}, {} ] },
					],
				},
			} ),
		} );

		expect(
			rowTableIntegration.assessRowMoveForApply( {
				clientId: 'table-a',
				sourceRowIndex: 3,
				destinationBoundaryIndex: 1,
			} )
		).toEqual( { affectedCellCount: 9, destinationRowIndex: 1 } );
	} );

	/** 後方移動でも移動元除去後の最終行位置を返すことを確認する。 */
	it( 'when a row moves toward a later boundary, should assess the post-removal destination row index', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ {} ] }, { cells: [ {} ] }, { cells: [ {} ] }, { cells: [ {} ] } ],
				},
			} ),
		} );

		expect(
			rowTableIntegration.assessRowMoveForApply( {
				clientId: 'table-a',
				sourceRowIndex: 0,
				destinationBoundaryIndex: 4,
			} )
		).toEqual( { affectedCellCount: 4, destinationRowIndex: 3 } );
	} );

	/** 現在Tableの縦結合制約で候補が成立しない場合、Apply前評価を成立させないことを確認する。 */
	it( 'when the current merged-cell constraints reject a row move, should not return an apply assessment', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { rowspan: 2 } ] }, { cells: [ {} ] }, { cells: [ {} ] } ],
				},
			} ),
		} );

		expect(
			rowTableIntegration.assessRowMoveForApply( {
				clientId: 'table-a',
				sourceRowIndex: 1,
				destinationBoundaryIndex: 3,
			} )
		).toBeNull();
	} );

	/** assessment後に縦結合制約が変化した場合、確定更新を行わないことを確認する。 */
	it( 'when merged-cell constraints change after assessment, should reject the final row update', () => {
		const updateBlockAttributes = jest.fn();
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ {} ] }, { cells: [ {} ] }, { cells: [ {} ] } ],
				},
			} )
			.mockReturnValueOnce( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { rowspan: 2 } ] }, { cells: [ {} ] }, { cells: [ {} ] } ],
				},
			} );
		selectMock.mockReturnValue( { getBlock } );
		dispatchMock.mockReturnValue( { updateBlockAttributes } );
		const move = {
			clientId: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 3,
		};

		expect( rowTableIntegration.assessRowMoveForApply( move ) ).toEqual( {
			affectedCellCount: 2,
			destinationRowIndex: 2,
		} );
		expect( rowTableIntegration.applyRowMove( move ) ).toBe( false );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );
} );
