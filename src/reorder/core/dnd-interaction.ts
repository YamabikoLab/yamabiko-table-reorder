/**
 * 入力方式と行・列に共通するDnD InteractionとReorder operation boundaryを提供する。
 *
 * DnDの開始可否、進行、完了、キャンセル、安全終了を統括し、1回のDnDで有効なReorder Sessionを
 * 1つだけ所有する。DnD Interactionは現在方向に対応する入口までを選択し、方向固有の解釈・規則・処理は各方向側へ委譲する。
 */
import { resolveColumnDndStart } from '@/reorder/column-reorder/dnd-start-resolution';
import { getColumnReorderSourceIndex } from '@/reorder/column-reorder/reorder-target-resolution';
import { resolveColumnTableUpdateChanges } from '@/reorder/column-reorder/table-update';
import type { DataUpdate, DataUpdateDirectionAdapter } from '@/reorder/core/data-update';
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
import type { ReorderTargetResolutionResult } from '@/reorder/core/reorder-target-resolution-rules';
import {
	cancelReorderSession,
	completeReorderSession,
	startReorderSession,
	updateReorderDestination,
} from '@/reorder/core/reorder-session';
import type {
	CommittedReorder,
	ConcreteCommittedReorder,
	ConcreteReorderSession,
	ReorderSession,
	ReorderSessionState,
} from '@/reorder/core/reorder-session';
import type {
	ConcreteReorderTarget,
	ReorderDestination,
	ReorderKind,
} from '@/reorder/core/reorder-types';
import type { ReorderMode } from '@/reorder/foundation/reorder-mode';
import { resolveRowDndStart } from '@/reorder/row-reorder/dnd-start-resolution';
import { getRowReorderSourceIndex } from '@/reorder/row-reorder/reorder-target-resolution';
import { resolveRowTableUpdateChanges } from '@/reorder/row-reorder/table-update';

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
	dataUpdate: DataUpdate;
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
	/** @return Table更新まで完了した確定結果、データ変更なし、またはabort結果。 */
	complete: () => DndCompleteResult;
	/** @return 利用者操作によるDnDキャンセル結果。 */
	cancel: () => DndCancelResult;
	/** 外部環境変化などから現在のDnDを内部エラー記録なしで安全終了する。 */
	abort: () => void;
};

/** 具体方向のDnD完了処理がoperation boundaryへ返す内部結果。 */
type ActiveDndCompleteResult< K extends ReorderKind > =
	| { status: 'committed'; reorder: ConcreteCommittedReorder< K > }
	| { status: 'completed-without-commit' }
	| { status: 'update-failed' };

/**
 * 現在のReorder Sessionと、その方向に対応するDrop Target Resolverを同じDnD中だけ束ねる内部契約。
 *
 * Reorder Sessionを状態の正本とし、この組み合わせ自体には独立した業務状態やLifecycleを持たせない。
 */
type ActiveDndBinding< K extends ReorderKind = ReorderKind > = {
	[ Kind in K ]: {
		/** @return 現在の移動先更新まで反映した最新Reorder Session。 */
		getSession: () => ConcreteReorderSession< Kind >;
		/**
		 * 現在位置から同方向の移動先を解決し、Reorder Sessionへ反映する。
		 *
		 * @param currentPosition Input Interactionから渡された現在位置。
		 * @return 現在の有効な移動先。
		 */
		progress: ( currentPosition: DropTargetPosition ) => ReorderDestination< Kind > | null;
		/** @return 同方向のSessionを完了し、Data Updateまで接続した結果。 */
		complete: () => ActiveDndCompleteResult< Kind >;
	};
}[ K ];

/** 指定方向のDnD開始入口が返す対象解決結果と同方向の移動先判定入口。 */
type DndStartResolution< K extends ReorderKind > = {
	targetResolution: ReorderTargetResolutionResult< ConcreteReorderTarget< K > >;
	resolveDropTarget: (
		request: DropTargetResolutionRequest< K >
	) => DropTargetResolutionResult< K >;
};

/** 指定方向の開始位置解釈とResolver対応を方向側へ委譲する入口。 */
type DndStartResolver< K extends ReorderKind > = (
	request: DndStartRequest,
	reorderTargetResolution: ReorderTargetResolution,
	dropTargetResolution: DropTargetResolution
) => DndStartResolution< K >;

/** 方向選択境界で同じ方向の開始解釈とData Update規則を束ねる。 */
type DndDirectionAdapter< K extends ReorderKind > = {
	resolveStart: DndStartResolver< K >;
	dataUpdate: DataUpdateDirectionAdapter< K >;
};

/** 方向固有入口の対象解決後に共通開始処理が生成する結果。 */
type PreparedDndStart< K extends ReorderKind > =
	| {
			status: 'started';
			session: ConcreteReorderSession< K >;
			binding: ActiveDndBinding< K >;
	  }
	| { status: 'not-started'; reason: ReorderTargetResolutionFailureReason };

/**
 * 具体方向へ確定したReorder Sessionと同方向のDrop Target Resolver、Data Update規則を束ねる。
 *
 * @param initialSession  DnD開始時に成立した具体方向のReorder Session。
 * @param resolve         同じ方向のRequest / Result対応を保証する移動先判定入口。
 * @param dataUpdateRules 同じ方向のTarget位置取得とTableデータ変更規則。
 * @param dataUpdate      確定済みReorderをTable Integrationへ接続する共通Data Update。
 * @return 最新Reorder Sessionを保持しながら同方向の進行・完了を行う内部バインディング。
 */
const createActiveDndBinding = < K extends ReorderKind >(
	initialSession: ConcreteReorderSession< K >,
	resolve: ( request: DropTargetResolutionRequest< K > ) => DropTargetResolutionResult< K >,
	dataUpdateRules: DataUpdateDirectionAdapter< K >,
	dataUpdate: DataUpdate
): ActiveDndBinding< K > => {
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
		complete: () => {
			const committedReorder = completeReorderSession( session );

			// 有効な移動先がないDnDはData Updateを呼び出さず正常完了する。
			if ( committedReorder === null ) {
				return { status: 'completed-without-commit' };
			}

			const updateResult = dataUpdate.update( committedReorder, dataUpdateRules );
			// no-opは確定可能な境界だった場合もTableデータ変更を発生させず正常完了する。
			if ( updateResult.status === 'unchanged' ) {
				return { status: 'completed-without-commit' };
			}

			// 外部Table更新を開始できない、または成立を確認できない場合はoperation boundaryの共通abortへ返す。
			if ( updateResult.status !== 'updated' ) {
				return { status: 'update-failed' };
			}

			return { status: 'committed', reorder: committedReorder };
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

	/**
	 * 選択された方向固有入口から対象解決、移動先判定、Data Update規則の対応を受け取り、共通Session開始結果を準備する。
	 *
	 * @param request Input Interactionから渡された方向非依存のDnD開始位置。
	 * @param adapter 現在の並び替え方向に対応する方向固有入口とData Update規則。
	 * @return 具体方向を維持したSessionとBinding、またはDnDを開始できない理由。
	 */
	const prepareStartForDirection = < K extends ReorderKind >(
		request: DndStartRequest,
		adapter: DndDirectionAdapter< K >
	): PreparedDndStart< K > => {
		const { targetResolution, resolveDropTarget } = adapter.resolveStart(
			request,
			dependencies.reorderTargetResolution,
			dependencies.dropTargetResolution
		);

		// 並び替え対象として成立しない要素ではDnDを開始せず、その理由を呼び出し側へ返す。
		if ( targetResolution.status === 'immovable' ) {
			return { status: 'not-started', reason: targetResolution.reason };
		}

		const startedSession = startReorderSession< K >(
			targetResolution.target,
			targetResolution.constraints
		);
		const binding = createActiveDndBinding< K >(
			startedSession,
			resolveDropTarget,
			adapter.dataUpdate,
			dependencies.dataUpdate
		);

		return { status: 'started', session: startedSession, binding };
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

				// 方向が未確定なこの境界だけで行・列を選択し、以降は同じ方向の型対応と更新規則を維持する。
				if ( reorderKind === 'row' ) {
					const preparedStart = prepareStartForDirection( request, {
						resolveStart: resolveRowDndStart,
						dataUpdate: {
							getSourceIndex: getRowReorderSourceIndex,
							resolveTableUpdateChanges: resolveRowTableUpdateChanges,
						},
					} );
					if ( preparedStart.status === 'not-started' ) {
						return preparedStart;
					}

					activeDnd = preparedStart.binding;
					return { status: 'started', session: preparedStart.session };
				}

				const preparedStart = prepareStartForDirection( request, {
					resolveStart: resolveColumnDndStart,
					dataUpdate: {
						getSourceIndex: getColumnReorderSourceIndex,
						resolveTableUpdateChanges: resolveColumnTableUpdateChanges,
					},
				} );
				if ( preparedStart.status === 'not-started' ) {
					return preparedStart;
				}

				activeDnd = preparedStart.binding;
				return { status: 'started', session: preparedStart.session };
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

				const completion = activeDnd.complete();
				activeDnd = null;

				// 外部更新の開始不可または成立未確認は内部エラーとして記録せず、同じ共通abort結果へ合流する。
				if ( completion.status === 'update-failed' ) {
					abort();
					return { status: 'aborted' };
				}

				return completion;
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
