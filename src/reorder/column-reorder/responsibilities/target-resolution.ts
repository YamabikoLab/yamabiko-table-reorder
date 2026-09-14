/**
 * 列並び替え開始前の移動対象解決を所有する。
 *
 * 要求時点のTable制約に対して指定された論理列が移動対象として成立するかを一回解決し、
 * 開始可能な場合はReorder Targetと開始時制約、結合セルによる開始拒否時は原因位置を返す。
 * 解決結果は保持せず、DnD Sessionや表示状態を所有しない。
 */

import {
	columnTableIntegration,
	type ColumnBlockingMergedRange,
	type ColumnReorderConstraints,
} from './table-integration';
import {
	isColumnReorderTargetBlockedByMergedRange,
	isColumnReorderTargetInRange,
	type ColumnReorderTarget,
} from '@/reorder/column-reorder/domain/target-validity';

/** Reorder Target Resolutionの解決結果。 */
export type ColumnReorderTargetResolution =
	| {
			status: 'resolved';
			target: ColumnReorderTarget;
			initialConstraints: ColumnReorderConstraints;
	  }
	| {
			status: 'rejected';
			blockingMergedRange: ColumnBlockingMergedRange;
	  }
	| {
			status: 'unavailable';
	  };

/**
 * 要求時点のTable構造から列DnD開始対象を解決する。
 *
 * 対象Tableまたは移動元論理列を安全に解釈できない場合は通常の利用不能とする。
 * 横結合範囲により列単位で移動できない場合は、利用者が原因セルを特定できる位置を返す。
 * 制約判定後の現在Tableから原因位置を診断できない場合は、理由を推測せず利用不能とする。
 *
 * @param target 開始を試行するReorder Target。
 * @return 開始可能なTargetと開始時制約、原因となる結合セル位置、または通常の利用不能結果。
 */
export const resolveColumnReorderTarget = (
	target: ColumnReorderTarget
): ColumnReorderTargetResolution => {
	const initialConstraints = columnTableIntegration.getConstraints( target.tableIdentity );
	if ( initialConstraints === null ) {
		return { status: 'unavailable' };
	}

	if ( ! isColumnReorderTargetInRange( target, initialConstraints ) ) {
		return { status: 'unavailable' };
	}

	if ( isColumnReorderTargetBlockedByMergedRange( target, initialConstraints ) ) {
		const blockingMergedRange = columnTableIntegration.getSourceBlockingMergedRange(
			target.tableIdentity,
			target.sourceColumnIndex
		);
		/* 現在Tableから原因位置を確定できない拒否結果は、利用者向け理由として公開しない。 */
		if ( blockingMergedRange === null ) {
			return { status: 'unavailable' };
		}

		return {
			status: 'rejected',
			blockingMergedRange,
		};
	}

	return {
		status: 'resolved',
		target,
		initialConstraints,
	};
};

export type { ColumnReorderTarget } from '@/reorder/column-reorder/domain/target-validity';
