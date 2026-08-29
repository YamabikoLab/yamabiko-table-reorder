/**
 * DnD Interactionが選択した列並び替え入口として、共通の開始位置を列固有の対象解決へ接続する。
 *
 * 方向非依存のTable位置から列固有の`columnIndex`を解釈し、列の対象解決結果と
 * 同じ方向の移動先判定入口を対応付ける。DnD Interactionには列固有の解釈や内部処理を持ち込まない。
 */
import type { DndStartRequest } from '@/reorder/core/dnd-start-request';
import type { DropTargetResolution } from '@/reorder/core/drop-target-resolution';
import type { ReorderTargetResolution } from '@/reorder/core/reorder-target-resolution';
import type {
	ColumnReorderTargetResolutionRequest,
	ColumnReorderTargetResolutionResult,
} from './reorder-target-resolution';

/** 列DnD開始時にDnD Interactionへ返す対象解決結果と同方向の移動先判定入口。 */
export type ColumnDndStartResolution = {
	targetResolution: ColumnReorderTargetResolutionResult;
	resolveDropTarget: DropTargetResolution[ 'resolveColumn' ];
};

/**
 * 共通のDnD開始位置から列並び替え固有の対象解決要求を作成する。
 *
 * @param request Input InteractionからDnD Interactionへ渡されたTable上の開始位置。
 * @return 列並び替えの対象解決に必要な情報だけを持つ要求。
 */
const createColumnReorderTargetResolutionRequest = (
	request: DndStartRequest
): ColumnReorderTargetResolutionRequest => ( {
	kind: 'column',
	clientId: request.clientId,
	columnIndex: request.position.columnIndex,
} );

/**
 * 列固有の開始位置解釈とResolver対応を確定する。
 *
 * @param request                  Input Interactionから渡された方向非依存のDnD開始位置。
 * @param reorderTargetResolution DnD開始対象と制約を解決する共通Reorder Target Resolution。
 * @param dropTargetResolution    DnD中の移動先を判定する共通Drop Target Resolution。
 * @return 列の対象解決結果と、その列Sessionに対応する移動先判定入口。
 */
export const resolveColumnDndStart = (
	request: DndStartRequest,
	reorderTargetResolution: ReorderTargetResolution,
	dropTargetResolution: DropTargetResolution
): ColumnDndStartResolution => {
	const resolutionRequest = createColumnReorderTargetResolutionRequest( request );
	const targetResolution = reorderTargetResolution.resolve( resolutionRequest );

	return {
		targetResolution,
		resolveDropTarget: dropTargetResolution.resolveColumn,
	};
};
