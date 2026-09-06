/**
 * 行並び替え開始前の移動対象解決を所有する。
 *
 * 要求時点のTable制約に対して指定された行が移動対象として成立するかを解決し、
 * 開始可能な場合はReorder Targetと開始時制約を同じ解決結果として返す。
 * 解決結果は保持せず、DnD Sessionや表示状態を所有しない。
 */

import { rowTableIntegration, type RowReorderConstraints } from './table-integration';

/** 行並び替えで移動する行を識別するReorder Target。 */
export type RowReorderTarget = {
	/** 行並び替え対象のTable個体を識別する値。 */
	tableIdentity: string;
	/** tbody内の0-based移動元行位置。 */
	sourceRowIndex: number;
};

/** Designで利用者へ理由を提示する開始拒否理由。 */
export type RowReorderTargetRejectionReason = 'merged-range';

/**
 * Reorder Target Resolutionの解決結果。
 *
 * Reorder Target自体には開始時制約や拒否理由を含めず、解決時点だけに必要な情報は解決結果で扱う。
 */
export type RowReorderTargetResolution =
	| {
			status: 'resolved';
			target: RowReorderTarget;
			initialConstraints: RowReorderConstraints;
	  }
	| {
			status: 'rejected';
			reason: RowReorderTargetRejectionReason;
	  }
	| {
			status: 'unavailable';
	  };

/**
 * 同一Tableの現在制約を基準に、複数の移動対象候補を解決する一時的な解決境界。
 *
 * 行並び替えモード中の表示判定では、Table構造を行ごとに再取得せず同じ制約を基準に開始可否を確認できる。
 */
export type RowReorderTargetResolver = {
	/**
	 * 指定行を現在の解決基準に対するReorder Targetとして解決する。
	 *
	 * @param sourceRowIndex tbody内の0-based移動元行位置。
	 * @return 開始可能なTargetと開始時制約、開始拒否理由、または通常の利用不能結果。
	 */
	resolve: ( sourceRowIndex: number ) => RowReorderTargetResolution;
};

/**
 * 移動対象行が指定された行制約のtbody内に実在するか判定する。
 *
 * @param sourceRowIndex 移動対象の0-based行位置。
 * @param constraints    判定基準とする行制約。
 * @return tbody内の実在行として扱える場合はtrue。
 */
const isSourceInRange = ( sourceRowIndex: number, constraints: RowReorderConstraints ): boolean => {
	const sourceInRange =
		Number.isInteger( sourceRowIndex ) &&
		sourceRowIndex >= 0 &&
		sourceRowIndex < constraints.rowCount;
	return sourceInRange;
};

/**
 * 移動対象行がrowspan等による結合範囲のため行単位で移動できないか判定する。
 *
 * @param sourceRowIndex 移動対象の0-based行位置。
 * @param constraints    判定基準とする行制約。
 * @return 移動対象行の直前または直後が分断不可境界の場合はtrue。
 */
const isSourceBlockedByMergedRange = (
	sourceRowIndex: number,
	constraints: RowReorderConstraints
): boolean => {
	const sourceBlockedByMergedRange =
		constraints.blockedBoundaries.includes( sourceRowIndex ) ||
		constraints.blockedBoundaries.includes( sourceRowIndex + 1 );
	return sourceBlockedByMergedRange;
};

/**
 * 指定されたReorder Targetが現在の行制約に対して行単位で移動可能か判定する。
 *
 * complete時の再照合でも開始時と同じ移動対象ルールを利用し、開始可否と確定可否で判定を重複させない。
 *
 * @param target      判定するReorder Target。
 * @param constraints 判定基準とする現在の行制約。
 * @return 行単位の移動でTable構造を保持できる場合はtrue。
 */
export const isRowReorderTargetMovable = (
	target: RowReorderTarget,
	constraints: RowReorderConstraints
): boolean => {
	if ( ! isSourceInRange( target.sourceRowIndex, constraints ) ) {
		return false;
	}

	const sourceBlockedByMergedRange = isSourceBlockedByMergedRange(
		target.sourceRowIndex,
		constraints
	);
	const sourceMovable = ! sourceBlockedByMergedRange;
	return sourceMovable;
};

/**
 * 指定された行制約に対してReorder Targetを解決する。
 *
 * @param target             解決するReorder Target。
 * @param initialConstraints 解決基準とする開始時の行制約。
 * @return 開始可能なTargetと開始時制約、Design上の開始拒否理由、または通常の利用不能結果。
 */
const resolveWithConstraints = (
	target: RowReorderTarget,
	initialConstraints: RowReorderConstraints
): RowReorderTargetResolution => {
	if ( ! isSourceInRange( target.sourceRowIndex, initialConstraints ) ) {
		return { status: 'unavailable' };
	}

	if ( isSourceBlockedByMergedRange( target.sourceRowIndex, initialConstraints ) ) {
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
 * 同一Tableの要求時点の行制約を基準とする一時的なTarget Resolverを生成する。
 *
 * Table制約を取得できない場合もresolver自体は成立させ、各候補を通常の利用不能として解決する。
 * これによりPresentationはTable Integrationへ直接依存せず、開始可否判定の意味をTarget Resolutionへ統一できる。
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
 * 結合範囲により行単位で移動できない場合だけDesign上の開始拒否理由を返す。
 *
 * @param target 開始を試行するReorder Target。
 * @return 開始可能なTargetと開始時制約、Design上の開始拒否理由、または通常の利用不能結果。
 */
const resolve = ( target: RowReorderTarget ): RowReorderTargetResolution => {
	const resolver = createResolver( target.tableIdentity );
	const resolution = resolver.resolve( target.sourceRowIndex );
	return resolution;
};

/** 行並び替え開始前の移動対象解決境界。 */
export const rowReorderTargetResolution = {
	createResolver,
	resolve,
};
