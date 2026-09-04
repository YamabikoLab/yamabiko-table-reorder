/**
 * 行専用DnD Interactionとして、DnD Engineの物理的なDnD進行をRow Reorderの意味状態へ変換する。
 *
 * DnD開始前の開始可否判定、activeな行DnD Session、移動先更新、確定、cancelのLifecycleを所有する。
 * 開始可否判定で確認した行制約はprepareStartの戻り値としてstartへ引き継ぎ、Session開始時に外部Table構造を取得し直さない。
 * active Sessionだけを共有状態として保持し、DnD Engine固有の物理状態やSession開始前の候補を状態として複製しない。
 * Row Reorder内部のErrorはoperation boundaryで共通failure recoveryへ合流させ、SessionとDnD Interaction所有の一時状態を安全に破棄してidleへ戻す。
 * DnD終了後はSessionと一時状態を破棄してから対象Tableの現在行制約を取得し直し、Reorder Modeへ継続可否だけを通知する。
 * DnD Interaction外部へStoreを公開せず、Reorder PresentationやAuto Scrollに必要な状態をReact非依存の購読境界と一回性イベントで公開する。
 */

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

/** completeが正常経路で終了したとき、利用者向け異常終了通知が必要かを表す。 */
type RowDndCompleteResult = Readonly< {
	/** 外部環境変化等により今回のDnDを安全に確定できず終了した場合はtrue。 */
	shouldNotifyTermination: boolean;
} >;

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
	/**
	 * active Sessionの最終移動先を現在のTable構造へ再照合し、成立する行移動だけを確定してSessionを終了する。
	 *
	 * @return 正常な終了経路のうち、利用者向け異常終了通知が必要かを表す結果。
	 */
	complete: () => RowDndCompleteResult;
	/** Tableを更新せずactive Sessionを終了する。 */
	cancel: () => void;
};

/** 共通failure recoveryだけが利用するStore内部操作を表す。 */
type RowDndStoreRecoveryActions = {
	/** DnD Interactionが所有するSessionを無条件に破棄し、安全なidleへ戻す。 */
	recoverToIdle: () => void;
};

/** DnD Interactionが所有する意味状態とLifecycle操作をまとめたStore境界。 */
type RowDndStore = RowDndStoreState & RowDndStoreActions & RowDndStoreRecoveryActions;

/**
 * DnD Interactionがoperation boundaryで識別する行DnD操作を表す。
 *
 * Architecture上のprogressは、実装上では現在の移動先を更新するupdateDestinationとして扱う。
 */
export type RowDndOperation =
	| 'prepareStart'
	| 'start'
	| 'updateDestination'
	| 'complete'
	| 'cancel';

/**
 * Session成立前等、Storeだけでは終了対象Tableを復元できないfailureでoperation boundaryから渡す短命な回復情報。
 */
export type RowDndFailureRecoveryContext = Readonly< {
	/** cleanup後のReorder Mode継続可否判断に使用する終了対象Table Identity。 */
	tableIdentity?: string;
} >;

/**
 * DnD Engine接続インスタンスが所有する一時状態を、共通failure recoveryから破棄するための内部仕様。
 *
 * Input Interactionが所有するDraggableや入力一時状態は対象に含めない。
 */
export type RowDndFailureRecoveryHooks = Readonly< {
	/** DnD開始成立前に残っている開始準備値を破棄する。 */
	discardPreparedStart: () => void;
	/** activeな物理DnDが残っている場合だけDnD Engine側の操作をcancelする。 */
	cancelActiveDnd: () => void;
	/** DnD Interactionが所有するDroppable等の一時登録を破棄する。 */
	discardTemporaryDndState: () => void;
} >;

/** DnD Engine Lifecycleから利用する行専用DnD Interactionの操作内部仕様。 */
export type RowDndInteraction = {
	/**
	 * 物理DnD開始成立前に開始可否を判定する。
	 *
	 * @param source 開始を試行するTableと移動対象行。
	 * @return 開始可能な場合は開始時制約。開始不能または内部Errorから回復した場合はnull。
	 */
	prepareStart: ( source: RowDndSource ) => RowReorderConstraints | null;
	/**
	 * 物理DnD開始成立後にactive Sessionを開始する。
	 *
	 * @param source             開始対象Tableと移動対象行。
	 * @param initialConstraints prepareStartで確認した開始時制約。
	 */
	start: ( source: RowDndSource, initialConstraints: RowReorderConstraints ) => void;
	/**
	 * 現在の移動先境界をactive Sessionへ反映する。
	 *
	 * @param destinationBoundaryIndex 現在の0-based移動先境界。有効な候補がない場合はnull。
	 */
	updateDestination: ( destinationBoundaryIndex: number | null ) => void;
	/** active Sessionを現在Tableへ再照合し、成立する行移動だけを確定して終了する。 */
	complete: () => void;
	/** Tableを更新せずactive Sessionを終了する。 */
	cancel: () => void;
};

/**
 * DnD Engine接続インスタンスごとの共通failure recoveryとoperation boundaryを表す。
 *
 * recovery中の一時状態はこの境界を生成した接続インスタンスのクロージャだけで保持し、Zustand StateやRow DnD Sessionへ追加しない。
 */
export type RowDndOperationBoundary = RowDndInteraction & {
	/**
	 * operation boundaryへErrorを伝播できないexecution boundaryから、同じ共通failure recoveryへ合流させる。
	 *
	 * @param operation Errorが発生した行DnD操作。
	 * @param error     捕捉した元のError情報。
	 * @param context   Sessionから復元できない終了対象Table等の短命な回復情報。
	 */
	recoverFailure: (
		operation: RowDndOperation,
		error: unknown,
		context?: RowDndFailureRecoveryContext
	) => void;
	/**
	 * DnD Engine終了callback等が共通failure recoveryへ再入しないため、現在の回復中状態を確認する。
	 *
	 * @return この接続インスタンスが共通failure recovery中の場合はtrue。
	 */
	isRecovering: () => boolean;
};

/** DnD Interactionの共有状態変更をReact非依存で受け取る購読listener。 */
type RowDndStateListener = () => void;

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

/** activeな行DnDを安全に継続または確定できず終了したことをReorder Presentationへ通知する。 */
const emitRowDndTerminationNotice = (): void => {
	/* 通知対象の終了を現在購読中のPresentationへ同じ一回性イベントとして伝える。 */
	rowDndTerminationNoticeListeners.forEach( ( listener ) => {
		listener();
	} );
};

/** Designで定義された移動不可理由により行DnD開始を拒否したことをReorder Presentationへ通知する。 */
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
 * 共通failure recovery中に、終了対象Tableの現在状態からReorder Mode継続可否を安全側へ解決する。
 *
 * 現在行制約の再取得自体が失敗した場合は継続可能と判断せず、元のfailure chainへ追加Errorを再拡散しない。
 *
 * @param tableIdentity failureで終了した行DnDの対象Table Identity。
 */
const resolveReorderModeAfterFailure = ( tableIdentity: string ): void => {
	let canContinue = false;

	try {
		const currentConstraints = rowTableIntegration.getConstraints( tableIdentity );
		canContinue = currentConstraints !== null;
	} catch {
		/* 回復中の再取得失敗は継続不能として扱い、元のfailureに対する記録を増やさない。 */
	}

	try {
		rowReorderMode.resolveAfterDnd( tableIdentity, canContinue );
	} catch {
		/* 回復処理自体のErrorをEditor全体へ再拡散せず、safe idleを最優先する。 */
	}
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
						return { shouldNotifyTermination };
					}

					const currentConstraints = rowTableIntegration.getConstraints( session.tableIdentity );

					/* complete時点の現在構造で移動元または移動先が成立しない場合は、安全に確定できない終了として利用者へ通知する。 */
					if (
						currentConstraints === null ||
						! isSourceMovable( session.sourceRowIndex, currentConstraints ) ||
						! isDestinationValid( session.destinationBoundaryIndex, currentConstraints )
					) {
						shouldNotifyTermination = true;
						return { shouldNotifyTermination };
					}

					/* 移動元の直前または直後へのdropは行順を変えないため、Table更新を発生させない。 */
					if ( ! changesRowOrder( session.sourceRowIndex, session.destinationBoundaryIndex ) ) {
						return { shouldNotifyTermination };
					}

					rowTableIntegration.applyRowMove( {
						clientId: session.tableIdentity,
						sourceRowIndex: session.sourceRowIndex,
						destinationBoundaryIndex: session.destinationBoundaryIndex,
					} );
					return { shouldNotifyTermination };
				} finally {
					set(
						{
							phase: 'idle',
							session: null,
						},
						undefined,
						'row-dnd/complete'
					);
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

			recoverToIdle: () => {
				set(
					{
						phase: 'idle',
						session: null,
					},
					undefined,
					'row-dnd/failure-recovery'
				);
			},
		} ),
		{
			name: 'Yamabiko Table Reorder / Row DnD',
		}
	)
);

/**
 * 現在activeなSessionが所有するTable Identityを、共通failure recovery用の短命な値として取得する。
 *
 * @return active SessionのTable Identity。Sessionが存在しない場合はundefined。
 */
const getActiveTableIdentity = (): string | undefined => {
	const state = rowDndStore.getState();
	let tableIdentity: string | undefined;

	if ( state.phase === 'active' ) {
		tableIdentity = state.session.tableIdentity;
	}

	return tableIdentity;
};

/**
 * 共通failure recovery中の追加Errorを外側へ再拡散せず、後続cleanupを継続する。
 *
 * @param recoveryStep safe idleへ戻すために試行する1つの回復処理。
 */
const attemptRecoveryStep = ( recoveryStep: () => void ): void => {
	try {
		recoveryStep();
	} catch {
		/* 元のfailureを1回だけ記録し、回復処理中の追加Errorではcleanupを中断しない。 */
	}
};

/** 共通failure recoveryを必要としない接続境界で使用する空の一時状態cleanup。 */
const defaultFailureRecoveryHooks: RowDndFailureRecoveryHooks = {
	discardPreparedStart: () => undefined,
	cancelActiveDnd: () => undefined,
	discardTemporaryDndState: () => undefined,
};

/**
 * DnD Engine接続インスタンスごとに、行DnD operation boundaryと共通failure recoveryを生成する。
 *
 * 各operation内の予期しないErrorはこの境界で捕捉し、同じ共通failure recoveryへ合流させる。
 * DnD Engine callback等のexecution boundaryで別のErrorを捕捉した場合もrecoverFailure()へ渡すことで同じcleanup順序を使用できる。
 * recovery中に物理DnDのcancelから終了callbackが同期的に再入しても、この接続インスタンス内の短命な回復中状態によって二重cleanup・二重log・二重通知を防ぐ。
 *
 * @param recoveryHooks DnD Engine接続インスタンスが所有する開始準備値・物理DnD・一時登録を破棄する操作。
 * @return 共通failure recoveryへ接続済みの行DnD operation boundary。
 */
export const createRowDndOperationBoundary = (
	recoveryHooks: RowDndFailureRecoveryHooks
): RowDndOperationBoundary => {
	let recovering = false;

	const recoverFailure = (
		operation: RowDndOperation,
		error: unknown,
		context: RowDndFailureRecoveryContext = {}
	): void => {
		/* recoveryから発生したDnD Engine終了callback等は、同じfailure chainの回復へ再入させない。 */
		if ( recovering ) {
			return;
		}

		recovering = true;
		const tableIdentity = context.tableIdentity ?? getActiveTableIdentity();

		try {
			/* Error記録は共通failure recoveryだけが所有し、元のoperationとError情報を1回のlogへまとめる。 */
			attemptRecoveryStep( () => {
				console.error( `[Yamabiko Table Reorder] Row DnD ${ operation } failed.`, error );
			} );

			attemptRecoveryStep( recoveryHooks.discardPreparedStart );
			attemptRecoveryStep( recoveryHooks.cancelActiveDnd );
			attemptRecoveryStep( recoveryHooks.discardTemporaryDndState );
			attemptRecoveryStep( () => rowDndStore.getState().recoverToIdle() );

			/* 物理DnD開始成立前のprepareStart failureは、DnD異常終了通知とDnD終了後Lifecycleの対象にしない。 */
			if ( operation === 'prepareStart' ) {
				return;
			}

			attemptRecoveryStep( emitRowDndTerminationNotice );

			/* Session成立前のstart failureを含め、終了対象Tableを保持できた場合だけ現在状態からReorder Mode継続可否を解決する。 */
			if ( tableIdentity !== undefined ) {
				resolveReorderModeAfterFailure( tableIdentity );
			}
		} finally {
			recovering = false;
		}
	};

	return {
		prepareStart: ( source ) => {
			/* recovery中に開始前Lifecycleが再入しても、新しいDnD開始を成立させない。 */
			if ( recovering ) {
				return null;
			}

			let tableIdentity: string | undefined;

			try {
				tableIdentity = source.tableIdentity;
				return rowDndStore.getState().prepareStart( source );
			} catch ( error ) {
				recoverFailure( 'prepareStart', error, { tableIdentity } );
				return null;
			}
		},
		start: ( source, initialConstraints ) => {
			/* recoveryから発生したDnD Engine callbackでは、新しいSession操作を実行しない。 */
			if ( recovering ) {
				return;
			}

			let tableIdentity: string | undefined;

			try {
				tableIdentity = source.tableIdentity;
				rowDndStore.getState().start( source, initialConstraints );
			} catch ( error ) {
				recoverFailure( 'start', error, { tableIdentity } );
			}
		},
		updateDestination: ( destinationBoundaryIndex ) => {
			/* recovery中のDnD Engine進行callbackは、終了中のSessionへ新しい移動先を反映しない。 */
			if ( recovering ) {
				return;
			}

			const tableIdentity = getActiveTableIdentity();

			try {
				rowDndStore.getState().updateDestination( destinationBoundaryIndex );
			} catch ( error ) {
				recoverFailure( 'updateDestination', error, { tableIdentity } );
			}
		},
		complete: () => {
			/* recoveryから発生した終了callbackでは、確定処理と二重cleanupを開始しない。 */
			if ( recovering ) {
				return;
			}

			const tableIdentity = getActiveTableIdentity();

			try {
				const completeResult = rowDndStore.getState().complete();

				/* active DnD終了後だけ、破棄済みSessionの対象Tableについて現在状態からReorder Mode継続可否を解決する。 */
				if ( tableIdentity !== undefined ) {
					resolveReorderModeAfterDnd( tableIdentity );
				}

				/* 正常な外部環境変化による確定不能は内部Errorとせず、Session終了後に既存の異常終了通知だけを発行する。 */
				if ( completeResult.shouldNotifyTermination ) {
					emitRowDndTerminationNotice();
				}
			} catch ( error ) {
				recoverFailure( 'complete', error, { tableIdentity } );
			}
		},
		cancel: () => {
			/* recoveryから発生したcancel callbackでは、通常cancel Lifecycleへ再入しない。 */
			if ( recovering ) {
				return;
			}

			const tableIdentity = getActiveTableIdentity();

			try {
				rowDndStore.getState().cancel();

				/* 通常cancelでもactive DnD終了後の対象Tableだけを現在状態から再判定し、異常終了通知は発行しない。 */
				if ( tableIdentity !== undefined ) {
					resolveReorderModeAfterDnd( tableIdentity );
				}
			} catch ( error ) {
				recoverFailure( 'cancel', error, { tableIdentity } );
			}
		},
		recoverFailure,
		isRecovering: () => recovering,
	};
};

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
 * Auto Scrollが行DnD中だけ自動スクロール許可状態を有効にするため、現在のactive状態を取得する。
 *
 * @return 行DnD Sessionがactiveな場合はtrue。それ以外はfalse。
 */
export const getRowDndActive = (): boolean => {
	const active = rowDndStore.getState().phase === 'active';
	return active;
};

/**
 * Reorder Presentationが現在の有効な挿入位置を追従するため、現在の移動先境界を取得する。
 *
 * @return 現在の有効な0-based移動先境界。idleまたは有効な移動先がない場合はnull。
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
 * DnD Engine Lifecycleから利用する行専用DnD Interactionの既定operation boundary。
 *
 * 現在はDnD Engine接続固有の一時状態を持たないため空のcleanupを使用する。
 * #765のDnD Engine接続ではcreateRowDndOperationBoundary()から接続インスタンス専用のboundaryを生成し、
 * preparedStart、物理DnD、Droppableのcleanupを同じ共通failure recoveryへ接続する。
 */
export const rowDndInteraction: RowDndInteraction =
	createRowDndOperationBoundary( defaultFailureRecoveryHooks );
