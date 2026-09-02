/**
 * 行専用Reorder Target Resolutionについて、Table Integrationの現在構造を利用して指定行の移動可否を判定する内部仕様を確認する。
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
	 * - 現在の`tbody`内で縦結合に含まれない行を移動可能と判定することを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは4行で、index 1の行は縦結合範囲に含まれない。
	 *
	 * 操作:
	 * - index 1の利用可否を確認する。
	 *
	 * 期待結果:
	 * - trueが返る。
	 */
	it( 'when the row is movable, should report it as available', () => {
		getStructureMock.mockReturnValue( {
			rowCount: 4,
			blockedBoundaries: [ 3 ],
		} );

		expect( rowReorderTargetResolution.isAvailable( 'table-a', 1 ) ).toBe( true );
		expect( getStructureMock ).toHaveBeenCalledWith( 'table-a' );
	} );

	/**
	 * 概要:
	 * - 縦結合範囲に含まれる行を行単位の移動対象として成立させないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは4行で、境界1と2を跨ぐ縦結合が存在する。
	 *
	 * 操作:
	 * - 結合範囲の先頭、中間、末尾にあたる各行の利用可否を確認する。
	 *
	 * 期待結果:
	 * - 3行すべてでfalseが返る。
	 */
	it( 'when rows are inside a rowspan range, should report every row as unavailable', () => {
		getStructureMock.mockReturnValue( {
			rowCount: 4,
			blockedBoundaries: [ 1, 2 ],
		} );

		for ( const rowIndex of [ 0, 1, 2 ] ) {
			expect( rowReorderTargetResolution.isAvailable( 'table-a', rowIndex ) ).toBe( false );
		}
	} );

	/**
	 * 概要:
	 * - 現在のTable構造を取得できない場合を正常な利用不能として扱うことを確認する。
	 *
	 * 事前条件:
	 * - Table Integrationが対象Tableの現在行構造を提供できない。
	 *
	 * 操作:
	 * - index 0の利用可否を確認する。
	 *
	 * 期待結果:
	 * - falseが返る。
	 */
	it( 'when the current row structure is unavailable, should report the row as unavailable', () => {
		getStructureMock.mockReturnValue( null );

		expect( rowReorderTargetResolution.isAvailable( 'table-a', 0 ) ).toBe( false );
		expect( getStructureMock ).toHaveBeenCalledWith( 'table-a' );
	} );

	/**
	 * 概要:
	 * - 現在の`tbody`範囲外の行位置を移動対象として成立させないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableは2行である。
	 *
	 * 操作:
	 * - index 2の利用可否を確認する。
	 *
	 * 期待結果:
	 * - falseが返る。
	 */
	it( 'when the row index is outside the current tbody range, should report it as unavailable', () => {
		getStructureMock.mockReturnValue( {
			rowCount: 2,
			blockedBoundaries: [],
		} );

		expect( rowReorderTargetResolution.isAvailable( 'table-a', 2 ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - `tbody`の行位置として成立しない値を移動対象として扱わないことを確認する。
	 *
	 * 事前条件:
	 * - 行位置が負数または整数ではない。
	 *
	 * 操作:
	 * - 不正な行位置の利用可否を確認する。
	 *
	 * 期待結果:
	 * - falseが返り、Table構造は要求されない。
	 */
	it( 'when the row index is invalid, should report it as unavailable without reading the Table structure', () => {
		expect( rowReorderTargetResolution.isAvailable( 'table-a', -1 ) ).toBe( false );
		expect( rowReorderTargetResolution.isAvailable( 'table-a', 0.5 ) ).toBe( false );
		expect( getStructureMock ).not.toHaveBeenCalled();
	} );
} );
