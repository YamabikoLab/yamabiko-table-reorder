/**
 * 行並び替えに固有のDrop Target Resolution契約を提供する。
 *
 * 行の移動先は`body`区画内の行間という方向固有の意味を持つため、この責務を正本として定義する。
 * 挿入境界の妥当性と禁止境界照合は行・列共通責務へ委譲する。
 */
import type { DropTargetPosition } from '@/reorder/core/drop-target-resolution';
import type { ReorderConstraints } from '@/reorder/core/reorder-target-resolution-rules';
import type { RowReorderTarget } from './reorder-target-resolution';

/** 行DnDの移動先判定入力。 */
export type RowDropTargetResolutionRequest = {
	kind: 'row';
	target: RowReorderTarget;
	constraints: ReorderConstraints;
	currentPosition: DropTargetPosition;
};

/** `body`区画内の行間を表す有効な移動先。 */
export type RowReorderDestination = {
	kind: 'row';
	clientId: string;
	/** `body`区画内の行間を表す0-based挿入境界インデックス。 */
	boundaryIndex: number;
};

/** 行DnDの移動先判定結果。 */
export type RowDropTargetResolutionResult =
	| { status: 'valid'; destination: RowReorderDestination }
	| { status: 'none' };

/**
 * 共通規則で有効と判定された境界から行のReorder Destinationを生成する。
 *
 * @param request       行DnDの移動先判定入力。
 * @param boundaryIndex 有効と判定された行間境界。
 * @return 行のReorder Destination。
 */
export const createRowReorderDestination = (
	request: RowDropTargetResolutionRequest,
	boundaryIndex: number
): RowReorderDestination => ( {
	kind: 'row',
	clientId: request.target.clientId,
	boundaryIndex,
} );
