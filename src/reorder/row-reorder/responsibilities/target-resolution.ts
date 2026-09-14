/**
 * 行並び替え開始前の移動対象解決を所有する。
 *
 * 要求時点のTable制約に対して指定された行が移動対象として成立するかを解決し、
 * 開始可能な場合はReorder Targetと開始時制約を同じ解決結果として返す。
 * 実際のDnD開始拒否では原因となる結合セル位置もTable Integration診断から取得する。
 * 解決結果は保持せず、DnD Sessionや表示状態を所有しない。
 */

import {
	rowBlockingMergedCellDiagnostics,
	type RowBlockingMergedCell,
} from './blocking-merged-cell-diagnostics';
import { rowTableIntegration, type RowReorderConstraints } from './table-integration';
import {
	isRowReorderTargetBlockedByMergedRange,
	isRowReorderTargetInRange,
	type RowReorderTarget,
} from '@/reorder/row-reorder/domain/target-validity';

/**
 * Reorder Target Resolutionの一回性解決結果。
 *
 * Reorder Target自体には開始時制約や構造診断を含めず、解決時点だけに必要な情報は解決結果で扱う。
 */
export type RowReorderTargetResolution =
	| {
			status: 'resolved';
			target: RowReorderTarget;
			initialConstraints: RowReorderConstraints;
	  }
	| {
			status: 'rejected';
			blockingMergedCell: RowBlockingMergedCell;
	  }
	| {
			status: 'unavailable';
	  };

/** 同一Table内の開始可否表示に利用する、構造診断を持たない軽量な解決結果。 */
type RowReorderTargetPreviewResolution =
	| {
			status: 'resolved';
			target: RowReorderTarget;
			initialConstraints: RowReorderConstraints;
	  }
	| {
			status: 'rejected';
	  }
	| {
			status: 'unavailable';
	  };

/**
 * 同一Tableの現在制約を基準に、複数の移動対象候補を解決する一時的な解決境界。
 *
 * 行並び替えモード中の表示判定では、Table構造を行ごとに再取得せず同じ制約を基準に開始可否を確認できる。
 */
type RowReorderTargetResolver = {
	/**
	 * 指定行を現在の解決基準に対するReorder Targetとして解決する。
	 *
	 * @param sourceRowIndex tbody内の0-based移動元行位置。
	 * @return 開始可能なTargetと開始時制約、開始拒否、または通常の利用不能結果。
	 */
	resolve: ( sourceRowIndex: number ) => RowReorderTargetPreviewResolution;
};

/**
 * 指定された行制約に対してReorder Targetの開始可否を解決する。
 *
 * @param target             解決するReorder Target。
 * @param initialConstraints 解決基準とする開始時の行制約。
 * @return 開始可能なTargetと開始時制約、開始拒否、または通常の利用不能結果。
 */
const resolveWithConstraints = (
	target: RowReorderTarget,
	initialConstraints: RowReorderConstraints
): RowReorderTargetPreviewResolution => {
	if ( ! isRowReorderTargetInRange( target, initialConstraints ) ) {
		return { status: 'unavailable' };
	}

	if ( isRowReorderTargetBlockedByMergedRange( target, initialConstraints ) ) {
		return { status: 'rejected' };
	}

	return {
		status: 'resolved',
		target,
		initialConstraints,
	};
};

/**
 * 同一Tableの要求時点の行制約を基準とする一時的なTarget Resolverを生成する。
 *
 * Table制約を取得できない場合もresolver自体は成立させ、各候補を通常の利用不能として解決する。
 * 表示判定ではblocking merged cell診断を取得せず、同じ制約を複数候補で再利用する。
 *
 * @param tableIdentity 解決対象となるTable個体の識別値。
 * @return 同じTable制約を基準に複数の移動対象候補を解決するResolver。
 */
const createResolver = ( tableIdentity: string ): RowReorderTargetResolver => {
	const initialConstraints = rowTableIntegration.getConstraints( tableIdentity );
	const resolver: RowReorderTargetResolver = {
		resolve: ( sourceRowIndex ) => {
			if ( initialConstraints === null ) {
				return { status: 'unavailable' };
			}

			const target: RowReorderTarget = {
				tableIdentity,
				sourceRowIndex,
			};
			const resolution = resolveWithConstraints( target, initialConstraints );
			return resolution;
		},
	};
	return resolver;
};

/**
 * 要求時点のTable構造から行DnD開始対象を解決する。
 *
 * 対象Tableまたは移動元行を安全に解釈できない場合は通常の利用不能とし、
 * 結合範囲により行単位で移動できない場合だけ原因となる結合セルの行・列位置を返す。
 * 開始拒否判定後に現在Tableから診断位置を取得できなくなった場合は、位置を推測せず利用不能として扱う。
 *
 * @param target 開始を試行するReorder Target。
 * @return 開始可能なTargetと開始時制約、開始拒否のblocking merged cell、または通常の利用不能結果。
 */
const resolve = ( target: RowReorderTarget ): RowReorderTargetResolution => {
	const resolver = createResolver( target.tableIdentity );
	const resolution = resolver.resolve( target.sourceRowIndex );
	if ( resolution.status !== 'rejected' ) {
		return resolution;
	}

	const blockingMergedCell = rowBlockingMergedCellDiagnostics.getSourceBlockingMergedCell(
		target.tableIdentity,
		target.sourceRowIndex
	);
	/* 開始拒否を説明する現在の結合セル位置を取得できない場合は、古い判定だけから理由を推測しない。 */
	if ( blockingMergedCell === null ) {
		return { status: 'unavailable' };
	}

	return {
		status: 'rejected',
		blockingMergedCell,
	};
};

/** 行並び替え開始前の移動対象解決境界。 */
export const rowReorderTargetResolution = {
	createResolver,
	resolve,
};

export type { RowReorderTarget } from '@/reorder/row-reorder/domain/target-validity';
