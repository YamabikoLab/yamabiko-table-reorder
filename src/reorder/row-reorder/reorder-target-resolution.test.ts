/**
 * 行専用Reorder Target Resolutionについて、DnD開始試行時の論理開始位置と現在のTable構造から、移動可能なtbody行または正常な開始拒否理由を返す内部仕様を確認する。
 */

import { rowReorderTargetResolution } from './reorder-target-resolution';
import { rowTableIntegration } from './table-integration';

jest.mock( './table-integration', () => ( {
	rowTableIntegration: {
		getStructure: jest.fn(),
	},
} ) );

const getStructureMock = rowTableIntegration.getStructure as jest.Mock;

describe( 'Reorder Target Resolution', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * 概要:
	 * - tbody内の独立した行を移動対象として解決できることを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは4行で、開始対象行を含む縦結合は存在しない。
	 *
	 * 操作:
	 * - tbodyのindex 1から開始する論理位置を解決する。
	 *
	 * 期待結果:
	 * - 対象Table IdentityとrowIndexを保持したmovable結果が返る。
	 */
	it( 'when the start row is movable, should return the row target', () => {
		getStructureMock.mockReturnValue( {
			rowCount: 4,
			blockedBoundaries: [ 3 ],
		} );

		expect(
			rowReorderTargetResolution.resolve( {
				tableIdentity: 'table-a',
				section: 'body',
				rowIndex: 1,
			} )
		).toEqual( {
			status: 'movable',
			target: {
				tableIdentity: 'table-a',
				rowIndex: 1,
			},
		} );
	} );

	/**
	 * 概要:
	 * - tbody外の開始位置を行DnDの対象として成立させないことを確認する。
	 *
	 * 事前条件:
	 * - 開始位置はtheadに属する。
	 *
	 * 操作:
	 * - theadの行位置を解決する。
	 *
	 * 期待結果:
	 * - target-out-of-scopeとして正常に開始拒否される。
	 * - Table構造は要求されない。
	 */
	it( 'when the start position is outside tbody, should reject it as out of scope', () => {
		expect(
			rowReorderTargetResolution.resolve( {
				tableIdentity: 'table-a',
				section: 'head',
				rowIndex: 0,
			} )
		).toEqual( {
			status: 'immovable',
			reason: 'target-out-of-scope',
		} );
		expect( getStructureMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 現在のTable構造を取得できない場合を内部Errorにせず正常な開始拒否として扱うことを確認する。
	 *
	 * 事前条件:
	 * - Table Integrationは対象Tableの現在構造を提供できない。
	 *
	 * 操作:
	 * - tbody内の開始位置を解決する。
	 *
	 * 期待結果:
	 * - table-structure-unavailableが返る。
	 */
	it( 'when the current Table structure is unavailable, should reject the start normally', () => {
		getStructureMock.mockReturnValue( null );

		expect(
			rowReorderTargetResolution.resolve( {
				tableIdentity: 'table-a',
				section: 'body',
				rowIndex: 0,
			} )
		).toEqual( {
			status: 'immovable',
			reason: 'table-structure-unavailable',
		} );
	} );

	/**
	 * 概要:
	 * - 現在のtbody行範囲外となった開始位置を移動対象として成立させないことを確認する。
	 *
	 * 事前条件:
	 * - 現在のtbodyは2行だけ存在する。
	 *
	 * 操作:
	 * - index 2の開始位置を解決する。
	 *
	 * 期待結果:
	 * - target-out-of-scopeとして正常に開始拒否される。
	 */
	it( 'when the row index is outside the current tbody range, should reject it as out of scope', () => {
		getStructureMock.mockReturnValue( {
			rowCount: 2,
			blockedBoundaries: [],
		} );

		expect(
			rowReorderTargetResolution.resolve( {
				tableIdentity: 'table-a',
				section: 'body',
				rowIndex: 2,
			} )
		).toEqual( {
			status: 'immovable',
			reason: 'target-out-of-scope',
		} );
	} );

	/**
	 * 概要:
	 * - rowspanによる結合範囲に含まれる全行を行単位の移動対象として成立させないことを確認する。
	 *
	 * 事前条件:
	 * - tbodyは4行で、境界1と2を跨ぐ縦結合が存在する。
	 * - index 0、1、2はいずれも同じ結合範囲の一部である。
	 *
	 * 操作:
	 * - 結合範囲の先頭、中間、末尾の各行を開始位置として解決する。
	 *
	 * 期待結果:
	 * - 3行すべてがmerged-cellとして正常に開始拒否される。
	 */
	it( 'when rows are inside a rowspan range, should reject every row in that range', () => {
		getStructureMock.mockReturnValue( {
			rowCount: 4,
			blockedBoundaries: [ 1, 2 ],
		} );

		for ( const rowIndex of [ 0, 1, 2 ] ) {
			expect(
				rowReorderTargetResolution.resolve( {
					tableIdentity: 'table-a',
					section: 'body',
					rowIndex,
				} )
			).toEqual( {
				status: 'immovable',
				reason: 'merged-cell',
			} );
		}
	} );
} );
