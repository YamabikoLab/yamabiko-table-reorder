/**
 * 列専用Table IntegrationがRFへ返す原因結合セルのsection内行範囲と論理列範囲を確認する。
 */

import { columnTableIntegration } from './table-integration';

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

describe( 'Column Table Integration RF blocking position', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * 原因セルが縦横の両方向へ結合している場合、Column RFへsection内の完全な矩形位置を返すことを確認する。
	 *
	 * 事前条件:
	 * - body先頭セルは0〜1行・0〜1列を占有する2行×2列の結合セルである。
	 * - 移動元列は結合セル外にあり、移動先境界1が原因セル内部にある。
	 *
	 * 操作:
	 * - 移動を妨げる結合セル位置を取得する。
	 *
	 * 期待結果:
	 * - 原因セルがbodyにあり、0〜1行・0〜1列を占有することが返る。
	 */
	it( 'when a blocking cell spans rows and columns, should return its full section-local rectangle', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [
						{ cells: [ { rowspan: 2, colspan: 2 }, {}, {} ] },
						{ cells: [ {}, {} ] },
					],
				},
			} ),
		} );

		expect(
			columnTableIntegration.getBlockingMergedRange( {
				clientId: 'table-a',
				sourceColumnIndex: 3,
				destinationBoundaryIndex: 1,
			} )
		).toEqual( {
			section: 'body',
			rowStart: 0,
			rowEnd: 1,
			columnStart: 0,
			columnEnd: 1,
		} );
	} );
} );
