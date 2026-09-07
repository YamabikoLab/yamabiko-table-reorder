/**
 * 列並び替え対象が指定された列制約に対して成立する共通ルールを所有する。
 *
 * Reorder Target Resolutionの開始判定とDnD Interactionのcomplete時再照合で同じルールを利用し、
 * 開始時と確定時でReorder Targetの成立条件を分岐させない。
 * Table構造の取得、解決結果、DnD Sessionは所有しない。
 */

import type { ColumnReorderConstraints } from '@/reorder/column-reorder/responsibilities/table-integration';

/** 列並び替えで移動する論理列を識別するReorder Target。 */
export type ColumnReorderTarget = {
	/** 列並び替え対象のTable個体を識別する値。 */
	tableIdentity: string;
	/** Table全体の0-based移動元論理列位置。 */
	sourceColumnIndex: number;
};

/**
 * 指定されたReorder Targetが現在の論理列範囲内に実在するか判定する。
 *
 * @param target      判定するReorder Target。
 * @param constraints 判定基準とする列制約。
 * @return 現在のTableに実在する論理列として扱える場合はtrue。
 */
export const isColumnReorderTargetInRange = (
	target: ColumnReorderTarget,
	constraints: ColumnReorderConstraints
): boolean => {
	const targetInRange =
		Number.isInteger( target.sourceColumnIndex ) &&
		target.sourceColumnIndex >= 0 &&
		target.sourceColumnIndex < constraints.columnCount;
	return targetInRange;
};

/**
 * 指定されたReorder Targetがcolspanによる結合範囲のため列単位で移動できないか判定する。
 *
 * @param target      判定するReorder Target。
 * @param constraints 判定基準とする列制約。
 * @return Reorder Targetの直前または直後が分断不可境界の場合はtrue。
 */
export const isColumnReorderTargetBlockedByMergedRange = (
	target: ColumnReorderTarget,
	constraints: ColumnReorderConstraints
): boolean => {
	const targetBlockedByMergedRange =
		constraints.blockedBoundaries.includes( target.sourceColumnIndex ) ||
		constraints.blockedBoundaries.includes( target.sourceColumnIndex + 1 );
	return targetBlockedByMergedRange;
};

/**
 * 指定されたReorder Targetが現在の列制約に対して列単位で移動可能か判定する。
 *
 * Reorder Target Resolutionの開始判定とDnD Interactionのcomplete時再照合で同じ成立条件を利用する。
 *
 * @param target      判定するReorder Target。
 * @param constraints 判定基準とする列制約。
 * @return 列単位の移動でTable構造を保持できる場合はtrue。
 */
export const isColumnReorderTargetMovable = (
	target: ColumnReorderTarget,
	constraints: ColumnReorderConstraints
): boolean => {
	if ( ! isColumnReorderTargetInRange( target, constraints ) ) {
		return false;
	}

	const targetBlockedByMergedRange = isColumnReorderTargetBlockedByMergedRange(
		target,
		constraints
	);
	const targetMovable = ! targetBlockedByMergedRange;
	return targetMovable;
};
