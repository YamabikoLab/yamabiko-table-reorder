/**
 * DnD Interactionが選択した行並び替え入口として、共通の開始位置を行固有の対象解決へ接続する。
 *
 * 方向非依存のTable位置から行固有の`section`と`rowIndex`を解釈し、行の対象解決結果と
 * 同じ方向の移動先判定入口を対応付ける。DnD Interactionには行固有の解釈や内部処理を持ち込まない。
 */
import type { DndStartRequest } from '@/reorder/core/dnd-start-request';
import type { DropTargetResolution } from '@/reorder/core/drop-target-resolution';
import type { ReorderTargetResolution } from '@/reorder/core/reorder-target-resolution';
import type {
	RowReorderTargetResolutionRequest,
	RowReorderTargetResolutionResult,
} from './reorder-target-resolution';

/** 行DnD開始時にDnD Interactionへ返す対象解決結果と同方向の移動先判定入口。 */
export type RowDndStartResolution = {
	targetResolution: RowReorderTargetResolutionResult;
	resolveDropTarget: DropTargetResolution[ 'resolveRow' ];
};

/**
 * 共通のDnD開始位置から行並び替え固有の対象解決要求を作成する。
 *
 * @param request Input InteractionからDnD Interactionへ渡されたTable上の開始位置。
 * @return 行並び替えの対象解決に必要な情報だけを持つ要求。
 */
const createRowReorderTargetResolutionRequest = (
	request: DndStartRequest
): RowReorderTargetResolutionRequest => ( {
	kind: 'row',
	clientId: request.clientId,
	section: request.position.section,
	rowIndex: request.position.rowIndex,
} );

/**
 * 行固有の開始位置解釈とResolver対応を確定する。
 *
 * @param request                  Input Interactionから渡された方向非依存のDnD開始位置。
 * @param reorderTargetResolution DnD開始対象と制約を解決する共通Reorder Target Resolution。
 * @param dropTargetResolution    DnD中の移動先を判定する共通Drop Target Resolution。
 * @return 行の対象解決結果と、その行Sessionに対応する移動先判定入口。
 */
export const resolveRowDndStart = (
	request: DndStartRequest,
	reorderTargetResolution: ReorderTargetResolution,
	dropTargetResolution: DropTargetResolution
): RowDndStartResolution => {
	const resolutionRequest = createRowReorderTargetResolutionRequest( request );
	const targetResolution = reorderTargetResolution.resolve( resolutionRequest );

	return {
		targetResolution,
		resolveDropTarget: dropTargetResolution.resolveRow,
	};
};
