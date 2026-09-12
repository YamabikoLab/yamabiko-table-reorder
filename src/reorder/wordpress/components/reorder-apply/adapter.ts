/**
 * Row / Columnの確認付き大規模反映Lifecycleを、WordPress表示責務が扱う最小のPresentation状態へ変換する。
 *
 * 方向固有Storeを正本として購読し、表示に必要な対象Table、移動概要、Lifecycle操作、反映後最終位置だけを受け渡す。
 * 状態やMove意味は所有せず、Table IntegrationやEditor DOM Contextへは依存しない。
 */

import { useSyncExternalStore } from 'react';

import {
	getLargeColumnReorderMoveSummary,
	getLargeRowReorderMoveSummary,
} from '@/messages';
import {
	applyLargeColumnReorder,
	cancelLargeColumnReorderApply,
	completeLargeColumnReorderApply,
	confirmLargeColumnReorderApply,
	getLargeColumnReorderApplyState,
	getLargeColumnReorderDestinationColumnIndex,
	subscribeLargeColumnReorderApply,
	type LargeColumnReorderApplyState,
} from '@/reorder/column-reorder/responsibilities/reorder-apply';
import {
	applyLargeRowReorder,
	cancelLargeRowReorderApply,
	completeLargeRowReorderApply,
	confirmLargeRowReorderApply,
	getLargeRowReorderApplyState,
	getLargeRowReorderDestinationRowIndex,
	subscribeLargeRowReorderApply,
	type LargeRowReorderApplyState,
} from '@/reorder/row-reorder/responsibilities/reorder-apply';

/** WordPress表示責務が扱う確認付き大規模反映の方向。 */
export type ReorderApplyDirection = 'row' | 'column';

/** WordPress表示責務が扱う確認付き大規模反映のPresentation状態。 */
export type ReorderApplyPresentationState =
	| { phase: 'idle' }
	| {
			phase: 'confirming';
			direction: ReorderApplyDirection;
			tableIdentity: string;
			moveSummary: string;
			confirm: () => void;
			cancel: () => void;
	  }
	| {
			phase: 'applying';
			direction: ReorderApplyDirection;
			tableIdentity: string;
			apply: () => void;
	  }
	| {
			phase: 'remounting';
			direction: ReorderApplyDirection;
			tableIdentity: string;
			applied: boolean;
			destinationIndex: number;
			complete: () => void;
	  };

/** Reactから行の確認付き大規模反映状態を購読する。 */
const useLargeRowReorderApplyState = (): LargeRowReorderApplyState =>
	useSyncExternalStore( subscribeLargeRowReorderApply, getLargeRowReorderApplyState );

/** Reactから列の確認付き大規模反映状態を購読する。 */
const useLargeColumnReorderApplyState = (): LargeColumnReorderApplyState =>
	useSyncExternalStore( subscribeLargeColumnReorderApply, getLargeColumnReorderApplyState );

/**
 * 行の確認付き大規模反映を、対象Table向けPresentation状態へ変換する。
 *
 * @param clientId 対象Table個体のclientId。
 * @param state    Row Reorder Applyが所有する現在状態。
 * @return 対象Tableへ表示する状態。対象外または通常状態ではidle。
 */
const adaptRowReorderApply = (
	clientId: string,
	state: LargeRowReorderApplyState
): ReorderApplyPresentationState => {
	if ( state.phase === 'idle' || state.move.tableIdentity !== clientId ) {
		return { phase: 'idle' };
	}

	if ( state.phase === 'applying' ) {
		return {
			phase: 'applying',
			direction: 'row',
			tableIdentity: state.move.tableIdentity,
			apply: applyLargeRowReorder,
		};
	}

	const destinationRowIndex = getLargeRowReorderDestinationRowIndex();
	if ( destinationRowIndex === null ) {
		return { phase: 'idle' };
	}

	if ( state.phase === 'confirming' ) {
		return {
			phase: 'confirming',
			direction: 'row',
			tableIdentity: state.move.tableIdentity,
			moveSummary: getLargeRowReorderMoveSummary(
				state.move.sourceRowIndex + 1,
				destinationRowIndex + 1
			),
			confirm: confirmLargeRowReorderApply,
			cancel: cancelLargeRowReorderApply,
		};
	}

	return {
		phase: 'remounting',
		direction: 'row',
		tableIdentity: state.move.tableIdentity,
		applied: state.applied,
		destinationIndex: destinationRowIndex,
		complete: completeLargeRowReorderApply,
	};
};

/**
 * 列の確認付き大規模反映を、対象Table向けPresentation状態へ変換する。
 *
 * @param clientId 対象Table個体のclientId。
 * @param state    Column Reorder Applyが所有する現在状態。
 * @return 対象Tableへ表示する状態。対象外または通常状態ではidle。
 */
const adaptColumnReorderApply = (
	clientId: string,
	state: LargeColumnReorderApplyState
): ReorderApplyPresentationState => {
	if ( state.phase === 'idle' || state.move.tableIdentity !== clientId ) {
		return { phase: 'idle' };
	}

	if ( state.phase === 'applying' ) {
		return {
			phase: 'applying',
			direction: 'column',
			tableIdentity: state.move.tableIdentity,
			apply: applyLargeColumnReorder,
		};
	}

	const destinationColumnIndex = getLargeColumnReorderDestinationColumnIndex();
	if ( destinationColumnIndex === null ) {
		return { phase: 'idle' };
	}

	if ( state.phase === 'confirming' ) {
		return {
			phase: 'confirming',
			direction: 'column',
			tableIdentity: state.move.tableIdentity,
			moveSummary: getLargeColumnReorderMoveSummary(
				state.move.sourceColumnIndex + 1,
				destinationColumnIndex + 1
			),
			confirm: confirmLargeColumnReorderApply,
			cancel: cancelLargeColumnReorderApply,
		};
	}

	return {
		phase: 'remounting',
		direction: 'column',
		tableIdentity: state.move.tableIdentity,
		applied: state.applied,
		destinationIndex: destinationColumnIndex,
		complete: completeLargeColumnReorderApply,
	};
};

/**
 * 対象Tableへ現在表示すべき確認付き大規模反映状態を提供する。
 *
 * Row / Columnが同時に対象となることは各Lifecycleの通常契約では想定しないが、既存境界と同じくRowを先に選択する。
 *
 * @param clientId 対象Table個体のclientId。
 * @return WordPress表示責務が扱う現在のPresentation状態。
 */
export const useReorderApplyPresentationState = (
	clientId: string
): ReorderApplyPresentationState => {
	const rowState = useLargeRowReorderApplyState();
	const columnState = useLargeColumnReorderApplyState();
	const rowPresentation = adaptRowReorderApply( clientId, rowState );
	if ( rowPresentation.phase !== 'idle' ) {
		return rowPresentation;
	}
	return adaptColumnReorderApply( clientId, columnState );
};
