/**
 * 行並び替えに固有のReorder Target Resolution規則を確認する単体テスト。
 */
import { createReorderTargetResolution } from '@/reorder/core/reorder-target-resolution';
import type { TableIntegration, TableStructure } from '@/reorder/foundation/table-integration';

const createIntegration = ( structure: TableStructure ): TableIntegration => ( {
	getStructure: jest.fn().mockReturnValue( structure ),
} );

describe( 'Row Reorder Target Resolution', () => {
	it( 'when row reorder starts outside the body section, should return target-out-of-scope', () => {
		const resolution = createReorderTargetResolution( createIntegration( { mergedCells: [] } ) );
		expect( resolution.resolve( { kind: 'row', clientId: 'table-client-id', section: 'head', rowIndex: 0 } ) ).toEqual( { status: 'immovable', reason: 'target-out-of-scope' } );
	} );

	it( 'when a row starts inside a body rowspan range, should return merged-cell', () => {
		const resolution = createReorderTargetResolution( createIntegration( { mergedCells: [ { section: 'body', rowStart: 1, columnStart: 0, rowSpan: 3, columnSpan: 1 } ] } ) );
		expect( resolution.resolve( { kind: 'row', clientId: 'table-client-id', section: 'body', rowIndex: 2 } ) ).toEqual( { status: 'immovable', reason: 'merged-cell' } );
	} );

	it( 'when a movable row is resolved, should derive only body rowspan boundaries', () => {
		const resolution = createReorderTargetResolution( createIntegration( { mergedCells: [
			{ section: 'body', rowStart: 1, columnStart: 0, rowSpan: 3, columnSpan: 1 },
			{ section: 'body', rowStart: 5, columnStart: 1, rowSpan: 1, columnSpan: 2 },
			{ section: 'head', rowStart: 0, columnStart: 0, rowSpan: 2, columnSpan: 1 },
		] } ) );
		expect( resolution.resolve( { kind: 'row', clientId: 'table-client-id', section: 'body', rowIndex: 4 } ) ).toEqual( {
			status: 'movable', target: { kind: 'row', clientId: 'table-client-id', rowIndex: 4 }, constraints: { blockedBoundaries: [ 2, 3 ] },
		} );
	} );
} );
