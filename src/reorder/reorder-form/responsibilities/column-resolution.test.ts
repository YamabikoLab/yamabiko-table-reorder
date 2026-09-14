/**
 * Column RF Resolutionが解釈済み指定を要求時点の現在論理列構造へ照合し、移動候補、no-op、構造拒否、利用不能を方向固有結果として解決するContractを確認する。
 */

import { columnBlockingMergedCellDiagnostics } from '@/reorder/column-reorder/responsibilities/blocking-merged-cell-diagnostics';
import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';

import { columnRfResolution } from './column-resolution';

jest.mock( '@/reorder/column-reorder/responsibilities/blocking-merged-cell-diagnostics', () => ( {
	columnBlockingMergedCellDiagnostics: {
		getBlockingMergedCell: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/table-integration', () => ( {
	columnTableIntegration: {
		getConstraints: jest.fn(),
		getBlockingMergedRange: jest.fn(),
	},
} ) );

const getConstraintsMock = columnTableIntegration.getConstraints as jest.MockedFunction<
	typeof columnTableIntegration.getConstraints
>;
const getBlockingMergedRangeMock =
	columnTableIntegration.getBlockingMergedRange as jest.MockedFunction<
		typeof columnTableIntegration.getBlockingMergedRange
	>;
const getBlockingMergedCellMock =
	columnBlockingMergedCellDiagnostics.getBlockingMergedCell as jest.MockedFunction<
		typeof columnBlockingMergedCellDiagnostics.getBlockingMergedCell
	>;

const currentConstraints = {
	columnCount: 6,
	blockedBoundaries: [],
} as const;

describe( 'Column RF Resolution', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		getConstraintsMock.mockReturnValue( currentConstraints );
		getBlockingMergedRangeMock.mockReturnValue( null );
		getBlockingMergedCellMock.mockReturnValue( null );
	} );

	it.each( [
		[ 'left' as const, 4 ],
		[ 'right' as const, 5 ],
	] )(
		'when a current Column target is resolved %s, should return the pre-move destination boundary',
		( position, destinationBoundaryIndex ) => {
			expect(
				columnRfResolution.resolve( 'table-a', {
					sourceColumnIndex: 1,
					targetColumnIndex: 4,
					position,
				} )
			).toEqual( {
				status: 'resolved',
				candidate: {
					clientId: 'table-a',
					sourceColumnIndex: 1,
					destinationBoundaryIndex,
				},
			} );
		}
	);

	it.each( [
		[ 2, 'left' as const ],
		[ 1, 'right' as const ],
	] )(
		'when a Column move would keep the current order, should return no-op before structural rejection',
		( targetColumnIndex, position ) => {
			expect(
				columnRfResolution.resolve( 'table-a', {
					sourceColumnIndex: 2,
					targetColumnIndex,
					position,
				} )
			).toEqual( { status: 'no-op' } );
			expect( getBlockingMergedRangeMock ).not.toHaveBeenCalled();
			expect( getBlockingMergedCellMock ).not.toHaveBeenCalled();
		}
	);

	it( 'when the current Column table or selected positions cannot be resolved, should return unavailable', () => {
		getConstraintsMock.mockReturnValueOnce( null );
		expect(
			columnRfResolution.resolve( 'table-a', {
				sourceColumnIndex: 1,
				targetColumnIndex: 4,
				position: 'left',
			} )
		).toEqual( { status: 'unavailable' } );

		getConstraintsMock.mockReturnValueOnce( { columnCount: 3, blockedBoundaries: [] } );
		expect(
			columnRfResolution.resolve( 'table-a', {
				sourceColumnIndex: 1,
				targetColumnIndex: 4,
				position: 'left',
			} )
		).toEqual( { status: 'unavailable' } );
	} );

	it( 'when a changing Column move is blocked, should return rejected with the blocking cell location', () => {
		getBlockingMergedRangeMock.mockReturnValue( { columnStart: 2, columnEnd: 4 } );
		getBlockingMergedCellMock.mockReturnValue( {
			section: 'head',
			rowStart: 0,
			rowEnd: 1,
			columnStart: 2,
			columnEnd: 4,
		} );

		expect(
			columnRfResolution.resolve( 'table-a', {
				sourceColumnIndex: 0,
				targetColumnIndex: 4,
				position: 'right',
			} )
		).toEqual( {
			status: 'rejected',
			blockingMergedCell: {
				section: 'head',
				rowStart: 0,
				rowEnd: 1,
				columnStart: 2,
				columnEnd: 4,
			},
		} );
	} );

	it( 'when structural rejection can no longer be diagnosed as a current cell, should return unavailable', () => {
		getBlockingMergedRangeMock.mockReturnValue( { columnStart: 2, columnEnd: 4 } );
		getBlockingMergedCellMock.mockReturnValue( null );

		expect(
			columnRfResolution.resolve( 'table-a', {
				sourceColumnIndex: 0,
				targetColumnIndex: 4,
				position: 'right',
			} )
		).toEqual( { status: 'unavailable' } );
	} );
} );
