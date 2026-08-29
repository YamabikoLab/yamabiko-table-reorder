/**
 * DnD Interactionの共通operation boundaryと方向別の型対応を確認する単体テスト。
 *
 * 方向非依存の開始位置からReorder Modeに応じた方向固有Requestを生成し、同じDnD中の制約保持、
 * 完了、内部エラーからの共通abort、外部環境変化によるabortを確認する。
 * Request / Result / Destinationの行・列対応は型契約で保証するため、方向不一致の実行時検証は行わない。
 */
import { createDndInteraction } from './dnd-interaction';
import type { DndInteractionDependencies } from './dnd-interaction';
import type { DndStartRequest } from './dnd-start-request';
import type { DropTargetResolutionRequest } from './drop-target-resolution';
import type { ReorderConstraints } from './reorder-target-resolution-rules';

/** Input Interactionから渡される方向非依存のTable上の開始位置。 */
const startRequest: DndStartRequest = {
	clientId: 'table-client-id',
	position: { section: 'body', rowIndex: 0, columnIndex: 0 },
};

/**
 * 単体テストで差し替えるReorder責務の既定値を作成する。
 *
 * @return 行並び替えモードと移動可能な行0を既定値とする依存関係。
 */
const createDependencies = (): DndInteractionDependencies => ( {
	reorderMode: { getReorderKind: jest.fn( () => 'row' ) },
	reorderTargetResolution: {
		resolve: jest.fn( () => ( {
			status: 'movable',
			target: { kind: 'row', clientId: 'table-client-id', rowIndex: 0 },
			constraints: { blockedBoundaries: [] },
		} ) ),
	},
	dropTargetResolution: { resolve: jest.fn( () => ( { status: 'none' } ) ) },
	logError: jest.fn(),
} );

describe( 'DnD Interaction', () => {
	it( 'when Reorder Mode is row, should resolve the start target as a row request', () => {
		const dependencies = createDependencies();
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		expect( dependencies.reorderTargetResolution.resolve ).toHaveBeenCalledWith( {
			kind: 'row',
			clientId: 'table-client-id',
			section: 'body',
			rowIndex: 0,
		} );
	} );

	it( 'when Reorder Mode is column, should resolve the start target as a column request', () => {
		const dependencies = createDependencies();
		dependencies.reorderMode.getReorderKind = jest.fn( () => 'column' );
		dependencies.reorderTargetResolution.resolve = jest.fn( () => ( {
			status: 'immovable',
			reason: 'target-out-of-scope',
		} ) );
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		expect( dependencies.reorderTargetResolution.resolve ).toHaveBeenCalledWith( {
			kind: 'column',
			clientId: 'table-client-id',
			columnIndex: 0,
		} );
	} );

	it( 'when destination resolution runs repeatedly, should reuse the same constraints within the Session', () => {
		const dependencies = createDependencies();
		const constraints: ReorderConstraints = { blockedBoundaries: [ 2 ] };
		dependencies.reorderTargetResolution.resolve = jest.fn( () => ( {
			status: 'movable',
			target: { kind: 'row', clientId: 'table-client-id', rowIndex: 0 },
			constraints,
		} ) );
		const requests: DropTargetResolutionRequest[] = [];
		dependencies.dropTargetResolution.resolve = jest.fn( ( request ) => {
			requests.push( request );
			return { status: 'none' };
		} );
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		interaction.progress( { boundaryIndex: 1 } );
		interaction.progress( { boundaryIndex: 3 } );
		expect( dependencies.reorderTargetResolution.resolve ).toHaveBeenCalledTimes( 1 );
		expect( requests ).toHaveLength( 2 );
		expect( requests[ 0 ].constraints ).toBe( constraints );
		expect( requests[ 1 ].constraints ).toBe( constraints );
	} );

	it( 'when row DnD completes with a valid destination, should commit the row reorder', () => {
		const dependencies = createDependencies();
		dependencies.dropTargetResolution.resolve = jest.fn( () => ( {
			status: 'valid',
			destination: { kind: 'row', clientId: 'table-client-id', boundaryIndex: 2 },
		} ) );
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		interaction.progress( { boundaryIndex: 2 } );
		expect( interaction.complete() ).toEqual( {
			status: 'committed',
			reorder: {
				kind: 'row',
				target: { kind: 'row', clientId: 'table-client-id', rowIndex: 0 },
				destination: { kind: 'row', clientId: 'table-client-id', boundaryIndex: 2 },
			},
		} );
		expect( interaction.getSession() ).toBeNull();
	} );

	it( 'when an internal progress error reaches the operation boundary, should log once and abort', () => {
		const dependencies = createDependencies();
		const error = new Error( 'drop target invariant' );
		dependencies.dropTargetResolution.resolve = jest.fn( () => {
			throw error;
		} );
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		expect( interaction.progress( { boundaryIndex: 1 } ) ).toEqual( { status: 'aborted' } );
		expect( dependencies.logError ).toHaveBeenCalledTimes( 1 );
		expect( dependencies.logError ).toHaveBeenCalledWith( 'progress', error );
		expect( interaction.getSession() ).toBeNull();
	} );

	it( 'when an external environment change aborts DnD, should clear the Session without logging', () => {
		const dependencies = createDependencies();
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		interaction.abort();
		expect( interaction.getSession() ).toBeNull();
		expect( dependencies.logError ).not.toHaveBeenCalled();
	} );
} );
