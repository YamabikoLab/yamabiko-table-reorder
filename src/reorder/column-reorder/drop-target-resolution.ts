/**
 * 列並び替えに固有のDrop Target Resolution契約を提供する。
 *
 * 列の移動先はTable全体の列間という方向固有の意味を持つため、この責務を正本として定義する。
 * 挿入境界の妥当性と禁止境界照合は行・列共通責務へ委譲する。
 */
import type { ReorderConstraints } from '@/reorder/common/reorder-target-resolution-rules';
import type { DropTargetPosition } from '@/reorder/common/drop-target-resolution';
import type { ColumnReorderTarget } from './reorder-target-resolution';

/** 列DnDの移動先判定入力。 */
export type ColumnDropTargetResolutionRequest = {
	kind: 'column';
	target: ColumnReorderTarget;
	constraints: ReorderConstraints;
	currentPosition: DropTargetPosition;
};

/** Table全体の列間を表す有効な移動先。 */
export type ColumnReorderDestination = {
	kind: 'column';
	clientId: string;
	/** Table全体の列間を表す0-based挿入境界インデックス。 */
	boundaryIndex: number;
};

/** 列DnDの移動先判定結果。 */
export type ColumnDropTargetResolutionResult =
	| { status: 'valid'; destination: ColumnReorderDestination }
	| { status: 'none' };

/**
 * 共通規則で有効と判定された境界から列のReorder Destinationを生成する。
 *
 * @param request       列DnDの移動先判定入力。
 * @param boundaryIndex 有効と判定された列間境界。
 * @return 列のReorder Destination。
 */
export const createColumnReorderDestination = (
	request: ColumnDropTargetResolutionRequest,
	boundaryIndex: number
): ColumnReorderDestination => ( {
	kind: 'column',
	clientId: request.target.clientId,
	boundaryIndex,
} );
