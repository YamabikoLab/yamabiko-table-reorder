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
 * 現在のReorder Sessionと、その方向に対応するDrop Target Resolverを同じDnD中だけ束ねる内部契約。
 *
 * Reorder Sessionを状態の正本とし、この組み合わせ自体には独立した業務状態やLifecycleを持たせない。
 */
type ActiveDndBinding = {
	/** @return 現在の移動先更新まで反映した最新Reorder Session。 */
	getSession: () => ReorderSession;
	/**
	 * 現在位置から同方向の移動先を解決し、Reorder Sessionへ反映する。
	 *
	 * @param currentPosition Input Interactionから渡された現在位置。
	 * @return 現在の有効な移動先。
	 */
	progress: ( currentPosition: DropTargetPosition ) => ReorderDestination | null;
};

/**
 * 具体方向へ確定したReorder Sessionと同方向のDrop Target Resolverを束ねる。
 *
 * @param initialSession DnD開始時に成立した具体方向のReorder Session。
 * @param resolve        同じ方向のRequest / Result対応を保証する移動先判定入口。
 * @return 最新Reorder Sessionを保持しながら同方向の移動先判定を行う内部バインディング。
 */
const createActiveDndBinding = < K extends ReorderKind >(
	initialSession: ReorderSession< K > & { kind: ConcreteReorderKind< K > },
	resolve: ( request: DropTargetResolutionRequest< K > ) => DropTargetResolutionResult< K >
): ActiveDndBinding => {
	let session = initialSession;

	return {
		getSession: () => session,
		progress: ( currentPosition ) => {
			const result = resolve( {
				kind: session.kind,
				target: session.target,
				constraints: session.constraints,
				currentPosition,
			} );
			const destination = result.status === 'valid' ? result.destination : null;
			session = updateReorderDestination( session, destination );
			return destination;
		},
	};
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
	let activeDnd: ActiveDndBinding | null = null;

	/** Reorder SessionとDnDに属する一時状態を終了して待機状態へ戻す共通`abort()`。 */
	const abort = (): void => {
		activeDnd = null;
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
		getSession: () => {
			const currentSession = activeDnd === null ? null : activeDnd.getSession();
			return currentSession;
		},

		start: ( request ) => {
			try {
				// 1回のDnDではReorder Sessionを1つだけ所有し、開始済みの状態から別Sessionを開始しない。
				if ( activeDnd !== null ) {
					throw new Error(
						'DnD Interaction invariant violated: only one Reorder Session may be active.'
					);
				}

				const reorderKind = dependencies.reorderMode.getReorderKind();

				// 通常編集モードでは並び替え方向が成立していないためReorder Sessionを開始しない。
				if ( reorderKind === null ) {
					return { status: 'not-started', reason: 'reorder-mode-inactive' };
				}

				// DnD Interactionは開始時だけ現在方向を選択し、同方向のSessionと移動先判定入口を確定する。
				if ( reorderKind === 'row' ) {
					const resolutionRequest = createRowReorderTargetResolutionRequest( request );
					const resolution = dependencies.reorderTargetResolution.resolve( resolutionRequest );

					// 並び替え対象として成立しない要素ではDnDを開始せず、その理由を呼び出し側へ返す。
					if ( resolution.status === 'immovable' ) {
						return { status: 'not-started', reason: resolution.reason };
					}

					const startedSession = startReorderSession( resolution.target, resolution.constraints );
					activeDnd = createActiveDndBinding(
						startedSession,
						dependencies.dropTargetResolution.resolveRow
					);
					return { status: 'started', session: startedSession };
				}

				const resolutionRequest = createColumnReorderTargetResolutionRequest( request );
				const resolution = dependencies.reorderTargetResolution.resolve( resolutionRequest );

				// 並び替え対象として成立しない要素ではDnDを開始せず、その理由を呼び出し側へ返す。
				if ( resolution.status === 'immovable' ) {
					return { status: 'not-started', reason: resolution.reason };
				}

				const startedSession = startReorderSession( resolution.target, resolution.constraints );
				activeDnd = createActiveDndBinding(
					startedSession,
					dependencies.dropTargetResolution.resolveColumn
				);
				return { status: 'started', session: startedSession };
			} catch ( error ) {
				handleOperationFailure( 'start', error );
				return { status: 'aborted' };
			}
		},

		progress: ( currentPosition ) => {
			try {
				// DnD進行は開始済みのReorder Sessionだけに成立し、開始前または終了後の進行は内部不変条件違反とする。
				if ( activeDnd === null ) {
					throw new Error(
						'DnD Interaction invariant violated: progress requires an active Reorder Session.'
					);
				}

				const destination = activeDnd.progress( currentPosition );
				return { status: 'progressed', destination };
			} catch ( error ) {
				handleOperationFailure( 'progress', error );
				return { status: 'aborted' };
			}
		},

		complete: () => {
			try {
				// DnD完了は開始済みのReorder Sessionだけに成立し、開始前または終了後の完了は内部不変条件違反とする。
				if ( activeDnd === null ) {
					throw new Error(
						'DnD Interaction invariant violated: complete requires an active Reorder Session.'
					);
				}

				const committedReorder = completeReorderSession( activeDnd.getSession() );
				activeDnd = null;

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
				if ( activeDnd === null ) {
					throw new Error(
						'DnD Interaction invariant violated: cancel requires an active Reorder Session.'
					);
				}

				cancelReorderSession( activeDnd.getSession() );
				activeDnd = null;
				return { status: 'cancelled' };
			} catch ( error ) {
				handleOperationFailure( 'cancel', error );
				return { status: 'aborted' };
			}
		},

		abort,
	};
};
