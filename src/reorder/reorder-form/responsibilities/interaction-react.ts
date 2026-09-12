/**
 * RF Interactionが所有する共有状態をReactへ接続する境界を提供する。
 *
 * React側はRF Sessionの正本や状態変更操作を持たず、対象Tableから見た現在方向の表示状態だけを継続購読する。
 * Table変更の検知や再評価通知はこのHookの責務に含めない。
 */

import { useStore } from 'zustand';

import type { ColumnInputDescriptor } from '@/reorder/column-reorder/responsibilities/table-integration';

import type { ColumnRfFormInput, RowRfFormInput } from './input-interpretation';
import {
	rfInteractionStore,
	type RfColumnCurrentResult,
	type RfDirection,
	type RfRowCurrentResult,
} from './interaction';

/** React UIへ公開する対象Table視点のRF Interaction状態。 */
export type RfInteractionReactState =
	| { status: 'closed' }
	| {
			status: 'open';
			direction: 'row';
			input: RowRfFormInput;
			rowCount: number | null;
			result: RfRowCurrentResult;
			canApply: boolean;
	  }
	| {
			status: 'open';
			direction: 'column';
			input: ColumnRfFormInput;
			columns: readonly ColumnInputDescriptor[];
			result: RfColumnCurrentResult;
			canApply: boolean;
	  }
	| {
			status: 'applying';
			direction: RfDirection;
	  };

/** 別TableまたはSession終了時に共有する不変のclosed表示状態。 */
const CLOSED_STATE: RfInteractionReactState = { status: 'closed' };

/**
 * 対象Tableから見たRF Interaction状態をReact描画へ反映する。
 *
 * 現在Session対象と異なるTableからの購読はclosedとして扱う。
 * Row / Columnのopen状態では現在方向に必要な項目だけを公開し、candidateや非表示方向の入力は返さない。
 *
 * @param tableIdentity RF状態を購読するTable Identity。
 * @return 対象Tableから見た現在RF Interaction表示状態。
 */
export const useRfInteraction = ( tableIdentity: string ): RfInteractionReactState => {
	const state = useStore( rfInteractionStore, ( store ) => {
		const session = store.session;
		if ( session.status === 'closed' || session.tableIdentity !== tableIdentity ) {
			return CLOSED_STATE;
		}

		if ( session.status === 'applying' ) {
			const applyingState: RfInteractionReactState = {
				status: 'applying',
				direction: session.direction,
			};
			return applyingState;
		}

		if ( session.direction === 'row' && session.evaluation.direction === 'row' ) {
			const result = session.evaluation.result;
			const rowState: RfInteractionReactState = {
				status: 'open',
				direction: 'row',
				input: session.rowInput,
				rowCount: session.evaluation.rowCount,
				result,
				canApply: result.status === 'resolved',
			};
			return rowState;
		}

		if ( session.direction === 'column' && session.evaluation.direction === 'column' ) {
			const result = session.evaluation.result;
			const columnState: RfInteractionReactState = {
				status: 'open',
				direction: 'column',
				input: session.columnInput,
				columns: session.evaluation.columns,
				result,
				canApply: result.status === 'resolved',
			};
			return columnState;
		}

		return CLOSED_STATE;
	} );

	return state;
};
