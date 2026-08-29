/**
 * Drop Target Resolutionの両方向共通入口を公開する互換境界。
 *
 * 方向固有Request / Destination / Resultの正本は`row-reorder` / `column-reorder`に置き、
 * 共通側は挿入境界の妥当性と禁止境界照合だけを扱う。
 */
export {
	createDropTargetResolution,
	type DropTargetPosition,
	type DropTargetResolution,
	type DropTargetResolutionRequest,
	type DropTargetResolutionResult,
} from '@/reorder/common/drop-target-resolution';
export type { RowReorderDestination } from '@/reorder/row-reorder/drop-target-resolution';
export type { ColumnReorderDestination } from '@/reorder/column-reorder/drop-target-resolution';

/** 両方向を扱う境界でだけ利用するReorder Destination union。 */
export type ReorderDestination =
	| import('@/reorder/row-reorder/drop-target-resolution').RowReorderDestination
	| import('@/reorder/column-reorder/drop-target-resolution').ColumnReorderDestination;
