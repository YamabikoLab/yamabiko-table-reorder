/**
 * 行専用DnD Interactionとして、DnD Engineの物理的なDnD進行をRow Reorderの意味状態へ変換する。
 *
 * Reorder Target Resolutionで開始可能と解決された対象だけを受け取り、activeな行DnD Session、
 * 移動先更新、確定、cancelのLifecycleを所有する。開始可否判定は所有しない。
 * active Sessionだけを共有状態として保持し、DnD Engine固有の物理状態やSession開始前の候補を状態として複製しない。
 * DnD終了後はSessionを破棄してから対象Tableの現在行制約を取得し直し、Reorder Modeへ継続可否だけを通知する。
 * DnD Interaction外部へStoreを公開せず、Reorder Presentationに必要な状態だけを購読境界と一回性イベントで公開する。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import {
	type DirectReorderApplyMeasurement,
	type ReorderApplyRuntime,
} from '@/reorder/reorder-apply-performance';
import { requiresLargeReorderApply } from '@/reorder/reorder-apply-policy';
import { rowReorderMode } from '@/reorder/reorder-mode';
import {
	isRowReorderTargetMovable,
	type RowReorderTarget,
} from '@/reorder/row-reorder/domain/target-validity';
import { requestLargeRowReorderApply } from '@/reorder/row-reorder/responsibilities/reorder-apply';

import { rowTableIntegration, type RowReorderConstraints } from './table-integration';

/**
 * activeな行DnD中にDnD Interactionが所有する意味状態を表す。
 *
 * Session開始時に成立した移動対象、対象Table、行制約、および現在の有効移動先だけを保持する。
 */
type RowDndSession = {
	/** 行DnDの対象となるTable個体を識別する値。 */
	tableIdentity: string;
	/** Session開始時に確定したtbody内の0-based移動元行位置。 */
	sourceRowIndex: number;
	/** Session開始時の行制約に対して実際に行順を変更できる現在の0-based移動先境界。有効な移動先がない場合はnull。 */
	destinationBoundaryIndex: number | null;
	/** Reorder Target Resolutionで確認し、Session開始時の判定基準として固定した行制約。 */
	initialConstraints: RowReorderConstraints;
};

/**
 * DnD Interactionが保持できる有効状態を表す。
 *
 * idleではSessionを持たず、activeでは必ず1つのSessionを持つことで、Lifecycle上成立しない状態を作らない。
 */
type RowDndStoreState =
	| {
			phase: 'idle';
			session: null;
	  }
	| {
			phase: 'active';
			session: RowDndSession;
	  };

/** DnD Interaction Storeが状態遷移のために提供する操作を表す。 */
type RowDndStoreActions = {
	/**
	 * 物理的なDnD開始成立後に、解決済みの移動対象と開始時制約を引き継いでactive Sessionを開始する。
	 *
	 * @param target             Reorder Target Resolutionで開始可能と解決された移動対象。
	 * @param initialConstraints Target Resolutionで確認した開始時制約。
	 */
	start: ( target: RowReorderTarget, initialConstraints: RowReorderConstraints ) => void;
	/**
	 * DnD Engine側で解決済みの移動先候補を、Session開始時の行制約と移動元へ照合して現在の有効移動先へ反映する。
	 *
	 * @param destinationBoundaryIndex 現在の0-based移動先候補境界。候補がない場合はnull。
	 */
	updateDestination: ( destinationBoundaryIndex: number | null ) => void;
	/**
	 * active Sessionの最終移動先を現在のTable構造へ再照合し、成立する行移動だけを確定してSessionを終了する。
	 *
	 * @param runtime 現在のEditor表示環境で性能学習を行うための境界。解決できない場合はnull。
	 * @return 正常な直接反映を開始した場合は表示完了計測に必要な値。それ以外はnull。
	 */
	complete: ( runtime?: ReorderApplyRuntime | null ) => DirectReorderApplyMeasurement | null;
	/** Tableを更新せずactive Sessionを終了する。 */
	cancel: () => void;
};

/** DnD Interactionが所有する意味状態とLifecycle操作をまとめたStore境界。 */
type RowDndStore = RowDndStoreState & RowDndStoreActions;

/** DnD Interactionの共有状態変更をReact非依存で受け取る購読listener。 */
type RowDndStateListener = () => void;

/** Reorder PresentationがDnD異常終了通知を受け取るための購読listener。 */
type RowDndTerminationNoticeListener = () => void;

/**
 * DnD Interactionが発行する一回性の異常終了通知を現在購読しているReorder Presentationを保持する。
 *
 * 通知はRow DnD Sessionの状態ではないため、Zustand storeへ複製しない。
 */
const rowDndTerminationNoticeListeners = new Set< RowDndTerminationNoticeListener >();

/** activeな行DnDを安全に継続または確定できず終了したことをReorder Presentationへ通知する。 */
const emitRowDndTerminationNotice = (): void => {
	/* 通知対象の終了を現在購読中のPresentationへ同じ一回性イベントとして伝える。 */
	rowDndTerminationNoticeListeners.forEach( ( listener ) => {
		listener();
	} );
};

/**
 * DnD終了後のSession対象Tableが、次の行並び替え操作を安全に受けられるかReorder Modeへ通知する。
 *
 * complete途中で取得した行制約やSession開始時制約は流用せず、Session終了後にTable Integrationから現在の行制約を取得し直す。
 * 今回の移動元・移動先・終了種別ではなく、対象Table自体が次の操作を受けられるかだけをReorder Modeへ通知する。
 *
 * @param tableIdentity 終了した行DnD Sessionの対象Table Identity。
 */
const resolveReorderModeAfterDnd = ( tableIdentity: string ): void => {
	const currentConstraints = rowTableIntegration.getConstraints( tableIdentity );
	const canContinue = currentConstraints !== null;

	rowReorderMode.resolveAfterDnd( tableIdentity, canContinue );
};

/**
 * 移動先境界が指定された行制約に対して有効か判定する。
 *
 * @param destinationBoundaryIndex 移動先の0-based挿入位置。
 * @param constraints              判定基準とする行制約。
 * @return 行を挿入してTable構造を保持できる場合はtrue。
 */
const isDestinationValid = (
	destinationBoundaryIndex: number,
	constraints: RowReorderConstraints
): boolean => {
	const destinationInRange =
		Number.isInteger( destinationBoundaryIndex ) &&
		destinationBoundaryIndex >= 0 &&
		destinationBoundaryIndex <= constraints.rowCount;

	/* tbodyの先頭から末尾直後までの挿入位置として成立しない値は、移動先として保持しない。 */
	if ( ! destinationInRange ) {
		return false;
	}

	const destinationAllowed = ! constraints.blockedBoundaries.includes( destinationBoundaryIndex );
	return destinationAllowed;
};

/**
 * 行DnD SessionとLifecycleを所有するStore。
 *
 * active Sessionだけを共有状態として保持し、物理的なDnD成立前のTarget Resolution結果はStoreへ保存しない。
 * 状態変更はStore所有の操作だけから行い、DnD Interaction外部へ状態置換手段を公開しない。
 */
const rowDndStore = createStore< RowDndStore >()(
	devtools(
		( set, get ) => ( {
			phase: 'idle',
			session: null,

			start: ( target, initialConstraints ) => {
				const state = get();

				/* active Sessionを新しいSessionで置き換えることは禁止し、1回の物理DnDと1つのSessionを対応させる。 */
				if ( state.phase === 'active' ) {
					throw new Error( 'Row DnD start requires an idle session.' );
				}

				const session: RowDndSession = {
					tableIdentity: target.tableIdentity,
					sourceRowIndex: target.sourceRowIndex,
					destinationBoundaryIndex: null,
					initialConstraints,
				};

				set(
					{
						phase: 'active',
						session,
					},
					undefined,
					'row-dnd/start'
				);
			},

			updateDestination: ( destinationBoundaryIndex ) => {
				const state = get();

				/* 移動先はactive Sessionにだけ属する意味状態であり、idle時の更新要求はLifecycle違反として扱う。 */
				if ( state.phase !== 'active' ) {
					throw new Error( 'Row DnD destination can only be updated during an active session.' );
				}

				let validDestination: number | null = null;
				const destinationChangesRowOrder =
					destinationBoundaryIndex !== null &&
					destinationBoundaryIndex !== state.session.sourceRowIndex &&
					destinationBoundaryIndex !== state.session.sourceRowIndex + 1;

				/* Table構造を保持でき、かつ実際に行順が変わる候補だけを現在の有効移動先として保持する。 */
				if (
					destinationChangesRowOrder &&
					destinationBoundaryIndex !== null &&
					isDestinationValid( destinationBoundaryIndex, state.session.initialConstraints )
				) {
					validDestination = destinationBoundaryIndex;
				}

				set(
					{
						phase: 'active',
						session: {
							...state.session,
							destinationBoundaryIndex: validDestination,
						},
					},
					undefined,
					'row-dnd/update-destination'
				);
			},

			complete: ( runtime = null ) => {
				const state = get();

				/* completeはactive Sessionの終了境界であり、対象Sessionがない呼び出しはLifecycle違反として扱う。 */
				if ( state.phase !== 'active' ) {
					throw new Error( 'Row DnD complete requires an active session.' );
				}

				const { session } = state;
				let shouldNotifyTermination = false;

				try {
					/* 有効な最終移動先が成立していないdropでは、Tableを更新せず正常終了する。 */
					if ( session.destinationBoundaryIndex === null ) {
						return null;
					}

					const currentConstraints = rowTableIntegration.getConstraints( session.tableIdentity );
					const target: RowReorderTarget = {
						tableIdentity: session.tableIdentity,
						sourceRowIndex: session.sourceRowIndex,
					};

					/* complete時点の現在構造で移動元または移動先が成立しない場合は、安全に確定できない終了として利用者へ通知する。 */
					if (
						currentConstraints === null ||
						! isRowReorderTargetMovable( target, currentConstraints ) ||
						! isDestinationValid( session.destinationBoundaryIndex, currentConstraints )
					) {
						shouldNotifyTermination = true;
						return null;
					}

					const move = {
						clientId: session.tableIdentity,
						sourceRowIndex: session.sourceRowIndex,
						destinationBoundaryIndex: session.destinationBoundaryIndex,
					};
					const affectedCellCount = rowTableIntegration.getAffectedCellCount( move );

					/* 更新対象セル数を安全に算出できない場合は、反映経路を推測せずTableを変更しない。 */
					if ( affectedCellCount === null ) {
						shouldNotifyTermination = true;
						return null;
					}

					const storage = runtime?.storage ?? null;
					const nowMs = runtime?.dateNow() ?? 0;
					/* 固定閾値または端末ローカルの有効な学習閾値に達する移動は、確認付き大規模反映へ引き渡す。 */
					if ( requiresLargeReorderApply( affectedCellCount, 'row', storage, nowMs ) ) {
						const pendingMove = {
							tableIdentity: session.tableIdentity,
							sourceRowIndex: session.sourceRowIndex,
							destinationBoundaryIndex: session.destinationBoundaryIndex,
						};
						queueMicrotask( () => {
							const requested = requestLargeRowReorderApply( pendingMove );
							if ( ! requested ) {
								emitRowDndTerminationNotice();
							}
						} );
						return null;
					}

					const startedAt = runtime?.performanceNow() ?? null;
					const rowMoveApplied = rowTableIntegration.applyRowMove( move );

					/* 更新要求時点の外部状態変化等で行移動を反映できない場合は、安全に確定できない通常の終了として扱う。 */
					if ( ! rowMoveApplied ) {
						shouldNotifyTermination = true;
						return null;
					}

					if ( startedAt === null ) {
						return null;
					}

					const measurement: DirectReorderApplyMeasurement = {
						affectedCellCount,
						startedAt,
					};
					return measurement;
				} finally {
					set(
						{
							phase: 'idle',
							session: null,
						},
						undefined,
						'row-dnd/complete'
					);

					/* 異常終了通知はSessionを破棄して安全なidleへ戻した後に一度だけ発行する。 */
					if ( shouldNotifyTermination ) {
						emitRowDndTerminationNotice();
					}
				}
			},

			cancel: () => {
				set(
					{
						phase: 'idle',
						session: null,
					},
					undefined,
					'row-dnd/cancel'
				);
			},
		} ),
		{
			name: 'Yamabiko Table Reorder / Row DnD',
		}
	)
);

/**
 * DnD Interactionの共有状態が変化したことを、Store内部を公開せず外部利用者へ通知する。
 *
 * @param listener 共有状態が変化したときに呼び出す購読listener。
 * @return 購読を解除する関数。
 */
export const subscribeRowDndState = ( listener: RowDndStateListener ): ( () => void ) => {
	const unsubscribe = rowDndStore.subscribe( listener );
	return unsubscribe;
};

/**
 * Reorder Presentationが行DnD中の表示開始・終了を追従するため、現在のLifecycle状態を取得する。
 *
 * @return 現在の行DnD Lifecycle状態。
 */
export const getRowDndPhase = (): RowDndStoreState[ 'phase' ] => {
	const phase = rowDndStore.getState().phase;
	return phase;
};

/**
 * Reorder Presentationが現在の有効な挿入位置を追従するため、現在の移動先境界を取得する。
 *
 * @return 実際に行順を変更できる現在の0-based移動先境界。idleまたは有効な移動先がない場合はnull。
 */
export const getRowDndDestinationBoundaryIndex = (): number | null => {
	const state = rowDndStore.getState();
	let destinationBoundaryIndex: number | null = null;

	if ( state.phase === 'active' ) {
		destinationBoundaryIndex = state.session.destinationBoundaryIndex;
	}

	return destinationBoundaryIndex;
};

/**
 * Reorder PresentationがDnD異常終了通知を一回性イベントとして受け取るために利用する。
 *
 * 通知表示そのものの状態や終了理由は公開せず、通知対象となる終了が発生したことだけを伝える。
 *
 * @param listener 通知対象のDnD終了時に呼び出す購読listener。
 * @return 購読を解除する関数。
 */
export const subscribeRowDndTerminationNotice = (
	listener: RowDndTerminationNoticeListener
): ( () => void ) => {
	rowDndTerminationNoticeListeners.add( listener );

	const unsubscribe = (): void => {
		rowDndTerminationNoticeListeners.delete( listener );
	};

	return unsubscribe;
};

/**
 * DnD Engine Lifecycleから利用する行専用DnD Interactionの内部仕様。
 *
 * Store自体や状態置換手段は公開せず、解決済みTargetから始まるSession Lifecycleの操作だけを公開する。
 * completeとcancelでは、終了対象SessionのTable IdentityをStore操作前に退避し、Session終了後にそのTableの継続可否だけをReorder Modeへ通知する。
 */
export const rowDndInteraction: RowDndStoreActions = {
	start: ( target, initialConstraints ) =>
		rowDndStore.getState().start( target, initialConstraints ),
	updateDestination: ( destinationBoundaryIndex ) =>
		rowDndStore.getState().updateDestination( destinationBoundaryIndex ),
	complete: ( runtime = null ) => {
		const state = rowDndStore.getState();

		/* completeのLifecycle違反はStore所有の境界で判定させ、終了後解決に存在しないSessionを使用しない。 */
		if ( state.phase !== 'active' ) {
			return rowDndStore.getState().complete( runtime );
		}

		const tableIdentity = state.session.tableIdentity;
		const measurement = rowDndStore.getState().complete( runtime );
		resolveReorderModeAfterDnd( tableIdentity );
		return measurement;
	},
	cancel: () => {
		const state = rowDndStore.getState();

		/* active DnDの終了経路だけをReorder ModeのDnD終了後Lifecycleへ接続し、idle時の後処理を発生させない。 */
		if ( state.phase !== 'active' ) {
			rowDndStore.getState().cancel();
			return;
		}

		const tableIdentity = state.session.tableIdentity;
		rowDndStore.getState().cancel();
		resolveReorderModeAfterDnd( tableIdentity );
	},
};
