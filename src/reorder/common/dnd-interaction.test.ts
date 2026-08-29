/**
 * DnD Interactionの共通operation boundaryと方向別の型対応を確認する単体テスト。
 *
 * 方向非依存の開始位置からReorder Modeに応じた方向固有Requestを生成し、同じDnD中の制約保持、
 * 完了、内部エラーからの共通abort、外部環境変化によるabortを確認する。
 * Request / Result / Destinationの行・列対応は型契約で保証するため、方向不一致の実行時検証は行わない。
 */
import type {
	ColumnDropTargetResolutionRequest,
	ColumnDropTargetResolutionResult,
} from '@/reorder/column-reorder/drop-target-resolution';
import type {
	ColumnReorderTargetResolutionRequest,
	ColumnReorderTargetResolutionResult,
} from '@/reorder/column-reorder/reorder-target-resolution';
import type {
	RowDropTargetResolutionRequest,
	RowDropTargetResolutionResult,
} from '@/reorder/row-reorder/drop-target-resolution';
import type {
	RowReorderTargetResolutionRequest,
	RowReorderTargetResolutionResult,
} from '@/reorder/row-reorder/reorder-target-resolution';
import { createDndInteraction } from './dnd-interaction';
import type { DndInteractionDependencies } from './dnd-interaction';
import type { DndStartRequest } from './dnd-start-request';
import type {
	DropTargetResolutionRequest,
	DropTargetResolutionResult,
} from './drop-target-resolution';
import type {
	ReorderTargetResolutionRequest,
	ReorderTargetResolutionResult,
} from './reorder-target-resolution';
import type { ReorderConstraints } from './reorder-target-resolution-rules';

/** Input Interactionから渡される方向非依存のTable上の開始位置。 */
const startRequest: DndStartRequest = {
	clientId: 'table-client-id',
	position: { section: 'body', rowIndex: 0, columnIndex: 0 },
};

type DependencyOptions = {
	reorderKind?: 'row' | 'column' | null;
	constraints?: ReorderConstraints;
	targetStatus?: 'movable' | 'immovable';
	dropBoundaryIndex?: number;
	dropError?: Error;
};

/**
 * 行・列のoverload contractを維持したテスト用Reorder責務を作成する。
 *
 * @param options 各テストで変更する並び替え方向、制約、判定結果。
 * @return DnD Interactionの依存関係と呼び出し確認用mock。
 */
const createDependencies = ( options: DependencyOptions = {} ) => {
	const constraints = options.constraints ?? { blockedBoundaries: [] };
	const reorderKind = options.reorderKind === undefined ? 'row' : options.reorderKind;
	const targetRequestMock = jest.fn();
	const dropRequestMock = jest.fn();

	function resolveTarget(
		request: RowReorderTargetResolutionRequest
	): RowReorderTargetResolutionResult;
	function resolveTarget(
		request: ColumnReorderTargetResolutionRequest
	): ColumnReorderTargetResolutionResult;
	function resolveTarget(
		request: ReorderTargetResolutionRequest
	): ReorderTargetResolutionResult {
		targetRequestMock( request );

		if ( options.targetStatus === 'immovable' ) {
			return { status: 'immovable', reason: 'target-out-of-scope' };
		}

		if ( request.kind === 'row' ) {
			return {
				status: 'movable',
				target: { kind: 'row', clientId: request.clientId, rowIndex: request.rowIndex },
				constraints,
			};
		}

		return {
			status: 'movable',
			target: { kind: 'column', clientId: request.clientId, columnIndex: request.columnIndex },
			constraints,
		};
	}

	function resolveDrop(
		request: RowDropTargetResolutionRequest
	): RowDropTargetResolutionResult;
	function resolveDrop(
		request: ColumnDropTargetResolutionRequest
	): ColumnDropTargetResolutionResult;
	function resolveDrop( request: DropTargetResolutionRequest ): DropTargetResolutionResult {
		dropRequestMock( request );

		if ( options.dropError !== undefined ) {
			throw options.dropError;
		}

		if ( options.dropBoundaryIndex === undefined ) {
			return { status: 'none' };
		}

		if ( request.kind === 'row' ) {
			return {
				status: 'valid',
				destination: {
					kind: 'row',
					clientId: request.target.clientId,
					boundaryIndex: options.dropBoundaryIndex,
				},
			};
		}

		return {
			status: 'valid',
			destination: {
				kind: 'column',
				clientId: request.target.clientId,
				boundaryIndex: options.dropBoundaryIndex,
			},
		};
	}

	const dependencies: DndInteractionDependencies = {
		reorderMode: { getReorderKind: jest.fn( () => reorderKind ) },
		reorderTargetResolution: { resolve: resolveTarget },
		dropTargetResolution: { resolve: resolveDrop },
		logError: jest.fn(),
	};

	return { dependencies, targetRequestMock, dropRequestMock };
};

describe( 'DnD Interaction', () => {
	/**
	 * 行並び替えモードでは方向非依存の開始位置から行固有Requestだけを生成することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは行並び替えである。
	 * - Input Interactionからの開始対象には並び替え方向が含まれない。
	 *
	 * 操作:
	 * - `start()`を実行する。
	 *
	 * 期待結果:
	 * - Reorder Target Resolutionへ`section`と`rowIndex`を持つ行Requestだけが渡される。
	 */
	it( 'when Reorder Mode is row, should resolve the start target as a row request', () => {
		const { dependencies, targetRequestMock } = createDependencies();
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		expect( targetRequestMock ).toHaveBeenCalledWith( {
			kind: 'row',
			clientId: 'table-client-id',
			section: 'body',
			rowIndex: 0,
		} );
	} );

	/**
	 * 列並び替えモードでは方向非依存の開始位置から列固有Requestだけを生成することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Modeは列並び替えである。
	 * - Input Interactionからの開始対象には並び替え方向が含まれない。
	 *
	 * 操作:
	 * - `start()`を実行する。
	 *
	 * 期待結果:
	 * - Reorder Target Resolutionへ`columnIndex`を持つ列Requestだけが渡される。
	 */
	it( 'when Reorder Mode is column, should resolve the start target as a column request', () => {
		const { dependencies, targetRequestMock } = createDependencies( {
			reorderKind: 'column',
			targetStatus: 'immovable',
		} );
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		expect( targetRequestMock ).toHaveBeenCalledWith( {
			kind: 'column',
			clientId: 'table-client-id',
			columnIndex: 0,
		} );
	} );

	/**
	 * 1回のDnD中では開始時に導出した同一のReorder Constraintsを移動先判定へ再利用することを確認する。
	 *
	 * 事前条件:
	 * - DnD開始時に1つのReorder Constraintsが成立する。
	 * - Drop Target Resolutionは進行ごとに判定入力を受け取る。
	 *
	 * 操作:
	 * - `start()`後に異なる現在位置で`progress()`を2回実行する。
	 *
	 * 期待結果:
	 * - Reorder Target Resolutionは開始時の1回だけ実行される。
	 * - 2回のDrop Target Resolutionへ同一参照のReorder Constraintsが渡される。
	 */
	it( 'when destination resolution runs repeatedly, should reuse the same constraints within the Session', () => {
		const constraints: ReorderConstraints = { blockedBoundaries: [ 2 ] };
		const { dependencies, targetRequestMock, dropRequestMock } = createDependencies( {
			constraints,
		} );
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		interaction.progress( { boundaryIndex: 1 } );
		interaction.progress( { boundaryIndex: 3 } );
		expect( targetRequestMock ).toHaveBeenCalledTimes( 1 );
		expect( dropRequestMock ).toHaveBeenCalledTimes( 2 );
		expect( dropRequestMock.mock.calls[ 0 ][ 0 ].constraints ).toBe( constraints );
		expect( dropRequestMock.mock.calls[ 1 ][ 0 ].constraints ).toBe( constraints );
	} );

	/**
	 * 有効な行DestinationでDnDを完了した場合に同じ方向のCommitted Reorderを生成することを確認する。
	 *
	 * 事前条件:
	 * - 行0のReorder Sessionが有効である。
	 * - 境界2が同じTableの有効な行Destinationとして判定される。
	 *
	 * 操作:
	 * - `progress()`で移動先を更新してから`complete()`を実行する。
	 *
	 * 期待結果:
	 * - 行Targetと行Destinationを持つCommitted Reorderが返される。
	 * - 完了後はReorder Sessionが有効ではない。
	 */
	it( 'when row DnD completes with a valid destination, should commit the row reorder', () => {
		const { dependencies } = createDependencies( { dropBoundaryIndex: 2 } );
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
	 * Drop Target Resolutionの内部エラーがoperation boundaryで1回だけ記録され、共通abortへ合流することを確認する。
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
	it( 'when an internal progress error reaches the operation boundary, should log once and abort', () => {
		const error = new Error( 'drop target invariant' );
		const { dependencies } = createDependencies( { dropError: error } );
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		expect( interaction.progress( { boundaryIndex: 1 } ) ).toEqual( { status: 'aborted' } );
		expect( dependencies.logError ).toHaveBeenCalledTimes( 1 );
		expect( dependencies.logError ).toHaveBeenCalledWith( 'progress', error );
		expect( interaction.getSession() ).toBeNull();
	} );

	/**
	 * 外部環境変化による共通abortを内部エラーとして記録しないことを確認する。
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
	it( 'when an external environment change aborts DnD, should clear the Session without logging', () => {
		const { dependencies } = createDependencies();
		const interaction = createDndInteraction( dependencies );
		interaction.start( startRequest );
		interaction.abort();
		expect( interaction.getSession() ).toBeNull();
		expect( dependencies.logError ).not.toHaveBeenCalled();
	} );
} );
