/**
 * 列並び替えに固有のReorder Target Resolution規則を確認する単体テスト。
 */
import { createReorderTargetResolution } from '@/reorder/core/reorder-target-resolution';
import type { TableIntegration, TableStructure } from '@/reorder/foundation/table-integration';

const createIntegration = ( structure: TableStructure ): TableIntegration => ( {
	getStructure: jest.fn().mockReturnValue( structure ),
} );

describe( 'Column Reorder Target Resolution', () => {
	it( 'when a column starts inside any colspan range, should return merged-cell', () => {
		const resolution = createReorderTargetResolution( createIntegration( { mergedCells: [ { section: 'foot', rowStart: 0, columnStart: 1, rowSpan: 1, columnSpan: 3 } ] } ) );
		expect( resolution.resolve( { kind: 'column', clientId: 'table-client-id', columnIndex: 2 } ) ).toEqual( { status: 'immovable', reason: 'merged-cell' } );
	} );

	it( 'when a movable column is resolved, should derive unique sorted colspan boundaries from the whole table', () => {
		const resolution = createReorderTargetResolution( createIntegration( { mergedCells: [
			{ section: 'head', rowStart: 0, columnStart: 0, rowSpan: 1, columnSpan: 3 },
			{ section: 'body', rowStart: 1, columnStart: 1, rowSpan: 1, columnSpan: 3 },
			{ section: 'foot', rowStart: 0, columnStart: 0, rowSpan: 1, columnSpan: 2 },
			{ section: 'body', rowStart: 3, columnStart: 5, rowSpan: 2, columnSpan: 1 },
		] } ) );
		expect( resolution.resolve( { kind: 'column', clientId: 'table-client-id', columnIndex: 4 } ) ).toEqual( {
			status: 'movable', target: { kind: 'column', clientId: 'table-client-id', columnIndex: 4 }, constraints: { blockedBoundaries: [ 1, 2, 3 ] },
		} );
	} );
} );
