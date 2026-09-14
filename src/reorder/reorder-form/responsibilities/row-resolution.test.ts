/**
 * Row RF Resolutionが解釈済み指定を要求時点の現在tbodyへ照合し、移動候補、no-op、構造拒否、利用不能を方向固有結果として解決するContractを確認する。
 */

import { rowBlockingMergedCellDiagnostics } from '@/reorder/row-reorder/responsibilities/blocking-merged-cell-diagnostics';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import { rowRfResolution } from './row-resolution';

jest.mock( '@/reorder/row-reorder/responsibilities/blocking-merged-cell-diagnostics', () => ( {
	rowBlockingMergedCellDiagnostics: {
		getBlockingMergedCell: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
		getBlockingMergedRange: jest.fn(),
	},
} ) );

const getConstraintsMock = rowTableIntegration.getConstraints as jest.MockedFunction<
	typeof rowTableIntegration.getConstraints
>;
const getBlockingMergedRangeMock =
	rowTableIntegration.getBlockingMergedRange as jest.MockedFunction<
		typeof rowTableIntegration.getBlockingMergedRange
	>;
const getBlockingMergedCellMock =
	rowBlockingMergedCellDiagnostics.getBlockingMergedCell as jest.MockedFunction<
		typeof rowBlockingMergedCellDiagnostics.getBlockingMergedCell
	>;

const currentConstraints = {
	rowCount: 6,
	blockedBoundaries: [],
} as const;

describe( 'Row RF Resolution', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		getConstraintsMock.mockReturnValue( currentConstraints );
		getBlockingMergedRangeMock.mockReturnValue( null );
		getBlockingMergedCellMock.mockReturnValue( null );
	} );

	it.each( [
		[ 'above' as const, 4 ],
		[ 'below' as const, 5 ],
	] )(
		'when a current Row target is resolved %s, should return the pre-move destination boundary',
		( position, destinationBoundaryIndex ) => {
			expect(
				rowRfResolution.resolve( 'table-a', {
					sourceRowIndex: 1,
					targetRowIndex: 4,
					position,
				} )
			).toEqual( {
				status: 'resolved',
				candidate: {
					clientId: 'table-a',
					sourceRowIndex: 1,
					destinationBoundaryIndex,
				},
			} );
		}
	);

	it.each( [
		[ 2, 'above' as const ],
		[ 1, 'below' as const ],
	] )(
		'when a Row move would keep the current order, should return no-op before structural rejection',
		( targetRowIndex, position ) => {
			expect(
				rowRfResolution.resolve( 'table-a', {
					sourceRowIndex: 2,
					targetRowIndex,
					position,
				} )
			).toEqual( { status: 'no-op' } );
			expect( getBlockingMergedRangeMock ).not.toHaveBeenCalled();
			expect( getBlockingMergedCellMock ).not.toHaveBeenCalled();
		}
	);

	it( 'when the current Row table or selected positions cannot be resolved, should return unavailable', () => {
		getConstraintsMock.mockReturnValueOnce( null );
		expect(
			rowRfResolution.resolve( 'table-a', {
				sourceRowIndex: 1,
				targetRowIndex: 4,
				position: 'above',
			} )
		).toEqual( { status: 'unavailable' } );

		getConstraintsMock.mockReturnValueOnce( { rowCount: 3, blockedBoundaries: [] } );
		expect(
			rowRfResolution.resolve( 'table-a', {
				sourceRowIndex: 1,
				targetRowIndex: 4,
				position: 'above',
			} )
		).toEqual( { status: 'unavailable' } );
	} );

	it( 'when a changing Row move is blocked, should return rejected with the blocking cell location', () => {
		getBlockingMergedRangeMock.mockReturnValue( { rowStart: 2, rowEnd: 4 } );
		getBlockingMergedCellMock.mockReturnValue( {
			rowStart: 2,
			rowEnd: 4,
			columnStart: 1,
			columnEnd: 2,
		} );

		expect(
			rowRfResolution.resolve( 'table-a', {
				sourceRowIndex: 0,
				targetRowIndex: 4,
				position: 'below',
			} )
		).toEqual( {
			status: 'rejected',
			blockingMergedCell: {
				rowStart: 2,
				rowEnd: 4,
				columnStart: 1,
				columnEnd: 2,
			},
		} );
	} );

	it( 'when structural rejection can no longer be diagnosed as a current cell, should return unavailable', () => {
		getBlockingMergedRangeMock.mockReturnValue( { rowStart: 2, rowEnd: 4 } );
		getBlockingMergedCellMock.mockReturnValue( null );

		expect(
			rowRfResolution.resolve( 'table-a', {
				sourceRowIndex: 0,
				targetRowIndex: 4,
				position: 'below',
			} )
		).toEqual( { status: 'unavailable' } );
	} );
} );
