import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

import webpack, {
	type Configuration,
	type StatsCompilation,
	type StatsModule,
} from 'webpack';

interface NpmQueryNode {
	location?: string;
	name?: string;
	path?: string;
	realpath?: string;
	version?: string;
}

interface OptionalNode {
	name: string;
	path: string;
	version: string;
}

const repositoryRoot = process.cwd();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const normalizeExistingPath = ( candidate: string ): string => {
	const absolutePath = path.isAbsolute( candidate )
		? candidate
		: path.resolve( repositoryRoot, candidate );

	return path.normalize(
		existsSync( absolutePath ) ? realpathSync( absolutePath ) : absolutePath
	);
};

const getOptionalOnlyNodes = (): OptionalNode[] => {
	const stdout = execFileSync(
		npmCommand,
		[ 'query', '.optional:not(.prod)', '--json' ],
		{
			cwd: repositoryRoot,
			encoding: 'utf8',
			stdio: [ 'ignore', 'pipe', 'inherit' ],
		}
	);

	const nodes = JSON.parse( stdout ) as NpmQueryNode[];

	return nodes.map( ( node ) => {
		const nodePath = node.realpath ?? node.path ?? node.location;

		if ( ! node.name || ! node.version || ! nodePath ) {
			throw new Error(
				'Unable to identify an optional-only dependency node from npm query output.'
			);
		}

		return {
			name: node.name,
			version: node.version,
			path: normalizeExistingPath( nodePath ),
		};
	} );
};

const getModulePaths = ( compilation: StatsCompilation ): Set<string> => {
	const modulePaths = new Set<string>();

	const visitModule = ( module: StatsModule ): void => {
		if ( module.nameForCondition ) {
			modulePaths.add( normalizeExistingPath( module.nameForCondition ) );
		}

		for ( const nestedModule of module.modules ?? [] ) {
			visitModule( nestedModule );
		}
	};

	for ( const module of compilation.modules ?? [] ) {
		visitModule( module );
	}

	return modulePaths;
};

const isInsidePackage = ( modulePath: string, packagePath: string ): boolean =>
	modulePath === packagePath ||
	modulePath.startsWith( packagePath + path.sep );

const compileProductionGraph = async (): Promise<Set<string>> => {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const baseConfig = require( '../../webpack.config.js' ) as Configuration;
	const outputPath = path.resolve( repositoryRoot, '.security-build/webpack' );

	const config: Configuration = {
		...baseConfig,
		mode: 'production',
		devtool: false,
		output: {
			...baseConfig.output,
			path: outputPath,
			clean: true,
		},
	};

	const stats = await new Promise<webpack.Stats>( ( resolve, reject ) => {
		const compiler = webpack( config );

		compiler.run( ( error, result ) => {
			const closeCompiler = (): void => {
				compiler.close( ( closeError ) => {
					if ( closeError ) {
						reject( closeError );
					}
				} );
			};

			if ( error ) {
				closeCompiler();
				reject( error );
				return;
			}

			if ( ! result ) {
				closeCompiler();
				reject( new Error( 'Webpack completed without returning stats.' ) );
				return;
			}

			compiler.close( ( closeError ) => {
				if ( closeError ) {
					reject( closeError );
					return;
				}

				resolve( result );
			} );
		} );
	} );

	const compilation = stats.toJson( {
		all: false,
		errors: true,
		modules: true,
		nestedModules: true,
	} );

	if ( stats.hasErrors() ) {
		const errors = ( compilation.errors ?? [] )
			.map( ( error ) =>
				typeof error === 'string' ? error : error.message
			)
			.join( '\n' );

		throw new Error( `Production Webpack compilation failed:\n${ errors }` );
	}

	return getModulePaths( compilation );
};

const main = async (): Promise<void> => {
	const optionalOnlyNodes = getOptionalOnlyNodes();
	const modulePaths = await compileProductionGraph();

	const bundledOptionalNodes = optionalOnlyNodes.filter( ( node ) =>
		Array.from( modulePaths ).some( ( modulePath ) =>
			isInsidePackage( modulePath, node.path )
		)
	);

	if ( bundledOptionalNodes.length === 0 ) {
		console.log(
			`Optional runtime dependency check passed (${ optionalOnlyNodes.length } optional-only nodes checked).`
		);
		return;
	}

	console.error(
		'Optional-only dependencies are included in the production runtime:'
	);

	for ( const node of bundledOptionalNodes ) {
		console.error( `- ${ node.name }@${ node.version } (${ node.path })` );
	}

	process.exitCode = 1;
};

void main().catch( ( error: unknown ) => {
	console.error(
		error instanceof Error ? error.message : 'Optional runtime check failed.'
	);
	process.exitCode = 1;
} );
