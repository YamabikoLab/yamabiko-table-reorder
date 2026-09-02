/**
 * 行専用Reorder Target Resolutionとして、DnD開始試行時の論理開始位置からtbodyの移動対象行を解決し、現在のTable構造で行単位の移動対象として成立するかを判定する。
 *
 * 判定は要求時点のTable Integrationから取得した現在構造だけを利用し、判定結果やTable構造を状態として保持しない。
 * 開始対象外、現在構造の利用不能、縦結合により行単位で移動できない状態は、内部Errorではなく正常な開始拒否結果として返す。
 */

import { rowTableIntegration } from './table-integration';

/** 行DnD開始試行でReorder Target Resolutionへ渡す論理開始位置。 */
export type RowReorderStartPosition = {
	/** 開始試行の対象Table個体を識別する値。 */
	tableIdentity: string;
	/** 開始位置が属するTable section。 */
	section: 'head' | 'body' | 'foot';
	/** section内の0-based行位置。 */
	rowIndex: number;
};

/** 行DnDで実際に移動するtbody内の行。 */
export type RowReorderTarget = {
	/** 移動対象が属するTable個体を識別する値。 */
	tableIdentity: string;
	/** tbody内の0-based行位置。 */
	rowIndex: number;
};

/** 行DnDを開始できない正常な理由。 */
export type RowReorderTargetResolutionFailureReason =
	| 'table-structure-unavailable'
	| 'target-out-of-scope'
	| 'merged-cell';

/** DnD開始試行時の行移動対象解決結果。 */
export type RowReorderTargetResolutionResult =
	| {
			status: 'movable';
			target: RowReorderTarget;
	  }
	| {
			status: 'immovable';
			reason: RowReorderTargetResolutionFailureReason;
	  };

/**
 * DnD開始試行の論理開始位置から、現在のTableで移動可能なtbody行を解決する。
 *
 * @param startPosition DnD開始試行時のTable上の論理位置。
 * @return 移動可能な行、または開始できない正常な理由。
 */
const resolve = ( startPosition: RowReorderStartPosition ): RowReorderTargetResolutionResult => {
	/* 行DnDの対象範囲はtbodyだけであるため、他sectionの開始位置はTable構造を参照せず対象外とする。 */
	if ( startPosition.section !== 'body' || ! Number.isInteger( startPosition.rowIndex ) ) {
		return {
			status: 'immovable',
			reason: 'target-out-of-scope',
		};
	}

	const structure = rowTableIntegration.getStructure( startPosition.tableIdentity );
	/* 対応Tableが消失した場合や現在構造を安全に取得できない場合は、外部状態による正常な開始不能として扱う。 */
	if ( structure === null ) {
		return {
			status: 'immovable',
			reason: 'table-structure-unavailable',
		};
	}

	/* tbody外の行位置は移動対象として成立させない。 */
	if ( startPosition.rowIndex < 0 || startPosition.rowIndex >= structure.rowCount ) {
		return {
			status: 'immovable',
			reason: 'target-out-of-scope',
		};
	}

	/*
	 * 縦結合を跨ぐ境界の直前または直後にある行は、その結合範囲の一部であり、行単位で独立して移動するとtbody構造を保持できない。
	 */
	const isInsideMergedRange =
		structure.blockedBoundaries.includes( startPosition.rowIndex ) ||
		structure.blockedBoundaries.includes( startPosition.rowIndex + 1 );
	if ( isInsideMergedRange ) {
		return {
			status: 'immovable',
			reason: 'merged-cell',
		};
	}

	return {
		status: 'movable',
		target: {
			tableIdentity: startPosition.tableIdentity,
			rowIndex: startPosition.rowIndex,
		},
	};
};

/**
 * DnD開始試行時だけ利用する行専用Reorder Target Resolutionのインタフェース。
 *
 * 判定結果やactive DnD状態を所有せず、各要求時点のTable Integrationから現在構造を取得して判定する。
 */
export const rowReorderTargetResolution = {
	resolve,
};
