/**
 * Table編集、行並び替え、列並び替えのうち、その時点で有効なReorder Modeの状態を表す。
 *
 * `edit`、`row`、`column`のいずれか1つだけを現在状態として持つことで、
 * 行並び替えと列並び替えが同時に有効にならない状態を表現する。
 */
export type ReorderKind = 'row' | 'column';

type ReorderModeState = 'edit' | ReorderKind;

/**
 * 通常編集、行並び替え、列並び替えの現在状態を所有・管理するReorder Modeを表す。
 *
 * 状態遷移の結果を呼び出し側へ値として返さず、このContract自身が1つの現在状態を
 * 保持する。Input InteractionとDnD Interactionは必要な時点で、このContractから
 * 現在状態または並び替え種別を取得する。
 */
export type ReorderMode = {
	/** 現在有効なReorder Modeの状態を取得する。 */
	getState: () => ReorderModeState;
	/** 選択された行または列のReorder Modeへ切り替える。 */
	enter: ( kind: ReorderKind ) => void;
	/** Reorder Modeを終了して通常編集モードへ戻す。 */
	exit: () => void;
	/** 現在のReorder ModeからDnDで扱う並び替え種別を取得する。 */
	getReorderKind: () => ReorderKind | null;
};

/**
 * 通常編集モードから開始するReorder Modeを作成する。
 *
 * 作成したReorder Mode自身が現在状態を所有し、行または列の入口選択による開始、
 * 別方向への切り替え、終了による通常編集への復帰を同じ状態に対して管理する。
 * 個々の行または列が並び替え対象として成立するかどうかは判定しない。
 */
export const createReorderMode = (): ReorderMode => {
	let state: ReorderModeState = 'edit';

	return {
		getState: () => state,
		enter: ( kind ) => {
			state = kind;
		},
		exit: () => {
			state = 'edit';
		},
		getReorderKind: () => ( state === 'edit' ? null : state ),
	};
};
