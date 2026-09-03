/**
 * dnd-kit PoCの視覚Feedback切替状態をWordPress統合境界で所有する。
 *
 * Row Reorder / Column Reorder本体の状態へPoC専用設定を混在させず、React componentの再生成から独立して
 * Visual FeedbackのON / OFFを保持し、ToolbarとDnD接続境界へ同じ設定を提供する。
 */

import { createStore } from 'zustand/vanilla';

/** dnd-kit PoC設定Storeが所有する状態と操作を表す。 */
type DndKitPocSettingsStore = {
	visualFeedbackEnabled: boolean;
	/** Visual Feedbackの有効状態を反転する。 */
	toggleVisualFeedback: () => void;
};

/** dnd-kit PoC専用設定をReact componentのライフサイクルから独立して保持するStore。 */
const dndKitPocSettingsStore = createStore< DndKitPocSettingsStore >()( ( set ) => ( {
	visualFeedbackEnabled: false,
	toggleVisualFeedback: () => {
		set( ( state ) => ( { visualFeedbackEnabled: ! state.visualFeedbackEnabled } ) );
	},
} ) );

/** dnd-kit PoC設定をWordPress統合へ提供する最小内部仕様。 */
type DndKitPocSettings = Pick< typeof dndKitPocSettingsStore, 'subscribe' > & {
	/**
	 * Visual Feedbackが有効か取得する。
	 *
	 * @return dnd-kit標準Visual Feedbackを使用する場合はtrue。Feedbackを表示しない場合はfalse。
	 */
	isVisualFeedbackEnabled: () => boolean;
	/** Visual Feedbackの有効状態を反転する。 */
	toggleVisualFeedback: () => void;
};

/** ToolbarとDnD接続境界が共有するdnd-kit PoC設定。 */
export const dndKitPocSettings: DndKitPocSettings = {
	isVisualFeedbackEnabled: () => dndKitPocSettingsStore.getState().visualFeedbackEnabled,
	toggleVisualFeedback: () => dndKitPocSettingsStore.getState().toggleVisualFeedback(),
	subscribe: dndKitPocSettingsStore.subscribe,
};
