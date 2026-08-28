import type {
	ArchitectureDependency,
	ArchitectureModel,
	DependencyView,
	ExternalContext,
	ProcessFlowView,
	Responsibility,
	RuntimeView,
} from './architecture-model';

type ArchitectureElement = ExternalContext | Responsibility;

type RuntimeRelationshipUsage = {
	runtimeViewId: string;
	step: number;
};

type RuntimeRelationship = {
	id: string;
	source: string;
	target: string;
	interaction: string;
	runtimeViewIds: string[];
	usages: RuntimeRelationshipUsage[];
};

type RuntimeRelationships = {
	relationships: RuntimeRelationship[];
	stepRelationshipIds: Map< string, string >;
};

const dependencyIdentifier = ( index: number ): string =>
	`DEP_${ String( index + 1 ).padStart( 3, '0' ) }`;
const processFlowRelationshipIdentifier = ( index: number ): string =>
	`PF_${ String( index + 1 ).padStart( 3, '0' ) }`;
const runtimeRelationshipIdentifier = ( index: number ): string =>
	`RT_${ String( index + 1 ).padStart( 3, '0' ) }`;
const processFlowTag = ( processFlowViewId: string ): string => `ProcessFlow_${ processFlowViewId }`;
const runtimeTag = ( runtimeViewId: string ): string => `Runtime_${ runtimeViewId }`;

const escapeDslString = ( value: string ): string =>
	value.replaceAll( '\\', '\\\\' ).replaceAll( '"', '\\"' ).replaceAll( '\n', ' ' );
const quoted = ( value: string ): string => `"${ escapeDslString( value ) }"`;
const runtimeRelationshipKey = ( source: string, target: string, interaction: string ): string =>
	`${ source }\u0000${ target }\u0000${ interaction }`;
const runtimeStepKey = ( runtimeViewId: string, step: number ): string =>
	`${ runtimeViewId }\u0000${ step }`;

const buildRuntimeRelationships = ( runtimeViews: RuntimeView[] ): RuntimeRelationships => {
	const relationships: RuntimeRelationship[] = [];
	const relationshipsByKey = new Map< string, RuntimeRelationship >();
	const stepRelationshipIds = new Map< string, string >();
	runtimeViews.forEach( ( runtimeView ) => {
		runtimeView.steps.forEach( ( step ) => {
			const relationshipKey = runtimeRelationshipKey( step.source, step.target, step.interaction );
			let relationship = relationshipsByKey.get( relationshipKey );
			if ( relationship === undefined ) {
				relationship = {
					id: runtimeRelationshipIdentifier( relationships.length ),
					source: step.source,
					target: step.target,
					interaction: step.interaction,
					runtimeViewIds: [],
					usages: [],
				};
				relationships.push( relationship );
				relationshipsByKey.set( relationshipKey, relationship );
			}
			if ( ! relationship.runtimeViewIds.includes( runtimeView.id ) ) {
				relationship.runtimeViewIds.push( runtimeView.id );
			}
			relationship.usages.push( { runtimeViewId: runtimeView.id, step: step.step } );
			stepRelationshipIds.set( runtimeStepKey( runtimeView.id, step.step ), relationship.id );
		} );
	} );
	return { relationships, stepRelationshipIds };
};

const generateElement = ( element: ArchitectureElement, metadata: string, tag: string ): string[] => [
	`\t\t${ element.id } = element ${ quoted( element.name ) } ${ quoted( metadata ) } ${ quoted( element.summary ) } {`,
	`\t\t\ttags ${ quoted( tag ) }`,
	'\t\t}',
];

const generateDependency = ( dependency: ArchitectureDependency, index: number ): string[] => [
	`\t\t${ dependencyIdentifier( index ) } = ${ dependency.dependent } -> ${ dependency.dependsOn } ${ quoted( dependency.reason ) } {`,
	'\t\t\ttags "Structural Dependency"',
	'\t\t}',
];

const processFlowElements = ( processFlowView: ProcessFlowView ): string[] => {
	const identifiers: string[] = [];
	processFlowView.edges.forEach( ( edge ) => {
		[ edge.from, edge.to ].forEach( ( identifier ) => {
			if ( ! identifiers.includes( identifier ) ) identifiers.push( identifier );
		} );
	} );
	return identifiers;
};

const generateProcessFlowRelationships = ( processFlowViews: ProcessFlowView[] ): string[] => {
	const lines: string[] = [];
	let relationshipIndex = 0;
	processFlowViews.forEach( ( view ) => {
		view.edges.forEach( ( edge ) => {
			const tags = [ 'Process Flow', processFlowTag( view.id ) ].join( ',' );
			lines.push(
				`\t\t${ processFlowRelationshipIdentifier( relationshipIndex ) } = ${ edge.from } -> ${ edge.to } ${ quoted( edge.meaning ) } {`,
				`\t\t\ttags ${ quoted( tags ) }`,
				'\t\t}'
			);
			relationshipIndex++;
		} );
	} );
	return lines;
};

const generateRuntimeRelationship = ( relationship: RuntimeRelationship ): string[] => {
	const tags = [ 'Runtime Interaction', ...relationship.runtimeViewIds.map( ( id ) => runtimeTag( id ) ) ];
	const lines = [
		`\t\t${ relationship.id } = ${ relationship.source } -> ${ relationship.target } ${ quoted( relationship.interaction ) } {`,
		`\t\t\ttags ${ quoted( tags.join( ',' ) ) }`,
		'\t\t\tproperties {',
	];
	relationship.usages.forEach( ( usage ) => {
		lines.push( `\t\t\t\t${ quoted( `runtime.${ usage.runtimeViewId }.step.${ usage.step }` ) } ${ quoted( relationship.interaction ) }` );
	} );
	lines.push( '\t\t\t}', '\t\t}' );
	return lines;
};

const generateDependencyView = ( view: DependencyView ): string[] => [
	`\t\tcustom ${ quoted( view.id ) } {`,
	`\t\t\ttitle ${ quoted( `Structural Dependencies - ${ view.name }` ) }`,
	`\t\t\tinclude ${ view.includes.join( ' ' ) }`,
	'\t\t\texclude "relationship.tag!=Structural Dependency"',
	'\t\t\tautoLayout lr',
	'\t\t}',
];

const generateProcessFlowView = ( view: ProcessFlowView ): string[] => [
	`\t\tcustom ${ quoted( view.id ) } {`,
	`\t\t\ttitle ${ quoted( `Process Flow - ${ view.name }` ) }`,
	`\t\t\tinclude ${ processFlowElements( view ).join( ' ' ) }`,
	`\t\t\texclude ${ quoted( `relationship.tag!=${ processFlowTag( view.id ) }` ) }`,
	'\t\t\tautoLayout lr',
	'\t\t}',
];

const runtimeElements = ( runtimeView: RuntimeView ): string[] => {
	const identifiers: string[] = [];
	runtimeView.steps.forEach( ( step ) => {
		[ step.source, step.target ].forEach( ( identifier ) => {
			if ( ! identifiers.includes( identifier ) ) identifiers.push( identifier );
		} );
	} );
	return identifiers;
};

const runtimeStepProperty = ( runtimeView: RuntimeView, stepRelationshipIds: Map< string, string > ): string =>
	runtimeView.steps
		.map( ( step ) => {
			const relationshipId = stepRelationshipIds.get( runtimeStepKey( runtimeView.id, step.step ) );
			if ( relationshipId === undefined ) {
				throw new Error( `Runtime step ${ runtimeView.id }#${ step.step } has no generated Runtime Interaction relationship.` );
			}
			return `${ step.step }=${ relationshipId }`;
		} )
		.join( ';' );

const generateRuntimeView = ( runtimeView: RuntimeView, stepRelationshipIds: Map< string, string > ): string[] => {
	const elements = runtimeElements( runtimeView );
	const sequence = runtimeStepProperty( runtimeView, stepRelationshipIds );
	const tag = runtimeTag( runtimeView.id );
	return [
		`\t\tcustom ${ quoted( runtimeView.id ) } {`,
		`\t\t\ttitle ${ quoted( `Runtime - ${ runtimeView.name }` ) }`,
		`\t\t\tinclude ${ elements.join( ' ' ) }`,
		`\t\t\texclude ${ quoted( `relationship.tag!=${ tag }` ) }`,
		'\t\t\tproperties {',
		`\t\t\t\t"runtime.steps" ${ quoted( sequence ) }`,
		'\t\t\t}',
		'\t\t\tautoLayout lr',
		'\t\t}',
	];
};

/** Architecture Model の明示情報だけから Structurizr DSL を生成する。 */
export const generateStructurizrDsl = ( model: ArchitectureModel ): string => {
	const runtimeRelationships = buildRuntimeRelationships( model.runtimeViews );
	const processFlowRelationships = generateProcessFlowRelationships( model.processFlowViews );
	const lines = [
		'// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.',
		'workspace "YTR Reorder v1 Architecture" {',
		'\t!impliedRelationships false',
		'',
		'\tmodel {',
	];
	model.externalContexts.forEach( ( item ) => lines.push( ...generateElement( item, item.type, 'External Context' ) ) );
	if ( model.externalContexts.length > 0 && model.responsibilities.length > 0 ) lines.push( '' );
	model.responsibilities.forEach( ( item ) => lines.push( ...generateElement( item, 'Responsibility', 'Responsibility' ) ) );
	if ( model.dependencies.length > 0 ) lines.push( '' );
	model.dependencies.forEach( ( item, index ) => lines.push( ...generateDependency( item, index ) ) );
	if ( processFlowRelationships.length > 0 ) {
		lines.push( '' );
		lines.push( ...processFlowRelationships );
	}
	if ( runtimeRelationships.relationships.length > 0 ) lines.push( '' );
	runtimeRelationships.relationships.forEach( ( item ) => lines.push( ...generateRuntimeRelationship( item ) ) );
	lines.push( '\t}', '', '\tviews {' );

	let hasPreviousView = false;
	model.dependencyViews.forEach( ( view ) => {
		if ( hasPreviousView ) lines.push( '' );
		lines.push( ...generateDependencyView( view ) );
		hasPreviousView = true;
	} );
	model.processFlowViews.forEach( ( view ) => {
		if ( hasPreviousView ) lines.push( '' );
		lines.push( ...generateProcessFlowView( view ) );
		hasPreviousView = true;
	} );
	model.runtimeViews.forEach( ( view ) => {
		if ( hasPreviousView ) lines.push( '' );
		lines.push( ...generateRuntimeView( view, runtimeRelationships.stepRelationshipIds ) );
		hasPreviousView = true;
	} );
	lines.push( '\t}', '}', '' );
	return lines.join( '\n' );
};
