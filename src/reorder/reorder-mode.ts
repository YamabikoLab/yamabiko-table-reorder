/**
 * 通常編集、行並び替え、列並び替えの排他状態と、その並び替えモードが有効なTableを所有する。
 *
 * ReactやWordPressには依存せず、Zustandのvanilla storeを状態境界として、
 * モード選択、Table単位のライフサイクル、および通常編集との排他を提供する。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

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

/** Reorder Mode Storeが所有する状態を表す。 */
type ReorderModeStoreState = {
	mode: ReorderModeState;
};

/**
 * Reorder Mode Storeが外部統合へ提供する状態変更操作を表す。
 *
 * Storeの利用者は状態を直接置き換えず、Reorder Modeが所有する状態遷移だけを要求する。
 */
type ReorderModeStoreActions = {
	/**
	 * 選択された並び替え入口を現在状態へ反映する。
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
};

/** Reorder Mode Store内部で方向固有Lifecycleを解決する操作を表す。 */
type ReorderModeStoreInternalActions = {
	/**
	 * 行DnD終了後の対象Table継続可否を、現在のReorder Modeへ反映する。
	 *
	 * 終了したDnDと現在も同一Tableの行並び替えモードが一致する場合だけ結果を反映し、
	 * 継続不能なら通常編集へ戻す。すでに別状態へ遷移している場合は過去のDnD結果で上書きしない。
	 *
	 * @param tableIdentity 終了した行DnD Sessionの対象Table Identity。
	 * @param canContinue   DnD終了後も対象Tableで行並び替えを安全に継続できる場合はtrue。
	 */
	resolveAfterRowDnd: ( tableIdentity: ReorderTableIdentity, canContinue: boolean ) => void;
};

type ReorderModeStore = ReorderModeStoreState &
	ReorderModeStoreActions &
	ReorderModeStoreInternalActions;

/**
 * Row Reorderへ提供するReorder Modeの最小内部仕様を表す。
 *
 * Row ReorderはReorder Mode全体の状態を参照せず、対象Tableで行並び替えが有効かの確認と、
 * DnD終了後に対象Tableで安全に継続できるかという結果の通知だけを行う。
 */
type RowReorderMode = {
	/**
	 * 対象Tableで行並び替えが有効か確認する。
	 *
	 * @param tableIdentity 行並び替えの有効状態を確認するTable Identity。
	 * @return 対象Tableで行並び替えが有効な場合はtrue。それ以外はfalse。
	 */
	isActive: ( tableIdentity: ReorderTableIdentity ) => boolean;
	/**
	 * 行DnD終了後に、Session対象Tableで行並び替えを安全に継続できるかという結果を通知する。
	 *
	 * 現在も同一Tableの行並び替えモードである場合だけ継続可否を反映し、
	 * すでに通常編集、列並び替え、または別Tableへ遷移している場合は現在状態を維持する。
	 *
	 * @param tableIdentity 終了した行DnD Sessionの対象Table Identity。
	 * @param canContinue   DnD終了後も対象Tableで行並び替えを安全に継続できる場合はtrue。
	 */
	resolveAfterDnd: ( tableIdentity: ReorderTableIdentity, canContinue: boolean ) => void;
};

/**
 * Reorder Modeの状態と状態遷移を所有するStore。
 *
 * Zustandのvanilla storeを使用し、ReactやWordPressのライフサイクルとは独立して状態を維持する。
 * Redux DevToolsではReorder Modeの状態変更を操作単位で確認できる。
 * Reactからの直接参照は`reorder-mode-react.ts`だけに限定する。
 */
export const reorderModeStore = createStore< ReorderModeStore >()(
	devtools(
		( set, get ) => ( {
			mode: { kind: 'edit' },
			select: ( kind, tableIdentity ) => {
				const mode = get().mode;
				const isSameSelectedMode = mode.kind === kind && mode.tableIdentity === tableIdentity;

				/*
				 * 選択中の入口を同じTableでもう一度選択した場合は、並び替えモードを解除する。
				 */
				if ( isSameSelectedMode ) {
					set( { mode: { kind: 'edit' } }, undefined, 'reorder-mode/select' );
					return;
				}

				set( { mode: { kind, tableIdentity } }, undefined, 'reorder-mode/select' );
			},
			observeTable: ( tableIdentity ) => {
				const mode = get().mode;

				/*
				 * 通常編集、または同じTableの再観測では、現在のReorder Modeを維持する。
				 */
				if ( mode.kind === 'edit' || mode.tableIdentity === tableIdentity ) {
					return;
				}

				set( { mode: { kind: 'edit' } }, undefined, 'reorder-mode/observe-table' );
			},
			notifyTableInactive: ( tableIdentity ) => {
				const mode = get().mode;

				/*
				 * 操作対象から外れたTableが現在の並び替え対象Tableである場合だけ、Reorder Modeを終了する。
				 */
				if ( mode.kind === 'edit' || mode.tableIdentity !== tableIdentity ) {
					return;
				}

				set( { mode: { kind: 'edit' } }, undefined, 'reorder-mode/notify-table-inactive' );
			},
			resolveAfterRowDnd: ( tableIdentity, canContinue ) => {
				const mode = get().mode;
				const sameRowModeStillActive = mode.kind === 'row' && mode.tableIdentity === tableIdentity;

				/*
				 * DnD終了後に利用者がすでに別状態へ遷移している場合は、終了済みDnDの結果で現在状態を上書きしない。
				 */
				if ( ! sameRowModeStillActive ) {
					return;
				}

				/* 継続可能な場合は現在の行並び替え状態を維持し、過去状態を再設定しない。 */
				if ( canContinue ) {
					return;
				}

				set( { mode: { kind: 'edit' } }, undefined, 'reorder-mode/resolve-after-row-dnd' );
			},
		} ),
		{ name: 'Yamabiko Table Reorder / Reorder Mode' }
	)
);

/**
 * Reorder Mode本体が外部統合へ提供する最小内部仕様を表す。
 *
 * 表示や編集可否など利用側固有の表現は持たず、状態遷移とTable単位の現在モード参照だけを提供する。
 */
type ReorderMode = ReorderModeStoreActions & {
	/**
	 * 対象Tableから見た現在のReorder Modeを取得する。
	 *
	 * @param tableIdentity 現在モードを確認するTable Identity。
	 * @return 対象Tableで有効なReorder Mode。別Tableが並び替え対象の場合は通常編集モード。
	 */
	getMode: ( tableIdentity: ReorderTableIdentity ) => ReorderKind | 'edit';
};

/**
 * 外部統合へ提供する共有Reorder Mode内部仕様。
 *
 * 状態遷移とTable単位の現在モード参照だけを公開し、Zustandの購読内部仕様や利用側固有の表示表現は公開しない。
 */
export const reorderMode: ReorderMode = {
	select: ( kind, tableIdentity ) => {
		reorderModeStore.getState().select( kind, tableIdentity );
	},
	observeTable: ( tableIdentity ) => {
		reorderModeStore.getState().observeTable( tableIdentity );
	},
	notifyTableInactive: ( tableIdentity ) => {
		reorderModeStore.getState().notifyTableInactive( tableIdentity );
	},
	getMode: ( tableIdentity ) => {
		const mode = reorderModeStore.getState().mode;
		const tableMode =
			mode.kind !== 'edit' && mode.tableIdentity === tableIdentity ? mode.kind : 'edit';

		return tableMode;
	},
};

/**
 * Row Reorderへ提供する共有Reorder Mode内部仕様。
 *
 * Toolbarと同じReorder Mode状態を参照しつつ、対象Tableで行並び替えが有効かの確認と、
 * DnD終了後の継続可否によるLifecycle解決だけを公開する。
 */
export const rowReorderMode: RowReorderMode = {
	isActive: ( tableIdentity ) => {
		const mode = reorderModeStore.getState().mode;
		const rowReorderActiveForTable = mode.kind === 'row' && mode.tableIdentity === tableIdentity;

		return rowReorderActiveForTable;
	},
	resolveAfterDnd: ( tableIdentity, canContinue ) => {
		reorderModeStore.getState().resolveAfterRowDnd( tableIdentity, canContinue );
	},
};
