/**
 * 通常編集、行並び替え、列並び替えの排他状態と、その並び替えモードが有効なTableを所有する。
 *
 * ReactやWordPressには依存せず、Tableツールバーの再生成とは独立した状態境界として、
 * モード選択、Table単位のライフサイクル、通常編集との排他、および状態変更の購読を提供する。
 */

/** 行または列の並び替えモードを表す。 */
export type ReorderKind = 'row' | 'column';

/** 並び替えモードを現在のTableへ関連付ける最小限のTable Identityを表す。 */
type ReorderTableIdentity = string;

/**
 * Reorder Modeが保持できる有効状態を表す。
 *
 * 並び替えモードでは必ず対象Tableを所有し、対象Tableを持たない行・列並び替え状態を作らない。
 */
type ReorderModeState =
	| { kind: 'edit' }
	| {
			kind: ReorderKind;
			tableIdentity: ReorderTableIdentity;
	  };

/**
 * Row Reorderへ提供するReorder Modeの最小内部仕様を表す。
 *
 * Row ReorderはReorder Mode全体の状態を参照せず、対象Tableで行並び替えが有効かだけを確認する。
 */
type RowReorderMode = {
	/**
	 * 対象Tableで行並び替えが有効か確認する。
	 *
	 * @param tableIdentity 行並び替えの有効状態を確認するTable Identity。
	 * @return 対象Tableで行並び替えが有効な場合はtrue。それ以外はfalse。
	 */
	isActive: ( tableIdentity: ReorderTableIdentity ) => boolean;
};

/**
 * WordPress / React接続が利用するReorder Modeの最小内部仕様を表す。
 *
 * React側はReorder Modeの遷移条件を所有せず、Table操作対象の変化を通知し、表示に必要な状態だけを購読する。
 */
type ReorderModeIntegration = {
	/**
	 * Tableツールバーで選択された並び替え入口を現在状態へ反映する。
	 *
	 * 同じTableで選択中の入口を再選択した場合は通常編集へ戻し、別方向の入口を選択した場合はその方向へ切り替える。
	 *
	 * @param kind          選択された並び替え方向。
	 * @param tableIdentity 入口を所有するTable Identity。
	 */
	select: ( kind: ReorderKind, tableIdentity: ReorderTableIdentity ) => void;
	/**
	 * 現在操作しているTableをReorder Modeへ通知する。
	 *
	 * 選択中の並び替えモードとは別のTableへ操作対象が移った場合だけ通常編集へ戻す。
	 *
	 * @param tableIdentity 現在操作しているTable Identity。
	 */
	observeTable: ( tableIdentity: ReorderTableIdentity ) => void;
	/**
	 * Tableが操作対象から外れたことをReorder Modeへ通知する。
	 *
	 * 通知されたTableが現在の並び替え対象Tableである場合だけ通常編集へ戻し、他のTableからの通知は現在状態へ影響させない。
	 *
	 * @param tableIdentity 操作対象から外れたTable Identity。
	 */
	notifyTableInactive: ( tableIdentity: ReorderTableIdentity ) => void;
	/**
	 * 対象Tableで現在選択されている並び替え方向を取得する。
	 *
	 * @param tableIdentity 選択状態を確認するTable Identity。
	 * @return 対象Tableで選択されている並び替え方向。通常編集または別Tableが対象の場合はnull。
	 */
	getSelectedKind: ( tableIdentity: ReorderTableIdentity ) => ReorderKind | null;
	/**
	 * 対象Tableで通常編集を開始できるか確認する。
	 *
	 * @param tableIdentity 編集可否を確認するTable Identity。
	 * @return 対象Tableが並び替えモード中でなければtrue。対象Tableが並び替えモード中ならfalse。
	 */
	isEditingAllowed: ( tableIdentity: ReorderTableIdentity ) => boolean;
	/**
	 * 状態変更を購読する。
	 *
	 * @param listener Reorder Modeの状態変更後に呼び出す購読者。
	 * @return 購読を解除する関数。
	 */
	subscribe: ( listener: () => void ) => () => void;
};

/**
 * 通常編集から開始するReorder Modeを作成する。
 *
 * `edit`、または`row | column`とそのモードが有効なTable Identityの組だけを状態として保持し、
 * 並び替えモード中にTable Identityが存在しない状態を作らない。
 *
 * @return WordPress / React接続とRow Reorderへ必要最小限の内部仕様を提供するReorder Mode。
 */
const createReorderMode = () => {
	let state: ReorderModeState = { kind: 'edit' };
	const listeners = new Set< () => void >();

	/**
	 * 意味のある状態変更だけを反映し、購読者へ通知する。
	 *
	 * @param nextState 次に有効となるReorder Mode状態。
	 */
	const updateState = ( nextState: ReorderModeState ) => {
		const isSameEditState = state.kind === 'edit' && nextState.kind === 'edit';
		const isSameReorderState =
			state.kind !== 'edit' &&
			nextState.kind !== 'edit' &&
			state.kind === nextState.kind &&
			state.tableIdentity === nextState.tableIdentity;

		/*
		 * Reorder Modeの意味が変わらない更新では、再描画や購読通知を発生させない。
		 */
		if ( isSameEditState || isSameReorderState ) {
			return;
		}

		state = nextState;

		/*
		 * 状態変更を購読するすべての境界へ、同じ状態変更を通知する。
		 */
		listeners.forEach( ( listener ) => listener() );
	};

	const rowReorder: RowReorderMode = {
		isActive: ( tableIdentity ) => {
			const rowReorderActiveForTable =
				state.kind === 'row' && state.tableIdentity === tableIdentity;

			return rowReorderActiveForTable;
		},
	};

	const integration: ReorderModeIntegration = {
		select: ( kind, tableIdentity ) => {
			const isSameSelectedMode = state.kind === kind && state.tableIdentity === tableIdentity;

			/*
			 * 選択中の入口を同じTableでもう一度選択した場合は、並び替えモードを解除する。
			 */
			if ( isSameSelectedMode ) {
				updateState( { kind: 'edit' } );
				return;
			}

			updateState( { kind, tableIdentity } );
		},
		observeTable: ( tableIdentity ) => {
			/*
			 * 通常編集、または同じTableの再観測では、現在のReorder Modeを維持する。
			 */
			if ( state.kind === 'edit' || state.tableIdentity === tableIdentity ) {
				return;
			}

			updateState( { kind: 'edit' } );
		},
		notifyTableInactive: ( tableIdentity ) => {
			/*
			 * 操作対象から外れたTableが現在の並び替え対象Tableである場合だけ、Reorder Modeを終了する。
			 */
			if ( state.kind === 'edit' || state.tableIdentity !== tableIdentity ) {
				return;
			}

			updateState( { kind: 'edit' } );
		},
		getSelectedKind: ( tableIdentity ) => {
			const selectedKind =
				state.kind !== 'edit' && state.tableIdentity === tableIdentity ? state.kind : null;

			return selectedKind;
		},
		isEditingAllowed: ( tableIdentity ) => {
			const isReorderActiveForTable =
				state.kind !== 'edit' && state.tableIdentity === tableIdentity;
			const editingAllowed = ! isReorderActiveForTable;

			return editingAllowed;
		},
		subscribe: ( listener ) => {
			listeners.add( listener );

			return () => {
				listeners.delete( listener );
			};
		},
	};

	return { integration, rowReorder };
};

/**
 * Toolbar接続と後続のRow Reorderが共有するReorder Modeの正本を所有する。
 *
 * 各利用境界へは必要な内部仕様だけを渡し、Reorder Mode全体を共有しない。
 */
const sharedReorderMode = createReorderMode();

/**
 * WordPress / React接続へ提供する共有Reorder Mode内部仕様。
 *
 * Toolbar、Table lifecycle、編集抑止が必要とする状態と操作だけを公開する。
 */
export const reorderModeIntegration = sharedReorderMode.integration;

/**
 * Row Reorderへ提供する共有Reorder Mode内部仕様。
 *
 * Toolbarと同じReorder Mode状態を参照しつつ、対象Tableで行並び替えが有効かだけを公開する。
 */
export const rowReorderMode = sharedReorderMode.rowReorder;
