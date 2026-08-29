/**
 * 行並び替えに固有のReorder Target Resolution契約と判定を提供する。
 *
 * 行固有の開始要求、移動対象、判定結果をこの責務の正本として定義し、`body`区画と縦結合という
 * 行固有の意味を共通側へ持ち込まない。論理インデックスと禁止境界の規則だけを共通責務へ委譲する。
 */
import {
	resolveTargetWithinScope,
	type ReorderTargetResolutionResult,
} from '@/reorder/common/reorder-target-resolution-rules';
import type { TableStructure } from '@/reorder/table-integration';

/** 行DnD開始試行で必要な方向固有情報。 */
export type RowReorderTargetResolutionRequest = {
	kind: 'row';
	clientId: string;
	section: 'head' | 'body' | 'foot';
	/** 対象Table区画を基準とする0-based行インデックス。 */
	rowIndex: number;
};

/** `body`区画内で実際に移動する行。 */
export type RowReorderTarget = {
	kind: 'row';
	clientId: string;
	/** `body`区画内の0-based行インデックス。 */
	rowIndex: number;
};

/** 行Reorder Target Resolutionの判定結果。 */
export type RowReorderTargetResolutionResult = ReorderTargetResolutionResult< RowReorderTarget >;

/**
 * 行DnD開始試行を`body`区画内のReorder Targetとして判定する。
 *
 * @param request   DnD Interactionから渡された行DnD開始試行。
 * @param structure 要求時点の共通Table構造。
 * @return 行のReorder TargetとReorder Constraints、または開始できない理由。
 */
export const resolveRowReorderTarget = (
	request: RowReorderTargetResolutionRequest,
	structure: TableStructure
): RowReorderTargetResolutionResult => {
	// 行並び替えの移動対象はArchitectureで定義された`body`区画だけに限定する。
	if ( request.section !== 'body' ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	const target: RowReorderTarget = {
		kind: 'row',
		clientId: request.clientId,
		rowIndex: request.rowIndex,
	};

	// 行DnDでは`body`区画の縦結合だけが開始可否と移動先制約に影響する。
	const mergedCells = structure.mergedCells.filter(
		( cell ) => cell.section === 'body' && cell.rowSpan > 1
	);

	return resolveTargetWithinScope( target, request.rowIndex, mergedCells, {
		getStart: ( cell ) => cell.rowStart,
		getSpan: ( cell ) => cell.rowSpan,
	} );
};
