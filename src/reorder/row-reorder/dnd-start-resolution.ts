/**
 * DnD Interactionが受け取った共通の開始位置を、行並び替え固有のReorder Target Resolution要求へ変換する。
 *
 * DnD Interactionは現在の並び替え方向を選択する責務だけを持ち、行固有の`section`と`rowIndex`の
 * 取り出しはこの境界へ委譲する。これにより、行固有の開始位置の意味を共通DnD処理へ持ち込まない。
 */
import type { DndStartRequest } from '@/reorder/dnd-start-request';
import type { ReorderTargetResolutionRequest } from '@/reorder/reorder-target-resolution';

/** 行並び替えで利用するReorder Target Resolution要求。 */
type RowReorderTargetResolutionRequest = Extract<
	ReorderTargetResolutionRequest,
	{ kind: 'row' }
>;

/**
 * 共通のDnD開始位置から行並び替え固有の対象解決要求を作成する。
 *
 * @param request Input InteractionからDnD Interactionへ渡されたTable上の開始位置。
 * @return 行並び替えの対象解決に必要な情報だけを持つ要求。
 */
export const createRowReorderTargetResolutionRequest = (
	request: DndStartRequest
): RowReorderTargetResolutionRequest => ( {
	kind: 'row',
	clientId: request.clientId,
	section: request.position.section,
	rowIndex: request.position.rowIndex,
} );
