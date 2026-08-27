import { spawnSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';

const structurizrImage = 'structurizr/structurizr:2026.06.28-noble';

/**
 * Structurizr 公式 Docker イメージで生成 DSL を解析し、workspace として有効かを検証する。
 * Structurizr が DSL を受理しない場合は生成処理を失敗させ、成功した生成物として扱わせない。
 *
 * @param workspacePath 検証する Structurizr DSL のパス。
 */
export const validateStructurizrWorkspace = ( workspacePath: string ): void => {
	const absoluteWorkspacePath = resolve( workspacePath );
	const workspaceDirectory = dirname( absoluteWorkspacePath );
	const workspaceFilename = basename( absoluteWorkspacePath );
	const result = spawnSync(
		'docker',
		[
			'run',
			'--rm',
			'--volume',
			`${ workspaceDirectory }:/usr/local/structurizr`,
			'--workdir',
			'/usr/local/structurizr',
			structurizrImage,
			'validate',
			'-workspace',
			workspaceFilename,
		],
		{ encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'pipe' ] }
	);

	if ( result.error !== undefined ) {
		throw new Error( `Structurizr validation could not start: ${ result.error.message }` );
	}
	if ( result.status !== 0 ) {
		const detail = ( result.stderr || result.stdout || '' ).trim();
		throw new Error(
			`Structurizr validation failed for ${ workspacePath }: ${ detail || 'unknown error' }`
		);
	}
};
