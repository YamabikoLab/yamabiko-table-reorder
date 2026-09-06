/**
 * Reorder Target Resolutionが、現在のTable制約から開始対象の成立可否と理由を解決することを確認する。
 */

import { rowTableIntegration } from './table-integration';
import { rowReorderTargetResolution } from './target-resolution';

jest.mock( './table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
		applyRowMove: jest.fn(),
	},
} ) );

const getConstraintsMock = rowTableIntegration.getConstraints as jest.MockedFunction<
	typeof rowTableIntegration.getConstraints
>;

const target = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

describe( 'Row Reorder Target Resolution', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		getConstraintsMock.mockReset();
	} );

	/**
	 * 概要:
	 * - 行単位で移動可能な対象ではTargetと開始時制約を同じ解決結果で返すことを確認する。
	 * 事前条件:
	 * - 対象Tableを取得でき、移動元行の前後に分断不可境界がない。
	 * 操作:
	 * - Target Resolutionを実行する。
	 * 期待結果:
	 * - resolvedとしてTargetと取得した行制約が返る。
	 */
	it( 'when the target row is movable, should resolve the target with the current constraints', () => {
		const constraints = { rowCount: 5, blockedBoundaries: [] };
		getConstraintsMock.mockReturnValue( constraints );

		const result = rowReorderTargetResolution.resolve( target );

		expect( result ).toEqual( {
			status: 'resolved',
			target,
			initialConstraints: constraints,
		} );
	} );

	/**
	 * 概要:
	 * - rowspan等の結合範囲に含まれる行はDesign上の開始拒否理由として解決することを確認する。
	 * 事前条件:
	 * - 移動元行の直後が分断不可境界である。
	 * 操作:
	 * - Target Resolutionを実行する。
	 * 期待結果:
	 * - merged-range理由のrejectedが返る。
	 */
	it( 'when the target row is blocked by a merged range, should reject it with the merged-range reason', () => {
		getConstraintsMock.mockReturnValue( {
			rowCount: 5,
			blockedBoundaries: [ 2 ],
		} );

		const result = rowReorderTargetResolution.resolve( target );

		expect( result ).toEqual( {
			status: 'rejected',
			reason: 'merged-range',
		} );
	} );

	/**
	 * 概要:
	 * - Table制約を取得できない場合は利用者向け拒否理由を作らず通常の利用不能とすることを確認する。
	 * 事前条件:
	 * - 対象Tableの現在制約を取得できない。
	 * 操作:
	 * - Target Resolutionを実行する。
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when current table constraints are unavailable, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( null );

		const result = rowReorderTargetResolution.resolve( target );

		expect( result ).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * 概要:
	 * - tbody範囲外の対象は利用者向け拒否理由を作らず通常の利用不能とすることを確認する。
	 * 事前条件:
	 * - Table制約は取得できるが移動元行がtbody範囲外である。
	 * 操作:
	 * - Target Resolutionを実行する。
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when the target row is outside tbody, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( {
			rowCount: 5,
			blockedBoundaries: [],
		} );

		const result = rowReorderTargetResolution.resolve( {
			tableIdentity: 'table-a',
			sourceRowIndex: 5,
		} );

		expect( result ).toEqual( { status: 'unavailable' } );
	} );
} );
