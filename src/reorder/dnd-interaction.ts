/**
 * 入力方式と行・列に共通するDnD InteractionとReorder operation boundaryを提供する。
 *
 * DnD開始試行では現在のReorder ModeとReorder Target Resolutionを組み合わせてReorder Sessionを開始し、
 * 進行中は同じSessionが保持する並び替え制約をDrop Target Resolutionへ渡す。完了、キャンセル、abortでは
 * Sessionを終了し、内部エラーはoperation boundaryで1回だけ記録して共通abortへ合流させる。
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
 * @param error operation boundaryまで伝播した元のエラー情報。
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
 * 入力方式と行・列に共通するDnDのLifecycleを統括する契約。
 */
export type DndInteraction = {
	/** 現在activeなReorder Sessionを取得する。 */
	getSession: () => ReorderSessionState;
	/** DnD開始を試行する。 */
	start: ( request: ReorderTargetResolutionRequest ) => DndStartResult;
	/** activeなDnDの現在位置に対して移動先を更新する。 */
	progress: ( currentPosition: DropTargetPosition ) => DndProgressResult;
	/** activeなDnDを完了し、確定可能な場合だけCommitted Reorderを返す。 */
	complete: () => DndCompleteResult;
	/** activeなDnDを利用者操作としてキャンセルする。 */
	cancel: () => DndCancelResult;
	/** 外部環境変化などから現在のDnDを共通abortで安全終了する。 */
	abort: () => void;
};

/**
 * Reorder operation boundaryとReorder Sessionを所有するDnD Interactionを作成する。
 *
 * 内部責務から伝播したエラーは各operation boundaryで記録した後に共通abortへ合流する。
 * 外部環境変化など、内部エラーではない処理不能は`abort()`から同じ終了経路へ合流できる。
 *
 * @param dependencies DnD Interactionが利用するReorder責務とエラー記録先。
 * @return 1つのactiveなReorder Sessionだけを所有するDnD Interaction。
 */
export const createDndInteraction = (
	dependencies: DndInteractionDependencies
): DndInteraction => {
	let session: ReorderSessionState = null;

	/** Reorder SessionとDnDに属する状態を終了してidleへ戻す共通abort。 */
	const abort = (): void => {
		session = null;
	};

	/**
	 * operation boundaryまで伝播した内部エラーを記録し、共通abortへ合流する。
	 *
	 * @param operation 失敗したDnD操作。
	 * @param error operation boundaryまで伝播した元のエラー情報。
	 */
	const handleOperationFailure = ( operation: DndOperation, error: unknown ): void => {
		dependencies.logError( operation, error );
		abort();
	};

	return {
		getSession: () => session,

		start: ( request ) => {
			try {
				if ( session !== null ) {
					throw new Error( 'DnD Interaction invariant violated: only one Reorder Session may be active.' );
				}

				const reorderKind = dependencies.reorderMode.getReorderKind();

				// 通常編集モードではDnDを開始できないため、Reorder Sessionを作らず開始試行を終了する。
				if ( reorderKind === null ) {
					return { status: 'not-started', reason: 'reorder-mode-inactive' };
				}

				// Input Interactionから渡された対象種別と現在のReorder Modeが異なる状態は内部Contract違反として扱う。
				if ( reorderKind !== request.kind ) {
					throw new Error( 'DnD Interaction invariant violated: Reorder Mode must match the start request kind.' );
				}

				const resolution = dependencies.reorderTargetResolution.resolve( request );

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
				if ( session === null ) {
					throw new Error( 'DnD Interaction invariant violated: progress requires an active Reorder Session.' );
				}

				const resolution = resolveDestination( dependencies.dropTargetResolution, session, currentPosition );
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
				if ( session === null ) {
					throw new Error( 'DnD Interaction invariant violated: complete requires an active Reorder Session.' );
				}

				const committedReorder = completeReorderSession( session );
				session = null;

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
				if ( session === null ) {
					throw new Error( 'DnD Interaction invariant violated: cancel requires an active Reorder Session.' );
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
 * activeなReorder SessionからDrop Target Resolutionに必要な値だけを渡して移動先を判定する。
 *
 * @param resolution DnD開始後の移動先を判定するDrop Target Resolution。
 * @param session 現在activeなReorder Session。
 * @param currentPosition Input Interactionから渡された現在位置。
 * @return 現在位置に対するDrop Target Resolutionの判定結果。
 */
const resolveDestination = (
	resolution: DropTargetResolution,
	session: ReorderSession,
	currentPosition: DropTargetPosition
) => {
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
