/**
 * 行・列のReorder Target Resolutionで共通する開始可否と並び替え制約の規則を提供する。
 *
 * 行と列で同じ意味と変更理由を持つ論理インデックス判定、結合セル占有範囲判定、禁止境界導出を
 * この責務に集約し、方向固有の対象範囲や結合方向の選択は各Reorder実装へ委ねる。
 */
import type {
	ReorderTarget,
	ReorderTargetResolutionResult,
} from '@/reorder/reorder-target-resolution';
import type { TableMergedCellStructure } from '@/reorder/table-integration';

/**
 * 対象方向の開始位置と占有数を結合セルから取得する規則。
 */
export type ReorderTargetAxis = {
	/** 対象方向の0-based開始位置を取得する。 */
	getStart: ( cell: TableMergedCellStructure ) => number;
	/** 対象方向に占有する要素数を取得する。 */
	getSpan: ( cell: TableMergedCellStructure ) => number;
};

/**
 * 並び替え対象範囲内の行または列について、対象方向の結合セル制約を適用して開始可否を判定する。
 *
 * 行・列で共通する規則として、有効な論理インデックスを持ち、対象方向の結合セルに含まれない場合だけ
 * Reorder Targetとして成立する。成立時は同じ結合セル一覧からReorder Constraintsを生成する。
 *
 * @param target 開始可能な場合に返すReorder Target候補。
 * @param targetIndex 対象方向の0-based論理インデックス。
 * @param mergedCells 対象方向の開始可否と移動先制約に影響する結合セル一覧。
 * @param axis 対象方向の開始位置と占有数を結合セルから取得する規則。
 * @return 開始可能なReorder TargetとReorder Constraints、または開始できない理由。
 */
export const resolveTargetWithinScope = (
	target: ReorderTarget,
	targetIndex: number,
	mergedCells: readonly TableMergedCellStructure[],
	axis: ReorderTargetAxis
): ReorderTargetResolutionResult => {
	// Reorder Targetは現在Table上の要素を示す有効な論理インデックスを持つ必要がある。
	if ( ! isLogicalIndex( targetIndex ) ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	// 開始対象が対象方向の結合セルに1つでも含まれる場合は、独立した行または列として移動できない。
	const isInsideMergedCell = mergedCells.some( ( cell ) =>
		containsIndex( axis.getStart( cell ), axis.getSpan( cell ), targetIndex )
	);

	// 対象方向の結合セルに含まれる要素は、単独の行または列として並び替えることができない。
	if ( isInsideMergedCell ) {
		return { status: 'immovable', reason: 'merged-cell' };
	}

	const blockedBoundaries = buildBlockedBoundaries( mergedCells, axis );

	return {
		status: 'movable',
		target,
		constraints: { blockedBoundaries },
	};
};

/**
 * 開始対象の位置がReorder Targetとして利用できる論理インデックスか判定する。
 *
 * @param index 開始対象を示す0-based論理インデックス。
 * @return 論理インデックスとして成立する場合は`true`。
 */
const isLogicalIndex = ( index: number ): boolean => Number.isInteger( index ) && index >= 0;

/**
 * 指定位置が結合セルの占有範囲に含まれるか判定する。
 *
 * @param start 結合セルが対象方向で開始する0-based論理インデックス。
 * @param span 結合セルが対象方向に占有する要素数。
 * @param index 占有範囲に含まれるか確認する0-based論理インデックス。
 * @return 指定位置が結合セルの占有範囲内の場合は`true`。
 */
const containsIndex = ( start: number, span: number, index: number ): boolean =>
	index >= start && index < start + span;

/**
 * 対象方向の結合セルから、移動先として利用できない挿入境界を導出する。
 *
 * @param mergedCells 対象方向の制約として扱う結合セル一覧。
 * @param axis 対象方向の開始位置と占有数を結合セルから取得する規則。
 * @return 移動先として利用できない挿入境界インデックス一覧。
 */
const buildBlockedBoundaries = (
	mergedCells: readonly TableMergedCellStructure[],
	axis: ReorderTargetAxis
): readonly number[] => {
	const boundaries = new Set< number >();

	// 対象方向のすべての結合セルを確認し、各結合範囲を分断する境界だけを並び替え制約へ集約する。
	for ( const cell of mergedCells ) {
		const start = axis.getStart( cell );
		const span = axis.getSpan( cell );

		// 1つの結合セルについて内部境界だけを禁止し、結合範囲の外側は移動可能な境界として残す。
		for ( let offset = 1; offset < span; offset++ ) {
			boundaries.add( start + offset );
		}
	}

	// Drop Target Resolutionが境界を一意の順序で扱えるよう、重複を除いた禁止境界を昇順で公開する。
	return [ ...boundaries ].sort( ( left, right ) => left - right );
};
