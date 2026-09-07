/**
 * 列並び替え開始前の移動対象解決を所有する。
 *
 * 要求時点のTable制約に対して指定された論理列が移動対象として成立するかを解決し、
 * 開始可能な場合はReorder Targetと開始時制約を同じ解決結果として返す。
 * 解決結果は保持せず、DnD Sessionや表示状態を所有しない。
 */

import { columnTableIntegration, type ColumnReorderConstraints } from './table-integration';
import {
	isColumnReorderTargetBlockedByMergedRange,
	isColumnReorderTargetInRange,
	type ColumnReorderTarget,
} from '@/reorder/column-reorder/domain/target-validity';

/** Designで利用者へ理由を提示する開始拒否理由。 */
export type ColumnReorderTargetRejectionReason = 'merged-range';

/**
 * Reorder Target Resolutionの解決結果。
 *
 * Reorder Target自体には開始時制約や拒否理由を含めず、解決時点だけに必要な情報は解決結果で扱う。
 */
export type ColumnReorderTargetResolution =
	| {
			status: 'resolved';
			target: ColumnReorderTarget;
			initialConstraints: ColumnReorderConstraints;
	  }
	| {
			status: 'rejected';
			reason: ColumnReorderTargetRejectionReason;
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
	 * @return 開始可能なTargetと開始時制約、開始拒否理由、または通常の利用不能結果。
	 */
	resolve: ( sourceColumnIndex: number ) => ColumnReorderTargetResolution;
};

/**
 * 指定された列制約に対してReorder Targetを解決する。
 *
 * @param target             解決するReorder Target。
 * @param initialConstraints 解決基準とする開始時の列制約。
 * @return 開始可能なTargetと開始時制約、Design上の開始拒否理由、または通常の利用不能結果。
 */
const resolveWithConstraints = (
	target: ColumnReorderTarget,
	initialConstraints: ColumnReorderConstraints
): ColumnReorderTargetResolution => {
	if ( ! isColumnReorderTargetInRange( target, initialConstraints ) ) {
		return { status: 'unavailable' };
	}

	if ( isColumnReorderTargetBlockedByMergedRange( target, initialConstraints ) ) {
		return {
			status: 'rejected',
			reason: 'merged-range',
		};
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
 * これによりPresentationはTable Integrationへ直接依存せず、開始可否判定の意味をTarget Resolutionへ統一できる。
 *
 * @param tableIdentity 解決対象となるTable個体の識別値。
 * @return 同じTable制約を基準に複数の移動対象候補を解決するResolver。
 */
const createResolver = ( tableIdentity: string ): ColumnReorderTargetResolver => {
	const initialConstraints = columnTableIntegration.getConstraints( tableIdentity );
	const resolver: ColumnReorderTargetResolver = {
		resolve: ( sourceColumnIndex ) => {
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
 * colspanによる結合範囲により列単位で移動できない場合だけDesign上の開始拒否理由を返す。
 *
 * @param target 開始を試行するReorder Target。
 * @return 開始可能なTargetと開始時制約、Design上の開始拒否理由、または通常の利用不能結果。
 */
const resolve = ( target: ColumnReorderTarget ): ColumnReorderTargetResolution => {
	const resolver = createResolver( target.tableIdentity );
	const resolution = resolver.resolve( target.sourceColumnIndex );
	return resolution;
};

/** 列並び替え開始前の移動対象解決境界。 */
export const columnReorderTargetResolution = {
	createResolver,
	resolve,
};

export type { ColumnReorderTarget } from '@/reorder/column-reorder/domain/target-validity';
