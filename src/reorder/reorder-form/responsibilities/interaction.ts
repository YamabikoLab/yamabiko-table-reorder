/**
 * RF Interactionとして、一つの対象Tableに対するRF入力Sessionと粗いApply Lifecycleを所有する。
 *
 * Zustandのvanilla storeを状態正本とし、React component lifecycleから独立してSessionを維持する。
 * 現在Tableに依存する表示結果は要求時点で既存Table Integration / Input Interpretation / Resolutionから再評価し、
 * 成立したApply要求はRF Apply Coordinationへ直接渡す。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import {
	columnTableIntegration,
	type ColumnBlockingMergedRange,
	type ColumnInputDescriptor,
} from '@/reorder/column-reorder/responsibilities/table-integration';
import {
	rowTableIntegration,
	type RowBlockingMergedRange,
} from '@/reorder/row-reorder/responsibilities/table-integration';

import { receiveRfApplyRequest } from './apply-coordination';
import {
	columnRfResolution,
	type ColumnRfMoveCandidate,
	type ColumnRfResolution,
} from './column-resolution';
import {
	interpretColumnRfInput,
	interpretRowRfInput,
	type ColumnRfFormInput,
	type RowRfFormInput,
} from './input-interpretation';
import { rowRfResolution, type RowRfMoveCandidate, type RowRfResolution } from './row-resolution';

/** Row Reorderの現在表示結果。 */
export type RfRowCurrentResult =
	| { status: 'not-ready' }
	| { status: 'no-op' }
	| { status: 'rejected'; blockingMergedRange: RowBlockingMergedRange }
	| { status: 'unavailable' }
	| { status: 'resolved' };

/** Column Reorderの現在表示結果。 */
export type RfColumnCurrentResult =
	| { status: 'not-ready' }
	| { status: 'no-op' }
	| { status: 'rejected'; blockingMergedRange: ColumnBlockingMergedRange }
	| { status: 'unavailable' }
	| { status: 'resolved' };

/** RF InteractionがRF Apply Coordinationへ渡すReorder Kind固有要求。 */
export type RfApplyRequest =
	| { kind: 'row'; candidate: RowRfMoveCandidate }
	| { kind: 'column'; candidate: ColumnRfMoveCandidate };

/** RF Apply CoordinationがRF Interactionへ返すLifecycle結果。 */
export type RfApplyResult = 'success' | 'failure' | 'cancelled';

/** Row RFフォームの初期入力。 */
const INITIAL_ROW_INPUT: RowRfFormInput = {
	sourceRowNumber: '',
	targetRowNumber: '',
	position: null,
};

/** Column RFフォームの初期入力。 */
const INITIAL_COLUMN_INPUT: ColumnRfFormInput = {
	sourceColumnIndex: null,
	targetColumnIndex: null,
	position: null,
};

type RfSessionInputs = {
	rowInput: RowRfFormInput;
	columnInput: ColumnRfFormInput;
};

type RowEvaluation = {
	kind: 'row';
	rowCount: number | null;
	result: RfRowCurrentResult;
};

type ColumnEvaluation = {
	kind: 'column';
	columns: readonly ColumnInputDescriptor[];
	result: RfColumnCurrentResult;
};

type RfEvaluation = RowEvaluation | ColumnEvaluation;

type RfSessionState =
	| { status: 'closed' }
	| ( {
			status: 'open';
			tableIdentity: string;
			kind: 'row' | 'column';
			evaluation: RfEvaluation;
	  } & RfSessionInputs )
	| ( {
			status: 'applying';
			tableIdentity: string;
			kind: 'row' | 'column';
	  } & RfSessionInputs );

type RfInteractionStoreState = {
	session: RfSessionState;
};

type RfInteractionStoreActions = {
	open: ( tableIdentity: string ) => void;
	close: ( tableIdentity: string ) => void;
	selectKind: ( tableIdentity: string, kind: 'row' | 'column' ) => void;
	updateRowInput: ( tableIdentity: string, input: RowRfFormInput ) => void;
	updateColumnInput: ( tableIdentity: string, input: ColumnRfFormInput ) => void;
	notifyTableChanged: ( tableIdentity: string ) => void;
	requestApply: ( tableIdentity: string ) => void;
	resolveApply: ( tableIdentity: string, result: RfApplyResult ) => void;
};

type RfInteractionStore = RfInteractionStoreState & RfInteractionStoreActions;

const toRowCurrentResult = ( resolution: RowRfResolution ): RfRowCurrentResult => {
	if ( resolution.status === 'rejected' ) {
		return {
			status: 'rejected',
			blockingMergedRange: resolution.blockingMergedRange,
		};
	}

	const result: RfRowCurrentResult = { status: resolution.status };
	return result;
};

const toColumnCurrentResult = ( resolution: ColumnRfResolution ): RfColumnCurrentResult => {
	if ( resolution.status === 'rejected' ) {
		return {
			status: 'rejected',
			blockingMergedRange: resolution.blockingMergedRange,
		};
	}

	const result: RfColumnCurrentResult = { status: resolution.status };
	return result;
};

const evaluateRow = (
	tableIdentity: string,
	input: RowRfFormInput
): { evaluation: RowEvaluation; candidate: RowRfMoveCandidate | null } => {
	const constraints = rowTableIntegration.getConstraints( tableIdentity );
	if ( constraints === null ) {
		return {
			evaluation: {
				kind: 'row',
				rowCount: null,
				result: { status: 'unavailable' },
			},
			candidate: null,
		};
	}

	const interpretation = interpretRowRfInput( input, constraints.rowCount );
	if ( interpretation.status === 'not-ready' ) {
		return {
			evaluation: {
				kind: 'row',
				rowCount: constraints.rowCount,
				result: { status: 'not-ready' },
			},
			candidate: null,
		};
	}

	const resolution = rowRfResolution.resolve( tableIdentity, interpretation.specification );
	const candidate = resolution.status === 'resolved' ? resolution.candidate : null;
	return {
		evaluation: {
			kind: 'row',
			rowCount: constraints.rowCount,
			result: toRowCurrentResult( resolution ),
		},
		candidate,
	};
};

const evaluateColumn = (
	tableIdentity: string,
	input: ColumnRfFormInput
): { evaluation: ColumnEvaluation; candidate: ColumnRfMoveCandidate | null } => {
	const columns = columnTableIntegration.getColumnInputDescriptors( tableIdentity );
	if ( columns === null ) {
		return {
			evaluation: {
				kind: 'column',
				columns: [],
				result: { status: 'unavailable' },
			},
			candidate: null,
		};
	}

	const interpretation = interpretColumnRfInput( input, columns );
	if ( interpretation.status === 'not-ready' ) {
		return {
			evaluation: {
				kind: 'column',
				columns,
				result: { status: 'not-ready' },
			},
			candidate: null,
		};
	}

	const resolution = columnRfResolution.resolve( tableIdentity, interpretation.specification );
	const candidate = resolution.status === 'resolved' ? resolution.candidate : null;
	return {
		evaluation: {
			kind: 'column',
			columns,
			result: toColumnCurrentResult( resolution ),
		},
		candidate,
	};
};

const evaluateOpenSession = (
	session: Extract< RfSessionState, { status: 'open' } >
): { evaluation: RfEvaluation; request: RfApplyRequest | null } => {
	if ( session.kind === 'row' ) {
		const row = evaluateRow( session.tableIdentity, session.rowInput );
		const request =
			row.candidate === null ? null : { kind: 'row' as const, candidate: row.candidate };
		return { evaluation: row.evaluation, request };
	}

	const column = evaluateColumn( session.tableIdentity, session.columnInput );
	const request =
		column.candidate === null ? null : { kind: 'column' as const, candidate: column.candidate };
	return { evaluation: column.evaluation, request };
};

/** RF Interactionの状態正本。 */
export const rfInteractionStore = createStore< RfInteractionStore >()(
	devtools(
		( set, get ) => ( {
			session: { status: 'closed' },
			open: ( tableIdentity ) => {
				const session = get().session;
				if ( session.status === 'applying' ) {
					return;
				}
				if ( session.status === 'open' && session.tableIdentity === tableIdentity ) {
					return;
				}

				const rowInput = { ...INITIAL_ROW_INPUT };
				const columnInput = { ...INITIAL_COLUMN_INPUT };
				const row = evaluateRow( tableIdentity, rowInput );
				set(
					{
						session: {
							status: 'open',
							tableIdentity,
							kind: 'row',
							rowInput,
							columnInput,
							evaluation: row.evaluation,
						},
					},
					undefined,
					'rf-interaction/open'
				);
			},
			close: ( tableIdentity ) => {
				const session = get().session;
				if ( session.status !== 'open' || session.tableIdentity !== tableIdentity ) {
					return;
				}
				set( { session: { status: 'closed' } }, undefined, 'rf-interaction/close' );
			},
			selectKind: ( tableIdentity, kind ) => {
				const session = get().session;
				if ( session.status !== 'open' || session.tableIdentity !== tableIdentity ) {
					return;
				}
				if ( session.kind === kind ) {
					return;
				}

				const nextSession = { ...session, kind };
				const evaluated = evaluateOpenSession( nextSession );
				set(
					{ session: { ...nextSession, evaluation: evaluated.evaluation } },
					undefined,
					'rf-interaction/select-kind'
				);
			},
			updateRowInput: ( tableIdentity, input ) => {
				const session = get().session;
				if (
					session.status !== 'open' ||
					session.tableIdentity !== tableIdentity ||
					session.kind !== 'row'
				) {
					return;
				}

				const row = evaluateRow( tableIdentity, input );
				set(
					{ session: { ...session, rowInput: input, evaluation: row.evaluation } },
					undefined,
					'rf-interaction/update-row-input'
				);
			},
			updateColumnInput: ( tableIdentity, input ) => {
				const session = get().session;
				if (
					session.status !== 'open' ||
					session.tableIdentity !== tableIdentity ||
					session.kind !== 'column'
				) {
					return;
				}

				const column = evaluateColumn( tableIdentity, input );
				set(
					{ session: { ...session, columnInput: input, evaluation: column.evaluation } },
					undefined,
					'rf-interaction/update-column-input'
				);
			},
			notifyTableChanged: ( tableIdentity ) => {
				const session = get().session;
				if ( session.status !== 'open' || session.tableIdentity !== tableIdentity ) {
					return;
				}

				const evaluated = evaluateOpenSession( session );
				set(
					{ session: { ...session, evaluation: evaluated.evaluation } },
					undefined,
					'rf-interaction/notify-table-changed'
				);
			},
			requestApply: ( tableIdentity ) => {
				const session = get().session;
				if ( session.status !== 'open' || session.tableIdentity !== tableIdentity ) {
					return;
				}

				const evaluated = evaluateOpenSession( session );
				if ( evaluated.request === null ) {
					set(
						{ session: { ...session, evaluation: evaluated.evaluation } },
						undefined,
						'rf-interaction/request-apply-not-started'
					);
					return;
				}

				const applyingSession: Extract< RfSessionState, { status: 'applying' } > = {
					status: 'applying',
					tableIdentity: session.tableIdentity,
					kind: session.kind,
					rowInput: session.rowInput,
					columnInput: session.columnInput,
				};
				set( { session: applyingSession }, undefined, 'rf-interaction/request-apply' );
				receiveRfApplyRequest( evaluated.request, ( result ) => {
					get().resolveApply( tableIdentity, result );
				} );
			},
			resolveApply: ( tableIdentity, result ) => {
				const session = get().session;
				if ( session.status !== 'applying' || session.tableIdentity !== tableIdentity ) {
					return;
				}

				if ( result === 'success' ) {
					set( { session: { status: 'closed' } }, undefined, 'rf-interaction/apply-success' );
					return;
				}

				const evaluation =
					session.kind === 'row'
						? evaluateRow( session.tableIdentity, session.rowInput ).evaluation
						: evaluateColumn( session.tableIdentity, session.columnInput ).evaluation;
				const openSession: Extract< RfSessionState, { status: 'open' } > = {
					status: 'open',
					tableIdentity: session.tableIdentity,
					kind: session.kind,
					rowInput: session.rowInput,
					columnInput: session.columnInput,
					evaluation,
				};
				set( { session: openSession }, undefined, `rf-interaction/apply-${ result }` );
			},
		} ),
		{ name: 'Yamabiko Table Reorder / RF Interaction' }
	)
);

/** RF Interactionが外部統合へ公開する命令 / 通知境界。 */
export const rfInteraction = {
	/** @param tableIdentity RF Sessionを開始する対象Table Identity。 */
	open: ( tableIdentity: string ) => rfInteractionStore.getState().open( tableIdentity ),
	/** @param tableIdentity RF Sessionを終了する対象Table Identity。 */
	close: ( tableIdentity: string ) => rfInteractionStore.getState().close( tableIdentity ),
	/**
	 * @param tableIdentity 現在RF Sessionの対象Table Identity。
	 * @param kind 選択するReorder Kind。
	 */
	selectKind: ( tableIdentity: string, kind: 'row' | 'column' ) =>
		rfInteractionStore.getState().selectKind( tableIdentity, kind ),
	/**
	 * @param tableIdentity 現在RF Sessionの対象Table Identity。
	 * @param input 利用者が現在指定しているRow入力。
	 */
	updateRowInput: ( tableIdentity: string, input: RowRfFormInput ) =>
		rfInteractionStore.getState().updateRowInput( tableIdentity, input ),
	/**
	 * @param tableIdentity 現在RF Sessionの対象Table Identity。
	 * @param input 利用者が現在指定しているColumn入力。
	 */
	updateColumnInput: ( tableIdentity: string, input: ColumnRfFormInput ) =>
		rfInteractionStore.getState().updateColumnInput( tableIdentity, input ),
	/** @param tableIdentity 外部変更が検知された対象Table Identity。 */
	notifyTableChanged: ( tableIdentity: string ) =>
		rfInteractionStore.getState().notifyTableChanged( tableIdentity ),
	/** @param tableIdentity Applyを要求する現在RF Sessionの対象Table Identity。 */
	requestApply: ( tableIdentity: string ) =>
		rfInteractionStore.getState().requestApply( tableIdentity ),
};
