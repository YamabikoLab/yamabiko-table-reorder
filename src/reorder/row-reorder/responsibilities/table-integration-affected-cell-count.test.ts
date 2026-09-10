/**
 * 行専用Table Integrationが、並び替えで表示位置が変わる範囲の物理セル数を算出することを確認する。
 */

import { rowTableIntegration } from './table-integration';

jest.mock( '@wordpress/block-editor', () => ( {
	store: Symbol( 'block-editor-store' ),
} ) );

jest.mock( '@wordpress/data', () => ( {
	dispatch: jest.fn(),
	select: jest.fn(),
} ) );

const { select: selectMock } = jest.requireMock( '@wordpress/data' ) as {
	select: jest.Mock;
};

describe( 'Row Table Integration affected cell count', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * 長距離の行移動では、移動元から挿入先までに含まれる物理セルだけを数えることを確認する。
	 *
	 * 事前条件:
	 * - tbodyの各行は2、3、1、4個の物理セルを持つ。
	 * - 最終行を2行目へ移動する。
	 *
	 * 操作:
	 * - 更新対象セル数を取得する。
	 *
	 * 期待結果:
	 * - 表示位置が変わる2〜4行目の物理セル数8が返る。
	 */
	it( 'when a row moves across multiple rows, should count physical cells only in the affected range', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [
						{ cells: [ {}, {} ] },
						{ cells: [ {}, {}, {} ] },
						{ cells: [ {} ] },
						{ cells: [ {}, {}, {}, {} ] },
					],
				},
			} ),
		} );

		expect(
			rowTableIntegration.getAffectedCellCount( {
				clientId: 'table-a',
				sourceRowIndex: 3,
				destinationBoundaryIndex: 1,
			} )
		).toBe( 8 );
	} );

	/**
	 * Table構造を安全に解釈できない場合は更新対象セル数を推測しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Core Tableのtbody行がセル配列を持たない。
	 *
	 * 操作:
	 * - 更新対象セル数を取得する。
	 *
	 * 期待結果:
	 * - nullが返る。
	 */
	it( 'when the affected row range cannot be interpreted safely, should return null', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: { body: [ { cells: [ {} ] }, {} ] },
			} ),
		} );

		expect(
			rowTableIntegration.getAffectedCellCount( {
				clientId: 'table-a',
				sourceRowIndex: 1,
				destinationBoundaryIndex: 0,
			} )
		).toBeNull();
	} );
} );
