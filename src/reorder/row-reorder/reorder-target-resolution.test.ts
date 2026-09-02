/**
 * 行専用Reorder Target Resolutionについて、Table Integrationの現在構造を利用して対象Tableの利用可否を判定する内部仕様を確認する。
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
	 * - 現在の行構造を取得できるTableを利用可能と判定することを確認する。
	 *
	 * 事前条件:
	 * - Table Integrationが対象Tableの現在行数と分断不可境界を提供できる。
	 *
	 * 操作:
	 * - 対象Tableの利用可否を確認する。
	 *
	 * 期待結果:
	 * - trueが返る。
	 */
	it( 'when the current row structure is available, should report the Table as available', () => {
		getStructureMock.mockReturnValue( {
			rowCount: 4,
			blockedBoundaries: [ 2 ],
		} );

		expect( rowReorderTargetResolution.isAvailable( 'table-a' ) ).toBe( true );
		expect( getStructureMock ).toHaveBeenCalledWith( 'table-a' );
	} );

	/**
	 * 概要:
	 * - 現在の行構造を取得できないTableを利用不能と判定することを確認する。
	 *
	 * 事前条件:
	 * - Table Integrationが対象Tableの現在行構造を提供できない。
	 *
	 * 操作:
	 * - 対象Tableの利用可否を確認する。
	 *
	 * 期待結果:
	 * - falseが返る。
	 */
	it( 'when the current row structure is unavailable, should report the Table as unavailable', () => {
		getStructureMock.mockReturnValue( null );

		expect( rowReorderTargetResolution.isAvailable( 'table-a' ) ).toBe( false );
		expect( getStructureMock ).toHaveBeenCalledWith( 'table-a' );
	} );
} );
