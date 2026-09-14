/**
 * Reorder Form（RF）の狭い表示で利用者が指定した折りたたみ状態をPresentation状態として所有する。
 *
 * RF Interactionの入力・並び替え状態とは分離し、同じRF Session中のReact再mountでは状態を維持する。
 * 新しいRF Sessionを開始する場合は展開状態へ戻す。
 */

import { useCallback } from '@wordpress/element';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** RF入力画面の折りたたみ状態を表す。 */
type ReorderFormCollapseStore = {
	tableIdentity: string | null;
	collapsed: boolean;
	beginSession: ( tableIdentity: string ) => void;
	setCollapsed: ( tableIdentity: string, collapsed: boolean ) => void;
};

/**
 * RF入力画面の折りたたみ状態をReactのmount / unmountから独立して保持する。
 *
 * RF Session開始時に対象Tableを設定して展開状態へ戻し、Session中の変更だけを現在Tableへ反映する。
 */
const reorderFormCollapseStore = createStore< ReorderFormCollapseStore >()( ( set, get ) => ( {
	tableIdentity: null,
	collapsed: false,
	beginSession: ( tableIdentity ) => {
		set( { tableIdentity, collapsed: false } );
	},
	setCollapsed: ( tableIdentity, collapsed ) => {
		/* 終了済みまたは別Tableの古い操作では現在Sessionの表示状態を変更しない。 */
		if ( get().tableIdentity !== tableIdentity ) {
			return;
		}

		set( { collapsed } );
	},
} ) );

/** RF Session入口とRF Presentationへ提供する折りたたみ状態操作。 */
export const reorderFormCollapse = {
	/**
	 * 新しいRF Sessionを展開状態で開始する。
	 *
	 * @param tableIdentity 新しいRF Sessionの対象Table Identity。
	 */
	beginSession: ( tableIdentity: string ): void => {
		reorderFormCollapseStore.getState().beginSession( tableIdentity );
	},
	/**
	 * 現在RF Sessionの折りたたみ状態を更新する。
	 *
	 * @param tableIdentity 現在RF Sessionの対象Table Identity。
	 * @param collapsed     狭い表示で入力画面を折りたたむ場合はtrue。
	 */
	setCollapsed: ( tableIdentity: string, collapsed: boolean ): void => {
		reorderFormCollapseStore.getState().setCollapsed( tableIdentity, collapsed );
	},
};

/**
 * 対象TableのRF入力画面折りたたみ状態をReactへ提供する。
 *
 * @param tableIdentity RF入力画面を表示するTable Identity。
 * @return 現在Sessionの折りたたみ状態と、その状態を更新する操作。
 */
export const useReorderFormCollapse = ( tableIdentity: string ) => {
	const collapsed = useStore( reorderFormCollapseStore, ( state ) => {
		const collapsedForTable = state.tableIdentity === tableIdentity ? state.collapsed : false;
		return collapsedForTable;
	} );
	const setCollapsed = useCallback(
		( nextCollapsed: boolean ) => reorderFormCollapse.setCollapsed( tableIdentity, nextCollapsed ),
		[ tableIdentity ]
	);

	return { collapsed, setCollapsed };
};
