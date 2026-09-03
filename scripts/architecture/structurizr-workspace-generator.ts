import type { ArchitectureModel } from './architecture-model';
import { generateStructurizrDsl } from './structurizr-generator';

const dependencyViewDeclarationPattern = /^(\t\t)custom "(DV_[A-Za-z0-9_]+)" \{$/gmu;

const escapeScriptString = ( value: string ): string =>
	value.replaceAll( '\\', '\\\\' ).replaceAll( '"', '\\"' ).replaceAll( '\n', ' ' );

const quotedScriptString = ( value: string ): string => `"${ escapeScriptString( value ) }"`;

const applyOwnershipBoundaries = ( dsl: string, model: ArchitectureModel ): string => {
	const boundaryNameByElementId = new Map< string, string >();
	model.boundaries.forEach( ( boundary ) => {
		boundary.includes.forEach( ( elementId ) => {
			boundaryNameByElementId.set( elementId, boundary.name );
		} );
	} );

	if ( boundaryNameByElementId.size === 0 ) {
		return dsl;
	}

	const output: string[] = [];
	let currentBoundaryName: string | undefined;

	dsl.split( '\n' ).forEach( ( line ) => {
		if ( currentBoundaryName === undefined ) {
			const declaration = /^\t\t([A-Za-z0-9_]+) = element /u.exec( line );
			if ( declaration?.[ 1 ] !== undefined ) {
				currentBoundaryName = boundaryNameByElementId.get( declaration[ 1 ] );
			}
		}

		if ( currentBoundaryName !== undefined && line === '\t\t}' ) {
			output.push(
				'\t\t\t!script groovy {',
				`\t\t\t\telement.setGroup(${ quotedScriptString( currentBoundaryName ) })`,
				'\t\t\t}'
			);
			currentBoundaryName = undefined;
		}

		output.push( line );
	} );

	return output.join( '\n' );
};

/**
 * Architecture ModelからStructurizrで所有境界を表示できるWorkspace DSLを生成する。
 * custom elementはStructurizr DSLのgroupブロックへ配置せずモデル直下に維持し、
 * 公式DSL scriptから要素自身のgroup属性を設定してOwnership Boundaryを表現する。
 * Dependency ViewだけをGroup境界を描画できるSystem Landscape Viewへ変換し、
 * Process Flow ViewとRuntime ViewのCustom View表現は変更しない。
 *
 * @param model Markdownから構築したArchitecture Model。
 * @return Structurizrで所有境界を表示可能なWorkspace DSL。
 */
export const generateStructurizrWorkspaceDsl = ( model: ArchitectureModel ): string => {
	const dsl = generateStructurizrDsl( model );
	const groupedDsl = applyOwnershipBoundaries( dsl, model );

	return groupedDsl.replace(
		dependencyViewDeclarationPattern,
		'$1systemLandscape "$2" {'
	);
};
