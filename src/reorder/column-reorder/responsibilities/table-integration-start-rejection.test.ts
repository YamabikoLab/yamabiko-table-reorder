/**
 * 列専用Table IntegrationがDnD開始拒否に必要な移動元のblocking merged rangeだけを現在Tableから取得することを確認する。
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

describe( 'Column Table Integration start rejection contract', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * 概要:
	 * - Core TableとFlexible Table Blockのどちらでも、移動元列を含む横結合範囲を同じContractで取得できることを確認する。
	 * 事前条件:
	 * - 2〜4列目を占有する横結合セルが存在する。
	 * 操作:
	 * - 3列目を移動元としてblocking merged rangeを取得する。
	 * 期待結果:
	 * - 2〜4列目に対応する0-based・両端inclusiveの範囲が返る。
	 */
	it.each( [
		{ blockName: 'core/table', mergedCell: { colspan: 3 } },
		{ blockName: 'flexible-table-block/table', mergedCell: { colSpan: 3 } },
	] )(
		'when $blockName contains the source column in a merged range, should return that source blocking range',
		( { blockName, mergedCell } ) => {
			selectMock.mockReturnValue( {
				getBlock: jest.fn().mockReturnValue( {
					name: blockName,
					attributes: {
						body: [ { cells: [ {}, mergedCell ] } ],
					},
				} ),
			} );

			expect( columnTableIntegration.getSourceBlockingMergedRange( 'table-a', 2 ) ).toEqual( {
				columnStart: 1,
				columnEnd: 3,
			} );
		}
	);

	/**
	 * 概要:
	 * - 移動元列が横結合範囲に含まれない場合は開始拒否範囲を作らないことを確認する。
	 * 事前条件:
	 * - 先頭2列だけを占有する横結合セルと通常列が存在する。
	 * 操作:
	 * - 3列目を移動元としてblocking merged rangeを取得する。
	 * 期待結果:
	 * - nullが返る。
	 */
	it( 'when the source column is outside merged ranges, should return null', () => {
		selectMock.mockReturnValue( {
			getBlock: jest.fn().mockReturnValue( {
				name: 'core/table',
				attributes: {
					body: [ { cells: [ { colspan: 2 }, {} ] } ],
				},
			} ),
		} );

		expect( columnTableIntegration.getSourceBlockingMergedRange( 'table-a', 2 ) ).toBeNull();
	} );
} );
