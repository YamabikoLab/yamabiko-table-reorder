/**
 * Reorder Target Resolutionが、要求時点のTable制約から列開始対象と結合セル拒否位置を解決することを確認する。
 */

import { columnTableIntegration } from './table-integration';
import { resolveColumnReorderTarget } from './target-resolution';

jest.mock( './table-integration', () => ( {
	columnTableIntegration: {
		getConstraints: jest.fn(),
		getSourceBlockingMergedRange: jest.fn(),
		applyColumnMove: jest.fn(),
	},
} ) );

const getConstraintsMock = columnTableIntegration.getConstraints as jest.MockedFunction<
	typeof columnTableIntegration.getConstraints
>;
const getSourceBlockingMergedRangeMock =
	columnTableIntegration.getSourceBlockingMergedRange as jest.MockedFunction<
		typeof columnTableIntegration.getSourceBlockingMergedRange
	>;
const applyColumnMoveMock = columnTableIntegration.applyColumnMove as jest.MockedFunction<
	typeof columnTableIntegration.applyColumnMove
>;

const target = {
	tableIdentity: 'table-a',
	sourceColumnIndex: 1,
};
const blockingMergedRange = {
	section: 'body' as const,
	rowStart: 0,
	rowEnd: 0,
	columnStart: 0,
	columnEnd: 1,
};

describe( 'Column Reorder Target Resolution', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		getConstraintsMock.mockReset();
		getSourceBlockingMergedRangeMock.mockReset();
		applyColumnMoveMock.mockReset();
	} );

	/**
	 * 列単位で移動可能な対象ではTargetと開始時制約を同じ解決結果で返すことを確認する。
	 *
	 * 期待結果:
	 * - resolvedとしてTargetと取得した列制約が返る。
	 * - 結合セル位置の追加診断は行われない。
	 */
	it( 'when the target column is movable, should resolve the target with the current constraints', () => {
		const constraints = { columnCount: 5, blockedBoundaries: [] };
		getConstraintsMock.mockReturnValue( constraints );

		expect( resolveColumnReorderTarget( target ) ).toEqual( {
			status: 'resolved',
			target,
			initialConstraints: constraints,
		} );
		expect( getSourceBlockingMergedRangeMock ).not.toHaveBeenCalled();
	} );

	/**
	 * colspan範囲に含まれる列では原因セル位置を開始拒否結果として返すことを確認する。
	 *
	 * 事前条件:
	 * - 移動元列の直後が分断不可境界である。
	 *
	 * 期待結果:
	 * - blockingMergedRangeを持つrejectedが返る。
	 * - 移動先を必要としない開始対象専用の診断が要求される。
	 */
	it( 'when the target column is blocked by a merged range, should reject it with the blocking range', () => {
		getConstraintsMock.mockReturnValue( { columnCount: 5, blockedBoundaries: [ 2 ] } );
		getSourceBlockingMergedRangeMock.mockReturnValue( blockingMergedRange );

		const result = resolveColumnReorderTarget( target );

		expect( getSourceBlockingMergedRangeMock ).toHaveBeenCalledWith( 'table-a', 1 );
		expect( result ).toEqual( { status: 'rejected', blockingMergedRange } );
	} );

	/**
	 * colspanの右端側にある列も直前の分断不可境界から開始拒否になることを確認する。
	 *
	 * 期待結果:
	 * - 原因セル位置を持つrejectedが返る。
	 */
	it( 'when the boundary before the target column is blocked, should reject it with the blocking range', () => {
		getConstraintsMock.mockReturnValue( { columnCount: 5, blockedBoundaries: [ 1 ] } );
		getSourceBlockingMergedRangeMock.mockReturnValue( blockingMergedRange );

		expect( resolveColumnReorderTarget( target ) ).toEqual( {
			status: 'rejected',
			blockingMergedRange,
		} );
	} );

	/**
	 * 開始拒否の原因位置を現在Tableから確定できない場合は理由を推測しないことを確認する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when the current blocking range cannot be diagnosed, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( { columnCount: 5, blockedBoundaries: [ 2 ] } );
		getSourceBlockingMergedRangeMock.mockReturnValue( null );

		expect( resolveColumnReorderTarget( target ) ).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * 解決要求ごとに現在Table制約を取得し直すことを確認する。
	 *
	 * 事前条件:
	 * - 同じ列が最初の要求では移動可能で、次の要求時には結合範囲に含まれる。
	 *
	 * 期待結果:
	 * - Table制約を要求ごとに取得し、2回目は現在の原因セル位置を持つ開始拒否になる。
	 */
	it( 'when the same target is resolved again, should use the current table for each request', () => {
		getConstraintsMock
			.mockReturnValueOnce( { columnCount: 3, blockedBoundaries: [] } )
			.mockReturnValueOnce( { columnCount: 3, blockedBoundaries: [ 1, 2 ] } );
		getSourceBlockingMergedRangeMock.mockReturnValue( blockingMergedRange );

		expect( resolveColumnReorderTarget( target ).status ).toBe( 'resolved' );
		expect( resolveColumnReorderTarget( target ) ).toEqual( {
			status: 'rejected',
			blockingMergedRange,
		} );
		expect( getConstraintsMock ).toHaveBeenCalledTimes( 2 );
	} );

	/**
	 * Table制約を取得できない場合は通常の利用不能とすることを確認する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when current table constraints are unavailable, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( null );
		expect( resolveColumnReorderTarget( target ) ).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * 論理列範囲外または整数でない対象を通常の利用不能とすることを確認する。
	 *
	 * 期待結果:
	 * - どちらもunavailableが返る。
	 */
	it.each( [ 5, 1.5 ] )(
		'when target column index %s is invalid, should return unavailable',
		( sourceColumnIndex ) => {
			getConstraintsMock.mockReturnValue( { columnCount: 5, blockedBoundaries: [] } );
			expect(
				resolveColumnReorderTarget( { tableIdentity: 'table-a', sourceColumnIndex } )
			).toEqual( { status: 'unavailable' } );
		}
	);

	/**
	 * Target Resolutionが開始可否の判定だけを行い、Tableデータを変更しないことを確認する。
	 *
	 * 操作:
	 * - 開始可能、開始拒否、Table利用不能の各条件で解決する。
	 *
	 * 期待結果:
	 * - いずれの結果でもTableへの列移動は要求されない。
	 */
	it( 'when target resolution returns any normal outcome, should not update table data', () => {
		getConstraintsMock
			.mockReturnValueOnce( { columnCount: 3, blockedBoundaries: [] } )
			.mockReturnValueOnce( { columnCount: 3, blockedBoundaries: [ 2 ] } )
			.mockReturnValueOnce( null );
		getSourceBlockingMergedRangeMock.mockReturnValue( blockingMergedRange );

		resolveColumnReorderTarget( target );
		resolveColumnReorderTarget( target );
		resolveColumnReorderTarget( target );

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
	} );
} );
