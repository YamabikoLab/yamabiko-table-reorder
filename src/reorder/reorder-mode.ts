/**
 * 通常編集と行・列の並び替えを排他的に切り替えるReorder ModeのContractを提供する。
 *
 * 同時に複数の並び替え種別を有効にせず、DnD Interactionが現在許可されている種別を
 * 1つの状態から判断できるようにする。
 */

/**
 * Tableの操作状態を、通常編集・行並び替え・列並び替えのいずれか1つとして表す。
 *
 * `edit`ではDnDを開始せず、`row`と`column`では対応する種別だけを有効にする。
 */
export type ReorderMode = 'edit' | 'row' | 'column';

/**
 * DnD Interactionが扱える並び替え種別。
 *
 * 通常編集を除外することで、開始済みSessionが行または列のどちらを扱うかを明確にする。
 */
export type ReorderKind = Exclude< ReorderMode, 'edit' >;

/**
 * Reorder Modeを通常編集状態で開始する。
 *
 * Tableを開いた時点では並び替え操作を暗黙に有効化しないというLifecycleを表す。
 *
 * @return 初期状態の`edit`。
 */
export const createReorderMode = (): ReorderMode => 'edit';

/**
 * 選択された行または列の並び替えだけを有効にする。
 *
 * 現在状態から直接置き換えることで、行・列の並び替えが同時に有効にならないInvariantを維持する。
 *
 * @param _kind ユーザーが有効にする並び替え種別。
 * @return 選択された種別を表すReorder Mode。
 */
export const enterReorderMode = ( _kind: ReorderKind ): ReorderMode => _kind;

/**
 * 並び替え状態を終了し、通常のTable編集へ戻す。
 *
 * @return 通常編集を表す`edit`。
 */
export const exitReorderMode = (): ReorderMode => 'edit';

/**
 * 現在のModeから、DnD Sessionを開始してよい並び替え種別だけを取り出す。
 *
 * 通常編集では並び替えを許可しないため、DnD Interactionへ種別を渡さず`null`を返す。
 *
 * @param mode DnD開始可否を判断する現在のReorder Mode。
 * @return 有効な行・列のReorder Kind。通常編集では`null`。
 */
export const getReorderKind = ( mode: ReorderMode ): ReorderKind | null =>
	mode === 'edit' ? null : mode;
