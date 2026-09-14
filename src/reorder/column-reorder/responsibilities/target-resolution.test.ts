/**
 * Reorder Target Resolutionが、現在のTable制約から列開始対象の成立可否とblocking merged cellを副作用なく解決することを確認する。
 */

import { columnBlockingMergedCellDiagnostics } from './blocking-merged-cell-diagnostics';
import { columnTableIntegration } from './table-integration';
import { columnReorderTargetResolution } from './target-resolution';

jest.mock( './blocking-merged-cell-diagnostics', () => ( {
	columnBlockingMergedCellDiagnostics: {
		getSourceBlockingMergedCell: jest.fn(),
	},
} ) );

jest.mock( './table-integration', () => ( {
	columnTableIntegration: {
		getConstraints: jest.fn(),
		applyColumnMove: jest.fn(),
	},
} ) );

const getConstraintsMock = columnTableIntegration.getConstraints as jest.MockedFunction<
	typeof columnTableIntegration.getConstraints
>;
const getSourceBlockingMergedCellMock =
	columnBlockingMergedCellDiagnostics.getSourceBlockingMergedCell as jest.MockedFunction<
		typeof columnBlockingMergedCellDiagnostics.getSourceBlockingMergedCell
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
		getSourceBlockingMergedCellMock.mockReset();
		applyColumnMoveMock.mockReset();
	} );

	it( 'when the target column is movable, should resolve without requesting blocking cell diagnostics', () => {
		const constraints = { columnCount: 5, blockedBoundaries: [] };
		getConstraintsMock.mockReturnValue( constraints );

		expect( columnReorderTargetResolution.resolve( target ) ).toEqual( {
			status: 'resolved',
			target,
			initialConstraints: constraints,
		} );
		expect( getSourceBlockingMergedCellMock ).not.toHaveBeenCalled();
	} );

	it( 'when the target column is blocked, should reject it with the blocking cell location', () => {
		getConstraintsMock.mockReturnValue( { columnCount: 5, blockedBoundaries: [ 2 ] } );
		getSourceBlockingMergedCellMock.mockReturnValue( {
			section: 'body',
			rowStart: 2,
			rowEnd: 2,
			columnStart: 1,
			columnEnd: 2,
		} );

		const result = columnReorderTargetResolution.resolve( target );

		expect( getSourceBlockingMergedCellMock ).toHaveBeenCalledWith( 'table-a', 1 );
		expect( result ).toEqual( {
			status: 'rejected',
			blockingMergedCell: {
				section: 'body',
				rowStart: 2,
				rowEnd: 2,
				columnStart: 1,
				columnEnd: 2,
			},
		} );
	} );

	it( 'when a rejected column no longer has a diagnosable blocking cell, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( { columnCount: 5, blockedBoundaries: [ 2 ] } );
		getSourceBlockingMergedCellMock.mockReturnValue( null );

		expect( columnReorderTargetResolution.resolve( target ) ).toEqual( {
			status: 'unavailable',
		} );
	} );

	it( 'when one resolver checks multiple columns, should reuse constraints without diagnosing blocking cells', () => {
		const constraints = { columnCount: 3, blockedBoundaries: [ 1 ] };
		getConstraintsMock.mockReturnValue( constraints );
		const resolver = columnReorderTargetResolution.createResolver( 'table-a' );

		expect( resolver.resolve( 0 ) ).toEqual( { status: 'rejected' } );
		expect( resolver.resolve( 2 ) ).toEqual( {
			status: 'resolved',
			target: { tableIdentity: 'table-a', sourceColumnIndex: 2 },
			initialConstraints: constraints,
		} );
		expect( getConstraintsMock ).toHaveBeenCalledTimes( 1 );
		expect( getSourceBlockingMergedCellMock ).not.toHaveBeenCalled();
	} );

	it( 'when current table constraints are unavailable, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( null );
		expect( columnReorderTargetResolution.resolve( target ) ).toEqual( {
			status: 'unavailable',
		} );
	} );

	it( 'when the target column is outside the logical column range, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( { columnCount: 5, blockedBoundaries: [] } );
		expect(
			columnReorderTargetResolution.resolve( {
				tableIdentity: 'table-a',
				sourceColumnIndex: 5,
			} )
		).toEqual( { status: 'unavailable' } );
	} );

	it( 'when the target column index is not an integer, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( { columnCount: 5, blockedBoundaries: [] } );
		expect(
			columnReorderTargetResolution.resolve( {
				tableIdentity: 'table-a',
				sourceColumnIndex: 1.5,
			} )
		).toEqual( { status: 'unavailable' } );
	} );

	it( 'when target resolution returns any normal outcome, should not update table data', () => {
		getConstraintsMock
			.mockReturnValueOnce( { columnCount: 3, blockedBoundaries: [] } )
			.mockReturnValueOnce( { columnCount: 3, blockedBoundaries: [ 2 ] } )
			.mockReturnValueOnce( null );
		getSourceBlockingMergedCellMock.mockReturnValue( {
			section: 'body',
			rowStart: 0,
			rowEnd: 0,
			columnStart: 1,
			columnEnd: 2,
		} );

		columnReorderTargetResolution.resolve( target );
		columnReorderTargetResolution.resolve( target );
		columnReorderTargetResolution.resolve( target );

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
	} );
} );
