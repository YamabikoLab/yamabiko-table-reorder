/**
 * Reorder Target Resolutionが、現在のTable制約から列開始対象の成立可否とblocking merged rangeを副作用なく解決することを確認する。
 */

import { columnTableIntegration } from './table-integration';
import { columnReorderTargetResolution } from './target-resolution';

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
	 * 事前条件:
	 * - 対象Tableを取得でき、移動元列の前後に分断不可境界がない。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - resolvedとしてTargetと取得した列制約が返る。
	 * - blocking merged range診断は要求されない。
	 */
	it( 'when the target column is movable, should resolve the target without requesting a blocking range', () => {
		const constraints = { columnCount: 5, blockedBoundaries: [] };
		getConstraintsMock.mockReturnValue( constraints );

		const result = columnReorderTargetResolution.resolve( target );

		expect( result ).toEqual( {
			status: 'resolved',
			target,
			initialConstraints: constraints,
		} );
		expect( getSourceBlockingMergedRangeMock ).not.toHaveBeenCalled();
	} );

	/**
	 * colspanの左端側にある列も前後の分断不可境界から開始拒否になり、原因範囲を返すことを確認する。
	 *
	 * 事前条件:
	 * - 移動元列の直後が分断不可境界である。
	 * - 現在Tableから1〜2列目の0-based横結合範囲を取得できる。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - rejectedとしてblocking merged rangeが返る。
	 */
	it( 'when the boundary after the target column is blocked, should reject it with that blocking range', () => {
		getConstraintsMock.mockReturnValue( {
			columnCount: 5,
			blockedBoundaries: [ 2 ],
		} );
		getSourceBlockingMergedRangeMock.mockReturnValue( { columnStart: 1, columnEnd: 2 } );

		const result = columnReorderTargetResolution.resolve( target );

		expect( getSourceBlockingMergedRangeMock ).toHaveBeenCalledWith( 'table-a', 1 );
		expect( result ).toEqual( {
			status: 'rejected',
			blockingMergedRange: { columnStart: 1, columnEnd: 2 },
		} );
	} );

	/**
	 * colspanの右端側にある列も前後の分断不可境界から開始拒否になり、原因範囲を返すことを確認する。
	 *
	 * 事前条件:
	 * - 移動元列の直前が分断不可境界である。
	 * - 現在Tableから0〜1列目の0-based横結合範囲を取得できる。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - rejectedとしてblocking merged rangeが返る。
	 */
	it( 'when the boundary before the target column is blocked, should reject it with that blocking range', () => {
		getConstraintsMock.mockReturnValue( {
			columnCount: 5,
			blockedBoundaries: [ 1 ],
		} );
		getSourceBlockingMergedRangeMock.mockReturnValue( { columnStart: 0, columnEnd: 1 } );

		const result = columnReorderTargetResolution.resolve( target );

		expect( result ).toEqual( {
			status: 'rejected',
			blockingMergedRange: { columnStart: 0, columnEnd: 1 },
		} );
	} );

	/**
	 * 開始拒否判定後に現在の結合範囲を取得できなくなった場合は範囲を推測しないことを確認する。
	 *
	 * 事前条件:
	 * - 開始時制約では対象列が結合範囲により拒否される。
	 * - 診断時点では現在Tableからblocking merged rangeを取得できない。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when a rejected column no longer has a diagnosable blocking range, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( { columnCount: 5, blockedBoundaries: [ 2 ] } );
		getSourceBlockingMergedRangeMock.mockReturnValue( null );

		const result = columnReorderTargetResolution.resolve( target );

		expect( result ).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * 同一Tableの複数列を解決する場合に要求時点の列制約を一度だけ取得し、構造診断を行わないことを確認する。
	 *
	 * 事前条件:
	 * - 3列Tableで境界1が分断不可である。
	 *
	 * 操作:
	 * - Table単位のResolverを生成し、1列目と3列目を順に解決する。
	 *
	 * 期待結果:
	 * - Table制約取得は1回だけで、1列目は開始拒否、3列目は開始可能として同じ制約を基準に解決される。
	 * - blocking merged range診断は要求されない。
	 */
	it( 'when one table resolver checks multiple columns, should reuse constraints without diagnosing blocking ranges', () => {
		const constraints = { columnCount: 3, blockedBoundaries: [ 1 ] };
		getConstraintsMock.mockReturnValue( constraints );
		const resolver = columnReorderTargetResolution.createResolver( 'table-a' );

		const first = resolver.resolve( 0 );
		const third = resolver.resolve( 2 );

		expect( getConstraintsMock ).toHaveBeenCalledTimes( 1 );
		expect( getSourceBlockingMergedRangeMock ).not.toHaveBeenCalled();
		expect( first ).toEqual( { status: 'rejected' } );
		expect( third ).toEqual( {
			status: 'resolved',
			target: { tableIdentity: 'table-a', sourceColumnIndex: 2 },
			initialConstraints: constraints,
		} );
	} );

	/**
	 * Table制約を取得できない場合は利用者向け拒否範囲を作らず通常の利用不能とすることを確認する。
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
	 * 論理列範囲外の対象は利用者向け拒否範囲を作らず通常の利用不能とすることを確認する。
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

	/**
	 * 整数の論理列位置として解釈できない対象を通常の利用不能として扱うことを確認する。
	 *
	 * 事前条件:
	 * - Table制約は取得できる。
	 * - 移動元列位置が整数ではない。
	 *
	 * 操作:
	 * - Target Resolutionを実行する。
	 *
	 * 期待結果:
	 * - unavailableが返る。
	 */
	it( 'when the target column index is not an integer, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( {
			columnCount: 5,
			blockedBoundaries: [],
		} );

		const result = columnReorderTargetResolution.resolve( {
			tableIdentity: 'table-a',
			sourceColumnIndex: 1.5,
		} );

		expect( result ).toEqual( { status: 'unavailable' } );
	} );

	/**
	 * Target Resolutionが開始可否と開始拒否診断だけを行い、Tableデータを変更しないことを確認する。
	 *
	 * 事前条件:
	 * - 開始可能、横結合による開始拒否、Table利用不能の各結果を解決できる。
	 *
	 * 操作:
	 * - 各条件でTarget Resolutionを実行する。
	 *
	 * 期待結果:
	 * - いずれの結果でもTableへの列移動は要求されない。
	 */
	it( 'when target resolution returns any normal outcome, should not update table data', () => {
		getConstraintsMock
			.mockReturnValueOnce( { columnCount: 3, blockedBoundaries: [] } )
			.mockReturnValueOnce( { columnCount: 3, blockedBoundaries: [ 2 ] } )
			.mockReturnValueOnce( null );
		getSourceBlockingMergedRangeMock.mockReturnValue( { columnStart: 1, columnEnd: 2 } );

		columnReorderTargetResolution.resolve( target );
		columnReorderTargetResolution.resolve( target );
		columnReorderTargetResolution.resolve( target );

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
	} );
} );
