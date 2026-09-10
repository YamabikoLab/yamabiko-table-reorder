/**
 * 列専用DnD Interactionとして、解決済みReorder Targetから始まるColumn DnD Sessionの意味状態とLifecycleを所有する。
 *
 * Reorder Target Resolutionで開始可能と解決された対象だけを受け取り、activeな列DnD Session、
 * 移動先更新、確定、cancel、安全終了を管理する。開始可否判定やDnD Engine固有の物理入力状態は所有しない。
 * active Sessionだけを共有状態として保持し、Session終了後は対象Tableの現在列制約を取得し直して、
 * Column Reorderを継続できるかという結果だけをReorder Modeへ通知する。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import {
	isColumnReorderTargetMovable,
	type ColumnReorderTarget,
} from '@/reorder/column-reorder/domain/target-validity';
import { requestLargeColumnReorderApply } from '@/reorder/column-reorder/responsibilities/reorder-apply';
import { requiresLargeReorderApply } from '@/reorder/reorder-apply-policy';
import { columnReorderMode } from '@/reorder/reorder-mode';

import { columnTableIntegration, type ColumnReorderConstraints } from './table-integration';

/**
 * activeな列DnD中にDnD Interactionが所有する意味状態を表す。
 *
 * Session開始時に成立した対象Table、移動元論理列、開始時制約、および現在の有効移動先だけを保持する。
 * DnD Engine固有の物理状態、開始前候補、終了結果は保持しない。
 */
type ColumnDndSession = {
	/** 列DnDの対象となるTable個体を識別する値。 */
	tableIdentity: string;
	/** Session開始時に確定した0-based移動元論理列位置。 */
	sourceColumnIndex: number;
	/** 実際に列順を変更できる現在の0-based移動先境界。有効な移動先がない場合はnull。 */
	destinationBoundaryIndex: number | null;
	/** Reorder Target Resolutionで確認し、Session開始時の判定基準として固定した列制約。 */
	initialConstraints: ColumnReorderConstraints;
};

/**
 * DnD Interactionが保持できる有効状態。
 *
 * idleではSessionを持たず、activeでは必ず1つのSessionを持つことで、Lifecycle上成立しない状態を表現しない。
 */
type ColumnDndStoreState =
	| {
			phase: 'idle';
			session: null;
	  }
	| {
			phase: 'active';
			session: ColumnDndSession;
	  };

/**
 * DnD InteractionがColumn DnD Sessionの状態遷移として受け付ける操作を表す。
 *
 * 開始可否の解決や物理入力の解釈は受け持たず、解決済みTargetから始まるSession Lifecycleだけを変更する。
 */
type ColumnDndStoreActions = {
	/**
	 * 物理DnD開始成立後に、解決済みの移動対象と開始時制約を引き継いでactive Sessionを開始する。
	 *
	 * @param target             Reorder Target Resolutionで開始可能と解決された移動対象。
	 * @param initialConstraints Target Resolutionで確認した開始時制約。
	 */
	start: ( target: ColumnReorderTarget, initialConstraints: ColumnReorderConstraints ) => void;
	/**
	 * 解決済みの論理列間境界を、Session開始時制約と移動元へ照合して現在の有効移動先へ反映する。
	 *
	 * @param destinationBoundaryIndex 現在の0-based移動先候補境界。候補がない場合はnull。
	 */
	updateDestination: ( destinationBoundaryIndex: number | null ) => void;
	/** active Sessionの最終移動先を現在Tableへ再照合し、成立する列移動だけを確定してSessionを終了する。 */
	complete: () => void;
	/** Tableを更新せずactive Sessionを終了する。 */
	cancel: () => void;
};

/** DnD Interactionが所有する意味状態とLifecycle操作をまとめたStore境界。 */
type ColumnDndStore = ColumnDndStoreState & ColumnDndStoreActions;

/** DnD Interactionの共有状態変更をReact非依存で受け取る通知先。 */
type ColumnDndStateListener = () => void;

/** Reorder PresentationがDnD異常終了通知を受け取る通知先。 */
type ColumnDndTerminationNoticeListener = () => void;

/**
 * DnD Interactionが発行する一回性の異常終了通知を現在購読しているReorder Presentationを保持する。
 *
 * 通知はColumn DnD Sessionの状態ではないため、Zustand storeへ複製しない。
 */
const columnDndTerminationNoticeListeners = new Set< ColumnDndTerminationNoticeListener >();

/** activeな列DnDを安全に確定できず終了したことをReorder Presentationへ通知する。 */
const emitColumnDndTerminationNotice = (): void => {
	/* 通知対象の終了を現在購読中のPresentationへ同じ一回性イベントとして伝える。 */
	columnDndTerminationNoticeListeners.forEach( ( listener ) => {
		listener();
	} );
};

/**
 * DnD終了後のSession対象Tableが、次の列並び替え操作を安全に受けられるかReorder Modeへ通知する。
 *
 * complete途中で取得した列制約やSession開始時制約は流用せず、Session終了後にTable Integrationから現在列制約を取得し直す。
 * 今回の移動元・移動先・終了種別ではなく、対象Table自体が次の操作を受けられるかだけを通知する。
 *
 * @param tableIdentity 終了したColumn DnD Sessionの対象Table Identity。
 */
const resolveReorderModeAfterDnd = ( tableIdentity: string ): void => {
	const currentConstraints = columnTableIntegration.getConstraints( tableIdentity );
	const canContinue = currentConstraints !== null;

	columnReorderMode.resolveAfterDnd( tableIdentity, canContinue );
};

/**
 * 移動先境界が指定された列制約に対して有効か判定する。
 *
 * @param destinationBoundaryIndex 移動先の0-based挿入位置。
 * @param constraints              判定基準とする列制約。
 * @return 列を挿入してTable構造を保持できる場合はtrue。
 */
const isDestinationValid = (
	destinationBoundaryIndex: number,
	constraints: ColumnReorderConstraints
): boolean => {
	const destinationInRange =
		Number.isInteger( destinationBoundaryIndex ) &&
		destinationBoundaryIndex >= 0 &&
		destinationBoundaryIndex <= constraints.columnCount;

	/* Tableの先頭から末尾直後までの列間境界として成立しない値は、移動先として保持しない。 */
	if ( ! destinationInRange ) {
		return false;
	}

	const destinationAllowed = ! constraints.blockedBoundaries.includes( destinationBoundaryIndex );
	return destinationAllowed;
};

/**
 * Column DnD SessionとLifecycleを所有するStore。
 *
 * active Sessionだけを共有状態として保持し、物理DnD成立前のTarget Resolution結果はStoreへ保存しない。
 * 状態変更はStore所有の操作だけから行い、DnD Interaction外部へ状態置換手段を公開しない。
 */
const columnDndStore = createStore< ColumnDndStore >()(
	devtools(
		( set, get ) => ( {
			phase: 'idle',
			session: null,

			start: ( target, initialConstraints ) => {
				const state = get();

				/* 1回の物理DnDと1つのColumn DnD Sessionを対応させ、active Sessionの置換を禁止する。 */
				if ( state.phase === 'active' ) {
					throw new Error( 'Column DnD start requires an idle session.' );
				}

				const session: ColumnDndSession = {
					tableIdentity: target.tableIdentity,
					sourceColumnIndex: target.sourceColumnIndex,
					destinationBoundaryIndex: null,
					initialConstraints,
				};

				set(
					{
						phase: 'active',
						session,
					},
					undefined,
					'column-dnd/start'
				);
			},

			updateDestination: ( destinationBoundaryIndex ) => {
				const state = get();

				/* 移動先はactive Sessionにだけ属する意味状態であり、idle時の更新要求はLifecycle違反として扱う。 */
				if ( state.phase !== 'active' ) {
					throw new Error( 'Column DnD destination can only be updated during an active session.' );
				}

				let validDestination: number | null = null;
				const destinationChangesColumnOrder =
					destinationBoundaryIndex !== null &&
					destinationBoundaryIndex !== state.session.sourceColumnIndex &&
					destinationBoundaryIndex !== state.session.sourceColumnIndex + 1;

				/* Table構造を保持でき、かつ実際に列順が変わる候補だけを現在の有効移動先として保持する。 */
				if (
					destinationChangesColumnOrder &&
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
					'column-dnd/update-destination'
				);
			},

			complete: () => {
				const state = get();

				/* completeはactive Sessionの終了境界であり、対象Sessionがない呼び出しはLifecycle違反として扱う。 */
				if ( state.phase !== 'active' ) {
					throw new Error( 'Column DnD complete requires an active session.' );
				}

				const { session } = state;
				let shouldNotifyTermination = false;

				try {
					/* 有効な最終移動先が成立していないdropでは、Tableを更新せず異常終了通知も出さない通常終了とする。 */
					if ( session.destinationBoundaryIndex === null ) {
						return;
					}

					const currentConstraints = columnTableIntegration.getConstraints( session.tableIdentity );
					const target: ColumnReorderTarget = {
						tableIdentity: session.tableIdentity,
						sourceColumnIndex: session.sourceColumnIndex,
					};

					/* complete時点の現在構造で移動元または移動先が成立しない場合は、安全に確定できない終了として通知対象にする。 */
					if (
						currentConstraints === null ||
						! isColumnReorderTargetMovable( target, currentConstraints ) ||
						! isDestinationValid( session.destinationBoundaryIndex, currentConstraints )
					) {
						shouldNotifyTermination = true;
						return;
					}

					const move = {
						clientId: session.tableIdentity,
						sourceColumnIndex: session.sourceColumnIndex,
						destinationBoundaryIndex: session.destinationBoundaryIndex,
					};
					const affectedCellCount = columnTableIntegration.getAffectedCellCount( move );

					/* 更新対象セル数を安全に算出できない場合は、反映経路を推測せずTableを変更しない。 */
					if ( affectedCellCount === null ) {
						shouldNotifyTermination = true;
						return;
					}

					/* 共通閾値を超える移動はDnD中に更新せず、Session終了後の確認付き反映へ移動意図だけを引き渡す。 */
					if ( requiresLargeReorderApply( affectedCellCount ) ) {
						const requested = requestLargeColumnReorderApply( {
							tableIdentity: session.tableIdentity,
							sourceColumnIndex: session.sourceColumnIndex,
							destinationBoundaryIndex: session.destinationBoundaryIndex,
						} );
						if ( ! requested ) {
							shouldNotifyTermination = true;
						}
						return;
					}

					const columnMoveApplied = columnTableIntegration.applyColumnMove( move );

					/* 再照合後の外部状態変化等で列移動を反映できない場合も、安全に確定できない終了として扱う。 */
					if ( ! columnMoveApplied ) {
						shouldNotifyTermination = true;
					}
				} finally {
					set(
						{
							phase: 'idle',
							session: null,
						},
						undefined,
						'column-dnd/complete'
					);

					/* 異常終了通知はSessionを破棄して安全なidleへ戻した後に一度だけ発行する。 */
					if ( shouldNotifyTermination ) {
						emitColumnDndTerminationNotice();
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
					'column-dnd/cancel'
				);
			},
		} ),
		{
			name: 'Yamabiko Table Reorder / Column DnD',
		}
	)
);

/**
 * DnD Interactionの共有状態が変化したことを、Store内部を公開せず外部利用者へ通知する。
 *
 * @param listener 共有状態が変化したときに呼び出す通知先。
 * @return 購読を解除する関数。
 */
export const subscribeColumnDndState = ( listener: ColumnDndStateListener ): ( () => void ) => {
	const unsubscribe = columnDndStore.subscribe( listener );
	return unsubscribe;
};

/**
 * Reorder PresentationがDnD中の表示開始・終了を追従するため、現在のLifecycle状態を取得する。
 *
 * @return 現在のColumn DnD Lifecycle状態。
 */
export const getColumnDndPhase = (): ColumnDndStoreState[ 'phase' ] => {
	const phase = columnDndStore.getState().phase;
	return phase;
};

/**
 * Reorder Presentationが押しのけ範囲の移動元を追従するため、Session開始時に確定した移動元論理列を取得する。
 *
 * @return active Sessionの0-based移動元論理列位置。idleの場合はnull。
 */
export const getColumnDndSourceColumnIndex = (): number | null => {
	const state = columnDndStore.getState();
	let sourceColumnIndex: number | null = null;

	if ( state.phase === 'active' ) {
		sourceColumnIndex = state.session.sourceColumnIndex;
	}

	return sourceColumnIndex;
};

/**
 * Reorder Presentationが現在の有効な挿入位置を追従するため、現在の移動先境界を取得する。
 *
 * @return 実際に列順を変更できる現在の0-based移動先境界。idleまたは有効な移動先がない場合はnull。
 */
export const getColumnDndDestinationBoundaryIndex = (): number | null => {
	const state = columnDndStore.getState();
	let destinationBoundaryIndex: number | null = null;

	if ( state.phase === 'active' ) {
		destinationBoundaryIndex = state.session.destinationBoundaryIndex;
	}

	return destinationBoundaryIndex;
};

/**
 * Reorder Presentationが列DnD異常終了通知を一回性イベントとして受け取るために利用する。
 *
 * 通知表示そのものの状態や終了理由は公開せず、通知対象となる終了が発生したことだけを伝える。
 *
 * @param listener 通知対象のDnD終了時に呼び出す通知先。
 * @return 購読を解除する関数。
 */
export const subscribeColumnDndTerminationNotice = (
	listener: ColumnDndTerminationNoticeListener
): ( () => void ) => {
	columnDndTerminationNoticeListeners.add( listener );

	const unsubscribe = (): void => {
		columnDndTerminationNoticeListeners.delete( listener );
	};

	return unsubscribe;
};

/**
 * DnD Engine Lifecycleから利用する列専用DnD Interactionの内部仕様。
 *
 * Store自体や状態置換手段は公開せず、解決済みTargetから始まるSession Lifecycleの操作だけを公開する。
 * completeとcancelでは、終了対象SessionのTable IdentityをStore操作前に退避し、Session終了後にそのTableの継続可否だけをReorder Modeへ通知する。
 */
export const columnDndInteraction: ColumnDndStoreActions = {
	start: ( target, initialConstraints ) =>
		columnDndStore.getState().start( target, initialConstraints ),
	updateDestination: ( destinationBoundaryIndex ) =>
		columnDndStore.getState().updateDestination( destinationBoundaryIndex ),
	complete: () => {
		const state = columnDndStore.getState();

		/* completeのLifecycle違反はStore所有の境界で判定させ、終了後解決に存在しないSessionを使用しない。 */
		if ( state.phase !== 'active' ) {
			columnDndStore.getState().complete();
			return;
		}

		const tableIdentity = state.session.tableIdentity;
		columnDndStore.getState().complete();
		resolveReorderModeAfterDnd( tableIdentity );
	},
	cancel: () => {
		const state = columnDndStore.getState();

		/* active DnDの終了経路だけをReorder ModeのDnD終了後Lifecycleへ接続し、idle時の後処理を発生させない。 */
		if ( state.phase !== 'active' ) {
			columnDndStore.getState().cancel();
			return;
		}

		const tableIdentity = state.session.tableIdentity;
		columnDndStore.getState().cancel();
		resolveReorderModeAfterDnd( tableIdentity );
	},
};