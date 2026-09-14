/**
 * Reorder Target Resolutionが、現在のTable制約から開始対象の成立可否とblocking merged cellを解決することを確認する。
 */

import { rowBlockingMergedCellDiagnostics } from './blocking-merged-cell-diagnostics';
import { rowTableIntegration } from './table-integration';
import { rowReorderTargetResolution } from './target-resolution';

jest.mock( './blocking-merged-cell-diagnostics', () => ( {
	rowBlockingMergedCellDiagnostics: {
		getSourceBlockingMergedCell: jest.fn(),
	},
} ) );

jest.mock( './table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
		applyRowMove: jest.fn(),
	},
} ) );

const getConstraintsMock = rowTableIntegration.getConstraints as jest.MockedFunction<
	typeof rowTableIntegration.getConstraints
>;
const getSourceBlockingMergedCellMock =
	rowBlockingMergedCellDiagnostics.getSourceBlockingMergedCell as jest.MockedFunction<
		typeof rowBlockingMergedCellDiagnostics.getSourceBlockingMergedCell
	>;

const target = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

describe( 'Row Reorder Target Resolution', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		getConstraintsMock.mockReset();
		getSourceBlockingMergedCellMock.mockReset();
	} );

	it( 'when the target row is movable, should resolve the target without requesting blocking cell diagnostics', () => {
		const constraints = { rowCount: 5, blockedBoundaries: [] };
		getConstraintsMock.mockReturnValue( constraints );

		const result = rowReorderTargetResolution.resolve( target );

		expect( result ).toEqual( {
			status: 'resolved',
			target,
			initialConstraints: constraints,
		} );
		expect( getSourceBlockingMergedCellMock ).not.toHaveBeenCalled();
	} );

	it( 'when the target row is blocked by a merged cell, should reject it with that cell location', () => {
		getConstraintsMock.mockReturnValue( {
			rowCount: 5,
			blockedBoundaries: [ 2 ],
		} );
		getSourceBlockingMergedCellMock.mockReturnValue( {
			rowStart: 1,
			rowEnd: 2,
			columnStart: 2,
			columnEnd: 3,
		} );

		const result = rowReorderTargetResolution.resolve( target );

		expect( getSourceBlockingMergedCellMock ).toHaveBeenCalledWith( 'table-a', 1 );
		expect( result ).toEqual( {
			status: 'rejected',
			blockingMergedCell: {
				rowStart: 1,
				rowEnd: 2,
				columnStart: 2,
				columnEnd: 3,
			},
		} );
	} );

	it( 'when a rejected row no longer has a diagnosable blocking cell, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( { rowCount: 5, blockedBoundaries: [ 2 ] } );
		getSourceBlockingMergedCellMock.mockReturnValue( null );

		const result = rowReorderTargetResolution.resolve( target );

		expect( result ).toEqual( { status: 'unavailable' } );
	} );

	it( 'when one table resolver checks multiple rows, should reuse constraints without diagnosing blocking cells', () => {
		const constraints = { rowCount: 3, blockedBoundaries: [ 1 ] };
		getConstraintsMock.mockReturnValue( constraints );
		const resolver = rowReorderTargetResolution.createResolver( 'table-a' );

		const first = resolver.resolve( 0 );
		const third = resolver.resolve( 2 );

		expect( getConstraintsMock ).toHaveBeenCalledTimes( 1 );
		expect( getSourceBlockingMergedCellMock ).not.toHaveBeenCalled();
		expect( first ).toEqual( { status: 'rejected' } );
		expect( third ).toEqual( {
			status: 'resolved',
			target: { tableIdentity: 'table-a', sourceRowIndex: 2 },
			initialConstraints: constraints,
		} );
	} );

	it( 'when current table constraints are unavailable, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( null );

		expect( rowReorderTargetResolution.resolve( target ) ).toEqual( {
			status: 'unavailable',
		} );
	} );

	it( 'when the target row is outside tbody, should return unavailable', () => {
		getConstraintsMock.mockReturnValue( {
			rowCount: 5,
			blockedBoundaries: [],
		} );

		expect(
			rowReorderTargetResolution.resolve( {
				tableIdentity: 'table-a',
				sourceRowIndex: 5,
			} )
		).toEqual( { status: 'unavailable' } );
	} );
} );
