import type {
	ArchitectureDependency,
	ArchitectureModel,
	DependencyView,
	ExternalContext,
	Responsibility,
	RuntimeView,
} from './architecture-model';

type ArchitectureElement = ExternalContext | Responsibility;

const dependencyIdentifier = ( index: number ): string =>
	`DEP_${ String( index + 1 ).padStart( 3, '0' ) }`;

const runtimeRelationshipIdentifier = ( runtimeViewId: string, step: number ): string =>
	`RT_${ runtimeViewId }_${ String( step ).padStart( 3, '0' ) }`;

const runtimeTag = ( runtimeViewId: string ): string => `Runtime_${ runtimeViewId }`;

const escapeDslString = ( value: string ): string =>
	value.replaceAll( '\\', '\\\\' ).replaceAll( '"', '\\"' ).replaceAll( '\n', ' ' );

const quoted = ( value: string ): string => `"${ escapeDslString( value ) }"`;

const generateElement = (
	element: ArchitectureElement,
	metadata: string,
	tag: string
): string[] => [
	`\t\t${ element.id } = element ${ quoted( element.name ) } ${ quoted( metadata ) } ${ quoted(
		element.summary
	) } {`,
	`\t\t\ttags ${ quoted( tag ) }`,
	'\t\t}',
];

const generateDependency = ( dependency: ArchitectureDependency, index: number ): string[] => [
	`\t\t${ dependencyIdentifier( index ) } = ${ dependency.dependent } -> ${
		dependency.dependsOn
	} ${ quoted( dependency.reason ) } {`,
	'\t\t\ttags "Structural Dependency"',
	'\t\t}',
];

const generateRuntimeRelationship = ( runtimeView: RuntimeView, stepIndex: number ): string[] => {
	const step = runtimeView.steps[ stepIndex ];
	return [
		`\t\t${ runtimeRelationshipIdentifier( runtimeView.id, step.step ) } = ${ step.source } -> ${
			step.target
		} ${ quoted( step.interaction ) } {`,
		`\t\t\ttags ${ quoted( `Runtime Interaction,${ runtimeTag( runtimeView.id ) }` ) }`,
		'\t\t\tproperties {',
		`\t\t\t\t"runtime.step" ${ quoted( String( step.step ) ) }`,
		'\t\t\t}',
		'\t\t}',
	];
};

const generateDependencyView = ( view: DependencyView ): string[] => [
	`\t\tcustom ${ quoted( view.id ) } {`,
	`\t\t\ttitle ${ quoted( view.name ) }`,
	`\t\t\tinclude ${ view.includes.join( ' ' ) }`,
	'\t\t\texclude "relationship.tag!=Structural Dependency"',
	'\t\t\tautoLayout lr',
	'\t\t}',
];

const runtimeElements = ( runtimeView: RuntimeView ): string[] => {
	const identifiers: string[] = [];

	runtimeView.steps.forEach( ( step ) => {
		[ step.source, step.target ].forEach( ( identifier ) => {
			if ( ! identifiers.includes( identifier ) ) {
				identifiers.push( identifier );
			}
		} );
	} );

	return identifiers;
};

const runtimeStepProperty = ( runtimeView: RuntimeView ): string =>
	runtimeView.steps
		.map(
			( step ) => `${ step.step }=${ runtimeRelationshipIdentifier( runtimeView.id, step.step ) }`
		)
		.join( ';' );

const generateRuntimeView = ( runtimeView: RuntimeView ): string[] => {
	const elements = runtimeElements( runtimeView );
	const sequence = runtimeStepProperty( runtimeView );
	const tag = runtimeTag( runtimeView.id );

	return [
		`\t\tcustom ${ quoted( runtimeView.id ) } {`,
		`\t\t\ttitle ${ quoted( runtimeView.name ) }`,
		`\t\t\tinclude ${ elements.join( ' ' ) }`,
		`\t\t\texclude ${ quoted( `relationship.tag!=${ tag }` ) }`,
		'\t\t\tproperties {',
		`\t\t\t\t"runtime.steps" ${ quoted( sequence ) }`,
		'\t\t\t}',
		'\t\t\tautoLayout lr',
		'\t\t}',
	];
};

/**
 * Architecture Model に含まれる明示的な設計情報だけから Structurizr DSL を生成する。
 * Structural Dependency と Runtime Interaction は独立した Relationship として生成し、
 * Dependency View は Includes に明示された要素と、その両端が含まれる Dependency だけを表示する。
 *
 * @param model Markdown から構築した Architecture Model。
 * @return 決定的に生成された Structurizr DSL。
 */
export const generateStructurizrDsl = ( model: ArchitectureModel ): string => {
	const lines = [
		'// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.',
		'workspace "YTR Reorder v1 Architecture" {',
		'\t!impliedRelationships false',
		'',
		'\tmodel {',
	];

	model.externalContexts.forEach( ( externalContext ) => {
		lines.push( ...generateElement( externalContext, externalContext.type, 'External Context' ) );
	} );

	if ( model.externalContexts.length > 0 && model.responsibilities.length > 0 ) {
		lines.push( '' );
	}

	model.responsibilities.forEach( ( responsibility ) => {
		lines.push( ...generateElement( responsibility, 'Responsibility', 'Responsibility' ) );
	} );

	if ( model.dependencies.length > 0 ) {
		lines.push( '' );
	}

	model.dependencies.forEach( ( dependency, index ) => {
		lines.push( ...generateDependency( dependency, index ) );
	} );

	if ( model.runtimeViews.length > 0 ) {
		lines.push( '' );
	}

	model.runtimeViews.forEach( ( runtimeView, runtimeViewIndex ) => {
		runtimeView.steps.forEach( ( _step, stepIndex ) => {
			lines.push( ...generateRuntimeRelationship( runtimeView, stepIndex ) );
		} );
		if ( runtimeViewIndex < model.runtimeViews.length - 1 ) {
			lines.push( '' );
		}
	} );

	lines.push( '\t}', '', '\tviews {' );

	model.dependencyViews.forEach( ( view, index ) => {
		if ( index > 0 ) {
			lines.push( '' );
		}
		lines.push( ...generateDependencyView( view ) );
	} );

	model.runtimeViews.forEach( ( runtimeView ) => {
		if ( model.dependencyViews.length > 0 || runtimeView !== model.runtimeViews[ 0 ] ) {
			lines.push( '' );
		}
		lines.push( ...generateRuntimeView( runtimeView ) );
	} );

	lines.push( '\t}', '}', '' );
	return lines.join( '\n' );
};
