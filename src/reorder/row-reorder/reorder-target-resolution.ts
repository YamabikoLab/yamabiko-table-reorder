/** 行並び替えに固有のReorder Target Resolution契約と判定を提供する。 */
import { resolveTargetWithinScope, type ReorderTargetResolutionResult } from '@/reorder/core/reorder-target-resolution-rules';
import type { TableStructure } from '@/reorder/foundation/table-integration';
export type RowReorderTargetResolutionRequest = { kind: 'row'; clientId: string; section: 'head' | 'body' | 'foot'; rowIndex: number };
export type RowReorderTarget = { kind: 'row'; clientId: string; rowIndex: number };
export type RowReorderTargetResolutionResult = ReorderTargetResolutionResult< RowReorderTarget >;
/** @param request DnD Interactionから渡された行DnD開始試行。 @param structure 要求時点の共通Table構造。 @return 行のReorder TargetとReorder Constraints、または開始できない理由。 */
export const resolveRowReorderTarget = ( request: RowReorderTargetResolutionRequest, structure: TableStructure ): RowReorderTargetResolutionResult => {
	// 行並び替えの移動対象はArchitectureで定義された`body`区画だけに限定する。
	if ( request.section !== 'body' ) return { status: 'immovable', reason: 'target-out-of-scope' };
	const target: RowReorderTarget = { kind: 'row', clientId: request.clientId, rowIndex: request.rowIndex };
	// 行DnDでは`body`区画の縦結合だけが開始可否と移動先制約に影響する。
	const mergedCells = structure.mergedCells.filter( ( cell ) => cell.section === 'body' && cell.rowSpan > 1 );
	return resolveTargetWithinScope( target, request.rowIndex, mergedCells, { getStart: ( cell ) => cell.rowStart, getSpan: ( cell ) => cell.rowSpan } );
};
