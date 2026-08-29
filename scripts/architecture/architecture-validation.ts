import type { ArchitectureModel } from './architecture-model';

const stableIdPattern = /^[A-Za-z][A-Za-z0-9_]*$/u;
const processFlowViewKinds = new Set( [ 'normal', 'failure-recovery' ] );
const processFlowEdgeKinds = new Set( [ 'normal', 'failure', 'recovery' ] );

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
			`Architecture validation failed: ${ item } ID "${ id }" must use the ${ prefix } prefix.`
		);
	}
};

const validateUniqueIds = ( model: ArchitectureModel ): void => {
	const seen = new Set< string >();
	const ids = [
		...model.externalContexts.map( ( item ) => item.id ),
		...model.responsibilities.map( ( item ) => item.id ),
		...model.dependencyViews.map( ( item ) => item.id ),
		...model.processFlowViews.map( ( item ) => item.id ),
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
		throw new Error(
			'Architecture validation failed: External Context requires at least one row.'
		);
	}
	if ( model.responsibilities.length === 0 ) {
		throw new Error(
			'Architecture validation failed: Responsibility Inventory requires at least one row.'
		);
	}
	if ( model.dependencies.length === 0 ) {
		throw new Error( 'Architecture validation failed: Dependencies requires at least one row.' );
	}
	if ( model.responsibilityDetails.length === 0 ) {
		throw new Error(
			'Architecture validation failed: Responsibility Details requires at least one responsibility.'
		);
	}
	if ( model.runtimeViews.length === 0 ) {
		throw new Error(
			'Architecture validation failed: Runtime View requires at least one scenario.'
		);
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

const validateDependencies = ( model: ArchitectureModel, elementIds: Set< string > ): void => {
	const seen = new Set< string >();

	model.dependencies.forEach( ( dependency, index ) => {
		const item = `Dependency row ${ index + 1 }`;
		requireValue( dependency.dependent, `${ item } Dependent` );
		requireValue( dependency.dependsOn, `${ item } Depends on` );
		requireValue( dependency.reason, `${ item } Reason` );

		if ( ! elementIds.has( dependency.dependent ) ) {
			throw new Error(
				`Architecture validation failed: ${ item } Dependent "${ dependency.dependent }" does not reference an External Context or Responsibility ID.`
			);
		}
		if ( ! elementIds.has( dependency.dependsOn ) ) {
			throw new Error(
				`Architecture validation failed: ${ item } Depends on "${ dependency.dependsOn }" does not reference an External Context or Responsibility ID.`
			);
		}

		const key = `${ dependency.dependent }\u0000${ dependency.dependsOn }`;
		if ( seen.has( key ) ) {
			throw new Error(
				`Architecture validation failed: duplicate Dependency ${ dependency.dependent } -> ${ dependency.dependsOn }.`
			);
		}
		seen.add( key );
	} );
};

const validateDependencyViews = ( model: ArchitectureModel, elementIds: Set< string > ): void => {
	model.dependencyViews.forEach( ( view ) => {
		validateStableId( view.id, 'DV_', 'Dependency View' );
		requireValue( view.name, `Dependency View ${ view.id } Name` );
		view.includes.forEach( ( id ) => {
			if ( ! elementIds.has( id ) ) {
				throw new Error(
					`Architecture validation failed: Dependency View ${ view.id } Includes "${ id }" does not reference an External Context or Responsibility ID.`
				);
			}
		} );
	} );
};

const validateProcessFlowViews = ( model: ArchitectureModel, elementIds: Set< string > ): void => {
	model.processFlowViews.forEach( ( processFlowView ) => {
		validateStableId( processFlowView.id, 'PV_', 'Process Flow View' );
		requireValue( processFlowView.name, `Process Flow View ${ processFlowView.id } name` );

		if ( ! processFlowViewKinds.has( processFlowView.kind ) ) {
			throw new Error(
				`Architecture validation failed: Process Flow View ${ processFlowView.id} kind "${ processFlowView.kind }" is invalid.`
			);
		}

		if ( processFlowView.edges.length === 0 ) {
			throw new Error(
				`Architecture validation failed: Process Flow View ${ processFlowView.id } requires at least one edge.`
			);
		}

		const seenEdges = new Set< string >();
		processFlowView.edges.forEach( ( edge, index ) => {
			const item = `Process Flow View ${ processFlowView.id } row ${ index + 1 }`;
			requireValue( edge.from, `${ item } From` );
			requireValue( edge.to, `${ item } To` );
			requireValue( edge.kind, `${ item } Kind` );
			requireValue( edge.meaning, `${ item } Meaning` );

			if ( ! processFlowEdgeKinds.has( edge.kind ) ) {
				throw new Error(
					`Architecture validation failed: ${ item } Kind "${ edge.kind }" is invalid.`
				);
			}
			if ( ! elementIds.has( edge.from ) ) {
				throw new Error(
					`Architecture validation failed: ${ item } From "${ edge.from }" does not reference an External Context or Responsibility ID.`
				);
			}
			if ( ! elementIds.has( edge.to ) ) {
				throw new Error(
					`Architecture validation failed: ${ item } To "${ edge.to }" does not reference an External Context or Responsibility ID.`
				);
			}

			const key = `${ edge.from }\u0000${ edge.to }`;
			if ( seenEdges.has( key ) ) {
				throw new Error(
					`Architecture validation failed: Process Flow View ${ processFlowView.id } contains duplicate edge ${ edge.from } -> ${ edge.to }.`
				);
			}
			seenEdges.add( key );
		} );
	} );
};

const validateRuntimeViews = ( model: ArchitectureModel, elementIds: Set< string > ): void => {
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

			const item = `Runtime View ${ runtimeView.id } Step ${ step.step }`;
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
		} );
	} );
};

/**
 * Architecture Model がアーキテクチャ設計書の機械可読規則を満たすことを検証する。
 * ID、一意性、責務詳細との対応、依存・View・Runtime の参照整合性、Runtime View の Step 順序を検証し、
 * 不整合がある場合は問題のある ID または項目を示して生成処理を停止させる。
 *
 * @param model Markdown から構築した Architecture Model。
 */
export const validateArchitectureModel = ( model: ArchitectureModel ): void => {
	validateRequiredRows( model );
	validateUniqueIds( model );
	const elementIds = validateElements( model );
	validateResponsibilityDetails( model );
	validateDependencies( model, elementIds );
	validateDependencyViews( model, elementIds );
	validateProcessFlowViews( model, elementIds );
	validateRuntimeViews( model, elementIds );
};
