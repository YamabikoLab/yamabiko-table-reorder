/**
 * Column RF Resolutionとして、解釈済みの列指定を要求時点の現在Tableへ照合し、列移動候補、no-op、構造拒否、利用不能を解決する。
 *
 * この責務は状態やTable snapshotを保持せず、Column Table Integrationを正本として現在位置と結合セル制約を評価する。
 * 解決済み候補はApply時点の成立保証ではなく、後続責務が再照合するための要求時点候補として公開する。
 */

import {
	columnBlockingMergedCellDiagnostics,
	type ColumnBlockingMergedCell,
} from '@/reorder/column-reorder/responsibilities/blocking-merged-cell-diagnostics';
import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';

import type { ColumnRfSpecification } from './input-interpretation';

export type ColumnRfMoveCandidate = {
	clientId: string;
	sourceColumnIndex: number;
	destinationBoundaryIndex: number;
};

export type ColumnRfResolution =
	| {
			status: 'resolved';
			candidate: ColumnRfMoveCandidate;
	  }
	| {
			status: 'no-op';
	  }
	| {
			status: 'rejected';
			blockingMergedCell: ColumnBlockingMergedCell;
	  }
	| {
			status: 'unavailable';
	  };

/** 解釈済みColumn RF指定を、要求時点の現在Tableへ照合して解決する。 */
const resolve = ( clientId: string, specification: ColumnRfSpecification ): ColumnRfResolution => {
	const constraints = columnTableIntegration.getConstraints( clientId );
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
	if ( ! destinationInRange ) {
		return { status: 'unavailable' };
	}

	const noOrderChange =
		destinationBoundaryIndex === specification.sourceColumnIndex ||
		destinationBoundaryIndex === specification.sourceColumnIndex + 1;
	if ( noOrderChange ) {
		return { status: 'no-op' };
	}

	const candidate: ColumnRfMoveCandidate = {
		clientId,
		sourceColumnIndex: specification.sourceColumnIndex,
		destinationBoundaryIndex,
	};
	const blockingMergedRange = columnTableIntegration.getBlockingMergedRange( candidate );
	if ( blockingMergedRange !== null ) {
		const blockingMergedCell = columnBlockingMergedCellDiagnostics.getBlockingMergedCell( candidate );
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

export const columnRfResolution = {
	resolve,
};
