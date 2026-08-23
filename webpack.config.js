const fs = require( 'node:fs' );
const path = require( 'node:path' );

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

const SORTABLEJS_TABLE_REORDER_ASSET = 'sortable.min.js';

class EmitSortableJsTableReorderRuntimePlugin {
	apply( compiler ) {
		compiler.hooks.thisCompilation.tap(
			'EmitSortableJsTableReorderRuntimePlugin',
			( compilation ) => {
				compilation.hooks.processAssets.tap(
					{
						name: 'EmitSortableJsTableReorderRuntimePlugin',
						stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
					},
					() => {
						const sourcePath = require.resolve( 'sortablejs/Sortable.min.js' );
						const source = fs.readFileSync( sourcePath );

						compilation.emitAsset(
							SORTABLEJS_TABLE_REORDER_ASSET,
							new compiler.webpack.sources.RawSource( source )
						);
					}
				);
			}
		);
	}
}

module.exports = {
	...defaultConfig,
	entry: {
		index: './src/index.tsx',
	},
	resolve: {
		...defaultConfig.resolve,
		alias: {
			...( defaultConfig.resolve?.alias ?? {} ),
			'@': path.resolve( __dirname, 'src' ),
		},
	},
	plugins: [ ...( defaultConfig.plugins ?? [] ), new EmitSortableJsTableReorderRuntimePlugin() ],
};
