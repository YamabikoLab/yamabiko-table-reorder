/**
 * RF Interactionが所有する共有状態をReactへ接続する境界を提供する。
 *
 * React側はRF Sessionの状態正本や状態変更操作を持たず、対象Tableから見た現在Reorder Kindの表示状態だけを継続購読する。
 * Table変更の検知や再評価通知はこのHookの責務に含めない。
 */

import { useStore } from 'zustand';

import type { ColumnInputDescriptor } from '@/reorder/column-reorder/responsibilities/table-integration';

import type { ColumnRfFormInput, RowRfFormInput } from './input-interpretation';
import {
	rfInteractionStore,
	type RfColumnCurrentResult,
	type RfRowCurrentResult,
} from './interaction';

/** React UIへ公開する対象Table視点のRF Interaction状態。 */
export type RfInteractionReactState =
	| { status: 'closed' }
	| {
			status: 'open';
			kind: 'row';
			input: RowRfFormInput;
			rowCount: number | null;
			result: RfRowCurrentResult;
			canApply: boolean;
	  }
	| {
			status: 'open';
			kind: 'column';
			input: ColumnRfFormInput;
			columns: readonly ColumnInputDescriptor[];
			result: RfColumnCurrentResult;
			canApply: boolean;
	  }
	| {
			status: 'applying';
			kind: 'row' | 'column';
	  };

/** 別TableまたはSession終了時に共有する不変のclosed表示状態。 */
const CLOSED_STATE: RfInteractionReactState = { status: 'closed' };

/**
 * 対象Tableから見たRF Interaction状態をReact描画へ反映する。
 *
 * 現在Session対象と異なるTableからの購読はclosedとして扱い、そのTableに無関係なSession更新では再描画しない。
 * Row / Columnのopen状態では現在Reorder Kindに必要な項目だけを公開し、candidateや非表示kindの入力は返さない。
 *
 * @param tableIdentity RF状態を購読するTable Identity。
 * @return 対象Tableから見た現在RF Interaction表示状態。
 */
export const useRfInteraction = ( tableIdentity: string ): RfInteractionReactState => {
	const session = useStore( rfInteractionStore, ( store ) => {
		const currentSession = store.session;

		// 対象外Tableには常に同じnullを返し、無関係なSession更新をReact更新へ伝播させない。
		if ( currentSession.status === 'closed' || currentSession.tableIdentity !== tableIdentity ) {
			return null;
		}

		return currentSession;
	} );

	// 現在Sessionの対象外TableはRF表示状態を持たない。
	if ( session === null ) {
		return CLOSED_STATE;
	}

	// Apply結果待機中は入力や評価結果を公開せず、現在Reorder Kindだけを表示状態として公開する。
	if ( session.status === 'applying' ) {
		const applyingState: RfInteractionReactState = {
			status: 'applying',
			kind: session.kind,
		};
		return applyingState;
	}

	// Row選択中はRow Reorderで再評価した表示情報だけを公開する。
	if ( session.kind === 'row' && session.evaluation.kind === 'row' ) {
		const result = session.evaluation.result;
		// Applyは現在Tableに対する指定が成立済みの場合だけ要求可能とする。
		const canApply = result.status === 'resolved';
		const rowState: RfInteractionReactState = {
			status: 'open',
			kind: 'row',
			input: session.rowInput,
			rowCount: session.evaluation.rowCount,
			result,
			canApply,
		};
		return rowState;
	}

	// Column選択中はColumn Reorderで再評価した表示情報だけを公開する。
	if ( session.kind === 'column' && session.evaluation.kind === 'column' ) {
		const result = session.evaluation.result;
		// Applyは現在Tableに対する指定が成立済みの場合だけ要求可能とする。
		const canApply = result.status === 'resolved';
		const columnState: RfInteractionReactState = {
			status: 'open',
			kind: 'column',
			input: session.columnInput,
			columns: session.evaluation.columns,
			result,
			canApply,
		};
		return columnState;
	}

	// Reorder Kindと評価結果が一致しない不完全なSessionはPresentationへ公開しない。
	return CLOSED_STATE;
};
