/**
 * Column RF Resolutionとして、解釈済みの列指定を要求時点の現在Tableへ照合し、列移動候補、no-op、構造拒否、利用不能を解決する。
 *
 * この責務は状態やTable snapshotを保持せず、Column Table Integrationを正本として現在位置と結合セル制約を評価する。
 * 解決済み候補はApply時点の成立保証ではなく、後続責務が再照合するための要求時点候補として公開する。
 */

import {
	columnTableIntegration,
	type ColumnBlockingMergedRange,
} from '@/reorder/column-reorder/responsibilities/table-integration';

import type { ColumnRfSpecification } from './input-interpretation';

/** Column RF Resolutionが要求時点の現在Table上で成立すると解決した列移動候補。 */
export type ColumnRfMoveCandidate = {
	/** 対象Table個体を識別するclientId。 */
	clientId: string;
	/** 要求時点のTableを基準とする0-based移動元論理列位置。 */
	sourceColumnIndex: number;
	/** 要求時点のTableを基準とする0-based移動先列間境界。 */
	destinationBoundaryIndex: number;
};

/** Column RF Resolutionの公開結果。 */
export type ColumnRfResolution =
	| {
			/** 現在Table上で列移動候補が成立している。 */
			status: 'resolved';
			/** 後続のApply責務へ渡せる要求時点の列移動候補。 */
			candidate: ColumnRfMoveCandidate;
	  }
	| {
			/** 指定は成立しているが現在の並び順は変わらない。 */
			status: 'no-op';
	  }
	| {
			/** 結合セル制約により現在Table上で列移動が成立しない。 */
			status: 'rejected';
			/** 利用者向け理由表示に利用する最初の横結合範囲。 */
			blockingMergedRange: ColumnBlockingMergedRange;
	  }
	| {
			/** 現在Tableまたは指定位置を安全に照合できない。 */
			status: 'unavailable';
	  };

/**
 * 解釈済みColumn RF指定を、要求時点の現在Tableへ照合して解決する。
 *
 * source / targetは永続Identityではなく現在Table上の位置として扱う。
 * source / target / destinationが現在範囲に存在することを確認した後にno-opを優先し、実際に並び順が変わる候補だけ結合セル制約を評価する。
 *
 * @param clientId      Resolution対象のTable個体を識別するclientId。
 * @param specification Phase 2で成立済みとなったColumn RF内部指定。
 * @return 現在Tableを基準とするColumn RF Resolution結果。
 */
const resolve = ( clientId: string, specification: ColumnRfSpecification ): ColumnRfResolution => {
	const constraints = columnTableIntegration.getConstraints( clientId );
	/* 現在Tableを論理列構造として安全に利用できない場合は候補を推測しない。 */
	if ( constraints === null ) {
		return { status: 'unavailable' };
	}

	const sourceInRange =
		Number.isInteger( specification.sourceColumnIndex ) &&
		specification.sourceColumnIndex >= 0 &&
		specification.sourceColumnIndex < constraints.columnCount;
	const targetInRange =
		Number.isInteger( specification.targetColumnIndex ) &&
		specification.targetColumnIndex >= 0 &&
		specification.targetColumnIndex < constraints.columnCount;
	/* Phase 2後にTable範囲が変わった場合は、過去の入力成立性を現在Tableの成立保証として扱わない。 */
	if ( ! sourceInRange || ! targetInRange ) {
		return { status: 'unavailable' };
	}

	const destinationBoundaryIndex =
		specification.position === 'left'
			? specification.targetColumnIndex
			: specification.targetColumnIndex + 1;
	const destinationInRange =
		Number.isInteger( destinationBoundaryIndex ) &&
		destinationBoundaryIndex >= 0 &&
		destinationBoundaryIndex <= constraints.columnCount;
	/* 移動先境界を現在Tableへ安全に照合できない場合も利用不能として扱う。 */
	if ( ! destinationInRange ) {
		return { status: 'unavailable' };
	}

	const noOrderChange =
		destinationBoundaryIndex === specification.sourceColumnIndex ||
		destinationBoundaryIndex === specification.sourceColumnIndex + 1;
	/* 並び順を変更しない指定では、実際の移動時だけ意味を持つ結合セル制約を利用者へ拒否理由として返さない。 */
	if ( noOrderChange ) {
		return { status: 'no-op' };
	}

	const candidate: ColumnRfMoveCandidate = {
		clientId,
		sourceColumnIndex: specification.sourceColumnIndex,
		destinationBoundaryIndex,
	};
	const blockingMergedRange = columnTableIntegration.getBlockingMergedRange( candidate );
	/* 実際に並び順が変わる候補だけ、Table Integration由来の方向固有診断で構造拒否を確定する。 */
	if ( blockingMergedRange !== null ) {
		return {
			status: 'rejected',
			blockingMergedRange,
		};
	}

	return {
		status: 'resolved',
		candidate,
	};
};

/** Column RF指定を要求時点の現在Tableへ照合する方向固有Resolution境界。 */
export const columnRfResolution = {
	resolve,
};
