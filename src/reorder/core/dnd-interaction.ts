/**
 * 入力方式と行・列に共通するDnD InteractionとReorder operation boundaryを提供する。
 *
 * DnDの開始可否、進行、完了、キャンセル、安全終了を統括し、1回のDnDで有効なReorder Sessionを
 * 1つだけ所有する。行・列の選択は方向選択境界に限定し、方向固有Request / Resultの対応は型で維持する。
 */
import { createColumnReorderTargetResolutionRequest } from '@/reorder/column-reorder/dnd-start-resolution';
import type { DndStartRequest } from '@/reorder/core/dnd-start-request';
import type {
	DropTargetPosition,
	DropTargetResolution,
	DropTargetResolutionRequest,
	DropTargetResolutionResult,
} from '@/reorder/core/drop-target-resolution';
import type {
	ReorderTargetResolution,
	ReorderTargetResolutionFailureReason,
	ReorderTargetResolutionResult,
} from '@/reorder/core/reorder-target-resolution';
import {
	cancelReorderSession,
	completeReorderSession,
	startReorderSession,
	updateReorderDestination,
} from '@/reorder/core/reorder-session';
import type {
	CommittedReorder,
	ReorderSession,
	ReorderSessionState,
} from '@/reorder/core/reorder-session';
import type {
	ConcreteReorderKind,
	ReorderDestination,
	ReorderKind,
} from '@/reorder/core/reorder-types';
import type { ReorderMode } from '@/reorder/foundation/reorder-mode';
import { createRowReorderTargetResolutionRequest } from '@/reorder/row-reorder/dnd-start-resolution';

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
	| { status: 'started'; session: ReorderSession }
	| {
			status: 'not-started';
			reason: ReorderTargetResolutionFailureReason | 'reorder-mode-inactive';
	  }
	| { status: 'aborted' };

/** DnD進行処理の結果。 */
export type DndProgressResult =
	| {
			status: 'progressed';
			destination: ReorderDestination | null;
	  }
	| { status: 'aborted' };

/** DnD完了処理の結果。 */
export type DndCompleteResult =
	| { status: 'committed'; reorder: CommittedReorder }
	| { status: 'completed-without-commit' }
	| { status: 'aborted' };

/** DnDキャンセル処理の結果。 */
export type DndCancelResult = { status: 'cancelled' } | { status: 'aborted' };

/** DnD Interactionが依存するReorder責務とoperation boundaryのエラー記録先。 */
export type DndInteractionDependencies = {
	reorderMode: Pick< ReorderMode, 'getReorderKind' >;
	reorderTargetResolution: ReorderTargetResolution;
	dropTargetResolution: DropTargetResolution;
	logError: DndErrorLogger;
};

/** 入力方式と行・列に共通するDnDの開始から終了までを統括する契約。 */
export type DndInteraction = {
	/** @return 現在有効なReorder Session。待機状態では`null`。 */
	getSession: () => ReorderSessionState;
	/**
	 * 方向非依存の開始対象から現在のReorder Modeに対応するDnD開始を試行する。
	 *
	 * @param request Input Interactionから渡されたTable上の開始対象。
	 * @return DnD開始結果。
	 */
	start: ( request: DndStartRequest ) => DndStartResult;
	/**
	 * 有効なDnDの現在位置に対応する移動先を更新する。
	 *
	 * @param currentPosition Input Interactionから渡された現在のドロップ候補位置。
	 * @return DnD進行結果。
	 */
	progress: ( currentPosition: DropTargetPosition ) => DndProgressResult;
	/** @return 確定済み並び替えを含むDnD完了結果。 */
	complete: () => DndCompleteResult;
	/** @return 利用者操作によるDnDキャンセル結果。 */
	cancel: () => DndCancelResult;
	/** 外部環境変化などから現在のDnDを内部エラー記録なしで安全終了する。 */
	abort: () => void;
};

/**
 * Reorder operation boundaryとReorder Sessionを所有するDnD Interactionを作成する。
 *
 * @param dependencies DnD Interactionが利用するReorder責務とエラー記録先。
 * @return 1つの有効なReorder Sessionだけを所有するDnD Interaction。
 */
export const createDndInteraction = (
	dependencies: DndInteractionDependencies
): DndInteraction => {
	let session: ReorderSessionState = null;

	/** Reorder SessionとDnDに属する一時状態を終了して待機状態へ戻す共通`abort()`。 */
	const abort = (): void => {
		session = null;
	};

	/**
	 * operation boundaryまで伝播した内部エラーを1回だけ記録し、共通`abort()`へ合流する。
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
				// 1回のDnDではReorder Sessionを1つだけ所有し、開始済みの状態から別Sessionを開始しない。
				if ( session !== null ) {
					throw new Error(
						'DnD Interaction invariant violated: only one Reorder Session may be active.'
					);
				}

				const reorderKind = dependencies.reorderMode.getReorderKind();

				// 通常編集モードでは並び替え方向が成立していないためReorder Sessionを開始しない。
				if ( reorderKind === null ) {
					return { status: 'not-started', reason: 'reorder-mode-inactive' };
				}

				let resolution: ReorderTargetResolutionResult;

				// DnD Interactionは現在方向だけを選択し、開始位置の方向固有解釈は各Reorder責務へ委譲する。
				if ( reorderKind === 'row' ) {
					const resolutionRequest = createRowReorderTargetResolutionRequest( request );
					resolution = dependencies.reorderTargetResolution.resolve( resolutionRequest );
				} else {
					const resolutionRequest = createColumnReorderTargetResolutionRequest( request );
					resolution = dependencies.reorderTargetResolution.resolve( resolutionRequest );
				}

				// 並び替え対象として成立しない要素ではDnDを開始せず、その理由を呼び出し側へ返す。
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
				// DnD進行は開始済みのReorder Sessionだけに成立し、開始前または終了後の進行は内部不変条件違反とする。
				if ( session === null ) {
					throw new Error(
						'DnD Interaction invariant violated: progress requires an active Reorder Session.'
					);
				}

				let progressed: ProgressedSession;

				// 両方向を束ねたSessionはこのcomposition pointで具体方向へ確定し、方向対応を型で維持する。
				if ( session.kind === 'row' ) {
					progressed = progressSession(
						session,
						currentPosition,
						dependencies.dropTargetResolution.resolveRow
					);
				} else {
					progressed = progressSession(
						session,
						currentPosition,
						dependencies.dropTargetResolution.resolveColumn
					);
				}

				session = progressed.session;
				return { status: 'progressed', destination: progressed.destination };
			} catch ( error ) {
				handleOperationFailure( 'progress', error );
				return { status: 'aborted' };
			}
		},

		complete: () => {
			try {
				// DnD完了は開始済みのReorder Sessionだけに成立し、開始前または終了後の完了は内部不変条件違反とする。
				if ( session === null ) {
					throw new Error(
						'DnD Interaction invariant violated: complete requires an active Reorder Session.'
					);
				}

				const committedReorder = completeReorderSession( session );
				session = null;

				// 有効な移動先がないDnDはData Updateへ渡す結果を生成せず正常完了する。
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
				// 利用者によるキャンセルは開始済みのReorder Sessionだけに成立する。
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

/** 指定した方向のDnD進行後Sessionと、その時点で有効な同じ方向のDestination。 */
type ProgressedSession< K extends ReorderKind = ReorderKind > = {
	[ Kind in K ]: {
		session: ReorderSession< Kind >;
		destination: ReorderDestination< Kind > | null;
	};
}[ K ];

/**
 * 具体方向へ確定したSessionの方向を維持してDrop Target Resolutionを呼び出し、同じ方向のDestinationを更新する。
 *
 * @param session         現在有効で具体方向へ確定したReorder Session。
 * @param currentPosition Input Interactionから渡された現在位置。
 * @param resolve         同じ方向のRequest / Result対応を保証する移動先判定入口。
 * @return 同じ方向のSessionと現在の有効な移動先。
 */
const progressSession = < K extends ReorderKind >(
	session: ReorderSession< K > & { kind: ConcreteReorderKind< K > },
	currentPosition: DropTargetPosition,
	resolve: ( request: DropTargetResolutionRequest< K > ) => DropTargetResolutionResult< K >
): ProgressedSession< K > => {
	const result = resolve( {
		kind: session.kind,
		target: session.target,
		constraints: session.constraints,
		currentPosition,
	} );
	const destination = result.status === 'valid' ? result.destination : null;

	return {
		session: updateReorderDestination( session, destination ),
		destination,
	};
};
