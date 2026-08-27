import type { ArchitectureModel } from './architecture-model';

const stableIdPattern = /^[A-Za-z][A-Za-z0-9_]*$/u;

const requireValue = ( value: string, item: string ): void => {
	if ( value.trim().length === 0 ) {
		throw new Error( `Architecture validation failed: ${ item } is required.` );
	}
};

const validateStableId = ( id: string, prefix: string, item: string ): void => {
	requireValue( id, `${ item } ID` );

	if ( ! stableIdPattern.test( id ) ) {
		throw new Error(
			`Architecture validation failed: ${ item } ID "${ id }" must start with an ASCII letter and contain only ASCII letters, digits, and _.`
		);
	}

	if ( ! id.startsWith( prefix ) ) {
		throw new Error(
			`Architecture validation failed: ${ item } ID "${ id }" must use the ${ prefix} prefix.`
		);
	}
};

const validateUniqueIds = ( model: ArchitectureModel ): void => {
	const seen = new Set< string >();
	const ids = [
		...model.externalContexts.map( ( item ) => item.id ),
		...model.responsibilities.map( ( item ) => item.id ),
		...model.runtimeViews.map( ( item ) => item.id ),
	];

	ids.forEach( ( id ) => {
		if ( seen.has( id ) ) {
			throw new Error( `Architecture validation failed: duplicate ID "${ id }".` );
		}
		seen.add( id );
	} );
};

const validateRequiredRows = ( model: ArchitectureModel ): void => {
	if ( model.externalContexts.length === 0 ) {
		throw new Error( 'Architecture validation failed: External Context requires at least one row.' );
	}
	if ( model.responsibilities.length === 0 ) {
		throw new Error(
			'Architecture validation failed: Responsibility Inventory requires at least one row.'
		);
	}
	if ( model.relationships.length === 0 ) {
		throw new Error( 'Architecture validation failed: Relationships requires at least one row.' );
	}
	if ( model.responsibilityDetails.length === 0 ) {
		throw new Error(
			'Architecture validation failed: Responsibility Details requires at least one responsibility.'
		);
	}
	if ( model.runtimeViews.length === 0 ) {
		throw new Error( 'Architecture validation failed: Runtime View requires at least one scenario.' );
	}
};

const validateElements = ( model: ArchitectureModel ): Set< string > => {
	model.externalContexts.forEach( ( item ) => {
		validateStableId( item.id, 'EXT_', 'External Context' );
		requireValue( item.name, `External Context ${ item.id } Name` );
		requireValue( item.type, `External Context ${ item.id } Type` );
		requireValue( item.summary, `External Context ${ item.id } Summary` );
	} );

	model.responsibilities.forEach( ( item ) => {
		validateStableId( item.id, 'RESP_', 'Responsibility' );
		requireValue( item.name, `Responsibility ${ item.id } Responsibility` );
		requireValue( item.summary, `Responsibility ${ item.id } Summary` );
	} );

	return new Set( [
		...model.externalContexts.map( ( item ) => item.id ),
		...model.responsibilities.map( ( item ) => item.id ),
	] );
};

const validateResponsibilityDetails = ( model: ArchitectureModel ): void => {
	const inventory = new Map(
		model.responsibilities.map( ( responsibility ) => [ responsibility.id, responsibility.name ] )
	);
	const seenDetails = new Set< string >();

	model.responsibilityDetails.forEach( ( detail ) => {
		if ( detail.id === null ) {
			throw new Error(
				`Architecture validation failed: Responsibility Details heading "${ detail.name }" requires a responsibility ID.`
			);
		}

		validateStableId( detail.id, 'RESP_', 'Responsibility Details' );
		const inventoryName = inventory.get( detail.id );
		if ( inventoryName === undefined ) {
			throw new Error(
				`Architecture validation failed: Responsibility Details ID "${ detail.id }" is not defined in Responsibility Inventory.`
			);
		}
		if ( inventoryName !== detail.name ) {
			throw new Error(
				`Architecture validation failed: Responsibility Details ${ detail.id } name "${ detail.name }" must match Responsibility Inventory name "${ inventoryName }".`
			);
		}
		if ( seenDetails.has( detail.id ) ) {
			throw new Error(
				`Architecture validation failed: Responsibility Details contains duplicate ID "${ detail.id }".`
			);
		}
		seenDetails.add( detail.id );
	} );

	model.responsibilities.forEach( ( responsibility ) => {
		if ( ! seenDetails.has( responsibility.id ) ) {
			throw new Error(
				`Architecture validation failed: Responsibility ${ responsibility.id } requires a matching Responsibility Details heading.`
			);
		}
	} );
};

const validateRelationships = (
	model: ArchitectureModel,
	elementIds: Set< string >
): Map< string, number > => {
	const relationshipCounts = new Map< string, number >();

	model.relationships.forEach( ( relationship, index ) => {
		const item = `Relationship row ${ index + 1 }`;
		requireValue( relationship.source, `${ item } Source` );
		requireValue( relationship.destination, `${ item } Destination` );
		requireValue( relationship.description, `${ item } Description` );

		if ( ! elementIds.has( relationship.source ) ) {
			throw new Error(
				`Architecture validation failed: ${ item } Source "${ relationship.source }" does not reference an External Context or Responsibility ID.`
			);
		}
		if ( ! elementIds.has( relationship.destination ) ) {
			throw new Error(
				`Architecture validation failed: ${ item } Destination "${ relationship.destination }" does not reference an External Context or Responsibility ID.`
			);
		}

		const key = `${ relationship.source }\u0000${ relationship.destination }`;
		relationshipCounts.set( key, ( relationshipCounts.get( key ) ?? 0 ) + 1 );
	} );

	return relationshipCounts;
};

const validateRuntimeViews = (
	model: ArchitectureModel,
	elementIds: Set< string >,
	relationshipCounts: Map< string, number >
): void => {
	model.runtimeViews.forEach( ( runtimeView ) => {
		validateStableId( runtimeView.id, 'RV_', 'Runtime View' );
		requireValue( runtimeView.name, `Runtime View ${ runtimeView.id } name` );

		if ( runtimeView.steps.length === 0 ) {
			throw new Error(
				`Architecture validation failed: Runtime View ${ runtimeView.id } requires at least one Step.`
			);
		}

		runtimeView.steps.forEach( ( step, index ) => {
			const expectedStep = index + 1;
			if ( step.step !== expectedStep ) {
				throw new Error(
					`Architecture validation failed: Runtime View ${ runtimeView.id } Step must start at 1 and increase without gaps; expected ${ expectedStep } but found ${ step.step }.`
				);
			}

			const item = `Runtime View ${ runtimeView.id} Step ${ step.step }`;
			requireValue( step.source, `${ item } Source` );
			requireValue( step.target, `${ item } Target` );
			requireValue( step.interaction, `${ item } Interaction` );

			if ( ! elementIds.has( step.source ) ) {
				throw new Error(
					`Architecture validation failed: ${ item } Source "${ step.source }" does not reference an External Context or Responsibility ID.`
				);
			}
			if ( ! elementIds.has( step.target ) ) {
				throw new Error(
					`Architecture validation failed: ${ item } Target "${ step.target }" does not reference an External Context or Responsibility ID.`
				);
			}

			const relationshipKey = `${ step.source }\u0000${ step.target }`;
			const matches = relationshipCounts.get( relationshipKey ) ?? 0;
			if ( matches !== 1 ) {
				throw new Error(
					`Architecture validation failed: ${ item } must resolve to exactly one explicit Relationship from ${ step.source } to ${ step.target }; found ${ matches }.`
				);
			}
		} );
	} );
};

/**
 * Architecture Model がアーキテクチャ設計書の機械可読規則を満たすことを検証する。
 * ID、一意性、責務詳細との対応、参照整合性、Runtime View の Step 順序を検証し、
 * 不整合がある場合は問題のある ID または項目を示して生成処理を停止させる。
 *
 * @param model Markdown から構築した Architecture Model。
 */
export const validateArchitectureModel = ( model: ArchitectureModel ): void => {
	validateRequiredRows( model );
	validateUniqueIds( model );
	const elementIds = validateElements( model );
	validateResponsibilityDetails( model );
	const relationshipCounts = validateRelationships( model, elementIds );
	validateRuntimeViews( model, elementIds, relationshipCounts );
};
