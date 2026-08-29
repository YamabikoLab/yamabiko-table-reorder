/**
 * Input InteractionからDnD Interactionへ渡すDnD開始対象の共通契約を提供する。
 *
 * 開始対象は対象TableとTable上の1つの論理位置だけを表し、行・列の並び替え方向は含めない。
 * DnD InteractionがReorder Modeから現在方向を選択し、方向固有責務がこの位置を各方向の要求へ解釈する。
 */

/**
 * Input InteractionがDnD開始位置として確定したTable上の論理位置。
 *
 * 1つのセル位置をTable区画、区画内の行位置、論理Tableグリッド上の列位置で表す。
 * 並び替え方向は含めず、行・列それぞれで必要な位置情報への解釈は方向固有責務が行う。
 */
export type DndStartPosition = {
	section: 'head' | 'body' | 'foot';
	/** 対象Table区画を基準とする0-based行インデックス。 */
	rowIndex: number;
	/** 論理Tableグリッド上の0-based列インデックス。 */
	columnIndex: number;
};

/**
 * Input InteractionからDnD Interactionへ渡すDnD開始対象。
 *
 * 対象TableとTable上の1つの開始位置だけを表し、並び替え方向や方向固有のReorder Target Resolution要求は
 * 含めない。
 */
export type DndStartRequest = {
	clientId: string;
	position: DndStartPosition;
};
