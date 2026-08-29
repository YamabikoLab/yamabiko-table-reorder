/**
 * 行・列に共通するReorder Target Resolutionの入口を提供する。
 *
 * 要求時点のTable構造取得だけを共通責務として持ち、方向固有のRequest / Target / Resultは
 * `row-reorder` / `column-reorder`を正本とする。方向選択はこのcomposition pointだけで行う。
 */
import {
	resolveColumnReorderTarget,
	type ColumnReorderTargetResolutionRequest,
	type ColumnReorderTargetResolutionResult,
} from '@/reorder/column-reorder/reorder-target-resolution';
import type { TableIntegration } from '@/reorder/foundation/table-integration';
import {
	resolveRowReorderTarget,
	type RowReorderTargetResolutionRequest,
	type RowReorderTargetResolutionResult,
} from '@/reorder/row-reorder/reorder-target-resolution';
import type { ReorderTargetResolutionFailureReason } from './reorder-target-resolution-rules';

export type ReorderTargetResolutionRequest = RowReorderTargetResolutionRequest | ColumnReorderTargetResolutionRequest;
export type ReorderTargetResolutionResult = RowReorderTargetResolutionResult | ColumnReorderTargetResolutionResult;
export type { ReorderTargetResolutionFailureReason } from './reorder-target-resolution-rules';

type ReorderTargetResolver = {
	( request: RowReorderTargetResolutionRequest ): RowReorderTargetResolutionResult;
	( request: ColumnReorderTargetResolutionRequest ): ColumnReorderTargetResolutionResult;
};
export type ReorderTargetResolution = { resolve: ReorderTargetResolver };

/**
 * 要求時点の共通Table構造を取得し、方向固有の対象解決へ委譲する。
 * @param tableIntegration 共通Table構造を提供するTable Integration。
 * @return 行・列のRequest / Result対応を維持するReorder Target Resolution。
 */
export const createReorderTargetResolution = ( tableIntegration: TableIntegration ): ReorderTargetResolution => {
	function resolve( request: RowReorderTargetResolutionRequest ): RowReorderTargetResolutionResult;
	function resolve( request: ColumnReorderTargetResolutionRequest ): ColumnReorderTargetResolutionResult;
	function resolve( request: ReorderTargetResolutionRequest ): ReorderTargetResolutionResult {
		const structure = tableIntegration.getStructure( request.clientId );
		// Table構造を確定できない開始試行では、推測で並び替えを開始しない。
		if ( structure === null ) {
			const reason: ReorderTargetResolutionFailureReason = 'table-structure-unavailable';
			return { status: 'immovable', reason };
		}
		// 両方向を扱う入口では現在方向を選択し、方向固有データの解釈は各Reorder責務へ委譲する。
		if ( request.kind === 'row' ) {
			return resolveRowReorderTarget( request, structure );
		}
		return resolveColumnReorderTarget( request, structure );
	}
	return { resolve };
};
