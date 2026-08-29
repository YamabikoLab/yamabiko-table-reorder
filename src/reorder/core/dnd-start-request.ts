/**
 * Input InteractionからDnD Interactionへ渡すDnD開始対象の共通契約を提供する。
 *
 * 開始対象は対象TableとTable上の1つの論理位置だけを表し、行・列の並び替え方向は含めない。
 * 各方向固有責務がこの共通位置から必要な位置情報だけを解釈する。
 */

/** Input Interactionが確定した方向非依存のTable上の論理位置。 */
export type DndStartPosition = {
	section: 'head' | 'body' | 'foot';
	/** 対象Table区画を基準とする0-based行インデックス。 */
	rowIndex: number;
	/** 論理Tableグリッド上の0-based列インデックス。 */
	columnIndex: number;
};

/** Input InteractionからDnD Interactionへ渡す方向非依存のDnD開始対象。 */
export type DndStartRequest = {
	clientId: string;
	position: DndStartPosition;
};
