import { supportsColumnReorder } from './block-support';

describe( 'supportsColumnReorder', () => {
	it.each( [ 'core/table', 'flexible-table-block/table' ] )( 'supports %s', ( blockName ) => {
		expect( supportsColumnReorder( blockName ) ).toBe( true );
	} );

	it( 'rejects unrelated blocks', () => {
		expect( supportsColumnReorder( 'core/paragraph' ) ).toBe( false );
	} );
} );
