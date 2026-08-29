/** 列並び替えに固有のReorder Target Resolution契約と判定を提供する。 */
import { resolveTargetWithinScope, type ReorderTargetResolutionResult } from '@/reorder/core/reorder-target-resolution-rules';
import type { TableStructure } from '@/reorder/foundation/table-integration';
export type ColumnReorderTargetResolutionRequest = { kind: 'column'; clientId: string; columnIndex: number };
export type ColumnReorderTarget = { kind: 'column'; clientId: string; columnIndex: number };
export type ColumnReorderTargetResolutionResult = ReorderTargetResolutionResult< ColumnReorderTarget >;
/** @param request DnD Interactionから渡された列DnD開始試行。 @param structure 要求時点の共通Table構造。 @return 列のReorder TargetとReorder Constraints、または開始できない理由。 */
export const resolveColumnReorderTarget = ( request: ColumnReorderTargetResolutionRequest, structure: TableStructure ): ColumnReorderTargetResolutionResult => {
	const target: ColumnReorderTarget = { kind: 'column', clientId: request.clientId, columnIndex: request.columnIndex };
	// 列DnDではTable全体の横結合だけが開始可否と移動先制約に影響する。
	const mergedCells = structure.mergedCells.filter( ( cell ) => cell.columnSpan > 1 );
	return resolveTargetWithinScope( target, request.columnIndex, mergedCells, { getStart: ( cell ) => cell.columnStart, getSpan: ( cell ) => cell.columnSpan } );
};
