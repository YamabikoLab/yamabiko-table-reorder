/**
 * Reorder Target Resolutionで行・列に共通する開始判定規則を確認する単体テスト。
 */
import type { TableIntegration, TableStructure } from '@/reorder/foundation/table-integration';
import { createReorderTargetResolution } from './reorder-target-resolution';

const createIntegration = ( structure: TableStructure | null ): TableIntegration => ( {
	getStructure: jest.fn().mockReturnValue( structure ),
} );

describe( 'Reorder Target Resolution shared rules', () => {
	it( 'when the current table structure is unavailable, should return table-structure-unavailable', () => {
		const integration = createIntegration( null );
		const resolution = createReorderTargetResolution( integration );
		expect( resolution.resolve( { kind: 'row', clientId: 'table-client-id', section: 'body', rowIndex: 0 } ) ).toEqual( {
			status: 'immovable', reason: 'table-structure-unavailable',
		} );
		expect( integration.getStructure ).toHaveBeenCalledWith( 'table-client-id' );
	} );

	it( 'when a logical start index is invalid, should return target-out-of-scope for both reorder kinds', () => {
		const resolution = createReorderTargetResolution( createIntegration( { mergedCells: [] } ) );
		expect( resolution.resolve( { kind: 'row', clientId: 'table-client-id', section: 'body', rowIndex: -1 } ) ).toEqual( { status: 'immovable', reason: 'target-out-of-scope' } );
		expect( resolution.resolve( { kind: 'column', clientId: 'table-client-id', columnIndex: 1.5 } ) ).toEqual( { status: 'immovable', reason: 'target-out-of-scope' } );
	} );
} );
