/**
 * 列並び替えに固有のReorder Target Resolutionを提供する。
 *
 * 列並び替えではTable全体を対象範囲とし、横方向に結合されたセルだけを列の開始可否と
 * 移動先制約へ適用する。行・列で共通する判定規則はReorder Target Resolutionの共通規則を利用する。
 */
import { resolveTargetWithinScope } from '@/reorder/reorder-target-resolution-rules';
import type {
	ReorderTarget,
	ReorderTargetResolutionRequest,
	ReorderTargetResolutionResult,
} from '@/reorder/reorder-target-resolution';
import type { TableStructure } from '@/reorder/table-integration';

/**
 * 列DnD開始試行をTable全体のReorder Targetとして判定する。
 *
 * @param request   DnD Interactionから渡された列DnD開始試行。
 * @param structure 要求時点の共通Table構造。
 * @return 列のReorder TargetとReorder Constraints、または開始できない理由。
 */
export const resolveColumnReorderTarget = (
	request: Extract< ReorderTargetResolutionRequest, { kind: 'column' } >,
	structure: TableStructure
): ReorderTargetResolutionResult => {
	const target: ReorderTarget = {
		kind: 'column',
		clientId: request.clientId,
		columnIndex: request.columnIndex,
	};

	// 列DnDの開始可否と移動先制約には、Table全体で横方向に結合されたセルだけを適用する。
	const mergedCells = structure.mergedCells.filter( ( cell ) => cell.columnSpan > 1 );

	return resolveTargetWithinScope( target, request.columnIndex, mergedCells, {
		getStart: ( cell ) => cell.columnStart,
		getSpan: ( cell ) => cell.columnSpan,
	} );
};
