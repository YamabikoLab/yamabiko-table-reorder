/**
 * 行専用Table Integrationについて、WordPress Store境界の外側から、対応Table Block差を漏らさず現在の行構造取得と確定済み行移動の反映を提供する内部仕様を確認する。
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

describe( 'Table Integration', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * 概要:
	 * - Core Tableの現在行数とrowspanによる分断不可境界を取得できることを確認する。
	 *
	 * 事前条件:
	 * - tbodyは4行で、2行目に3行を占有するセルが存在する。
	 * - colspanだけを持つセルも存在する。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからgetStructure()を実行する。
	 *
	 * 期待結果:
	 * - rowCountは4になる。
	 * - rowspan内部の境界2、3だけが重複なく昇順で返る。
	 * - colspanは行方向の制約を生成しない。
	 */
	it( 'when Core Table structure is requested, should return row count and blocked row boundaries', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [
						{ cells: [ { colspan: 2 } ] },
						{ cells: [ { rowspan: 3 }, { rowspan: 2 } ] },
						{ cells: [ {} ] },
						{ cells: [ {} ] },
					],
				},
			} ),
		} );

		expect( rowTableIntegration.getStructure( 'table-a' ) ).toEqual( {
			rowCount: 4,
			blockedBoundaries: [ 2, 3 ],
		} );
	} );

	/**
	 * 概要:
	 * - Flexible Table BlockのrowSpanだけをCore Tableと同じ行制約へ変換できることを確認する。
	 *
	 * 事前条件:
	 * - tbodyは3行で、先頭行に3行を占有するセルが存在する。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからgetStructure()を実行する。
	 *
	 * 期待結果:
	 * - Flexible Table Block固有のrowSpanが解釈され、境界1、2が返る。
	 */
	it( 'when Flexible Table Block structure is requested, should adapt rowSpan to the same row structure', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'flexible-table-block/table',
				attributes: {
					body: [ { cells: [ { rowSpan: 3 } ] }, { cells: [] }, { cells: [] } ],
				},
			} ),
		} );

		expect( rowTableIntegration.getStructure( 'table-b' ) ).toEqual( {
			rowCount: 3,
			blockedBoundaries: [ 1, 2 ],
		} );
	} );

	/**
	 * 概要:
	 * - 対応外Block、消失したBlock、不完全なTable構造では行構造を提供しないことを確認する。
	 *
	 * 事前条件:
	 * - 要求ごとに非対応Block、null、body欠落のCore Tableが返る。
	 *
	 * 操作:
	 * - 各clientIdについて公開されたTable IntegrationからgetStructure()を実行する。
	 *
	 * 期待結果:
	 * - いずれも正常な不在としてnullが返る。
	 */
	it( 'when the current Table cannot be integrated, should return null', () => {
		const getBlock = jest
			.fn()
			.mockReturnValueOnce( { name: 'core/paragraph', attributes: {} } )
			.mockReturnValueOnce( null )
			.mockReturnValueOnce( { name: 'core/table', attributes: {} } );
		selectMock.mockReturnValue( { getBlock } );

		expect( rowTableIntegration.getStructure( 'unsupported' ) ).toBeNull();
		expect( rowTableIntegration.getStructure( 'removed' ) ).toBeNull();
		expect( rowTableIntegration.getStructure( 'invalid' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 下方向への確定済み行移動で、移動前の境界位置を移動元行の削除後も同じ移動先を表す位置へ変換できることを確認する。
	 *
	 * 事前条件:
	 * - tbodyはA、B、C、Dの4行である。
	 * - BをDの後ろへ移動する確定済みRowMoveを受け取る。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからapplyRowMove()を実行する。
	 *
	 * 期待結果:
	 * - bodyはA、C、D、Bの順で1回更新される。
	 */
	it( 'when a confirmed row moves downward, should preserve the requested destination after removing the source row', () => {
		const updateBlockAttributes = jest.fn();
		const rows = [ 'A', 'B', 'C', 'D' ].map( ( content ) => ( {
			cells: [ { content } ],
		} ) );
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: { body: rows },
			} ),
		} );
		dispatchMock.mockReturnValue( { updateBlockAttributes } );

		expect(
			rowTableIntegration.applyRowMove( {
				clientId: 'table-a',
				sourceRowIndex: 1,
				destinationBoundaryIndex: 4,
			} )
		).toBe( true );
		expect( updateBlockAttributes ).toHaveBeenCalledWith( 'table-a', {
			body: [ rows[ 0 ], rows[ 2 ], rows[ 3 ], rows[ 1 ] ],
		} );
	} );

	/**
	 * 概要:
	 * - 更新要求時点で行範囲が変化した場合に更新しないことを確認する。
	 *
	 * 事前条件:
	 * - Tableは2行だけ存在する。
	 * - 移動元が現在の行範囲外となったRowMoveを受け取る。
	 *
	 * 操作:
	 * - 公開されたTable IntegrationからapplyRowMove()を実行する。
	 *
	 * 期待結果:
	 * - falseが返り、属性更新は行われない。
	 */
	it( 'when the current Table no longer matches the confirmed row range, should not update it', () => {
		const updateBlockAttributes = jest.fn();
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: { body: [ { cells: [] }, { cells: [] } ] },
			} ),
		} );
		dispatchMock.mockReturnValue( { updateBlockAttributes } );

		expect(
			rowTableIntegration.applyRowMove( {
				clientId: 'table-a',
				sourceRowIndex: 2,
				destinationBoundaryIndex: 0,
			} )
		).toBe( false );
		expect( updateBlockAttributes ).not.toHaveBeenCalled();
	} );
} );
