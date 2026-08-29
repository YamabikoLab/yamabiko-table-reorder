/**
 * 入力方式と行・列に共通するDnD InteractionとReorder operation boundaryを提供する。
 *
 * DnDの開始可否、進行、完了、キャンセル、安全終了を統括し、1回のDnDで有効なReorder Sessionを
 * 1つだけ所有する。内部責務から伝播した失敗はoperation boundaryで1回だけ記録して安全終了へ合流させ、
 * 外部環境変化による継続不能は内部エラーとして扱わず同じ終了経路へ合流させる。
 */
import type {
	DropTargetPosition,
	DropTargetResolution,
	ReorderDestination,
} from '@/reorder/drop-target-resolution';
import type { ReorderMode } from '@/reorder/reorder-mode';
import type {
	ReorderTargetResolution,
	ReorderTargetResolutionFailureReason,
	ReorderTargetResolutionRequest,
} from '@/reorder/reorder-target-resolution';
import {
	cancelReorderSession,
	completeReorderSession,
	startReorderSession,
	updateReorderDestination,
} from '@/reorder/reorder-session';
import type {
	CommittedReorder,
	ReorderSession,
	ReorderSessionState,
} from '@/reorder/reorder-session';

/** Reorder operation boundaryで識別するDnD操作。 */
export type DndOperation = 'start' | 'progress' | 'complete' | 'cancel';

/**
 * Reorder operation boundaryが内部エラーを1回だけ記録するための契約。
 *
 * @param operation 失敗したDnD操作。
 * @param error     operation boundaryまで伝播した元のエラー情報。
 */
export type DndErrorLogger = ( operation: DndOperation, error: unknown ) => void;

/** DnD開始試行の結果。 */
export type DndStartResult =
	| {
			status: 'started';
			session: ReorderSession;
	  }
	| {
			status: 'not-started';
			reason: ReorderTargetResolutionFailureReason | 'reorder-mode-inactive';
	  }
	| {
			status: 'aborted';
	  };

/** DnD進行処理の結果。 */
export type DndProgressResult =
	| {
			status: 'progressed';
			destination: ReorderDestination | null;
	  }
	| {
			status: 'aborted';
	  };

/** DnD完了処理の結果。 */
export type DndCompleteResult =
	| {
			status: 'committed';
			reorder: CommittedReorder;
	  }
	| {
			status: 'completed-without-commit';
	  }
	| {
			status: 'aborted';
	  };

/** DnDキャンセル処理の結果。 */
export type DndCancelResult =
	| {
			status: 'cancelled';
	  }
	| {
			status: 'aborted';
	  };

/**
 * DnD Interactionが依存する既存のReorder責務とoperation boundaryのエラー記録先。
 */
export type DndInteractionDependencies = {
	reorderMode: Pick< ReorderMode, 'getReorderKind' >;
	reorderTargetResolution: ReorderTargetResolution;
	dropTargetResolution: DropTargetResolution;
	logError: DndErrorLogger;
};

/**
 * 入力方式と行・列に共通するDnDの開始から終了までを統括する契約。
 */
export type DndInteraction = {
	/** 現在有効なReorder Sessionを取得する。 */
	getSession: () => ReorderSessionState;
	/**
	 * DnD開始を試行する。
	 *
	 * @param request Input Interactionが指定した並び替え対象の候補。
	 */
	start: ( request: ReorderTargetResolutionRequest ) => DndStartResult;
	/**
	 * 有効なDnDの現在位置に対して移動先を更新する。
	 *
	 * @param currentPosition Input Interactionが示す現在のドロップ候補位置。
	 */
	progress: ( currentPosition: DropTargetPosition ) => DndProgressResult;
	/** 有効なDnDを完了し、確定可能な場合だけCommitted Reorderを返す。 */
	complete: () => DndCompleteResult;
	/** 有効なDnDを利用者操作としてキャンセルする。 */
	cancel: () => DndCancelResult;
	/** 外部環境変化などから現在のDnDを共通`abort()`で安全終了する。 */
	abort: () => void;
};

/**
 * Reorder operation boundaryとReorder Sessionを所有するDnD Interactionを作成する。
 *
 * 内部責務から伝播したエラーは各operation boundaryで記録した後に共通`abort()`へ合流する。
 * 外部環境変化など、内部エラーではない処理不能は`abort()`から同じ終了経路へ合流できる。
 *
 * @param dependencies DnD Interactionが利用するReorder責務とエラー記録先。
 * @return 1つの有効なReorder Sessionだけを所有するDnD Interaction。
 */
export const createDndInteraction = (
	dependencies: DndInteractionDependencies
): DndInteraction => {
	let session: ReorderSessionState = null;

	/** Reorder SessionとDnDに属する状態を終了して待機状態へ戻す共通`abort()`。 */
	const abort = (): void => {
		session = null;
	};

	/**
	 * operation boundaryまで伝播した内部エラーを記録し、共通`abort()`へ合流する。
	 *
	 * @param operation 失敗したDnD操作。
	 * @param error     operation boundaryまで伝播した元のエラー情報。
	 */
	const handleOperationFailure = ( operation: DndOperation, error: unknown ): void => {
		dependencies.logError( operation, error );
		abort();
	};

	return {
		getSession: () => session,

		start: ( request ) => {
			try {
				// 1回のDnDで複数のReorder Sessionを並行して所有しないため、開始済みの場合は内部不変条件違反とする。
				if ( session !== null ) {
					throw new Error(
						'DnD Interaction invariant violated: only one Reorder Session may be active.'
					);
				}

				const reorderKind = dependencies.reorderMode.getReorderKind();

				// 通常編集モードではDnDを開始できないため、Reorder Sessionを作らず開始試行を終了する。
				if ( reorderKind === null ) {
					return { status: 'not-started', reason: 'reorder-mode-inactive' };
				}

				// Input Interactionから渡された並び替え種別と現在のReorder Modeが異なる状態は内部契約違反とする。
				if ( reorderKind !== request.kind ) {
					throw new Error(
						'DnD Interaction invariant violated: Reorder Mode must match the start request kind.'
					);
				}

				const resolution = dependencies.reorderTargetResolution.resolve( request );

				// 並び替え対象として成立しない要素ではDnDを開始せず、Reorder Sessionを作成しない。
				if ( resolution.status === 'immovable' ) {
					return { status: 'not-started', reason: resolution.reason };
				}

				session = startReorderSession( resolution.target, resolution.constraints );
				return { status: 'started', session };
			} catch ( error ) {
				handleOperationFailure( 'start', error );
				return { status: 'aborted' };
			}
		},

		progress: ( currentPosition ) => {
			try {
				// DnD進行は開始済みのReorder Sessionに対してのみ有効であり、開始前または終了後の呼び出しは内部不変条件違反とする。
				if ( session === null ) {
					throw new Error(
						'DnD Interaction invariant violated: progress requires an active Reorder Session.'
					);
				}

				const resolution = resolveDestination(
					dependencies.dropTargetResolution,
					session,
					currentPosition
				);
				// 有効と判定された移動先だけをReorder Sessionへ保持し、それ以外は現在の有効な移動先がない状態とする。
				const destination = resolution.status === 'valid' ? resolution.destination : null;
				session = updateReorderDestination( session, destination );

				return { status: 'progressed', destination };
			} catch ( error ) {
				handleOperationFailure( 'progress', error );
				return { status: 'aborted' };
			}
		},

		complete: () => {
			try {
				// DnD完了は開始済みのReorder Sessionに対してのみ有効であり、開始前または終了後の呼び出しは内部不変条件違反とする。
				if ( session === null ) {
					throw new Error(
						'DnD Interaction invariant violated: complete requires an active Reorder Session.'
					);
				}

				const committedReorder = completeReorderSession( session );
				session = null;

				// 有効な移動先がないDnDはData Updateへ渡す結果を生成せず、正常完了としてReorder Sessionだけを終了する。
				if ( committedReorder === null ) {
					return { status: 'completed-without-commit' };
				}

				return { status: 'committed', reorder: committedReorder };
			} catch ( error ) {
				handleOperationFailure( 'complete', error );
				return { status: 'aborted' };
			}
		},

		cancel: () => {
			try {
				// 利用者によるキャンセルは開始済みのReorder Sessionに対してのみ成立し、開始前または終了後の呼び出しは内部不変条件違反とする。
				if ( session === null ) {
					throw new Error(
						'DnD Interaction invariant violated: cancel requires an active Reorder Session.'
					);
				}

				session = cancelReorderSession( session );
				return { status: 'cancelled' };
			} catch ( error ) {
				handleOperationFailure( 'cancel', error );
				return { status: 'aborted' };
			}
		},

		abort,
	};
};

/**
 * 有効なReorder SessionからDrop Target Resolutionに必要な値だけを渡して移動先を判定する。
 *
 * @param resolution      DnD開始後の移動先を判定するDrop Target Resolution。
 * @param session         現在有効なReorder Session。
 * @param currentPosition Input Interactionから渡された現在位置。
 * @return 現在位置に対するDrop Target Resolutionの判定結果。
 */
const resolveDestination = (
	resolution: DropTargetResolution,
	session: ReorderSession,
	currentPosition: DropTargetPosition
) => {
	// 1回のDnDでは開始時の並び替え種別を維持するため、Reorder Sessionと同じ種別の移動先だけを判定対象とする。
	if ( session.kind === 'row' ) {
		return resolution.resolve( {
			kind: 'row',
			target: session.target,
			constraints: session.constraints,
			currentPosition,
		} );
	}

	return resolution.resolve( {
		kind: 'column',
		target: session.target,
		constraints: session.constraints,
		currentPosition,
	} );
};
