/**
 * Table編集、行並び替え、列並び替えのうち、その時点で有効なReorder Modeを表す。
 *
 * `edit`、`row`、`column`のいずれか1つだけを現在状態として持つことで、
 * 行並び替えと列並び替えが同時に有効にならない状態を表現する。
 */
export type ReorderMode = 'edit' | 'row' | 'column';

/**
 * Reorder Modeが並び替え対象として扱う行または列の種別を表す。
 *
 * 通常編集モードを表す`edit`は含めず、個々の行または列が実際に
 * 並び替え対象として成立するかどうかも表さない。
 */
export type ReorderKind = Exclude< ReorderMode, 'edit' >;

/**
 * Reorder Modeの初期状態を通常編集モードとして作成する。
 *
 * 通常編集モードでは行・列のDnDを有効にせず、並び替えの入口が
 * 選択されるまでは通常のTable編集を維持する。
 */
export const createReorderMode = (): ReorderMode => 'edit';

/**
 * 選択された行または列のReorder Modeへ切り替える。
 *
 * 現在状態にかかわらず選択された種別だけを次の状態とすることで、
 * 行並び替えと列並び替えを同時に有効にしない。
 * 個々の行または列が並び替え対象として成立するかどうかは判定しない。
 *
 * @param kind 選択された並び替え種別。
 */
export const enterReorderMode = ( kind: ReorderKind ): ReorderMode => kind;

/**
 * Reorder Modeを終了して通常編集モードへ戻す。
 *
 * 終了後は行・列のどちらもDnDの開始候補として扱わない状態になる。
 */
export const exitReorderMode = (): ReorderMode => 'edit';

/**
 * 現在のReorder ModeからDnDで扱う並び替え種別を取得する。
 *
 * 行並び替えモードでは`row`、列並び替えモードでは`column`を返す。
 * 通常編集モードでは行・列のDnDを有効にしないため`null`を返す。
 *
 * @param mode 現在のReorder Mode。
 */
export const getReorderKind = ( mode: ReorderMode ): ReorderKind | null =>
	mode === 'edit' ? null : mode;
