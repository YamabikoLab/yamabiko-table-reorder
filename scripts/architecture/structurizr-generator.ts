import type {
	ArchitectureDependency,
	ArchitectureModel,
	DependencyView,
	ExternalContext,
	ProcessFlowEdgeKind,
	ProcessFlowView,
	Responsibility,
	RuntimeView,
} from './architecture-model';

type ArchitectureElement = ExternalContext | Responsibility;

type ProcessFlowRelationship = {
	id: string;
	from: string;
	to: string;
	kind: ProcessFlowEdgeKind;
	meaning: string;
	processFlowViewIds: string[];
};

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

const processFlowTag = ( processFlowViewId: string ): string =>
	`ProcessFlow_${ processFlowViewId }`;

const processFlowEdgeKindTag = ( kind: ProcessFlowEdgeKind ): string => kind;

const runtimeTag = ( runtimeViewId: string ): string => `Runtime_${ runtimeViewId }`;

const escapeDslString = ( value: string ): string =>
	value.replaceAll( '\\', '\\\\' ).replaceAll( '"', '\\"' ).replaceAll( '\n', ' ' );

const quoted = ( value: string ): string => `"${ escapeDslString( value ) }"`;

const processFlowRelationshipKey = (
	from: string,
	to: string,
	kind: ProcessFlowEdgeKind,
	meaning: string
): string => `${ from }\u0000${ to }\u0000${ kind }\u0000${ meaning }`;

const buildProcessFlowRelationships = (
	processFlowViews: ProcessFlowView[]
): ProcessFlowRelationship[] => {
	const relationships: ProcessFlowRelationship[] = [];
	const relationshipsByKey = new Map< string, ProcessFlowRelationship >();

	processFlowViews.forEach( ( processFlowView ) => {
		processFlowView.edges.forEach( ( edge ) => {
			const relationshipKey = processFlowRelationshipKey(
				edge.from,
				edge.to,
				edge.kind,
				edge.meaning
			);
			let relationship = relationshipsByKey.get( relationshipKey );

			if ( relationship === undefined ) {
				relationship = {
					id: processFlowRelationshipIdentifier( relationships.length ),
					from: edge.from,
					to: edge.to,
					kind: edge.kind,
					meaning: edge.meaning,
					processFlowViewIds: [],
				};
				relationships.push( relationship );
				relationshipsByKey.set( relationshipKey, relationship );
			}

			if ( ! relationship.processFlowViewIds.includes( processFlowView.id ) ) {
				relationship.processFlowViewIds.push( processFlowView.id );
			}
		} );
	} );

	return relationships;
};

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
			relationship.usages.push( {
				runtimeViewId: runtimeView.id,
				step: step.step,
			} );
			stepRelationshipIds.set( runtimeStepKey( runtimeView.id, step.step ), relationship.id );
		} );
	} );

	return { relationships, stepRelationshipIds };
};

const generateElement = (
	element: ArchitectureElement,
	metadata: string,
	tags: string[]
): string[] => [
	`\t\t${ element.id } = element ${ quoted( element.name ) } ${ quoted( metadata ) } ${ quoted(
		element.summary
	) } {`,
	`\t\t\ttags ${ quoted( tags.join( ',' ) ) }`,
	'\t\t}',
];

const generateDependency = ( dependency: ArchitectureDependency, index: number ): string[] => [
	`\t\t${ dependencyIdentifier( index ) } = ${ dependency.dependent } -> ${
		dependency.dependsOn
	} ${ quoted( dependency.reason ) } {`,
	'\t\t\ttags "Structural Dependency"',
	'\t\t}',
];

const processFlowElements = ( processFlowView: ProcessFlowView ): string[] => {
	const identifiers: string[] = [];

	processFlowView.edges.forEach( ( edge ) => {
		[ edge.from, edge.to ].forEach( ( identifier ) => {
			if ( ! identifiers.includes( identifier ) ) {
				identifiers.push( identifier );
			}
		} );
	} );

	return identifiers;
};

const processFlowRelationshipLabel = ( kind: ProcessFlowEdgeKind, meaning: string ): string => {
	if ( kind === 'normal' ) {
		return meaning;
	}
	return `[${ kind }] ${ meaning }`;
};

const generateProcessFlowRelationship = ( relationship: ProcessFlowRelationship ): string[] => {
	const tags = [
		'Process Flow',
		...relationship.processFlowViewIds.map( ( processFlowViewId ) =>
			processFlowTag( processFlowViewId )
		),
		processFlowEdgeKindTag( relationship.kind ),
	];

	return [
		`\t\t${ relationship.id } = ${ relationship.from } -> ${ relationship.to } ${ quoted(
			processFlowRelationshipLabel( relationship.kind, relationship.meaning )
		) } {`,
		`\t\t\ttags ${ quoted( tags.join( ',' ) ) }`,
		'\t\t}',
	];
};

const generateRuntimeRelationship = ( relationship: RuntimeRelationship ): string[] => {
	const tags = [
		'Runtime Interaction',
		...relationship.runtimeViewIds.map( ( runtimeViewId ) => runtimeTag( runtimeViewId ) ),
	];
	const lines = [
		`\t\t${ relationship.id } = ${ relationship.source } -> ${ relationship.target } ${ quoted(
			relationship.interaction
		) } {`,
		`\t\t\ttags ${ quoted( tags.join( ',' ) ) }`,
		'\t\t\tproperties {',
	];

	relationship.usages.forEach( ( usage ) => {
		lines.push(
			`\t\t\t\t${ quoted( `runtime.${ usage.runtimeViewId }.step.${ usage.step }` ) } ${ quoted(
				relationship.interaction
			) }`
		);
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

const processFlowViewTitle = ( view: ProcessFlowView ): string =>
	view.kind === 'failure-recovery'
		? `Process Flow [Failure / Recovery] - ${ view.name }`
		: `Process Flow - ${ view.name }`;

const generateProcessFlowView = ( view: ProcessFlowView ): string[] => [
	`\t\tcustom ${ quoted( view.id ) } {`,
	`\t\t\ttitle ${ quoted( processFlowViewTitle( view ) ) }`,
	`\t\t\tinclude ${ processFlowElements( view ).join( ' ' ) }`,
	`\t\t\texclude ${ quoted( `relationship.tag!=${ processFlowTag( view.id ) }` ) }`,
	'\t\t\tautoLayout lr',
	'\t\t}',
];

const generateStyles = ( hasProcessFlowViews: boolean ): string[] => {
	const lines = [
		'\t\tstyles {',
		'\t\t\telement "Responsibility" {',
		'\t\t\t\tshape Box',
		'\t\t\t}',
		'\t\t\telement "External System" {',
		'\t\t\t\tshape RoundedBox',
		'\t\t\t\tbackground #f8fafc',
		'\t\t\t\tcolor #344054',
		'\t\t\t\tstroke #667085',
		'\t\t\t\tborder solid',
		'\t\t\t}',
		'\t\t\telement "External Block" {',
		'\t\t\t\tshape Component',
		'\t\t\t\tbackground #eef4ff',
		'\t\t\t\tcolor #344054',
		'\t\t\t\tstroke #6172f3',
		'\t\t\t}',
		'\t\t\telement "External Capability" {',
		'\t\t\t\tshape Hexagon',
		'\t\t\t\tbackground #f4f3ff',
		'\t\t\t\tcolor #344054',
		'\t\t\t\tstroke #7f56d9',
		'\t\t\t}',
		'\t\t\telement "External Environment" {',
		'\t\t\t\tshape Box',
		'\t\t\t\tbackground #f2f4f7',
		'\t\t\t\tcolor #344054',
		'\t\t\t\tstroke #98a2b3',
		'\t\t\t\tborder dashed',
		'\t\t\t}',
		'\t\t\trelationship "Structural Dependency" {',
		'\t\t\t\tstyle solid',
		'\t\t\t}',
		'\t\t\trelationship "Runtime Interaction" {',
		'\t\t\t\tstyle solid',
		'\t\t\t}',
	];

	if ( hasProcessFlowViews ) {
		lines.push(
			'\t\t\trelationship "normal" {',
			'\t\t\t\tstyle solid',
			'\t\t\t}',
			'\t\t\trelationship "failure" {',
			'\t\t\t\tcolor #b42318',
			'\t\t\t\tstyle dashed',
			'\t\t\t\tthickness 3',
			'\t\t\t}',
			'\t\t\trelationship "recovery" {',
			'\t\t\t\tcolor #b54708',
			'\t\t\t\tstyle dotted',
			'\t\t\t\tthickness 3',
			'\t\t\t}'
		);
	}

	lines.push( '\t\t}' );
	return lines;
};

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

const runtimeStepProperty = (
	runtimeView: RuntimeView,
	stepRelationshipIds: Map< string, string >
): string =>
	runtimeView.steps
		.map( ( step ) => {
			const relationshipId = stepRelationshipIds.get( runtimeStepKey( runtimeView.id, step.step ) );
			if ( relationshipId === undefined ) {
				throw new Error(
					`Runtime step ${ runtimeView.id }#${ step.step } has no generated Runtime Interaction relationship.`
				);
			}
			return `${ step.step }=${ relationshipId }`;
		} )
		.join( ';' );

const generateRuntimeView = (
	runtimeView: RuntimeView,
	stepRelationshipIds: Map< string, string >
): string[] => {
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

/**
 * Architecture Model に含まれる明示的な設計情報だけから Structurizr DSL を生成する。
 * Structural Dependency、Process Flow、Runtime Interaction は独立した Relationship として生成する。
 * Dependency View と Process Flow View は、それぞれの View に対応する Relationship だけを表示する。
 * 同一の Process Flow Relationship または Runtime Interaction が複数 View で使われる場合は、
 * Structurizr Model 上の Relationship を共有する。
 *
 * @param model Markdown から構築した Architecture Model。
 * @return 決定的に生成された Structurizr DSL。
 */
export const generateStructurizrDsl = ( model: ArchitectureModel ): string => {
	const processFlowRelationships = buildProcessFlowRelationships( model.processFlowViews );
	const runtimeRelationships = buildRuntimeRelationships( model.runtimeViews );
	const lines = [
		'// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.',
		'workspace "YTR Reorder v1 Architecture" {',
		'\t!impliedRelationships false',
		'',
		'\tmodel {',
	];

	model.externalContexts.forEach( ( externalContext ) => {
		lines.push(
			...generateElement( externalContext, externalContext.type, [
				'External Context',
				externalContext.type,
			] )
		);
	} );

	if ( model.externalContexts.length > 0 && model.responsibilities.length > 0 ) {
		lines.push( '' );
	}

	model.responsibilities.forEach( ( responsibility ) => {
		lines.push( ...generateElement( responsibility, 'Responsibility', [ 'Responsibility' ] ) );
	} );

	if ( model.dependencies.length > 0 ) {
		lines.push( '' );
	}

	model.dependencies.forEach( ( dependency, index ) => {
		lines.push( ...generateDependency( dependency, index ) );
	} );

	if ( processFlowRelationships.length > 0 ) {
		lines.push( '' );
	}

	processFlowRelationships.forEach( ( relationship ) => {
		lines.push( ...generateProcessFlowRelationship( relationship ) );
	} );

	if ( runtimeRelationships.relationships.length > 0 ) {
		lines.push( '' );
	}

	runtimeRelationships.relationships.forEach( ( relationship ) => {
		lines.push( ...generateRuntimeRelationship( relationship ) );
	} );

	lines.push( '\t}', '', '\tviews {' );

	let hasPreviousView = false;
	model.dependencyViews.forEach( ( view ) => {
		if ( hasPreviousView ) {
			lines.push( '' );
		}
		lines.push( ...generateDependencyView( view ) );
		hasPreviousView = true;
	} );

	model.processFlowViews.forEach( ( processFlowView ) => {
		if ( hasPreviousView ) {
			lines.push( '' );
		}
		lines.push( ...generateProcessFlowView( processFlowView ) );
		hasPreviousView = true;
	} );

	model.runtimeViews.forEach( ( runtimeView ) => {
		if ( hasPreviousView ) {
			lines.push( '' );
		}
		lines.push( ...generateRuntimeView( runtimeView, runtimeRelationships.stepRelationshipIds ) );
		hasPreviousView = true;
	} );

	lines.push( '', ...generateStyles( model.processFlowViews.length > 0 ) );

	lines.push( '\t}', '}', '' );
	return lines.join( '\n' );
};
