/**
 * DnD InteractionのReorder operation boundaryとReorder Sessionのライフサイクルを確認する単体テスト。
 *
 * DnD開始、複数回の移動先判定、確定、キャンセル、`abort()`を通じて、1回のDnD中だけ
 * 同じ並び替え制約が保持され、内部エラーがoperation boundaryから共通`abort()`へ合流することを検証する。
 * あわせて、開始対象には並び替え方向を持たせず、Reorder Modeが方向の唯一の情報源になることを確認する。
 */
import { createDndInteraction } from './dnd-interaction';
import type { DndInteractionDependencies, DndStartRequest } from './dnd-interaction';
import type { DropTargetResolutionRequest } from './drop-target-resolution';
import type { ReorderConstraints } from './reorder-target-resolution';

/** Input Interactionから渡されるTable上の方向非依存な開始位置。 */
const startRequest: DndStartRequest = {
	clientId: 'table-client-id',
	position: {
		section: 'body',
		rowIndex: 0,
		columnIndex: 0,
	},
};

/**
 * 単体テストで差し替えるReorder責務の既定値を作成する。
 *
 * @return 行並び替えモードと移動可能な行0を既定値とする依存関係。
 */
const createDependencies = (): DndInteractionDependencies => ( {
	reorderMode: {
		getReorderKind: jest.fn( () => 'row' ),
	},
	reorderTargetResolution: {
		resolve: jest.fn( () => ( {
			status: 'movable',
			target: {
				kind: 'row',
				clientId: 'table-client-id',
				rowIndex: 0,
			},
			constraints: { blockedBoundaries: [] },
		} ) ),
	},
	dropTargetResolution: {
		resolve: jest.fn( () => ( { status: 'none' } ) ),
	},
	logError: jest.fn(),
} );

describe( 'DnD Interaction', () => {
	/**
	 * 行並び替えモードでは、共通の開始位置を行固有の要求へ変換してReorder Target Resolutionへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは行並び替えである。
	 * - Input Interactionの開始対象には並び替え方向が含まれない。
	 *
	 * 操作:
	 * - `start()`を実行する。
	 *
	 * 期待結果:
	 * - Reorder Target Resolutionには`kind: 'row'`と行判定に必要な開始位置だけが渡される。
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
	 * 列並び替えモードでは、共通の開始位置を列固有の要求へ変換してReorder Target Resolutionへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは列並び替えである。
	 * - Input Interactionの開始対象には並び替え方向が含まれない。
	 *
	 * 操作:
	 * - `start()`を実行する。
	 *
	 * 期待結果:
	 * - Reorder Target Resolutionには`kind: 'column'`と列判定に必要な開始位置だけが渡される。
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
	 * 移動可能な対象からReorder Sessionを開始できることを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは行並び替えである。
	 * - Reorder Target Resolutionは行0と並び替え制約を返す。
	 *
	 * 操作:
	 * - 行0を含む開始対象に対して`start()`を実行する。
	 *
	 * 期待結果:
	 * - 行0と並び替え制約を保持し、移動先が未確定のReorder Sessionが有効になる。
	 */
	it( 'when a movable target is resolved, should start one active Reorder Session', () => {
		const dependencies = createDependencies();
		const interaction = createDndInteraction( dependencies );

		const result = interaction.start( startRequest );

		expect( result ).toEqual( {
			status: 'started',
			session: {
				kind: 'row',
				target: {
					kind: 'row',
					clientId: 'table-client-id',
					rowIndex: 0,
				},
				constraints: { blockedBoundaries: [] },
				destination: null,
			},
		} );
		expect( interaction.getSession() ).toEqual(
			expect.objectContaining( { kind: 'row', destination: null } )
		);
	} );

	/**
	 * 同じDnD中の複数回の移動先判定で開始時の並び替え制約を再利用することを確認する。
	 *
	 * 事前条件:
	 * - 1回のDnD開始時にReorder Target Resolutionが1つのReorder Constraintsを返す。
	 * - Drop Target Resolutionは進行のたびに判定入力を受け取る。
	 *
	 * 操作:
	 * - `start()`後に異なる現在位置で`progress()`を2回実行する。
	 *
	 * 期待結果:
	 * - Reorder Target Resolutionは開始時の1回だけ実行される。
	 * - 2回のDrop Target Resolutionへ同一のReorder Constraintsが渡される。
	 */
	it( 'when destination resolution runs repeatedly, should reuse the same constraints within the Session', () => {
		const dependencies = createDependencies();
		const constraints: ReorderConstraints = { blockedBoundaries: [ 2 ] };
		dependencies.reorderTargetResolution.resolve = jest.fn( () => ( {
			status: 'movable',
			target: {
				kind: 'row',
				clientId: 'table-client-id',
				rowIndex: 0,
			},
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
	 * 有効な移動先でDnDを完了した場合だけCommitted Reorderを生成することを確認する。
	 *
	 * 事前条件:
	 * - 行0のReorder Sessionが有効である。
	 * - Drop Target Resolutionは境界2を有効な移動先として返す。
	 *
	 * 操作:
	 * - `progress()`で移動先を更新してから`complete()`を実行する。
	 *
	 * 期待結果:
	 * - 行0と境界2を持つCommitted Reorderが返される。
	 * - 完了後はReorder Sessionが有効ではない。
	 */
	it( 'when DnD completes with a valid destination, should return a Committed Reorder and clear the Session', () => {
		const dependencies = createDependencies();
		dependencies.dropTargetResolution.resolve = jest.fn( () => ( {
			status: 'valid',
			destination: {
				kind: 'row',
				clientId: 'table-client-id',
				boundaryIndex: 2,
			},
		} ) );
		const interaction = createDndInteraction( dependencies );

		interaction.start( startRequest );
		interaction.progress( { boundaryIndex: 2 } );

		expect( interaction.complete() ).toEqual( {
			status: 'committed',
			reorder: {
				kind: 'row',
				target: {
					kind: 'row',
					clientId: 'table-client-id',
					rowIndex: 0,
				},
				destination: {
					kind: 'row',
					clientId: 'table-client-id',
					boundaryIndex: 2,
				},
			},
		} );
		expect( interaction.getSession() ).toBeNull();
	} );

	/**
	 * 有効な移動先がない完了ではTable更新へ渡す結果を生成しないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Sessionは有効だが有効な移動先を持たない。
	 *
	 * 操作:
	 * - `complete()`を実行する。
	 *
	 * 期待結果:
	 * - `completed-without-commit`が返され、Reorder Sessionが終了する。
	 */
	it( 'when DnD completes without a valid destination, should finish without a Committed Reorder', () => {
		const interaction = createDndInteraction( createDependencies() );
		interaction.start( startRequest );

		expect( interaction.complete() ).toEqual( { status: 'completed-without-commit' } );
		expect( interaction.getSession() ).toBeNull();
	} );

	/**
	 * 利用者によるキャンセルではCommitted Reorderを生成せずReorder Sessionだけを終了することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Sessionが有効である。
	 *
	 * 操作:
	 * - `cancel()`を実行する。
	 *
	 * 期待結果:
	 * - `cancelled`が返され、Reorder Sessionが有効ではなくなる。
	 */
	it( 'when an active DnD is cancelled, should clear the Session without committing', () => {
		const interaction = createDndInteraction( createDependencies() );
		interaction.start( startRequest );

		expect( interaction.cancel() ).toEqual( { status: 'cancelled' } );
		expect( interaction.getSession() ).toBeNull();
	} );

	/**
	 * Drop Target Resolutionの内部エラーがoperation boundaryから共通`abort()`へ合流することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Sessionが有効である。
	 * - Drop Target Resolutionが内部エラーを送出する。
	 *
	 * 操作:
	 * - `progress()`を実行する。
	 *
	 * 期待結果:
	 * - `progress`失敗として元のエラーが1回だけ記録される。
	 * - `aborted`が返され、Reorder Sessionが破棄される。
	 */
	it( 'when an internal progress error reaches the operation boundary, should log once and abort the Session', () => {
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
	 * 外部環境変化による共通`abort()`を内部エラーとして記録しないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Sessionが有効である。
	 *
	 * 操作:
	 * - 外部の継続不能を表す`abort()`を実行する。
	 *
	 * 期待結果:
	 * - Reorder Sessionが破棄される。
	 * - 内部エラーログは追加されない。
	 */
	it( 'when an external environment change aborts DnD, should clear the Session without logging an internal error', () => {
		const dependencies = createDependencies();
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );

		interaction.abort();

		expect( interaction.getSession() ).toBeNull();
		expect( dependencies.logError ).not.toHaveBeenCalled();
	} );
} );
