/**
 * Reorder Target Resolutionの両方向共通入口を公開する。
 *
 * 方向固有Request / Target / Resultの正本は`row-reorder` / `column-reorder`に置き、
 * このファイルは既存参照向けに共通composition boundaryだけを公開する。
 */
export {
	createReorderTargetResolution,
	type ReorderTargetResolution,
	type ReorderTargetResolutionFailureReason,
	type ReorderTargetResolutionRequest,
	type ReorderTargetResolutionResult,
} from '@/reorder/common/reorder-target-resolution';
export type { ReorderConstraints } from '@/reorder/common/reorder-target-resolution-rules';
export type { RowReorderTarget } from '@/reorder/row-reorder/reorder-target-resolution';
export type { ColumnReorderTarget } from '@/reorder/column-reorder/reorder-target-resolution';

/** 両方向を扱う境界でだけ利用するReorder Target union。 */
export type ReorderTarget =
	| import('@/reorder/row-reorder/reorder-target-resolution').RowReorderTarget
	| import('@/reorder/column-reorder/reorder-target-resolution').ColumnReorderTarget;
