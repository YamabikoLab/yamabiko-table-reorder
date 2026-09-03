/**
 * 行専用DnD Interactionとして、DnD Engineの物理的なDnD進行をRow Reorderの意味状態へ変換する。
 *
 * DnD開始前の開始可否判定、activeな行DnD Session、移動先更新、確定、cancelのLifecycleを所有する。
 * 開始可否判定で確認した行制約はprepareStartの戻り値としてstartへ引き継ぎ、Session開始時に外部Table構造を取得し直さない。
 * active Sessionだけを共有状態として保持し、DnD Engine固有の物理状態やSession開始前の候補を状態として複製しない。
 * Reorder PresentationへはStoreを公開せず、表示に必要な意味状態を用途別のHookと一回性イベントで公開する。
 */

import { useStore } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

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

/** DnD Interactionが所有する意味状態とLifecycle操作をまとめたStore境界。 */
type RowDndStore = RowDndStoreState & RowDndStoreActions;

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

/** Reorder PresentationがDnD異常終了通知を受け取るための購読listener。 */
type RowDndTerminationNoticeListener = () => void;

/**
 * DnD Interactionが発行する一回性の異常終了通知を現在購読しているReorder Presentationを保持する。
 *
 * 通知はRow DnD Sessionの状態ではないため、Zustand storeへ複製しない。
 */
const rowDndTerminationNoticeListeners = new Set< RowDndTerminationNoticeListener >();

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
 * 移動対象行が指定された行制約に対して行単位で移動可能か判定する。
 *
 * 移動対象行の直前または直後がrowspan等による分断不可境界の場合、その行だけを独立して移動するとTable構造を保持できないため開始対象にしない。
 *
 * @param sourceRowIndex 移動対象の0-based行位置。
 * @param constraints    判定基準とする行制約。
 * @return 行単位の移動でTable構造を保持できる場合はtrue。
 */
const isSourceMovable = ( sourceRowIndex: number, constraints: RowReorderConstraints ): boolean => {
	const sourceInRange =
		Number.isInteger( sourceRowIndex ) &&
		sourceRowIndex >= 0 &&
		sourceRowIndex < constraints.rowCount;

	/* tbody内の実在行として扱えない位置は、行DnDの移動対象として成立させない。 */
	if ( ! sourceInRange ) {
		return false;
	}

	const sourceCrossesBlockedBoundary =
		constraints.blockedBoundaries.includes( sourceRowIndex ) ||
		constraints.blockedBoundaries.includes( sourceRowIndex + 1 );
	const sourceMovable = ! sourceCrossesBlockedBoundary;
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

				/* 現在のTable構造を取得できない場合、または行単位で安全に移動できない場合は、通常の開始不能結果とする。 */
				if (
					initialConstraints === null ||
					! isSourceMovable( source.sourceRowIndex, initialConstraints )
				) {
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
 * DnD Engine Lifecycleから利用する行専用DnD Interactionの内部仕様。
 *
 * Store自体や状態置換手段は公開せず、開始判定で確認した行制約の受け渡しとSession Lifecycleの操作だけを公開する。
 * DnD EngineやPresentationは、この境界を通してもSession全体またはStore内部を直接所有しない。
 */
export const rowDndInteraction: RowDndStoreActions = {
	prepareStart: ( source ) => rowDndStore.getState().prepareStart( source ),
	start: ( source, initialConstraints ) =>
		rowDndStore.getState().start( source, initialConstraints ),
	updateDestination: ( destinationBoundaryIndex ) =>
		rowDndStore.getState().updateDestination( destinationBoundaryIndex ),
	complete: () => rowDndStore.getState().complete(),
	cancel: () => rowDndStore.getState().cancel(),
};
