/**
 * production bundle が optional-only dependency に依存していないことを検証する。
 *
 * npm が optional-only と分類する dependency node と production Webpack module graph を
 * installed package instance 単位で照合し、audit 対象から optional dependency を除外できる
 * 前提を継続的に保証する責務を持つ。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

import webpack, {
	type Configuration,
	type Stats,
	type StatsCompilation,
	type StatsModule,
} from 'webpack';

/**
 * npm query が返す dependency node の識別情報。
 *
 * npm のバージョンや node の状態によって利用可能な path 情報が異なるため、
 * installed package instance を特定できる候補を保持する。
 */
interface NpmQueryNode {
	location?: string;
	name?: string;
	path?: string;
	realpath?: string;
	version?: string;
}

/**
 * optional-only dependency として判定対象にする installed package instance。
 */
interface OptionalNode {
	name: string;
	path: string;
	version: string;
}

const repositoryRoot = process.cwd();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/**
 * dependency node と Webpack module を同じ実体パスで比較できるように正規化する。
 *
 * @param candidate npm または Webpack が返した path。
 *
 * @return 比較に使用する正規化済み path。
 */
const normalizeExistingPath = ( candidate: string ): string => {
	const absolutePath = path.isAbsolute( candidate )
		? candidate
		: path.resolve( repositoryRoot, candidate );

	return path.normalize( existsSync( absolutePath ) ? realpathSync( absolutePath ) : absolutePath );
};

/**
 * root から見て optional 経路にしか属さない dependency node を取得する。
 *
 * .prod と .optional の両方に属する node は production 必須依存として扱い、
 * optional-only の判定対象から除外する。
 *
 * @return optional-only dependency の installed package instance 一覧。
 */
const getOptionalOnlyNodes = (): OptionalNode[] => {
	const stdout = execFileSync( npmCommand, [ 'query', '.optional:not(.prod)', '--json' ], {
		cwd: repositoryRoot,
		encoding: 'utf8',
		stdio: [ 'ignore', 'pipe', 'inherit' ],
	} );

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

/**
 * production bundle に含まれた module の実体パスを収集する。
 *
 * concatenated module などの入れ子も同じ production module graph の一部として扱う。
 *
 * @param compilation production Webpack compile の統計情報。
 *
 * @return production bundle に含まれた module path の集合。
 */
const getModulePaths = ( compilation: StatsCompilation ): Set< string > => {
	const modulePaths = new Set< string >();

	/**
	 * module graph 内の1 module と、その配下の module を同じ判定対象として収集する。
	 *
	 * @param module 収集対象の Webpack module。
	 */
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

/**
 * production module が特定の installed package instance に属するかを判定する。
 *
 * @param modulePath production bundle 内 module の実体パス。
 * @param packagePath optional-only dependency node の package root。
 *
 * @return 同一 package instance に属する場合は true。
 */
const isInsidePackage = ( modulePath: string, packagePath: string ): boolean =>
	modulePath === packagePath || modulePath.startsWith( packagePath + path.sep );

/**
 * 通常の build/ を変更せず、production 条件の Webpack module graph を取得する。
 *
 * 検査専用出力は .security-build/ 配下に限定し、npm script の後処理で削除する。
 *
 * @return production bundle に含まれた module path の集合。
 */
const compileProductionGraph = async (): Promise< Set< string > > => {
	const baseConfig = require(
		path.resolve( repositoryRoot, 'webpack.config.js' )
	) as Configuration;
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

	const stats = await new Promise< Stats >( ( resolve, reject ) => {
		const compiler = webpack( config );

		compiler.run( ( error, result ) => {
			/**
			 * compile 失敗時も Webpack compiler の資源を解放する。
			 */
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
			.map( ( error ) => ( typeof error === 'string' ? error : error.message ) )
			.join( '\n' );

		throw new Error( `Production Webpack compilation failed:\n${ errors }` );
	}

	return getModulePaths( compilation );
};

/**
 * optional-only dependency が production runtime に混入していないことを検証する。
 *
 * optional-only package instance が1件でも bundle に含まれる場合は、
 * CI で検出できるよう終了コードを失敗にする。
 */
const main = async (): Promise< void > => {
	const optionalOnlyNodes = getOptionalOnlyNodes();
	const modulePaths = await compileProductionGraph();

	const bundledOptionalNodes = optionalOnlyNodes.filter( ( node ) =>
		Array.from( modulePaths ).some( ( modulePath ) => isInsidePackage( modulePath, node.path ) )
	);

	if ( bundledOptionalNodes.length === 0 ) {
		process.stdout.write(
			`Optional runtime dependency check passed (${ optionalOnlyNodes.length } optional-only nodes checked).\n`
		);
		return;
	}

	process.stderr.write( 'Optional-only dependencies are included in the production runtime:\n' );

	for ( const node of bundledOptionalNodes ) {
		process.stderr.write( `- ${ node.name }@${ node.version } (${ node.path })\n` );
	}

	process.exitCode = 1;
};

void main().catch( ( error: unknown ) => {
	process.stderr.write(
		`${ error instanceof Error ? error.message : 'Optional runtime check failed.' }\n`
	);
	process.exitCode = 1;
} );
