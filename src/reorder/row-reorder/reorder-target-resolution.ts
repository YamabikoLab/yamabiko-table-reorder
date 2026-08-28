/**
 * 行並び替えに固有のReorder Target Resolutionを提供する。
 *
 * 行並び替えの対象範囲を`body`区画に限定し、縦方向に結合されたセルだけを行の開始可否と
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
 * 行DnD開始試行を`body`区画内のReorder Targetとして判定する。
 *
 * @param request   DnD Interactionから渡された行DnD開始試行。
 * @param structure 要求時点の共通Table構造。
 * @return 行のReorder TargetとReorder Constraints、または開始できない理由。
 */
export const resolveRowReorderTarget = (
	request: Extract< ReorderTargetResolutionRequest, { kind: 'row' } >,
	structure: TableStructure
): ReorderTargetResolutionResult => {
	// 行並び替えでは`body`区画だけをReorder Targetの対象範囲とする。
	if ( request.section !== 'body' ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	const target: ReorderTarget = {
		kind: 'row',
		clientId: request.clientId,
		rowIndex: request.rowIndex,
	};

	// 行DnDの開始可否と移動先制約には、`body`区画で縦方向に結合されたセルだけを適用する。
	const mergedCells = structure.mergedCells.filter(
		( cell ) => cell.section === 'body' && cell.rowSpan > 1
	);

	return resolveTargetWithinScope( target, request.rowIndex, mergedCells, {
		getStart: ( cell ) => cell.rowStart,
		getSpan: ( cell ) => cell.rowSpan,
	} );
};
