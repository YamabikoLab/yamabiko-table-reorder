/**
 * RF Interactionとして、一つの対象Tableに対するRF入力Sessionと粗いApply Lifecycleを所有する。
 *
 * Zustandのvanilla storeを状態正本とし、React component lifecycleから独立してSessionを維持する。
 * 現在Tableに依存する表示結果は要求時点で既存Table Integration / Input Interpretation / Resolutionから再評価し、
 * 方向固有candidateはPresentationへ公開せずRF Apply Coordinationとの内部境界だけへ渡す。
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

import {
	interpretColumnRfInput,
	interpretRowRfInput,
	type ColumnRfFormInput,
	type RowRfFormInput,
} from './input-interpretation';
import {
	columnRfResolution,
	type ColumnRfMoveCandidate,
	type ColumnRfResolution,
} from './column-resolution';
import { rowRfResolution, type RowRfMoveCandidate, type RowRfResolution } from './row-resolution';

/** RF Sessionで選択できる並び替え方向。 */
export type RfDirection = 'row' | 'column';

/** Row方向の現在表示結果。 */
export type RfRowCurrentResult =
	| { status: 'not-ready' }
	| { status: 'no-op' }
	| { status: 'rejected'; blockingMergedRange: RowBlockingMergedRange }
	| { status: 'unavailable' }
	| { status: 'resolved' };

/** Column方向の現在表示結果。 */
export type RfColumnCurrentResult =
	| { status: 'not-ready' }
	| { status: 'no-op' }
	| { status: 'rejected'; blockingMergedRange: ColumnBlockingMergedRange }
	| { status: 'unavailable' }
	| { status: 'resolved' };

/** RF InteractionがRF Apply Coordinationへ渡す方向固有要求。 */
export type RfApplyRequest =
	| { direction: 'row'; candidate: RowRfMoveCandidate }
	| { direction: 'column'; candidate: ColumnRfMoveCandidate };

/** RF Apply CoordinationがRF Interactionへ返すLifecycle結果。 */
export type RfApplyResult = 'success' | 'failure' | 'cancelled';

/** RF Apply CoordinationがApply要求を受け取る内部接続境界。 */
export type RfApplyRequestReceiver = (
	request: RfApplyRequest,
	resolve: ( result: RfApplyResult ) => void
) => void;

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

/** RF Sessionが保持する方向別入力。 */
type RfSessionInputs = {
	rowInput: RowRfFormInput;
	columnInput: ColumnRfFormInput;
};

/** Row方向の現在Table基準表示キャッシュ。 */
type RowEvaluation = {
	direction: 'row';
	rowCount: number | null;
	result: RfRowCurrentResult;
};

/** Column方向の現在Table基準表示キャッシュ。 */
type ColumnEvaluation = {
	direction: 'column';
	columns: readonly ColumnInputDescriptor[];
	result: RfColumnCurrentResult;
};

/** 現在方向に対応する表示キャッシュ。 */
type RfEvaluation = RowEvaluation | ColumnEvaluation;

/** RF Interactionが所有するSession Lifecycle状態。 */
type RfSessionState =
	| { status: 'closed' }
	| ( {
			status: 'open';
			tableIdentity: string;
			direction: RfDirection;
			evaluation: RfEvaluation;
	  } & RfSessionInputs )
	| ( {
			status: 'applying';
			tableIdentity: string;
			direction: RfDirection;
	  } & RfSessionInputs );

/** RF Interaction Storeが所有する状態。 */
type RfInteractionStoreState = {
	session: RfSessionState;
};

/** RF Interaction Storeが所有する状態遷移。 */
type RfInteractionStoreActions = {
	open: ( tableIdentity: string ) => void;
	close: ( tableIdentity: string ) => void;
	selectDirection: ( tableIdentity: string, direction: RfDirection ) => void;
	updateRowInput: ( tableIdentity: string, input: RowRfFormInput ) => void;
	updateColumnInput: ( tableIdentity: string, input: ColumnRfFormInput ) => void;
	notifyTableChanged: ( tableIdentity: string ) => void;
	requestApply: ( tableIdentity: string ) => void;
	resolveApply: ( tableIdentity: string, result: RfApplyResult ) => void;
};

type RfInteractionStore = RfInteractionStoreState & RfInteractionStoreActions;

/** RF Apply Coordination実装が接続されるまでApply要求を外部へ流さないための内部Receiver。 */
let applyRequestReceiver: RfApplyRequestReceiver | null = null;

/**
 * Row Resolutionのcandidateを除いたPresentation向け結果へ変換する。
 * @param resolution
 */
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

/**
 * Column Resolutionのcandidateを除いたPresentation向け結果へ変換する。
 * @param resolution
 */
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

/**
 * 現在Tableと保持中Row入力から、Row表示状態とApply候補を同じ評価経路で解決する。
 *
 * @param tableIdentity 評価対象Table Identity。
 * @param input         現在Sessionが保持するRow入力。
 * @return Presentation向け評価と、成立時だけ内部Apply境界へ渡せるcandidate。
 */
const evaluateRow = (
	tableIdentity: string,
	input: RowRfFormInput
): { evaluation: RowEvaluation; candidate: RowRfMoveCandidate | null } => {
	const constraints = rowTableIntegration.getConstraints( tableIdentity );
	if ( constraints === null ) {
		return {
			evaluation: {
				direction: 'row',
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
				direction: 'row',
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
			direction: 'row',
			rowCount: constraints.rowCount,
			result: toRowCurrentResult( resolution ),
		},
		candidate,
	};
};

/**
 * 現在Tableと保持中Column入力から、Column表示状態とApply候補を同じ評価経路で解決する。
 *
 * @param tableIdentity 評価対象Table Identity。
 * @param input         現在Sessionが保持するColumn入力。
 * @return Presentation向け評価と、成立時だけ内部Apply境界へ渡せるcandidate。
 */
const evaluateColumn = (
	tableIdentity: string,
	input: ColumnRfFormInput
): { evaluation: ColumnEvaluation; candidate: ColumnRfMoveCandidate | null } => {
	const columns = columnTableIntegration.getColumnInputDescriptors( tableIdentity );
	if ( columns === null ) {
		return {
			evaluation: {
				direction: 'column',
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
				direction: 'column',
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
			direction: 'column',
			columns,
			result: toColumnCurrentResult( resolution ),
		},
		candidate,
	};
};

/**
 * 現在方向と保持入力を使い、要求時点の現在Table基準で共通再評価する。
 *
 * @param session 再評価対象のopen Session。
 * @return 現在方向の表示評価と、成立時だけ方向固有candidate。
 */
const evaluateOpenSession = (
	session: Extract< RfSessionState, { status: 'open' } >
): { evaluation: RfEvaluation; request: RfApplyRequest | null } => {
	if ( session.direction === 'row' ) {
		const row = evaluateRow( session.tableIdentity, session.rowInput );
		const request =
			row.candidate === null ? null : { direction: 'row' as const, candidate: row.candidate };
		return { evaluation: row.evaluation, request };
	}

	const column = evaluateColumn( session.tableIdentity, session.columnInput );
	const request =
		column.candidate === null
			? null
			: { direction: 'column' as const, candidate: column.candidate };
	return { evaluation: column.evaluation, request };
};

/**
 * RF Interactionの状態正本。
 *
 * Store内部APIはRF Interaction / React接続境界の実装だけが利用し、Presentationへ直接公開しない。
 */
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
							direction: 'row',
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
			selectDirection: ( tableIdentity, direction ) => {
				const session = get().session;
				if ( session.status !== 'open' || session.tableIdentity !== tableIdentity ) {
					return;
				}
				if ( session.direction === direction ) {
					return;
				}

				const nextSession = { ...session, direction };
				const evaluated = evaluateOpenSession( nextSession );
				set(
					{ session: { ...nextSession, evaluation: evaluated.evaluation } },
					undefined,
					'rf-interaction/select-direction'
				);
			},
			updateRowInput: ( tableIdentity, input ) => {
				const session = get().session;
				if (
					session.status !== 'open' ||
					session.tableIdentity !== tableIdentity ||
					session.direction !== 'row'
				) {
					return;
				}

				const row = evaluateRow( tableIdentity, input );
				set(
					{
						session: {
							...session,
							rowInput: input,
							evaluation: row.evaluation,
						},
					},
					undefined,
					'rf-interaction/update-row-input'
				);
			},
			updateColumnInput: ( tableIdentity, input ) => {
				const session = get().session;
				if (
					session.status !== 'open' ||
					session.tableIdentity !== tableIdentity ||
					session.direction !== 'column'
				) {
					return;
				}

				const column = evaluateColumn( tableIdentity, input );
				set(
					{
						session: {
							...session,
							columnInput: input,
							evaluation: column.evaluation,
						},
					},
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
				if ( evaluated.request === null || applyRequestReceiver === null ) {
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
					direction: session.direction,
					rowInput: session.rowInput,
					columnInput: session.columnInput,
				};
				set( { session: applyingSession }, undefined, 'rf-interaction/request-apply' );
				applyRequestReceiver( evaluated.request, ( result ) => {
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

				const openSession: Extract< RfSessionState, { status: 'open' } > = {
					status: 'open',
					tableIdentity: session.tableIdentity,
					direction: session.direction,
					rowInput: session.rowInput,
					columnInput: session.columnInput,
					evaluation:
						session.direction === 'row'
							? evaluateRow( session.tableIdentity, session.rowInput ).evaluation
							: evaluateColumn( session.tableIdentity, session.columnInput ).evaluation,
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
	 * @param direction     選択するRF方向。
	 */
	selectDirection: ( tableIdentity: string, direction: RfDirection ) =>
		rfInteractionStore.getState().selectDirection( tableIdentity, direction ),
	/**
	 * @param tableIdentity 現在RF Sessionの対象Table Identity。
	 * @param input         利用者が現在指定しているRow入力。
	 */
	updateRowInput: ( tableIdentity: string, input: RowRfFormInput ) =>
		rfInteractionStore.getState().updateRowInput( tableIdentity, input ),
	/**
	 * @param tableIdentity 現在RF Sessionの対象Table Identity。
	 * @param input         利用者が現在指定しているColumn入力。
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

/**
 * Phase 5のRF Apply CoordinationがApply要求を受け取るための内部接続境界。
 *
 * 一度に一つのReceiverだけを接続し、返却cleanupは同じReceiverが現在も接続中の場合だけ解除する。
 *
 * @param receiver RF Apply Coordinationが提供するApply要求受付。
 * @return 接続を解除するcleanup。
 */
export const connectRfApplyCoordination = ( receiver: RfApplyRequestReceiver ): ( () => void ) => {
	applyRequestReceiver = receiver;

	return () => {
		if ( applyRequestReceiver === receiver ) {
			applyRequestReceiver = null;
		}
	};
};
