/**
 * 初回案内の表示中状態を所有する。
 *
 * ReactやWordPressには依存せず、現在どのTableへ、どの操作環境の初回案内を表示しているかという
 * 一時状態だけをReorder Guidanceの状態境界として保持する。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

/** 初回案内を個別に扱う操作環境を表す。 */
export type ReorderGuidanceEnvironment = 'pc' | 'touch';

/** 現在表示している初回案内の対象Tableと操作環境を表す。 */
type ActiveReorderGuidance = {
	tableIdentity: string;
	environment: ReorderGuidanceEnvironment;
};

/** Reorder Guidanceの状態ストアが所有する現在表示を表す。 */
type ReorderGuidanceStoreState = {
	activeGuidance: ActiveReorderGuidance | null;
};

/** Reorder Guidanceの状態ストアが提供する状態変更操作を表す。 */
type ReorderGuidanceStoreActions = {
	/**
	 * 対象Tableへ初回案内を表示する。
	 *
	 * 別Tableの案内が残っている場合は、現在操作しているTableの案内へ置き換える。
	 *
	 * @param tableIdentity 初回案内を表示するTable Identity。
	 * @param environment   初回案内を個別に扱う操作環境。
	 */
	show: ( tableIdentity: string, environment: ReorderGuidanceEnvironment ) => void;
	/**
	 * 対象Tableの初回案内を終了する。
	 *
	 * 別Tableからの終了通知では、現在表示中の案内を終了しない。
	 *
	 * @param tableIdentity 初回案内を終了するTable Identity。
	 */
	hide: ( tableIdentity: string ) => void;
};

/** Reorder Guidanceの現在表示と、その状態変更操作をまとめた状態ストア内部仕様。 */
type ReorderGuidanceStore = ReorderGuidanceStoreState & ReorderGuidanceStoreActions;

/**
 * 初回案内の表示中状態を所有する状態ストア。
 *
 * PC／タッチごとの表示済み状態はWordPress側の永続化境界が所有し、
 * この状態ストアはReactコンポーネントのマウント／アンマウントに依存しない現在表示だけを保持する。
 */
export const reorderGuidanceStore = createStore< ReorderGuidanceStore >()(
	devtools(
		( set, get ) => ( {
			activeGuidance: null,
			show: ( tableIdentity, environment ) => {
				const current = get().activeGuidance;
				const sameGuidanceAlreadyVisible =
					current?.tableIdentity === tableIdentity && current.environment === environment;

				/* 同じ初回案内がすでに表示中の場合は、現在状態を維持する。 */
				if ( sameGuidanceAlreadyVisible ) {
					return;
				}

				set(
					{ activeGuidance: { tableIdentity, environment } },
					undefined,
					'reorder-guidance/show'
				);
			},
			hide: ( tableIdentity ) => {
				const current = get().activeGuidance;

				/* 現在表示中の対象Table以外からの通知では案内状態を変更しない。 */
				if ( current?.tableIdentity !== tableIdentity ) {
					return;
				}

				set( { activeGuidance: null }, undefined, 'reorder-guidance/hide' );
			},
		} ),
		{ name: 'Yamabiko Table Reorder / Reorder Guidance' }
	)
);

/** Reorder Guidance本体が外側の接続境界へ提供する最小内部仕様。 */
type ReorderGuidance = ReorderGuidanceStoreActions;

/**
 * 外側の接続境界へ提供するReorder Guidance内部仕様。
 *
 * Zustandの更新方法を公開せず、初回案内の開始と終了だけを提供する。
 */
export const reorderGuidance: ReorderGuidance = {
	show: ( tableIdentity, environment ) => {
		reorderGuidanceStore.getState().show( tableIdentity, environment );
	},
	hide: ( tableIdentity ) => {
		reorderGuidanceStore.getState().hide( tableIdentity );
	},
};
