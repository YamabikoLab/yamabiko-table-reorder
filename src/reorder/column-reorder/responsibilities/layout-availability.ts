/**
 * Column DnD Layout Availabilityとして、要求時点のEditor DOMに横方向の1次元列配置が成立するかを判定する。
 *
 * 表示方式や論理列の移動可否は識別せず、DOMセルから観測した論理列境界の整合性と論理進行方向だけを評価する。
 * 永続状態、Session状態、監視、UI、移動先解決は所有しない。
 */

import {
	measureTableColumnBoundaryObservations,
	type ColumnBoundaryObservation,
} from '@/reorder/column-reorder/infrastructure/column-geometry';

/** Column DnDの現在物理配置が操作モデルを成立させられるかを表す。 */
export type ColumnDndLayoutAvailability = 'available' | 'unavailable';

/** DOM計測誤差と物理的に区別できない境界差を判定する許容値。 */
const BOUNDARY_OFFSET_TOLERANCE = 1;

/** 同じ論理列境界から得た物理位置の範囲。 */
type ObservedBoundaryRange = {
	index: number;
	minimumOffset: number;
	maximumOffset: number;
};

/**
 * 論理列境界の全観測値を、同一境界の物理位置範囲へまとめる。
 *
 * @param observations 現在のEditor DOMから得た論理列境界の全観測値。
 * @return 論理列順の物理位置範囲。不正な観測値を含む場合はnull。
 */
const createObservedBoundaryRanges = (
	observations: readonly ColumnBoundaryObservation[]
): readonly ObservedBoundaryRange[] | null => {
	const offsetsByBoundary = new Map< number, number[] >();

	/* 各論理境界の整合性を全セルにわたって評価できるよう、同じ境界の観測位置を一つの集合へ集約する。 */
	for ( const observation of observations ) {
		if ( ! Number.isInteger( observation.index ) || ! Number.isFinite( observation.offset ) ) {
			return null;
		}

		const offsets = offsetsByBoundary.get( observation.index ) ?? [];
		offsets.push( observation.offset );
		offsetsByBoundary.set( observation.index, offsets );
	}

	return Array.from( offsetsByBoundary, ( [ index, offsets ] ) => ( {
		index,
		minimumOffset: Math.min( ...offsets ),
		maximumOffset: Math.max( ...offsets ),
	} ) ).sort( ( first, second ) => first.index - second.index );
};

/**
 * 観測済み論理列境界がColumn DnDに利用できる横方向の1次元配置を形成するか評価する。
 *
 * 未観測の論理境界は補完せず、観測できた境界だけについて同一境界の位置整合性と、互いに区別可能な前進を要求する。
 * 判定不能または安全に移動先を区別できない配置は利用不可とする。
 *
 * @param observations 現在のEditor DOMから得た論理列境界の全観測値。
 * @return 現在の物理配置に対するColumn DnD利用可否。
 */
export const evaluateColumnDndLayoutAvailability = (
	observations: readonly ColumnBoundaryObservation[]
): ColumnDndLayoutAvailability => {
	const boundaryRanges = createObservedBoundaryRanges( observations );

	/* 移動先を物理位置から区別するには、少なくとも二つの論理境界を安全に観測できる必要がある。 */
	if ( boundaryRanges === null || boundaryRanges.length < 2 ) {
		return 'unavailable';
	}

	/* 同一論理境界が複数セルで異なる位置を示す配置は、一つの横方向境界として解釈しない。 */
	if (
		boundaryRanges.some(
			( boundary ) => boundary.maximumOffset - boundary.minimumOffset > BOUNDARY_OFFSET_TOLERANCE
		)
	) {
		return 'unavailable';
	}

	/* 観測できた境界だけを論理順に照合し、誤差を超えて明確に前進しない配置では物理移動先を成立させない。 */
	for ( let index = 1; index < boundaryRanges.length; index += 1 ) {
		const previousBoundary = boundaryRanges[ index - 1 ];
		const currentBoundary = boundaryRanges[ index ];

		if (
			previousBoundary === undefined ||
			currentBoundary === undefined ||
			currentBoundary.minimumOffset - previousBoundary.maximumOffset <= BOUNDARY_OFFSET_TOLERANCE
		) {
			return 'unavailable';
		}
	}

	return 'available';
};

/**
 * 対象Tableの要求時点のEditor DOMを計測し、Column DnDの物理操作可否を返す。
 *
 * @param table 現在表示されている対象Table。解決できない場合はnull。
 * @return 現在の物理配置に対するColumn DnD利用可否。
 */
export const resolveColumnDndLayoutAvailability = (
	table: HTMLTableElement | null
): ColumnDndLayoutAvailability => {
	if ( table === null ) {
		return 'unavailable';
	}

	const observations = measureTableColumnBoundaryObservations( table );
	return evaluateColumnDndLayoutAvailability( observations );
};
