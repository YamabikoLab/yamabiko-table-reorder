const relationshipIdentifier = ( index ) =>
	`REL_${ String( index + 1 ).padStart( 3, '0' ) }`;

const runtimeTag = ( runtimeViewId ) => `Runtime_${ runtimeViewId }`;

const escapeDslString = ( value ) =>
	value.replaceAll( '\\', '\\\\' ).replaceAll( '"', '\\"' ).replaceAll( '\n', ' ' );

const quoted = ( value ) => `"${ escapeDslString( value ) }"`;

const relationshipKey = ( source, destination ) => `${ source }\u0000${ destination }`;

const buildRelationshipIndex = ( relationships ) => {
	const index = new Map();

	relationships.forEach( ( relationship, relationshipIndex ) => {
		const key = relationshipKey( relationship.source, relationship.destination );
		const existing = index.get( key ) ?? [];
		existing.push( relationshipIndex );
		index.set( key, existing );
	} );

	return index;
};

const bindRuntimeSteps = ( model ) => {
	const relationshipIndex = buildRelationshipIndex( model.relationships );
	const bindings = model.relationships.map( () => [] );

	model.runtimeViews.forEach( ( runtimeView ) => {
		runtimeView.steps.forEach( ( runtimeStep ) => {
			const key = relationshipKey( runtimeStep.source, runtimeStep.target );
			const matchingRelationships = relationshipIndex.get( key ) ?? [];

			if ( matchingRelationships.length !== 1 ) {
				throw new Error(
					`Runtime step ${ runtimeView.id }#${ runtimeStep.step } must resolve to exactly one explicit relationship.`
				);
			}

			bindings[ matchingRelationships[ 0 ] ].push( {
				runtimeViewId: runtimeView.id,
				step: runtimeStep.step,
				interaction: runtimeStep.interaction,
			} );
		} );
	} );

	return bindings;
};

const generateElement = ( element, metadata, tag ) => [
	`\t\t${ element.id } = element ${ quoted( element.name ) } ${ quoted( metadata ) } ${ quoted( element.summary ) } {`,
	`\t\t\ttags ${ quoted( tag ) }`,
	'\t\t}',
];

const generateRelationship = ( relationship, index, runtimeBindings ) => {
	const identifier = relationshipIdentifier( index );
	const tags = [ 'Architecture Relationship' ];
	const lines = [
		`\t\t${ identifier } = ${ relationship.source } -> ${ relationship.destination } ${ quoted( relationship.description ) } {`,
	];

	runtimeBindings.forEach( ( binding ) => {
		const tag = runtimeTag( binding.runtimeViewId );
		if ( ! tags.includes( tag ) ) {
			tags.push( tag );
		}
	} );

	lines.push( `\t\t\ttags ${ quoted( tags.join( ',' ) ) }` );

	if ( runtimeBindings.length > 0 ) {
		lines.push( '\t\t\tproperties {' );
		runtimeBindings.forEach( ( binding ) => {
			const propertyName = `runtime.${ binding.runtimeViewId }.step.${ binding.step }`;
			lines.push(
				`\t\t\t\t${ quoted( propertyName ) } ${ quoted( binding.interaction ) }`
			);
		} );
		lines.push( '\t\t\t}' );
	}

	lines.push( '\t\t}' );
	return lines;
};

const runtimeElements = ( runtimeView ) => {
	const identifiers = [];

	runtimeView.steps.forEach( ( step ) => {
		[ step.source, step.target ].forEach( ( identifier ) => {
			if ( ! identifiers.includes( identifier ) ) {
				identifiers.push( identifier );
			}
		} );
	} );

	return identifiers;
};

const runtimeStepProperty = ( runtimeView, relationshipIndex ) =>
	runtimeView.steps
		.map( ( step ) => {
			const key = relationshipKey( step.source, step.target );
			const matchingRelationships = relationshipIndex.get( key ) ?? [];

			if ( matchingRelationships.length !== 1 ) {
				throw new Error(
					`Runtime step ${ runtimeView.id }#${ step.step } must resolve to exactly one explicit relationship.`
				);
			}

			return `${ step.step }=${ relationshipIdentifier( matchingRelationships[ 0 ] ) }`;
		} )
		.join( ';' );

const generateResponsibilityView = () => [
	'\t\tcustom "ResponsibilityView" {',
	'\t\t\ttitle "Responsibility View"',
	'\t\t\tinclude *',
	'\t\t\tautoLayout lr',
	'\t\t}',
];

const generateRuntimeView = ( runtimeView, relationshipIndex ) => {
	const elements = runtimeElements( runtimeView );
	const sequence = runtimeStepProperty( runtimeView, relationshipIndex );
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
 * Runtime View は既存 Relationship を参照し、Step 順序を Relationship property と View property に保持する。
 *
 * @param {object} model Markdown から構築した Architecture Model。
 * @return {string} 決定的に生成された Structurizr DSL。
 */
export const generateStructurizrDsl = ( model ) => {
	const runtimeBindings = bindRuntimeSteps( model );
	const relationshipIndex = buildRelationshipIndex( model.relationships );
	const lines = [
		'// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.',
		'workspace "YTR Reorder v1 Architecture" {',
		'\t!impliedRelationships false',
		'',
		'\tmodel {',
	];

	model.externalContexts.forEach( ( externalContext ) => {
		lines.push(
			...generateElement( externalContext, externalContext.type, 'External Context' )
		);
	} );

	if ( model.externalContexts.length > 0 && model.responsibilities.length > 0 ) {
		lines.push( '' );
	}

	model.responsibilities.forEach( ( responsibility ) => {
		lines.push( ...generateElement( responsibility, 'Responsibility', 'Responsibility' ) );
	} );

	if ( model.relationships.length > 0 ) {
		lines.push( '' );
	}

	model.relationships.forEach( ( relationship, index ) => {
		lines.push( ...generateRelationship( relationship, index, runtimeBindings[ index ] ) );
	} );

	lines.push( '\t}', '', '\tviews {', ...generateResponsibilityView() );

	model.runtimeViews.forEach( ( runtimeView ) => {
		lines.push( '', ...generateRuntimeView( runtimeView, relationshipIndex ) );
	} );

	lines.push( '\t}', '}', '' );
	return lines.join( '\n' );
};
