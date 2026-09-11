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
	 * source側とdestination側の両方が縦結合により拒否される場合、source側の最初のblocking rangeを返すことを確認する。
	 *
	 * 事前条件:
	 * - tbodyには0〜1行と2〜4行を占有する縦結合セルが存在する。
	 * - 移動元は後者の範囲内、移動先境界は前者の内部にある。
	 *
	 * 操作:
	 * - blocking merged rangeを取得する。
	 *
	 * 期待結果:
	 * - destination側よりsource側が優先され、2〜4行の0-based・両端inclusive範囲が返る。
	 */
	it( 'when source and destination are both blocked, should return the source merged range first', () => {
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
		).toEqual( { rowStart: 2, rowEnd: 4 } );
	} );

	/**
	 * source側に問題がなくdestination側を複数の縦結合範囲が塞ぐ場合、開始行が小さい範囲を決定的に返すことを確認する。
	 *
	 * 事前条件:
	 * - 境界2を、0〜2行と1〜2行を占有する二つの縦結合範囲が塞いでいる。
	 * - 移動元行はどの縦結合範囲にも含まれない。
	 *
	 * 操作:
	 * - blocking merged rangeを取得する。
	 *
	 * 期待結果:
	 * - 開始行が小さい0〜2行の範囲が返る。
	 */
	it( 'when multiple destination ranges block a move, should return the range with the earliest start', () => {
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
		).toEqual( { rowStart: 0, rowEnd: 2 } );
	} );

	/**
	 * RF Apply前評価が現在Tableへ候補を再照合し、成立時だけ同じ評価から更新対象セル数を返すことを確認する。
	 *
	 * 事前条件:
	 * - tbodyの各行は1、2、3、4個の物理セルを持ち、結合セル制約はない。
	 * - 最終行を2行目へ移動する。
	 *
	 * 操作:
	 * - Apply assessmentを要求する。
	 *
	 * 期待結果:
	 * - 現在候補が成立し、表示位置が変わる2〜4行目の物理セル数9が返る。
	 */
	it( 'when the current row move is valid, should assess it with the affected cell count', () => {
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
		).toEqual( { affectedCellCount: 9 } );
	} );

	/**
	 * assessment後にTable構造が変化して現在候補が縦結合制約へ抵触した場合、確定更新を行わないことを確認する。
	 *
	 * 事前条件:
	 * - assessment時点では3行の通常Tableで候補が成立する。
	 * - 更新要求時点では移動元行を含む縦結合セルが追加されている。
	 *
	 * 操作:
	 * - assessment後に同じ候補をapplyRowMove()へ渡す。
	 *
	 * 期待結果:
	 * - assessmentは成功するが、更新直前再照合ではfalseになり、WordPress属性更新は行われない。
	 */
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
		} );
		expect( rowTableIntegration.applyRowMove( move ) ).toBe( false );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );
} );
