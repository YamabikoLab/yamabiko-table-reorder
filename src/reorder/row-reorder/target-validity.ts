/**
 * 行並び替え対象が指定された行制約に対して成立する共通ルールを所有する。
 *
 * Reorder Target Resolutionの開始判定とDnD Interactionのcomplete時再照合で同じルールを利用し、
 * 開始時と確定時でReorder Targetの成立条件を分岐させない。
 * Table構造の取得、解決結果、DnD Sessionは所有しない。
 */

import type { RowReorderConstraints } from './table-integration';

/** 行並び替えで移動する行を識別するReorder Target。 */
export type RowReorderTarget = {
	/** 行並び替え対象のTable個体を識別する値。 */
	tableIdentity: string;
	/** tbody内の0-based移動元行位置。 */
	sourceRowIndex: number;
};

/**
 * 指定されたReorder Targetが行制約のtbody内に実在するか判定する。
 *
 * @param target      判定するReorder Target。
 * @param constraints 判定基準とする行制約。
 * @return tbody内の実在行として扱える場合はtrue。
 */
export const isRowReorderTargetInRange = (
	target: RowReorderTarget,
	constraints: RowReorderConstraints
): boolean => {
	const targetInRange =
		Number.isInteger( target.sourceRowIndex ) &&
		target.sourceRowIndex >= 0 &&
		target.sourceRowIndex < constraints.rowCount;
	return targetInRange;
};

/**
 * 指定されたReorder Targetがrowspan等による結合範囲のため行単位で移動できないか判定する。
 *
 * @param target      判定するReorder Target。
 * @param constraints 判定基準とする行制約。
 * @return Reorder Targetの直前または直後が分断不可境界の場合はtrue。
 */
export const isRowReorderTargetBlockedByMergedRange = (
	target: RowReorderTarget,
	constraints: RowReorderConstraints
): boolean => {
	const targetBlockedByMergedRange =
		constraints.blockedBoundaries.includes( target.sourceRowIndex ) ||
		constraints.blockedBoundaries.includes( target.sourceRowIndex + 1 );
	return targetBlockedByMergedRange;
};

/**
 * 指定されたReorder Targetが現在の行制約に対して行単位で移動可能か判定する。
 *
 * Reorder Target Resolutionの開始判定とDnD Interactionのcomplete時再照合で同じ成立条件を利用する。
 *
 * @param target      判定するReorder Target。
 * @param constraints 判定基準とする行制約。
 * @return 行単位の移動でTable構造を保持できる場合はtrue。
 */
export const isRowReorderTargetMovable = (
	target: RowReorderTarget,
	constraints: RowReorderConstraints
): boolean => {
	if ( ! isRowReorderTargetInRange( target, constraints ) ) {
		return false;
	}

	const targetBlockedByMergedRange = isRowReorderTargetBlockedByMergedRange( target, constraints );
	const targetMovable = ! targetBlockedByMergedRange;
	return targetMovable;
};
