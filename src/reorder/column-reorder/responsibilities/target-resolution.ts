/**
 * 列並び替え開始前の移動対象解決を所有する。
 *
 * 要求時点のTable制約に対して指定された論理列が移動対象として成立するかを解決し、
 * 開始可能な場合はReorder Targetと開始時制約を同じ解決結果として返す。
 * 実際のDnD開始拒否では原因となる横結合範囲もTable Integrationから取得する。
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

/**
 * Reorder Target Resolutionの一回性解決結果。
 *
 * Reorder Target自体には開始時制約や構造診断を含めず、解決時点だけに必要な情報は解決結果で扱う。
 */
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

/** 同一Table内の開始可否表示に利用する、構造診断を持たない軽量な解決結果。 */
type ColumnReorderTargetPreviewResolution =
	| {
			status: 'resolved';
			target: ColumnReorderTarget;
			initialConstraints: ColumnReorderConstraints;
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
 * 列並び替えモード中の表示判定では、Table構造を列ごとに再取得せず同じ制約を基準に開始可否を確認できる。
 */
type ColumnReorderTargetResolver = {
	/**
	 * 指定列を現在の解決基準に対するReorder Targetとして解決する。
	 *
	 * @param sourceColumnIndex Table全体の0-based移動元論理列位置。
	 * @return 開始可能なTargetと開始時制約、開始拒否、または通常の利用不能結果。
	 */
	resolve: ( sourceColumnIndex: number ) => ColumnReorderTargetPreviewResolution;
};

/**
 * 指定された列制約に対してReorder Targetの開始可否を解決する。
 *
 * @param target             解決するReorder Target。
 * @param initialConstraints 解決基準とする開始時の列制約。
 * @return 開始可能なTargetと開始時制約、開始拒否、または通常の利用不能結果。
 */
const resolveWithConstraints = (
	target: ColumnReorderTarget,
	initialConstraints: ColumnReorderConstraints
): ColumnReorderTargetPreviewResolution => {
	/* 現在Tableに実在する論理列として解釈できない対象は、利用者向け拒否通知を作らず通常の利用不能とする。 */
	if ( ! isColumnReorderTargetInRange( target, initialConstraints ) ) {
		return { status: 'unavailable' };
	}

	if ( isColumnReorderTargetBlockedByMergedRange( target, initialConstraints ) ) {
		return { status: 'rejected' };
	}

	return {
		status: 'resolved',
		target,
		initialConstraints,
	};
};

/**
 * 同一Tableの要求時点の列制約を基準とする一時的なTarget Resolverを生成する。
 *
 * Table制約を取得できない場合もresolver自体は成立させ、各候補を通常の利用不能として解決する。
 * 表示判定ではblocking merged range診断を取得せず、同じ制約を複数候補で再利用する。
 *
 * @param tableIdentity 解決対象となるTable個体の識別値。
 * @return 同じTable制約を基準に複数の移動対象候補を解決するResolver。
 */
const createResolver = ( tableIdentity: string ): ColumnReorderTargetResolver => {
	const initialConstraints = columnTableIntegration.getConstraints( tableIdentity );
	const resolver: ColumnReorderTargetResolver = {
		resolve: ( sourceColumnIndex ) => {
			/* 要求時点でTable制約を提供できなかった場合は、そのResolver内の全候補を同じ通常の利用不能として扱う。 */
			if ( initialConstraints === null ) {
				return { status: 'unavailable' };
			}

			const target: ColumnReorderTarget = {
				tableIdentity,
				sourceColumnIndex,
			};
			const resolution = resolveWithConstraints( target, initialConstraints );
			return resolution;
		},
	};
	return resolver;
};

/**
 * 要求時点のTable構造から列DnD開始対象を解決する。
 *
 * 対象Tableまたは移動元論理列を安全に解釈できない場合は通常の利用不能とし、
 * colspanによる結合範囲により列単位で移動できない場合だけ原因となる横結合範囲を返す。
 * 開始拒否判定後に現在Tableから診断範囲を取得できなくなった場合は、範囲を推測せず利用不能として扱う。
 *
 * @param target 開始を試行するReorder Target。
 * @return 開始可能なTargetと開始時制約、開始拒否のblocking merged range、または通常の利用不能結果。
 */
const resolve = ( target: ColumnReorderTarget ): ColumnReorderTargetResolution => {
	const resolver = createResolver( target.tableIdentity );
	const resolution = resolver.resolve( target.sourceColumnIndex );
	if ( resolution.status !== 'rejected' ) {
		return resolution;
	}

	const blockingMergedRange = columnTableIntegration.getSourceBlockingMergedRange(
		target.tableIdentity,
		target.sourceColumnIndex
	);
	/* 開始拒否を説明する現在の結合範囲を取得できない場合は、古い判定だけから理由を推測しない。 */
	if ( blockingMergedRange === null ) {
		return { status: 'unavailable' };
	}

	return {
		status: 'rejected',
		blockingMergedRange,
	};
};

/**
 * 列並び替え開始前の移動対象解決境界。
 *
 * 要求時点の現在制約から開始候補を解決し、実際の開始拒否時だけ現在のblocking merged rangeを診断する。
 */
export const columnReorderTargetResolution = {
	createResolver,
	resolve,
};

export type { ColumnReorderTarget } from '@/reorder/column-reorder/domain/target-validity';
