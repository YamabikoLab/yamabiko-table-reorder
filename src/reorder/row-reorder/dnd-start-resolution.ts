/**
 * DnD Interactionが受け取った共通の開始位置を、行並び替え固有のReorder Target Resolution要求へ変換する。
 *
 * 方向非依存のTable位置は共通契約として維持し、行固有の`section`と`rowIndex`の解釈だけをこの責務で行う。
 */
import type { DndStartRequest } from '@/reorder/common/dnd-start-request';
import type { RowReorderTargetResolutionRequest } from './reorder-target-resolution';

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
