/**
 * 行専用DnD Interactionとして、DnD Engineの物理的なDnD進行をRow Reorderの意味状態へ変換する。
 *
 * DnD開始前の開始可否判定、activeな行DnD Session、移動先更新、確定、cancelのLifecycleを所有する。
 * 開始可否判定で確認した行制約はprepareStartの戻り値としてstartへ引き継ぎ、Session開始時に外部Table構造を取得し直さない。
 * active Sessionだけを共有状態として保持し、DnD Engine固有の物理状態やSession開始前の候補を状態として複製しない。
 * DnD終了後はSessionと一時状態を破棄してから対象Tableの現在行制約を取得し直し、Reorder Modeへ継続可否だけを通知する。
 * Reorder PresentationへはStoreを公開せず、表示に必要な意味状態を用途別のHookと一回性イベントで公開する。
 */

import { useStore } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { rowReorderMode } from '@/reorder/reorder-mode';

import { rowTableIntegration } from './table-integration';
import type { RowReorderConstraints } from './table-integration';

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
	/** Session開始時の行制約に対して現在有効な0-based移動先境界。有効な移動先がない場合はnull。 */
	destinationBoundaryIndex: number | null;
	/** 開始可否判定時に確認し、Session開始時の判定基準として固定した行制約。 */
	initialConstraints: RowReorderConstraints;
};

/** DnD開始可否判定の対象となる行を表す。 */
export type RowDndSource = {
	/** 行DnDを開始しようとしているTable個体を識別する値。 */
	tableIdentity: string;
	/** DnD開始候補となるtbody内の0-based行位置。 */
	sourceRowIndex: number;
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
	 * 物理的なDnD開始前に、現在のTable構造で移動対象が開始可能か判定する。
	 *
	 * @param source 開始を試行するTableと移動対象行。
	 * @return 開始可能な場合は開始可否判定時に確認した行制約。開始不能な場合はnull。
	 */
	prepareStart: ( source: RowDndSource ) => RowReorderConstraints | null;
	/**
	 * 物理的なDnD開始成立後に、開始対象とprepareStartで確認済みの行制約を引き継いでactive Sessionを開始する。
	 *
	 * @param source             prepareStartで開始可能と判定されたTableと移動対象行。
	 * @param initialConstraints prepareStartで確認した行制約。
	 */
	start: ( source: RowDndSource, initialConstraints: RowReorderConstraints ) => void;
	/**
	 * DnD Engine側で解決済みの移動先境界を、Session開始時の行制約へ照合して現在の有効移動先へ反映する。
	 *
	 * @param destinationBoundaryIndex 現在の0-based移動先境界。有効な候補がない場合はnull。
	 */
	updateDestination: ( destinationBoundaryIndex: number | null ) => void;
	/** active Sessionの最終移動先を現在のTable構造へ再照合し、成立する行移動だけを確定してSessionを終了する。 */
	complete: () => void;
	/** Tableを更新せずactive Sessionを終了する。 */
	cancel: () => void;
};

/** DnD Interactionが所有する意味状態とLifecycle操作をまとめたStore境界。 */
type RowDndStore = RowDndStoreState & RowDndStoreActions;

/** Reorder PresentationがDnD異常終了通知を受け取るための購読listener。 */
type RowDndTerminationNoticeListener = () => void;

/** Reorder PresentationがDnD開始拒否通知を受け取るための購読listener。 */
type RowDndStartRejectionNoticeListener = () => void;

/**
 * DnD Interactionが発行する一回性の異常終了通知を現在購読しているReorder Presentationを保持する。
 *
 * 通知はRow DnD Sessionの状態ではないため、Zustand storeへ複製しない。
 */
const rowDndTerminationNoticeListeners = new Set< RowDndTerminationNoticeListener >();

/**
 * DnD Interactionが発行する一回性の開始拒否通知を現在購読しているReorder Presentationを保持する。
 *
 * 通知はRow DnD Sessionの状態ではないため、Zustand storeへ複製しない。
 */
const rowDndStartRejectionNoticeListeners = new Set< RowDndStartRejectionNoticeListener >();

/**
 * activeな行DnDを安全に継続または確定できず終了したことをReorder Presentationへ通知する。
 */
const emitRowDndTerminationNotice = (): void => {
	/* 通知対象の終了を現在購読中のPresentationへ同じ一回性イベントとして伝える。 */
	rowDndTerminationNoticeListeners.forEach( ( listener ) => {
		listener();
	} );
};

/**
 * Designで定義された移動不可理由により行DnD開始を拒否したことをReorder Presentationへ通知する。
 */
const emitRowDndStartRejectionNotice = (): void => {
	/* 通知対象の開始拒否を現在購読中のPresentationへ同じ一回性イベントとして伝える。 */
	rowDndStartRejectionNoticeListeners.forEach( ( listener ) => {
		listener();
	} );
};

/**
 * DnD終了後のSession対象Tableが、次の行並び替え操作を安全に受けられるかReorder Modeへ通知する。
 *
 * complete途中で取得した行制約やSession開始時制約は流用せず、DnD Interactionの一時状態を終了した後に
 * Table Integrationから現在の行制約を取得し直す。今回の移動元・移動先・終了種別ではなく、対象Table自体の継続可否だけを判定する。
 *
 * @param tableIdentity 終了した行DnD Sessionの対象Table Identity。
 */
const resolveReorderModeAfterDnd = ( tableIdentity: string ): void => {
	const currentConstraints = rowTableIntegration.getConstraints( tableIdentity );
	const canContinue = currentConstraints !== null;

	rowReorderMode.resolveAfterDnd( tableIdentity, canContinue );
};

/**
 * 移動対象行が指定された行制約のtbody内に実在するか判定する。
 *
 * @param sourceRowIndex 移動対象の0-based行位置。
 * @param constraints    判定基準とする行制約。
 * @return tbody内の実在行として扱える場合はtrue。
 */
const isSourceInRange = ( sourceRowIndex: number, constraints: RowReorderConstraints ): boolean => {
	const sourceInRange =
		Number.isInteger( sourceRowIndex ) &&
		sourceRowIndex >= 0 &&
		sourceRowIndex < constraints.rowCount;
	return sourceInRange;
};

/**
 * 移動対象行がrowspan等による結合範囲のため行単位で移動できないか判定する。
 *
 * @param sourceRowIndex 移動対象の0-based行位置。
 * @param constraints    判定基準とする行制約。
 * @return 移動対象行の直前または直後が分断不可境界の場合はtrue。
 */
const isSourceBlockedByMergedRange = (
	sourceRowIndex: number,
	constraints: RowReorderConstraints
): boolean => {
	const sourceBlockedByMergedRange =
		constraints.blockedBoundaries.includes( sourceRowIndex ) ||
		constraints.blockedBoundaries.includes( sourceRowIndex + 1 );
	return sourceBlockedByMergedRange;
};

/**
 * 移動対象行が指定された行制約に対して行単位で移動可能か判定する。
 *
 * 移動対象行の直前または直後がrowspan等による分断不可境界の場合、その行だけを独立して移動するとTable構造を保持できないため開始対象にしない。
 *
 * @param sourceRowIndex 移動対象の0-based行位置。
 * @param constraints    判定基準とする行制約。
 * @return 行単位の移動でTable構造を保持できる場合はtrue。
 */
const isSourceMovable = ( sourceRowIndex: number, constraints: RowReorderConstraints ): boolean => {
	const sourceInRange = isSourceInRange( sourceRowIndex, constraints );

	/* tbody内の実在行として扱えない位置は、行DnDの移動対象として成立させない。 */
	if ( ! sourceInRange ) {
		return false;
	}

	const sourceBlockedByMergedRange = isSourceBlockedByMergedRange( sourceRowIndex, constraints );
	const sourceMovable = ! sourceBlockedByMergedRange;
	return sourceMovable;
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
 * 移動元行と移動先境界の組み合わせで実際に行順が変化するか判定する。
 *
 * 移動元行自身の直前または直後への挿入は、削除後の挿入位置が元の位置と一致するため更新対象にしない。
 *
 * @param sourceRowIndex           移動元の0-based行位置。
 * @param destinationBoundaryIndex 移動前のtbodyを基準とする0-based移動先境界。
 * @return 行順が変化する場合はtrue。
 */
const changesRowOrder = ( sourceRowIndex: number, destinationBoundaryIndex: number ): boolean => {
	const destinationBeforeSource = destinationBoundaryIndex === sourceRowIndex;
	const destinationAfterSource = destinationBoundaryIndex === sourceRowIndex + 1;
	const rowOrderChanges = ! destinationBeforeSource && ! destinationAfterSource;
	return rowOrderChanges;
};

/**
 * 行DnD SessionとLifecycleを所有するStore。
 *
 * active Sessionだけを共有状態として保持し、物理的なDnD成立前に確認した行制約はStoreへ保存しない。
 * 状態変更はStore所有の操作だけから行い、DnD Interaction外部へ状態置換手段を公開しない。
 */
const rowDndStore = createStore< RowDndStore >()(
	devtools(
		( set, get ) => ( {
			phase: 'idle',
			session: null,

			prepareStart: ( source ) => {
				const state = get();

				/* active Session中に別の開始試行を受理すると、一度に1つだけのSessionというLifecycleを壊すため禁止する。 */
				if ( state.phase === 'active' ) {
					throw new Error( 'Row DnD start preparation requires an idle session.' );
				}

				const initialConstraints = rowTableIntegration.getConstraints( source.tableIdentity );

				/* 現在のTable構造を取得できない場合は、利用者向けの移動不可理由を伴わない通常の開始不能結果とする。 */
				if ( initialConstraints === null ) {
					return null;
				}

				const sourceInRange = isSourceInRange( source.sourceRowIndex, initialConstraints );

				/* tbody内の実在行として扱えない開始候補は、Design上の移動不可理由とは区別して開始不能とする。 */
				if ( ! sourceInRange ) {
					return null;
				}

				const sourceBlockedByMergedRange = isSourceBlockedByMergedRange(
					source.sourceRowIndex,
					initialConstraints
				);

				/* 結合範囲のため行単位で移動できない開始候補だけを、Designで定義された開始拒否通知の対象とする。 */
				if ( sourceBlockedByMergedRange ) {
					emitRowDndStartRejectionNotice();
					return null;
				}

				return initialConstraints;
			},

			start: ( source, initialConstraints ) => {
				const state = get();

				/* active Sessionを新しいSessionで置き換えることは禁止し、1回の物理DnDと1つのSessionを対応させる。 */
				if ( state.phase === 'active' ) {
					throw new Error( 'Row DnD start requires an idle session.' );
				}

				const session: RowDndSession = {
					tableIdentity: source.tableIdentity,
					sourceRowIndex: source.sourceRowIndex,
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

				/* Session開始時の行制約に対して現在も利用できる候補だけを有効移動先として保持する。 */
				if (
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

			complete: () => {
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
						return;
					}

					const currentConstraints = rowTableIntegration.getConstraints( session.tableIdentity );

					/* complete時点の現在構造で移動元または移動先が成立しない場合は、安全に確定できない終了として利用者へ通知する。 */
					if (
						currentConstraints === null ||
						! isSourceMovable( session.sourceRowIndex, currentConstraints ) ||
						! isDestinationValid( session.destinationBoundaryIndex, currentConstraints )
					) {
						shouldNotifyTermination = true;
						return;
					}

					/* 移動元の直前または直後へのdropは行順を変えないため、Table更新を発生させない。 */
					if ( ! changesRowOrder( session.sourceRowIndex, session.destinationBoundaryIndex ) ) {
						return;
					}

					rowTableIntegration.applyRowMove( {
						clientId: session.tableIdentity,
						sourceRowIndex: session.sourceRowIndex,
						destinationBoundaryIndex: session.destinationBoundaryIndex,
					} );
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
 * Reorder Presentationが行DnD中の表示開始・終了を追従するために利用する。
 *
 * DnD Interactionが所有する状態のうちphaseだけを購読し、Session内部状態やActionは公開しない。
 *
 * @return 現在の行DnD Lifecycle状態。
 */
export const useRowDndPhase = (): RowDndStoreState[ 'phase' ] =>
	useStore( rowDndStore, ( state ) => state.phase );

/**
 * Reorder Presentationが現在の有効な挿入位置を追従するために利用する。
 *
 * active SessionのdestinationBoundaryIndexだけを購読し、idleまたは有効な移動先がない場合はnullを返す。
 * Session全体を公開せず、移動先変更と無関係な内部状態の変化でPresentationを更新しない。
 *
 * @return 現在の有効な0-based移動先境界。有効な移動先がない場合はnull。
 */
export const useRowDndDestinationBoundaryIndex = (): number | null =>
	useStore( rowDndStore, ( state ) => {
		let destinationBoundaryIndex: number | null = null;

		if ( state.phase === 'active' ) {
			destinationBoundaryIndex = state.session.destinationBoundaryIndex;
		}

		return destinationBoundaryIndex;
	} );

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
 * Reorder PresentationがDnD開始拒否通知を一回性イベントとして受け取るために利用する。
 *
 * 通知表示そのものの状態や開始不能理由の内部分類は公開せず、Designで定義された移動不可理由による開始拒否だけを伝える。
 *
 * @param listener 通知対象のDnD開始拒否時に呼び出す購読listener。
 * @return 購読を解除する関数。
 */
export const subscribeRowDndStartRejectionNotice = (
	listener: RowDndStartRejectionNoticeListener
): ( () => void ) => {
	rowDndStartRejectionNoticeListeners.add( listener );

	const unsubscribe = (): void => {
		rowDndStartRejectionNoticeListeners.delete( listener );
	};

	return unsubscribe;
};

/**
 * DnD Engine Lifecycleから利用する行専用DnD Interactionの内部仕様。
 *
 * Store自体や状態置換手段は公開せず、開始判定で確認した行制約の受け渡しとSession Lifecycleの操作だけを公開する。
 * DnD EngineやPresentationは、この境界を通してもSession全体またはStore内部を直接所有しない。
 * completeとcancelでは終了対象Sessionを保持したままStore操作を完了し、その後に現在Tableの継続可否だけをReorder Modeへ通知する。
 */
export const rowDndInteraction: RowDndStoreActions = {
	prepareStart: ( source ) => rowDndStore.getState().prepareStart( source ),
	start: ( source, initialConstraints ) =>
		rowDndStore.getState().start( source, initialConstraints ),
	updateDestination: ( destinationBoundaryIndex ) =>
		rowDndStore.getState().updateDestination( destinationBoundaryIndex ),
	complete: () => {
		const state = rowDndStore.getState();

		/* completeのLifecycle違反はStore所有の境界で判定させ、終了後解決に存在しないSessionを使用しない。 */
		if ( state.phase !== 'active' ) {
			rowDndStore.getState().complete();
			return;
		}

		const tableIdentity = state.session.tableIdentity;
		rowDndStore.getState().complete();
		resolveReorderModeAfterDnd( tableIdentity );
	},
	cancel: () => {
		const state = rowDndStore.getState();

		/* active DnDの終了経路だけをReorder ModeのDnD終了後Lifecycleへ接続する。 */
		if ( state.phase !== 'active' ) {
			rowDndStore.getState().cancel();
			return;
		}

		const tableIdentity = state.session.tableIdentity;
		rowDndStore.getState().cancel();
		resolveReorderModeAfterDnd( tableIdentity );
	},
};
