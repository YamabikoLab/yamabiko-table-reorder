/**
 * Row RF Resolutionとして、解釈済みの行指定を要求時点の現在Tableへ照合し、行移動候補、no-op、構造拒否、利用不能を解決する。
 *
 * この責務は状態やTable snapshotを保持せず、Row Table Integrationを正本として現在位置と結合セル制約を評価する。
 * 解決済み候補はApply時点の成立保証ではなく、後続責務が再照合するための要求時点候補として公開する。
 */

import {
	rowBlockingMergedCellDiagnostics,
	type RowBlockingMergedCell,
} from '@/reorder/row-reorder/responsibilities/blocking-merged-cell-diagnostics';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import type { RowRfSpecification } from './input-interpretation';

export type RowRfMoveCandidate = {
	clientId: string;
	sourceRowIndex: number;
	destinationBoundaryIndex: number;
};

export type RowRfResolution =
	| {
			status: 'resolved';
			candidate: RowRfMoveCandidate;
	  }
	| {
			status: 'no-op';
	  }
	| {
			status: 'rejected';
			blockingMergedCell: RowBlockingMergedCell;
	  }
	| {
			status: 'unavailable';
	  };

/** 解釈済みRow RF指定を、要求時点の現在Tableへ照合して解決する。 */
const resolve = ( clientId: string, specification: RowRfSpecification ): RowRfResolution => {
	const constraints = rowTableIntegration.getConstraints( clientId );
	if ( constraints === null ) {
		return { status: 'unavailable' };
	}

	const sourceInRange =
		Number.isInteger( specification.sourceRowIndex ) &&
		specification.sourceRowIndex >= 0 &&
		specification.sourceRowIndex < constraints.rowCount;
	const targetInRange =
		Number.isInteger( specification.targetRowIndex ) &&
		specification.targetRowIndex >= 0 &&
		specification.targetRowIndex < constraints.rowCount;
	if ( ! sourceInRange || ! targetInRange ) {
		return { status: 'unavailable' };
	}

	const destinationBoundaryIndex =
		specification.position === 'above'
			? specification.targetRowIndex
			: specification.targetRowIndex + 1;
	const destinationInRange =
		Number.isInteger( destinationBoundaryIndex ) &&
		destinationBoundaryIndex >= 0 &&
		destinationBoundaryIndex <= constraints.rowCount;
	if ( ! destinationInRange ) {
		return { status: 'unavailable' };
	}

	const noOrderChange =
		destinationBoundaryIndex === specification.sourceRowIndex ||
		destinationBoundaryIndex === specification.sourceRowIndex + 1;
	if ( noOrderChange ) {
		return { status: 'no-op' };
	}

	const candidate: RowRfMoveCandidate = {
		clientId,
		sourceRowIndex: specification.sourceRowIndex,
		destinationBoundaryIndex,
	};
	const blockingMergedRange = rowTableIntegration.getBlockingMergedRange( candidate );
	if ( blockingMergedRange !== null ) {
		const blockingMergedCell = rowBlockingMergedCellDiagnostics.getBlockingMergedCell( candidate );
		/* Table Integrationの拒否を説明する現在の結合セル位置を取得できない場合は理由を推測しない。 */
		if ( blockingMergedCell === null ) {
			return { status: 'unavailable' };
		}
		return {
			status: 'rejected',
			blockingMergedCell,
		};
	}

	return {
		status: 'resolved',
		candidate,
	};
};

export const rowRfResolution = {
	resolve,
};
