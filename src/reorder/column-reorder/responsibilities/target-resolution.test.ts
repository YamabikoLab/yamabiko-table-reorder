/**
 * Reorder Target Resolutionが、現在のTable制約から列開始対象の成立可否と理由を解決することを確認する。
 */

import { columnTableIntegration } from './table-integration';
import { columnReorderTargetResolution } from './target-resolution';

jest.mock( './table-integration', () => ( {
	columnTableIntegration: {
		getConstraints: jest.fn(),
		applyColumnMove: jest.fn(),
	},
} ) );

const getConstraintsMock = columnTableIntegration.getConstraints as jest.MockedFunction<
	typeof columnTableIntegration.getConstraints
>;

const target = {
	tableIdentity: 'table-a',
	sourceColumnIndex: 1,
};

describe( 'Column Reorder Target Resolution', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		getConstraintsMock.mockReset();
	} );

	/**
	 * 列単位で移動可能な対象ではTargetと開始時制約を同じ解決結果で返すことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableを取得でき、移動元列の前後に分断不可境界がない。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - resolvedとしてTargetと取得した列制約が返る。
	 */
	it( 'when the target column is movable, should resolve the target with the current constraints', () => {
		const constraints = { columnCount: 5, blockedBoundaries: [] };
		getConstraintsMock.mockReturnValue( constraints );

		const result = columnReorderTargetResolution.resolve( target );

		expect( result ).toEqual( {
			status: 'resolved',
			target,
			initialConstraints: constraints,
		} );
	} );

	/**
	 * colspanの左端側にある列も前後の分断不可境界から開始拒否になることを確認する。
	 *
	 * 事前条件:
	 * - 移動元列の直後が分断不可境界である。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - merged-range理由のrejectedが返る。
	 */
	it( 'when the boundary after the target column is blocked, should reject it with the merged-range reason', () => {
		getConstraintsMock.mockReturnValue( {
			columnCount: 5,
			blockedBoundaries: [ 2 ],
		} );

		const result = columnReorderTargetResolution.resolve( target );

		expect( result ).toEqual( {
			status: 'rejected',
			reason: 'merged-range',
		} );
	} );

	/**
	 * colspanの右端側にある列も前後の分断不可境界から開始拒否になることを確認する。
	 *
	 * 事前条件:
	 * - 移動元列の直前が分断不可境界である。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - merged-range理由のrejectedが返る。
	 */
	it( 'when the boundary before the target column is blocked, should reject it with the merged-range reason', () => {
		getConstraintsMock.mockReturnValue( {
			columnCount: 5,
			blockedBoundaries: [ 1 ],
		} );

		const result = columnReorderTargetResolution.resolve( target );

		expect( result ).toEqual( {
			status: 'rejected',
			reason: 'merged-range',
		} );
	} );

	/**
	 * rowspanだけでは列の分断不可境界が生じないため開始拒否しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの論理列数は取得でき、列方向の分断不可境界がない。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - resolvedが返る。
	 */
	it( 'when only row spanning affects the table, should not reject the target column', () => {
		const constraints = { columnCount: 5, blockedBoundaries: [] };
		getConstraintsMock.mockReturnValue( constraints );

		const result = columnReorderTargetResolution.resolve( target );

		expect( result ).toEqual( {
			status: 'resolved',
			target,
			initialConstraints: constraints,
		} );
	} );

	/**
	 * 同一Tableの複数列を解決する場合に要求時点の列制約を一度だけ取得することを確認する。
	 *
	 * 事前条件:
	 * - 3列Tableで境界1が分断不可である。
	 *
	 * 操作:
	 * - Table単位のResolverを生成し、1列目と3列目を順に解決する。
	 *
	 * 期待結果:
	 * - Table制約取得は1回だけで、1列目は開始拒否、3列目は開始可能として同じ制約を基準に解決される。
	 */
	it( 'when one table resolver checks multiple columns, should reuse one current constraint snapshot', () => {
		const constraints = { columnCount: 3, blockedBoundaries: [ 1 ] };
		getConstraintsMock.mockReturnValue( constraints );
		const resolver = columnReorderTargetResolution.createResolver( 'table-a' );

		const first = resolver.resolve( 0 );
		const third = resolver.resolve( 2 );

		expect( getConstraintsMock ).toHaveBeenCalledTimes( 1 );
		expect( first ).toEqual( { status: 'rejected', reason: 'merged-range' } );
		expect( third ).toEqual( {
			status: 'resolved',
			target: { tableIdentity: 'table-a', sourceColumnIndex: 2 },
			initialConstraints: constraints,
		} );
	} );

	/**
	 * Table制約を取得できない場合は利用者向け拒否理由を作らず通常の利用不能とすることを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの現在制約を取得できない。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when current table constraints are unavailable, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( null );

		const result = columnReorderTargetResolution.resolve( target );

		expect( result ).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * 論理列範囲外の対象は利用者向け拒否理由を作らず通常の利用不能とすることを確認する。
	 *
	 * 事前条件:
	 * - Table制約は取得できるが移動元列が論理列範囲外である。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when the target column is outside the logical column range, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( {
			columnCount: 5,
			blockedBoundaries: [],
		} );

		const result = columnReorderTargetResolution.resolve( {
			tableIdentity: 'table-a',
			sourceColumnIndex: 5,
		} );

		expect( result ).toEqual( { status: 'unavailable' } );
	} );
} );
