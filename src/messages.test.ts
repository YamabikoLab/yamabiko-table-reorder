import { PLUGIN_NAME } from './messages';

describe( 'v1 source skeleton', () => {
	it( 'keeps the plugin name available to the i18n pipeline', () => {
		expect( PLUGIN_NAME ).toBe( 'Yamabiko Table Reorder' );
	} );
} );
