/**
 * DnD Interactionが受け取った共通の開始位置を、列並び替え固有のReorder Target Resolution要求へ変換する。
 *
 * 方向非依存のTable位置は共通契約として維持し、列固有の`columnIndex`の解釈だけをこの責務で行う。
 */
import type { DndStartRequest } from '@/reorder/common/dnd-start-request';
import type { ColumnReorderTargetResolutionRequest } from './reorder-target-resolution';

/**
 * 共通のDnD開始位置から列並び替え固有の対象解決要求を作成する。
 *
 * @param request Input InteractionからDnD Interactionへ渡されたTable上の開始位置。
 * @return 列並び替えの対象解決に必要な情報だけを持つ要求。
 */
export const createColumnReorderTargetResolutionRequest = (
	request: DndStartRequest
): ColumnReorderTargetResolutionRequest => ( {
	kind: 'column',
	clientId: request.clientId,
	columnIndex: request.position.columnIndex,
} );
