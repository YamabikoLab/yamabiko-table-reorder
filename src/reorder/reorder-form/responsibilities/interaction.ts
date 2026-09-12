/**
 * RF Interactionとして、一つの対象Tableに対するRF入力Sessionと粗いApply Lifecycleを所有する。
 *
 * Zustandのvanilla storeを状態正本とし、React component lifecycleから独立してSessionを維持する。
 * 現在Tableに依存する表示結果は要求時点で既存Table Integration / Input Interpretation / Resolutionから再評価し、
 * 並び替え種別固有candidateはPresentationへ公開せずRF Apply Coordinationとの内部境界だけへ渡す。
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

/**
 * RF Apply CoordinationがApply要求を受け取る内部接続境界。
 *
 * @param request Apply要求時点の現在Tableで成立したReorder Kind固有candidate。
 * @param resolve Apply Coordinationが確定したLifecycle結果をRF Interactionへ返す通知。
 */
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

/** RF Sessionが保持するReorder Kind別入力。 */
type RfSessionInputs = {
	rowInput: RowRfFormInput;
	columnInput: ColumnRfFormInput;
};

/** Row Reorderの現在Table基準表示キャッシュ。 */
type RowEvaluation = {
	kind: 'row';
	rowCount: number | null;
	result: RfRowCurrentResult;
};

/** Column Reorderの現在Table基準表示キャッシュ。 */
type ColumnEvaluation = {
	kind: 'column';
	columns: readonly ColumnInputDescriptor[];
	result: RfColumnCurrentResult;
};

/** 現在Reorder Kindに対応する表示キャッシュ。 */
type RfEvaluation = RowEvaluation | ColumnEvaluation;

/** RF Interactionが所有するSession Lifecycle状態。 */
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

/** RF Interaction Storeが所有する状態。 */
type RfInteractionStoreState = {
	session: RfSessionState;
};

/** RF Interaction Storeが所有する状態遷移。 */
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

/** RF Interactionの状態と、その状態を変更できるStore内部操作。 */
type RfInteractionStore = RfInteractionStoreState & RfInteractionStoreActions;

/** RF Apply Coordination実装が接続されるまでApply要求を外部へ流さないための内部Receiver。 */
let applyRequestReceiver: RfApplyRequestReceiver | null = null;

/**
 * Row Resolution結果から、Presentationへ公開してよい現在結果だけを取り出す。
 *
 * candidateはApply Coordinationとの内部境界だけで扱い、結合セル制約で拒否された場合だけ
 * 利用者が理由を確認できるようblockingMergedRangeを保持する。
 *
 * @param resolution 現在TableとRow指定を評価したResolution結果。
 * @return candidateを含まないPresentation向け現在結果。
 */
const toRowCurrentResult = ( resolution: RowRfResolution ): RfRowCurrentResult => {
	// 結合セル制約による拒否時だけ、利用者へ拒否理由を示す範囲情報を公開する。
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
 * Column Resolution結果から、Presentationへ公開してよい現在結果だけを取り出す。
 *
 * candidateはApply Coordinationとの内部境界だけで扱い、結合セル制約で拒否された場合だけ
 * 利用者が理由を確認できるようblockingMergedRangeを保持する。
 *
 * @param resolution 現在TableとColumn指定を評価したResolution結果。
 * @return candidateを含まないPresentation向け現在結果。
 */
const toColumnCurrentResult = ( resolution: ColumnRfResolution ): RfColumnCurrentResult => {
	// 結合セル制約による拒否時だけ、利用者へ拒否理由を示す範囲情報を公開する。
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
	// 現在TableのRow構造を取得できない場合は成立可否を推測せず、利用不能として扱う。
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
	// 入力指定が現在行数に対して未成立なら、構造制約の解決へ進めず入力待ちとして扱う。
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
	// Apply候補は現在指定が成立した場合だけ内部境界へ渡せる。
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
	// 現在TableのColumn構造を取得できない場合は成立可否を推測せず、利用不能として扱う。
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
	// 入力指定が現在の列記述に対して未成立なら、構造制約の解決へ進めず入力待ちとして扱う。
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
	// Apply候補は現在指定が成立した場合だけ内部境界へ渡せる。
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

/**
 * 現在Reorder Kindと保持入力を使い、要求時点の現在Table基準で共通再評価する。
 *
 * @param session 再評価対象のopen Session。
 * @return 現在Reorder Kindの表示評価と、成立時だけkind固有candidate。
 */
const evaluateOpenSession = (
	session: Extract< RfSessionState, { status: 'open' } >
): { evaluation: RfEvaluation; request: RfApplyRequest | null } => {
	// 現在選択中のReorder Kindだけを再評価し、非表示kindの保持入力は評価結果へ混在させない。
	if ( session.kind === 'row' ) {
		const row = evaluateRow( session.tableIdentity, session.rowInput );
		// Apply要求は現在Row指定が成立した場合だけ生成する。
		const request = row.candidate === null ? null : { kind: 'row' as const, candidate: row.candidate };
		return { evaluation: row.evaluation, request };
	}

	const column = evaluateColumn( session.tableIdentity, session.columnInput );
	// Apply要求は現在Column指定が成立した場合だけ生成する。
	const request =
		column.candidate === null ? null : { kind: 'column' as const, candidate: column.candidate };
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
				// Apply結果待機中は現在Sessionを固定し、別Session開始や再初期化を受け付けない。
				if ( session.status === 'applying' ) {
					return;
				}
				// 同じTableの再openはReact remount等で既存入力やReorder Kindを失わないため無視する。
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
				// Cancel / closeは現在open中の対象Tableからの要求だけを受理し、古い要求で別Sessionを閉じない。
				if ( session.status !== 'open' || session.tableIdentity !== tableIdentity ) {
					return;
				}
				set( { session: { status: 'closed' } }, undefined, 'rf-interaction/close' );
			},
			selectKind: ( tableIdentity, kind ) => {
				const session = get().session;
				// Reorder Kind変更は現在open中の対象Tableからの要求だけを受理する。
				if ( session.status !== 'open' || session.tableIdentity !== tableIdentity ) {
					return;
				}
				// 同じReorder Kindの再選択では保持入力や現在評価を不要に更新しない。
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
				// Row入力は現在open中の同じTableでRow Reorderが選択されている場合だけ更新する。
				if (
					session.status !== 'open' ||
					session.tableIdentity !== tableIdentity ||
					session.kind !== 'row'
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
				// Column入力は現在open中の同じTableでColumn Reorderが選択されている場合だけ更新する。
				if (
					session.status !== 'open' ||
					session.tableIdentity !== tableIdentity ||
					session.kind !== 'column'
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
				// Table変更通知は現在open中の対象Tableに対してだけ再評価を発生させる。
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
				// Apply要求は現在open中の対象Tableからの要求だけを受理する。
				if ( session.status !== 'open' || session.tableIdentity !== tableIdentity ) {
					return;
				}

				const evaluated = evaluateOpenSession( session );
				// freshな指定が未成立、またはApply Coordination未接続ならLifecycleを開始せず最新表示結果だけを反映する。
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
					kind: session.kind,
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
				// Apply結果は現在結果待ち中の同じTableに対する通知だけを受理し、古い完了通知を無視する。
				if ( session.status !== 'applying' || session.tableIdentity !== tableIdentity ) {
					return;
				}

				// 正常反映が完了したSessionは入力を残さず終了する。
				if ( result === 'success' ) {
					set( { session: { status: 'closed' } }, undefined, 'rf-interaction/apply-success' );
					return;
				}

				// failure / cancelledでは入力を保持して再開し、現在Reorder Kindだけを最新Table基準で再評価する。
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
	 * @param kind          選択するReorder Kind。
	 */
	selectKind: ( tableIdentity: string, kind: 'row' | 'column' ) =>
		rfInteractionStore.getState().selectKind( tableIdentity, kind ),
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
		// 古いcleanupが後から呼ばれても、新しく接続されたReceiverを誤って解除しない。
		if ( applyRequestReceiver === receiver ) {
			applyRequestReceiver = null;
		}
	};
};
