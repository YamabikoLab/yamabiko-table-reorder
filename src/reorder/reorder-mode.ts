/**
 * 通常編集と行・列の並び替えを排他的に切り替える操作状態を提供する。
 *
 * 行と列の並び替えを同時に有効にせず、現在どの並び替えを許可しているかを1つの状態で判断できるようにする。
 */

/**
 * テーブルの操作状態を、通常編集・行並び替え・列並び替えのいずれか1つとして表す。
 *
 * `edit`では並び替えを開始せず、`row`と`column`では対応する並び替えだけを有効にする。
 */
export type ReorderMode = 'edit' | 'row' | 'column';

/**
 * 並び替え操作として扱う行または列の種別。
 */
export type ReorderKind = Exclude< ReorderMode, 'edit' >;

/**
 * テーブル操作を通常編集状態で開始する。
 *
 * @return 通常編集を表す初期状態。
 */
export const createReorderMode = (): ReorderMode => 'edit';

/**
 * 選択した行または列の並び替えだけを有効にする。
 *
 * @param kind 有効にする並び替え種別。
 * @return 選択した並び替えを表す状態。
 */
export const enterReorderMode = ( kind: ReorderKind ): ReorderMode => kind;

/**
 * 並び替えを終了し、通常編集へ戻す。
 *
 * @return 通常編集を表す状態。
 */
export const exitReorderMode = (): ReorderMode => 'edit';

/**
 * 現在の操作状態から、開始できる並び替え種別を取得する。
 *
 * 通常編集では並び替えを開始しないため、種別を返さない。
 *
 * @param mode 現在の操作状態。
 * @return 行または列の並び替え種別。通常編集では`null`。
 */
export const getReorderKind = ( mode: ReorderMode ): ReorderKind | null => {
	const reorderKind = mode === 'edit' ? null : mode;
	return reorderKind;
};
