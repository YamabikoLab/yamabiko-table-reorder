/**
 * 通常編集、行並び替え、列並び替えの排他状態と、その並び替えモードが有効なTableを所有する。
 *
 * ReactやWordPressには依存せず、Tableツールバーの再生成とは独立した状態境界として、
 * モード選択、Table単位のライフサイクル、通常編集との排他、および状態変更の購読を提供する。
 */

/** 行または列の並び替えモードを表す。 */
export type ReorderKind = 'row' | 'column';

/** 並び替えモードを現在のTableへ関連付ける最小限のTable Identityを表す。 */
export type ReorderTableIdentity = string;

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

/** Reorder Modeの状態変更を受け取る購読者を表す。 */
type ReorderModeListener = () => void;

/**
 * Row Reorderへ提供するReorder Modeの最小内部仕様を表す。
 *
 * Row ReorderはReorder Mode全体の状態を参照せず、対象Tableで行並び替えが有効かだけを確認する。
 */
export type RowReorderMode = {
	/**
	 * 対象Tableで行並び替えが有効か確認する。
	 *
	 * @param tableIdentity 行並び替えの有効状態を確認するTable Identity。
	 * @return 対象Tableで行並び替えが有効な場合はtrue。それ以外はfalse。
	 */
	isActive: ( tableIdentity: ReorderTableIdentity ) => boolean;
};

/**
 * Reorder Mode接続境界が利用する状態遷移と購読の内部仕様を表す。
 *
 * Row Reorder向け内部仕様は含めず、WordPress / React接続が必要とする操作だけを公開する。
 */
export type ReorderModeIntegration = {
	/**
	 * Tableツールバーで選択された並び替え入口を現在状態へ反映する。
	 *
	 * 同じTableで選択中の入口を再選択した場合は通常編集へ戻し、別方向の入口を選択した場合はその方向へ切り替える。
	 *
	 * @param kind          選択された並び替え方向。
	 * @param tableIdentity 入口を所有するTable Identity。
	 */
	select: ( kind: ReorderKind, tableIdentity: ReorderTableIdentity ) => void;
	/** Reorder Modeを終了して通常編集へ戻す。 */
	exit: () => void;
	/**
	 * 現在操作しているTableをReorder Modeへ通知する。
	 *
	 * 選択中の並び替えモードとは別のTableへ操作対象が移った場合だけ通常編集へ戻す。
	 *
	 * @param tableIdentity 現在操作しているTable Identity。
	 */
	observeTable: ( tableIdentity: ReorderTableIdentity ) => void;
	/**
	 * 対象Tableで指定方向の入口が選択状態か確認する。
	 *
	 * @param kind          確認する並び替え方向。
	 * @param tableIdentity 確認するTable Identity。
	 * @return 対象Tableで指定方向が選択状態の場合はtrue。それ以外はfalse。
	 */
	isSelected: ( kind: ReorderKind, tableIdentity: ReorderTableIdentity ) => boolean;
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
	subscribe: ( listener: ReorderModeListener ) => () => void;
	/**
	 * React側が状態変更を検知するための現在revisionを取得する。
	 *
	 * @return Reorder Modeの状態が変化した回数を表す現在revision。
	 */
	getRevision: () => number;
};

/**
 * Reorder Modeの状態を共有する接続境界とRow Reorder向け内部仕様を表す。
 *
 * Table内容、行・列構造、DnD Sessionなどの方向固有情報は所有しない。
 */
export type ReorderMode = ReorderModeIntegration & {
	/** Row Reorderへ公開する最小内部仕様。 */
	rowReorder: RowReorderMode;
};

/**
 * 通常編集から開始するReorder Modeを作成する。
 *
 * `edit`、または`row | column`とそのモードが有効なTable Identityの組だけを状態として保持し、
 * 並び替えモード中にTable Identityが存在しない状態を作らない。
 *
 * @return 独立した状態と購読境界を所有するReorder Mode。
 */
export const createReorderMode = (): ReorderMode => {
	let state: ReorderModeState = { kind: 'edit' };
	let revision = 0;
	const listeners = new Set< ReorderModeListener >();

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
		revision += 1;

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

	return {
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
		exit: () => {
			updateState( { kind: 'edit' } );
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
		isSelected: ( kind, tableIdentity ) => {
			const selectedForTable = state.kind === kind && state.tableIdentity === tableIdentity;

			return selectedForTable;
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
		getRevision: () => revision,
		rowReorder,
	};
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
 * Row Reorder向け内部仕様は公開せず、ToolbarとTable lifecycleが必要とする操作だけを提供する。
 */
export const reorderModeIntegration: ReorderModeIntegration = {
	select: sharedReorderMode.select,
	exit: sharedReorderMode.exit,
	observeTable: sharedReorderMode.observeTable,
	isSelected: sharedReorderMode.isSelected,
	isEditingAllowed: sharedReorderMode.isEditingAllowed,
	subscribe: sharedReorderMode.subscribe,
	getRevision: sharedReorderMode.getRevision,
};

/**
 * Row Reorderへ提供する共有Reorder Mode内部仕様。
 *
 * Toolbarと同じReorder Mode状態を参照しつつ、対象Tableで行並び替えが有効かだけを公開する。
 */
export const rowReorderMode: RowReorderMode = sharedReorderMode.rowReorder;
