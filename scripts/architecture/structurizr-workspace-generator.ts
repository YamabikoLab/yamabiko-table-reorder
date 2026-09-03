import type { ArchitectureModel } from './architecture-model';
import { generateStructurizrDsl } from './structurizr-generator';

const dependencyViewDeclarationPattern = /^(\t\t)custom "(DV_[A-Za-z0-9_]+)" \{$/gmu;

/**
 * Architecture ModelからStructurizrで所有境界を表示できるWorkspace DSLを生成する。
 * Dependency ViewだけをGroup境界を描画できるSystem Landscape Viewへ変換し、
 * Process Flow ViewとRuntime ViewのCustom View表現は変更しない。
 *
 * @param model Markdownから構築したArchitecture Model。
 * @return Structurizrで所有境界を表示可能なWorkspace DSL。
 */
export const generateStructurizrWorkspaceDsl = ( model: ArchitectureModel ): string =>
	generateStructurizrDsl( model ).replace(
		dependencyViewDeclarationPattern,
		'$1systemLandscape "$2" {'
	);
