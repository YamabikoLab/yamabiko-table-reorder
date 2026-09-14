/**
 * 行専用Table IntegrationがDnD開始拒否に必要な移動元のblocking merged rangeだけを現在Tableから取得することを確認する。
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

describe( 'Row Table Integration start rejection contract', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * 概要:
	 * - Core TableとFlexible Table Blockのどちらでも、移動元行を含む縦結合範囲を同じContractで取得できることを確認する。
	 * 事前条件:
	 * - 2〜4行目を占有する縦結合セルが存在する。
	 * 操作:
	 * - 3行目を移動元としてblocking merged rangeを取得する。
	 * 期待結果:
	 * - 2〜4行目に対応する0-based・両端inclusiveの範囲が返る。
	 */
	it.each( [
		{ blockName: 'core/table', mergedCell: { rowspan: 3 } },
		{ blockName: 'flexible-table-block/table', mergedCell: { rowSpan: 3 } },
	] )(
		'when $blockName contains the source row in a merged range, should return that source blocking range',
		( { blockName, mergedCell } ) => {
			selectMock.mockReturnValue( {
				getBlock: jest.fn().mockReturnValue( {
					name: blockName,
					attributes: {
						body: [
							{ cells: [ {} ] },
							{ cells: [ mergedCell ] },
							{ cells: [ {} ] },
							{ cells: [ {} ] },
						],
					},
				} ),
			} );

			expect( rowTableIntegration.getSourceBlockingMergedRange( 'table-a', 2 ) ).toEqual( {
				rowStart: 1,
				rowEnd: 3,
			} );
		}
	);

	/**
	 * 概要:
	 * - 移動元行が縦結合範囲に含まれない場合は開始拒否範囲を作らないことを確認する。
	 * 事前条件:
	 * - 先頭2行だけを占有する縦結合セルが存在する。
	 * 操作:
	 * - 3行目を移動元としてblocking merged rangeを取得する。
	 * 期待結果:
	 * - nullが返る。
	 */
	it( 'when the source row is outside merged ranges, should return null', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { rowspan: 2 } ] }, { cells: [ {} ] }, { cells: [ {} ] } ],
				},
			} ),
		} );

		expect( rowTableIntegration.getSourceBlockingMergedRange( 'table-a', 2 ) ).toBeNull();
	} );
} );
