/**
 * 列並び替えに固有のReorder Target Resolution契約と判定を提供する。
 *
 * 列固有の開始要求、移動対象、判定結果をこの責務の正本として定義し、Table全体と横結合という
 * 列固有の意味を共通側へ持ち込まない。論理インデックスと禁止境界の規則だけを共通責務へ委譲する。
 */
import {
	resolveTargetWithinScope,
	type ReorderTargetResolutionResult,
} from '@/reorder/core/reorder-target-resolution-rules';
import type { TableStructure } from '@/reorder/foundation/table-integration';

/** 列DnD開始試行で必要な方向固有情報。 */
export type ColumnReorderTargetResolutionRequest = {
	kind: 'column';
	clientId: string;
	/** 論理Tableグリッド上の0-based列インデックス。 */
	columnIndex: number;
};

/** Table全体で実際に移動する列。 */
export type ColumnReorderTarget = {
	kind: 'column';
	clientId: string;
	/** 論理Tableグリッド上の0-based列インデックス。 */
	columnIndex: number;
};

/** 列Reorder Target Resolutionの判定結果。 */
export type ColumnReorderTargetResolutionResult =
	ReorderTargetResolutionResult< ColumnReorderTarget >;

/**
 * 列DnD開始試行をTable全体のReorder Targetとして判定する。
 *
 * @param request   DnD Interactionから渡された列DnD開始試行。
 * @param structure 要求時点の共通Table構造。
 * @return 列のReorder TargetとReorder Constraints、または開始できない理由。
 */
export const resolveColumnReorderTarget = (
	request: ColumnReorderTargetResolutionRequest,
	structure: TableStructure
): ColumnReorderTargetResolutionResult => {
	const target: ColumnReorderTarget = {
		kind: 'column',
		clientId: request.clientId,
		columnIndex: request.columnIndex,
	};

	// 列DnDではTable全体の横結合だけが開始可否と移動先制約に影響する。
	const mergedCells = structure.mergedCells.filter( ( cell ) => cell.columnSpan > 1 );

	return resolveTargetWithinScope( target, request.columnIndex, mergedCells, {
		getStart: ( cell ) => cell.columnStart,
		getSpan: ( cell ) => cell.columnSpan,
	} );
};

/**
 * 列のReorder Targetから、Data Updateが利用する共通の移動元位置を取得する。
 *
 * `columnIndex`の意味は列並び替え責務が所有し、共通Data Updateは列固有のTarget構造を直接解釈しない。
 *
 * @param target Table全体で確定した列のReorder Target。
 * @return 論理Tableグリッド上の0-based移動元位置。
 */
export const getColumnReorderSourceIndex = ( target: ColumnReorderTarget ): number =>
	target.columnIndex;
