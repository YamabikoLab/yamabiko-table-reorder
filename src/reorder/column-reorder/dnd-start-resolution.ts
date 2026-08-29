/**
 * DnD Interactionが受け取った共通の開始位置を、列並び替え固有のReorder Target Resolution要求へ変換する。
 *
 * DnD Interactionは現在の並び替え方向を選択する責務だけを持ち、列固有の`columnIndex`の取り出しは
 * この境界へ委譲する。これにより、列固有の開始位置の意味を共通DnD処理へ持ち込まない。
 */
import type { DndStartRequest } from '@/reorder/dnd-interaction';
import type { ReorderTargetResolutionRequest } from '@/reorder/reorder-target-resolution';

/** 列並び替えで利用するReorder Target Resolution要求。 */
type ColumnReorderTargetResolutionRequest = Extract<
	ReorderTargetResolutionRequest,
	{ kind: 'column' }
>;

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
