/**
 * 行専用Table IntegrationがRFへ提供する構造診断、反映前評価、更新直前再照合の契約を確認する。
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
	 * 移動元側と移動先側の両方が縦結合により拒否される場合、移動元側の原因セルを優先することを確認する。
	 *
	 * 事前条件:
	 * - tbodyには0〜1行と2〜4行を占有する縦結合セルが存在する。
	 * - 移動元は後者の範囲内、移動先境界は前者の内部にある。
	 *
	 * 操作:
	 * - 移動を妨げる結合セル位置を取得する。
	 *
	 * 期待結果:
	 * - 移動先側より移動元側が優先され、2〜4行・0列の0-based・両端を含む範囲が返る。
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
		).toEqual( { rowStart: 2, rowEnd: 4, columnStart: 0, columnEnd: 0 } );
	} );

	/**
	 * 移動元側に問題がなく移動先側を複数の縦結合セルが塞ぐ場合、開始行が小さい原因セルを決定的に返すことを確認する。
	 *
	 * 事前条件:
	 * - 境界2を、0〜2行と1〜2行を占有する二つの縦結合セルが塞いでいる。
	 * - 移動元行はどの縦結合セルにも含まれない。
	 *
	 * 操作:
	 * - 移動を妨げる結合セル位置を取得する。
	 *
	 * 期待結果:
	 * - 開始行が小さい0〜2行・0列の範囲が返る。
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
		).toEqual( { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 0 } );
	} );

	/**
	 * 同じ行範囲の結合セルが複数ある場合、開始論理列が小さいセルを決定的に返すことを確認する。
	 *
	 * 事前条件:
	 * - 同じ0〜1行を占有する縦結合セルが0列目と1〜2列目に存在する。
	 * - 移動先境界は両方の縦結合セルの内部にある。
	 *
	 * 操作:
	 * - 移動を妨げる結合セル位置を取得する。
	 *
	 * 期待結果:
	 * - 同じ行範囲では開始論理列が小さい0列目のセルが返る。
	 */
	it( 'when equal row ranges block a move, should prefer the earliest logical column', () => {
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
	 * rowspanとcolspanにより物理セル位置と論理列位置が異なる場合も、原因セルの論理列範囲を返すことを確認する。
	 *
	 * 事前条件:
	 * - 前行から継続する縦結合が、原因セル開始行の0列目を占有している。
	 * - 同じ行の前方セルが1〜2列目を横結合している。
	 * - 原因となる結合セルは1〜2行・3〜4列目を占有している。
	 *
	 * 操作:
	 * - 原因セルに含まれる行を移動元として、移動を妨げる結合セル位置を取得する。
	 *
	 * 期待結果:
	 * - 物理セル配列上の位置ではなく、1〜2行・3〜4列目の論理位置が返る。
	 */
	it( 'when rowspan and colspan shift a blocking cell from its physical index, should return its logical column range', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [
						{ cells: [ { rowspan: 2 }, {}, {}, {}, {} ] },
						{ cells: [ { colspan: 2 }, { rowspan: 2, colspan: 2 } ] },
						{ cells: [ {}, {}, {} ] },
					],
				},
			} ),
		} );

		expect(
			rowTableIntegration.getBlockingMergedRange( {
				clientId: 'table-a',
				sourceRowIndex: 2,
				destinationBoundaryIndex: 3,
			} )
		).toEqual( { rowStart: 1, rowEnd: 2, columnStart: 3, columnEnd: 4 } );
	} );

	/**
	 * RF反映前評価が現在Tableへ候補を再照合し、成立時に更新対象セル数と反映後の最終行位置を返すことを確認する。
	 *
	 * 事前条件:
	 * - tbodyの各行は1、2、3、4個の物理セルを持ち、結合セル制約はない。
	 * - 最終行を2行目へ移動する。
	 *
	 * 操作:
	 * - 反映前評価を要求する。
	 *
	 * 期待結果:
	 * - 表示位置が変わる2〜4行目の物理セル数9が返る。
	 * - 移動対象の反映後0-based最終行位置として1が返る。
	 */
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

	/**
	 * 後方へ移動するRF候補でも、移動元除去後の最終行位置を返すことを確認する。
	 *
	 * 事前条件:
	 * - 4行の通常Tableで先頭行を末尾境界へ移動する。
	 *
	 * 操作:
	 * - 反映前評価を要求する。
	 *
	 * 期待結果:
	 * - 移動元除去後の0-based最終行位置として3が返る。
	 */
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

	/**
	 * 現在Tableの縦結合制約により候補が成立しない場合、RF反映前評価を成立させないことを確認する。
	 *
	 * 事前条件:
	 * - 先頭セルが0〜1行を占有する縦結合を持つ3行Tableである。
	 * - 移動元行がその縦結合範囲に含まれる。
	 *
	 * 操作:
	 * - 反映前評価を要求する。
	 *
	 * 期待結果:
	 * - 現在Tableでは候補が成立しないためnullが返る。
	 */
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

	/**
	 * 反映前評価後にTable構造が変化して現在候補が縦結合制約へ抵触した場合、確定更新を行わないことを確認する。
	 *
	 * 事前条件:
	 * - 反映前評価時点では3行の通常Tableで候補が成立する。
	 * - 更新要求時点では移動元行を含む縦結合セルが追加されている。
	 *
	 * 操作:
	 * - 反映前評価後に同じ候補をapplyRowMove()へ渡す。
	 *
	 * 期待結果:
	 * - 反映前評価は成功するが、更新直前再照合ではfalseになり、WordPress属性更新は行われない。
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
			destinationRowIndex: 2,
		} );
		expect( rowTableIntegration.applyRowMove( move ) ).toBe( false );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );
} );