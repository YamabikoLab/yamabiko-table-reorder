/**
 * RF Apply Coordinationとして、RF候補の反映経路選択と確認付き大規模反映Lifecycleを所有する。
 *
 * 通常反映は長期状態を持たず一回の処理として完了し、確認付き大規模反映だけをZustandのvanilla storeで保持する。
 * 方向固有Move意味と現在Tableでの成立性はRow / Column Table Integrationを正本とし、WordPress表示責務や翻訳済み文言は所有しない。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import { requiresLargeReorderApply } from '@/reorder/reorder-apply-policy';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import type {
	RfApplyRequest,
	RfApplyRequestReceiver,
	RfApplyResult,
} from './interaction';

/** WordPress Reorder Apply Integrationへ公開するRF大規模反映Lifecycle。 */
export type RfApplyCoordinationSnapshot =
	| { phase: 'idle' }
	| { phase: 'confirming'; tableIdentity: string; direction: 'row' | 'column' }
	| { phase: 'applying'; tableIdentity: string; direction: 'row' | 'column' }
	| {
			phase: 'restoring';
			tableIdentity: string;
			direction: 'row' | 'column';
			applied: boolean;
	  };

/** 確認Modalへ渡すRF移動の利用者向け位置。 */
export type RfApplySummary =
	| { direction: 'row'; sourcePosition: number; destinationPosition: number }
	| { direction: 'column'; sourcePosition: number; destinationPosition: number };

/** RF Apply Coordinationが大規模反映中だけ内部保持する要求。 */
type PendingRfApply = {
	request: RfApplyRequest;
	resolve: ( result: RfApplyResult ) => void;
	summary: RfApplySummary;
};

/** Apply要求時の現在Table再照合結果。 */
type RfApplyAssessment = {
	tableIdentity: string;
	direction: 'row' | 'column';
	affectedCellCount: number;
	summary: RfApplySummary;
};

/** RF大規模反映Lifecycleを進めるStore内部操作。 */
type RfApplyCoordinationActions = {
	requestLarge: (
		request: RfApplyRequest,
		resolve: ( result: RfApplyResult ) => void,
		summary: RfApplySummary
	) => boolean;
	continueApply: () => void;
	cancel: () => void;
	apply: () => void;
	complete: () => void;
};

/** RF Apply Coordination Storeが所有する内部状態。 */
type RfApplyCoordinationStore = {
	snapshot: RfApplyCoordinationSnapshot;
	pending: PendingRfApply | null;
} & RfApplyCoordinationActions;

/**
 * RF候補を現在Tableへ再照合し、経路選択と確認表示に必要な情報を取得する。
 *
 * destinationPositionの方向固有Move意味はTable IntegrationのApply Assessmentを正本とし、
 * この責務では0-based位置を1-based表示へ変換するだけとする。
 *
 * @param request RF InteractionがApply要求時点で解決した方向固有候補。
 * @return 現在Tableでも成立する候補の評価。成立しない場合はnull。
 */
const assessRequest = ( request: RfApplyRequest ): RfApplyAssessment | null => {
	if ( request.direction === 'row' ) {
		const assessment = rowTableIntegration.assessRowMoveForApply( request.candidate );
		if ( assessment === null ) {
			return null;
		}

		return {
			tableIdentity: request.candidate.clientId,
			direction: 'row',
			affectedCellCount: assessment.affectedCellCount,
			summary: {
				direction: 'row',
				sourcePosition: request.candidate.sourceRowIndex + 1,
				destinationPosition: assessment.destinationRowIndex + 1,
			},
		};
	}

	const assessment = columnTableIntegration.assessColumnMoveForApply( request.candidate );
	if ( assessment === null ) {
		return null;
	}

	return {
		tableIdentity: request.candidate.clientId,
		direction: 'column',
		affectedCellCount: assessment.affectedCellCount,
		summary: {
			direction: 'column',
			sourcePosition: request.candidate.sourceColumnIndex + 1,
			destinationPosition: assessment.destinationColumnIndex + 1,
		},
	};
};

/**
 * 対応方向のTable Integrationへ一回の確定更新を要求する。
 *
 * Table Integration自身が更新直前の現在Tableを最終権威として再照合するため、ここでは候補を加工しない。
 *
 * @param request 反映対象の方向固有候補。
 * @return 現在Tableへ安全に反映できた場合はtrue。
 */
const applyRequest = ( request: RfApplyRequest ): boolean => {
	if ( request.direction === 'row' ) {
		return rowTableIntegration.applyRowMove( request.candidate );
	}

	return columnTableIntegration.applyColumnMove( request.candidate );
};

/** 確認付き大規模反映Lifecycleの初期公開状態。 */
const IDLE_SNAPSHOT: RfApplyCoordinationSnapshot = { phase: 'idle' };

/**
 * 確認付き大規模反映の状態正本。
 *
 * 公開snapshot自体をStoreで保持し、状態不変時に同一参照を返せるようにする。
 * candidate・callback・summaryは内部pendingとして保持し、WordPress Presentationへ公開しない。
 */
const rfApplyCoordinationStore = createStore< RfApplyCoordinationStore >()(
	devtools(
		( set, get ) => ( {
			snapshot: IDLE_SNAPSHOT,
			pending: null,
			requestLarge: ( request, resolve, summary ) => {
				/* 一つの大規模反映が完了するまで別候補を重ねて保持しない。 */
				if ( get().snapshot.phase !== 'idle' ) {
					return false;
				}

				const tableIdentity = request.candidate.clientId;
				set(
					{
						snapshot: { phase: 'confirming', tableIdentity, direction: request.direction },
						pending: { request, resolve, summary },
					},
					undefined,
					'rf-apply/request-large'
				);
				return true;
			},
			continueApply: () => {
				const state = get();
				/* 確認対象が存在しない状態からContinueすることは内部Lifecycle違反とする。 */
				if ( state.snapshot.phase !== 'confirming' || state.pending === null ) {
					throw new Error( 'RF apply continuation requires a confirming request.' );
				}

				set(
					{
						snapshot: {
							phase: 'applying',
							tableIdentity: state.snapshot.tableIdentity,
							direction: state.snapshot.direction,
						},
					},
					undefined,
					'rf-apply/continue'
				);
			},
			cancel: () => {
				const state = get();
				/* Cancelは確認待ちの要求にだけ成立する。 */
				if ( state.snapshot.phase !== 'confirming' || state.pending === null ) {
					throw new Error( 'RF apply cancellation requires a confirming request.' );
				}

				const resolve = state.pending.resolve;
				/* callbackの同期的な再入で古いLifecycleを観測させないため、外部通知より先に内部状態を破棄する。 */
				set(
					{ snapshot: IDLE_SNAPSHOT, pending: null },
					undefined,
					'rf-apply/cancel'
				);
				resolve( 'cancelled' );
			},
			apply: () => {
				const state = get();
				/* WordPress側で反映中表示が成立する前の更新要求は内部Lifecycle違反とする。 */
				if ( state.snapshot.phase !== 'applying' || state.pending === null ) {
					throw new Error( 'RF reorder apply requires an applying request.' );
				}

				/* Continue待ちの間にTableが変わり得るため、現在Tableで候補が成立する場合だけ確定更新へ進む。 */
				const assessment = assessRequest( state.pending.request );
				const applied = assessment === null ? false : applyRequest( state.pending.request );
				set(
					{
						snapshot: {
							phase: 'restoring',
							tableIdentity: state.snapshot.tableIdentity,
							direction: state.snapshot.direction,
							applied,
						},
					},
					undefined,
					'rf-apply/restoring'
				);
			},
			complete: () => {
				const state = get();
				/* success / failureはWordPress側の表示復帰完了後だけ確定する。 */
				if ( state.snapshot.phase !== 'restoring' || state.pending === null ) {
					throw new Error( 'RF apply completion requires a restoring request.' );
				}

				const resolve = state.pending.resolve;
				const result: RfApplyResult = state.snapshot.applied ? 'success' : 'failure';
				/* callbackの同期的な再入で完了済み候補を再利用させないため、外部通知より先にcleanupする。 */
				set(
					{ snapshot: IDLE_SNAPSHOT, pending: null },
					undefined,
					'rf-apply/complete'
				);
				resolve( result );
			},
		} ),
		{ name: 'Yamabiko Table Reorder / RF Apply Coordination' }
	)
);

/**
 * RF InteractionからApply要求を受け取る。
 *
 * candidateはApply時点の成立保証として信用せず現在Tableへ再照合する。通常反映は同期的に完了し、
 * 確認付き大規模反映だけをStoreへ移す。各要求のcallbackは成功・失敗・取消のいずれかで一度だけ完了させる。
 *
 * @param request RF InteractionがApply要求時点で解決した候補。
 * @param resolve RF InteractionへLifecycle結果を返すcallback。
 */
export const receiveRfApplyRequest: RfApplyRequestReceiver = ( request, resolve ) => {
	/* 進行中Lifecycleと競合する要求は黙って破棄せず、呼び出し元Interactionをfailureで解放する。 */
	if ( rfApplyCoordinationStore.getState().snapshot.phase !== 'idle' ) {
		resolve( 'failure' );
		return;
	}

	const assessment = assessRequest( request );
	if ( assessment === null ) {
		resolve( 'failure' );
		return;
	}

	if ( ! requiresLargeReorderApply( assessment.affectedCellCount ) ) {
		const applied = applyRequest( request );
		resolve( applied ? 'success' : 'failure' );
		return;
	}

	const accepted = rfApplyCoordinationStore
		.getState()
		.requestLarge( request, resolve, assessment.summary );
	/* 同期的な競合で保持できなかった場合もcallbackを未完了にしない。 */
	if ( ! accepted ) {
		resolve( 'failure' );
	}
};

/**
 * RF大規模反映Lifecycleの変更を購読する。
 *
 * @param listener 公開snapshotが変化したときにWordPress統合へ通知する購読者。
 * @return 購読を解除する関数。
 */
export const subscribeRfApplyCoordination = ( listener: () => void ): ( () => void ) =>
	rfApplyCoordinationStore.subscribe( listener );

/**
 * WordPress統合へ公開する現在Lifecycle snapshotを取得する。
 *
 * 状態が変わらない間はStoreが保持する同一参照を返し、Zustand Store自体や内部candidateは公開しない。
 *
 * @return 確認付き大規模RF反映の現在snapshot。
 */
export const getRfApplyCoordinationSnapshot = (): RfApplyCoordinationSnapshot =>
	rfApplyCoordinationStore.getState().snapshot;

/**
 * 確認Modalへ表示するRF移動summaryを取得する。
 *
 * Lifecycle購読は既存snapshot購読を正本とし、このgetter専用の購読は持たない。
 * raw candidateや翻訳済み文言を公開せず、利用者向け1-based位置だけを返す。
 *
 * @return 大規模反映中の表示専用summary。idleではnull。
 */
export const getRfApplySummary = (): RfApplySummary | null =>
	rfApplyCoordinationStore.getState().pending?.summary ?? null;

/** 確認待ちRF反映をContinueし、WordPress側が反映中表示を成立させる段階へ進める。 */
export const continueRfApply = (): void => rfApplyCoordinationStore.getState().continueApply();

/** 確認待ちRF反映を破棄し、cleanup後にRF Interactionへcancelledを返す。 */
export const cancelRfApply = (): void => rfApplyCoordinationStore.getState().cancel();

/** WordPress側の反映中表示成立後に現在Tableを再照合し、一回の確定更新を要求する。 */
export const applyRfReorder = (): void => rfApplyCoordinationStore.getState().apply();

/** WordPress側のediting surface restoration完了後にcleanupし、RF Interactionへ結果を返す。 */
export const completeRfApplyRestoration = (): void => rfApplyCoordinationStore.getState().complete();
