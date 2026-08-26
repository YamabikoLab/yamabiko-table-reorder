/**
 * Table編集と行・列の並び替えを排他的に表すReorder Mode。
 *
 * `edit`ではDnDを開始できず、`row`と`column`では対応する行・列だけを
 * 並び替え対象として扱う。
 */
export type ReorderMode = 'edit' | 'row' | 'column';

/**
 * Reorder Modeが示す並び替え種別。
 */
export type ReorderKind = Exclude< ReorderMode, 'edit' >;

/**
 * Reorder Modeの初期状態を返す。
 *
 * 通常のTable編集から開始するというArchitectureのLifecycleを表す。
 */
export const createReorderMode = (): ReorderMode => 'edit';

/**
 * 指定した種別のReorder Modeへ切り替える。
 *
 * 現在状態にかかわらず選択された種別だけを有効にすることで、行・列の
 * 並び替えが同時に有効にならないInvariantを維持する。
 *
 * @param _kind 切り替える並び替え種別。
 */
export const enterReorderMode = ( _kind: ReorderKind ): ReorderMode => _kind;

/**
 * Reorder Modeを終了し、通常のTable編集へ戻す。
 */
export const exitReorderMode = (): ReorderMode => 'edit';

/**
 * 現在のReorder ModeからDnDに利用できる並び替え種別を返す。
 *
 * 通常編集状態ではDnDを開始できないため`null`を返す。
 * @param mode
 */
export const getReorderKind = ( mode: ReorderMode ): ReorderKind | null =>
	mode === 'edit' ? null : mode;
