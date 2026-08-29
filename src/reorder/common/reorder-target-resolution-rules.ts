/**
 * 行・列のReorder Target Resolutionで同じ意味を持つ開始可否と並び替え制約の規則を提供する。
 *
 * 方向固有の対象範囲、位置、結合方向は各Reorder責務が解釈し、この共通責務は論理インデックス、
 * 結合範囲内部、禁止境界という方向非依存の規則だけを扱う。
 */
import type { TableMergedCellStructure } from '@/reorder/table-integration';

/** 1回のDnD中に移動先判定で利用する構造上の並び替え制約。 */
export type ReorderConstraints = {
	blockedBoundaries: readonly number[];
};

/** Reorder Target ResolutionがDnDを開始できない理由。 */
export type ReorderTargetResolutionFailureReason =
	| 'table-structure-unavailable'
	| 'target-out-of-scope'
	| 'merged-cell';

/** 対象方向の開始位置と占有数を結合セルから取得する規則。 */
export type ReorderTargetAxis = {
	/**
	 * @param cell 共通Table構造上の結合セル。
	 * @return 対象方向の0-based開始インデックス。
	 */
	getStart: ( cell: TableMergedCellStructure ) => number;
	/**
	 * @param cell 共通Table構造上の結合セル。
	 * @return 対象方向に占有する行数または列数。
	 */
	getSpan: ( cell: TableMergedCellStructure ) => number;
};

/** 方向固有のReorder Target Resolution結果。 */
export type ReorderTargetResolutionResult< TTarget > =
	| { status: 'movable'; target: TTarget; constraints: ReorderConstraints }
	| { status: 'immovable'; reason: ReorderTargetResolutionFailureReason };

/**
 * 対象範囲内の行または列へ共通の開始可否規則を適用する。
 *
 * @param target      方向固有責務が生成した並び替え対象候補。
 * @param targetIndex 対象方向の0-based論理インデックス。
 * @param mergedCells 対象方向の制約へ影響する結合セル一覧。
 * @param axis        対象方向の開始位置と占有数を取得する規則。
 * @return 開始可能な対象と制約、または開始できない理由。
 */
export const resolveTargetWithinScope = < TTarget >(
	target: TTarget,
	targetIndex: number,
	mergedCells: readonly TableMergedCellStructure[],
	axis: ReorderTargetAxis
): ReorderTargetResolutionResult< TTarget > => {
	// 並び替え対象は現在Table上の要素を示す有効な論理インデックスを持つ必要がある。
	if ( ! Number.isInteger( targetIndex ) || targetIndex < 0 ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	const isInsideMergedCell = mergedCells.some( ( cell ) => {
		const start = axis.getStart( cell );
		const span = axis.getSpan( cell );
		return targetIndex >= start && targetIndex < start + span;
	} );

	// 対象方向の結合範囲に含まれる要素は単独の行または列として移動できない。
	if ( isInsideMergedCell ) {
		return { status: 'immovable', reason: 'merged-cell' };
	}

	const boundaries = new Set< number >();

	// すべての対象方向の結合範囲について、範囲内部を分断する境界だけを禁止境界へ集約する。
	for ( const cell of mergedCells ) {
		const start = axis.getStart( cell );
		const span = axis.getSpan( cell );

		// 1つの結合範囲について外側は移動可能なまま残し、内部境界だけを禁止する。
		for ( let offset = 1; offset < span; offset++ ) {
			boundaries.add( start + offset );
		}
	}

	const blockedBoundaries = [ ...boundaries ].sort( ( left, right ) => left - right );
	return { status: 'movable', target, constraints: { blockedBoundaries } };
};
