/**
 * 行・列・RFの確認付き大規模反映を、WordPress表示責務が扱うPresentation状態へ変換する。
 *
 * 各Reorder Applyを正本として購読し、対象Tableに必要な確認内容、反映操作、反映後最終位置だけを表示側へ提供する。
 * Reorder Applyの状態や移動先の意味は所有せず、Table IntegrationやEditor DOM Contextにも依存しない。
 */

import { useSyncExternalStore } from 'react';

import { getLargeColumnReorderMoveSummary, getLargeRowReorderMoveSummary } from '@/messages';
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
import type { ReorderKind } from '@/reorder/reorder-mode';
import {
	applyRfReorder,
	cancelRfApply,
	completeRfApplyRestoration,
	continueRfApply,
	getRfApplyCoordinationSnapshot,
	getRfApplySummary,
	subscribeRfApplyCoordination,
	type RfApplyCoordinationSnapshot,
} from '@/reorder/reorder-form/responsibilities/apply-coordination';
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

/** WordPress表示責務が扱う確認付き大規模反映のPresentation状態。 */
export type ReorderApplyPresentationState =
	| { phase: 'idle' }
	| {
			phase: 'confirming';
			kind: ReorderKind;
			tableIdentity: string;
			moveSummary: string;
			confirm: () => void;
			cancel: () => void;
	  }
	| {
			phase: 'applying';
			kind: ReorderKind;
			tableIdentity: string;
			apply: () => void;
	  }
	| {
			phase: 'remounting';
			kind: ReorderKind;
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

/** ReactからRFの確認付き大規模反映状態を購読する。 */
const useRfApplyCoordinationSnapshot = (): RfApplyCoordinationSnapshot =>
	useSyncExternalStore( subscribeRfApplyCoordination, getRfApplyCoordinationSnapshot );

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
	/* 別Tableの反映状態は、現在のTableへ表示しない。 */
	if ( state.phase === 'idle' || state.move.tableIdentity !== clientId ) {
		return { phase: 'idle' };
	}

	if ( state.phase === 'applying' ) {
		return {
			phase: 'applying',
			kind: 'row',
			tableIdentity: state.move.tableIdentity,
			apply: applyLargeRowReorder,
		};
	}

	const destinationRowIndex = getLargeRowReorderDestinationRowIndex();
	/* 反映後最終位置を確定できない場合は、推測した確認内容や復帰先を表示しない。 */
	if ( destinationRowIndex === null ) {
		return { phase: 'idle' };
	}

	if ( state.phase === 'confirming' ) {
		return {
			phase: 'confirming',
			kind: 'row',
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
		kind: 'row',
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
	/* 別Tableの反映状態は、現在のTableへ表示しない。 */
	if ( state.phase === 'idle' || state.move.tableIdentity !== clientId ) {
		return { phase: 'idle' };
	}

	if ( state.phase === 'applying' ) {
		return {
			phase: 'applying',
			kind: 'column',
			tableIdentity: state.move.tableIdentity,
			apply: applyLargeColumnReorder,
		};
	}

	const destinationColumnIndex = getLargeColumnReorderDestinationColumnIndex();
	/* 反映後最終位置を確定できない場合は、推測した確認内容や復帰先を表示しない。 */
	if ( destinationColumnIndex === null ) {
		return { phase: 'idle' };
	}

	if ( state.phase === 'confirming' ) {
		return {
			phase: 'confirming',
			kind: 'column',
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
		kind: 'column',
		tableIdentity: state.move.tableIdentity,
		applied: state.applied,
		destinationIndex: destinationColumnIndex,
		complete: completeLargeColumnReorderApply,
	};
};

/**
 * RFの確認付き大規模反映を、対象Table向けPresentation状態へ変換する。
 *
 * RF Apply Coordinationが公開する利用者向け位置を正本とし、candidateやTable構造をWordPress表示責務で再解釈しない。
 *
 * @param clientId 対象Table個体のclientId。
 * @param snapshot RF Apply Coordinationが所有する現在snapshot。
 * @return 対象Tableへ表示する状態。対象外または通常状態ではidle。
 */
const adaptRfApply = (
	clientId: string,
	snapshot: RfApplyCoordinationSnapshot
): ReorderApplyPresentationState => {
	/* 別TableのRF反映状態は、現在のTableへ表示しない。 */
	if ( snapshot.phase === 'idle' || snapshot.tableIdentity !== clientId ) {
		return { phase: 'idle' };
	}

	if ( snapshot.phase === 'applying' ) {
		return {
			phase: 'applying',
			kind: snapshot.kind,
			tableIdentity: snapshot.tableIdentity,
			apply: applyRfReorder,
		};
	}

	const summary = getRfApplySummary();
	/* RF Apply Coordinationが概要を提供できない場合は、推測した確認内容や復帰先を表示しない。 */
	if ( summary === null ) {
		return { phase: 'idle' };
	}

	if ( snapshot.phase === 'confirming' ) {
		let moveSummary: string;
		/* 確認文言はRFが公開するReorder Kindと利用者向け位置だけから生成する。 */
		if ( summary.kind === 'row' ) {
			moveSummary = getLargeRowReorderMoveSummary(
				summary.sourcePosition,
				summary.destinationPosition
			);
		} else {
			moveSummary = getLargeColumnReorderMoveSummary(
				summary.sourcePosition,
				summary.destinationPosition
			);
		}

		return {
			phase: 'confirming',
			kind: snapshot.kind,
			tableIdentity: snapshot.tableIdentity,
			moveSummary,
			confirm: continueRfApply,
			cancel: cancelRfApply,
		};
	}

	return {
		phase: 'remounting',
		kind: snapshot.kind,
		tableIdentity: snapshot.tableIdentity,
		applied: snapshot.applied,
		destinationIndex: summary.destinationPosition - 1,
		complete: completeRfApplyRestoration,
	};
};

/**
 * 対象Tableへ現在表示すべき確認付き大規模反映状態を提供する。
 *
 * Row / Column / RFのApply Lifecycleは同時に複数成立しないことをInvariantとする。
 * この境界は製品入口の排他制御やInvariant違反時の仲裁を所有せず、各責務の状態をPresentationへ変換するだけとする。
 *
 * @param clientId 対象Table個体のclientId。
 * @return WordPress表示責務が扱う現在のPresentation状態。
 */
export const useReorderApplyPresentationState = (
	clientId: string
): ReorderApplyPresentationState => {
	const rowState = useLargeRowReorderApplyState();
	const columnState = useLargeColumnReorderApplyState();
	const rfSnapshot = useRfApplyCoordinationSnapshot();
	const rowPresentation = adaptRowReorderApply( clientId, rowState );
	if ( rowPresentation.phase !== 'idle' ) {
		return rowPresentation;
	}

	const columnPresentation = adaptColumnReorderApply( clientId, columnState );
	if ( columnPresentation.phase !== 'idle' ) {
		return columnPresentation;
	}

	return adaptRfApply( clientId, rfSnapshot );
};
