/**
 * DnD Interactionの共通operation boundaryと方向別の型対応を確認する単体テスト。
 *
 * 方向非依存の開始位置からReorder Modeに応じた方向固有Requestを生成し、同じDnD中の制約保持、
 * 完了、内部エラーからの共通abort、外部環境変化によるabortを確認する。
 * Request / Result / Destinationの行・列対応は型契約で保証するため、方向不一致の実行時検証は行わない。
 */
import { createDndInteraction } from './dnd-interaction';
import type { DndInteractionDependencies, DndStartRequest } from './dnd-interaction';
import type { DropTargetResolutionRequest } from './drop-target-resolution';
import type { ReorderConstraints } from './reorder-target-resolution';

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
	/**
	 * 行モードでは共通開始位置から行固有Requestだけを生成することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは行並び替えである。
	 *
	 * 操作:
	 * - `start()`を実行する。
	 *
	 * 期待結果:
	 * - `section` / `rowIndex`を持つ行Requestだけが対象解決へ渡される。
	 */
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

	/**
	 * 列モードでは共通開始位置から列固有Requestだけを生成することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは列並び替えである。
	 *
	 * 操作:
	 * - `start()`を実行する。
	 *
	 * 期待結果:
	 * - `columnIndex`を持つ列Requestだけが対象解決へ渡される。
	 */
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

	/**
	 * 同じDnD中の複数回の移動先判定で開始時の並び替え制約を再利用することを確認する。
	 *
	 * 事前条件:
	 * - DnD開始時に1つのReorder Constraintsが成立する。
	 *
	 * 操作:
	 * - `start()`後に`progress()`を2回実行する。
	 *
	 * 期待結果:
	 * - 対象解決は開始時の1回だけで、2回の移動先判定へ同一の制約が渡される。
	 */
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

	/**
	 * 有効な行DestinationでDnDを完了した場合に同じ方向のCommitted Reorderを生成することを確認する。
	 *
	 * 事前条件:
	 * - 行0のReorder Sessionが有効である。
	 * - 境界2が有効な行Destinationとして判定される。
	 *
	 * 操作:
	 * - `progress()`後に`complete()`を実行する。
	 *
	 * 期待結果:
	 * - 行Targetと行Destinationを持つCommitted Reorderが返り、Sessionが終了する。
	 */
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

	/**
	 * 内部エラーがoperation boundaryで1回だけ記録され共通abortへ合流することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Sessionが有効で、Drop Target ResolutionがErrorを送出する。
	 *
	 * 操作:
	 * - `progress()`を実行する。
	 *
	 * 期待結果:
	 * - `progress`失敗が1回記録され、Sessionが破棄される。
	 */
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

	/**
	 * 外部環境変化によるabortを内部エラーとして記録しないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Sessionが有効である。
	 *
	 * 操作:
	 * - `abort()`を実行する。
	 *
	 * 期待結果:
	 * - Sessionだけが破棄され、内部エラーログは追加されない。
	 */
	it( 'when an external environment change aborts DnD, should clear the Session without logging', () => {
		const dependencies = createDependencies();
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );

		interaction.abort();

		expect( interaction.getSession() ).toBeNull();
		expect( dependencies.logError ).not.toHaveBeenCalled();
	} );
} );
