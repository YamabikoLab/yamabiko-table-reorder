/**
 * RF Apply Coordinationとして、RF候補の反映経路選択と反映成功後の表示復帰ライフサイクルを所有する。
 *
 * 通常反映は成功時だけ表示復帰状態を保持し、確認付き大規模反映は確認・反映・表示復帰を保持する。
 * Reorder Kind固有の移動意味と現在Tableでの成立性はRow / Column Table Integrationを正本とし、
 * WordPress側の表示責務や翻訳済み文言は所有しない。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import { requiresLargeReorderApply } from '@/reorder/reorder-apply-policy';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import type { RfApplyRequest, RfApplyResult } from './interaction';

/**
 * WordPress Reorder Apply Integrationへ公開するRF反映ライフサイクル状態。
 *
 * `idle`は保持中の反映がない状態、`confirming`は利用者の確認待ち、`applying`はWordPress側が
 * 反映中表示を成立させる段階、`restoring`は確定更新後の表示復帰待ちを表す。
 * `destinationIndex`は表示復帰が利用する反映後の0-based最終位置を正本として保持する。
 */
export type RfApplyCoordinationSnapshot =
	| { phase: 'idle' }
	| { phase: 'confirming'; tableIdentity: string; kind: 'row' | 'column' }
	| { phase: 'applying'; tableIdentity: string; kind: 'row' | 'column' }
	| {
			phase: 'restoring';
			tableIdentity: string;
			kind: 'row' | 'column';
			applied: boolean;
			destinationIndex: number | null;
	  };

/**
 * 確認ダイアログへ渡す利用者向けのRF移動概要。
 *
 * `sourcePosition`と`destinationPosition`は1-basedで表し、`destinationPosition`は移動元を除去した後の
 * 最終配置位置とする。表示復帰位置の正本には使用しない。
 */
export type RfApplySummary =
	| { kind: 'row'; sourcePosition: number; destinationPosition: number }
	| { kind: 'column'; sourcePosition: number; destinationPosition: number };

/** RF Apply Coordinationが反映結果確定まで内部保持する要求。 */
type PendingRfApply = {
	request: RfApplyRequest;
	resolve: ( result: RfApplyResult ) => void;
	summary: RfApplySummary | null;
};

/** Apply要求時の現在Table再照合結果。 */
type RfApplyAssessment = {
	tableIdentity: string;
	kind: 'row' | 'column';
	affectedCellCount: number;
	destinationIndex: number;
	summary: RfApplySummary;
};

/** RF反映ライフサイクルを進めるStore内部操作。 */
type RfApplyCoordinationActions = {
	requestLarge: (
		request: RfApplyRequest,
		resolve: ( result: RfApplyResult ) => void,
		summary: RfApplySummary
	) => boolean;
	requestRestoration: (
		request: RfApplyRequest,
		resolve: ( result: RfApplyResult ) => void,
		destinationIndex: number
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
 * RF候補を現在Tableへ再照合し、経路選択と表示復帰に必要な最終位置を取得する。
 *
 * @param request RF InteractionがApply要求時点で解決したReorder Kind固有候補。
 * @return 現在Tableでも成立する候補の評価。成立しない場合はnull。
 */
const assessRequest = ( request: RfApplyRequest ): RfApplyAssessment | null => {
	/* Reorder Kind固有の移動意味は、対応するTable Integrationの評価結果だけを正本として利用する。 */
	if ( request.kind === 'row' ) {
		const assessment = rowTableIntegration.assessRowMoveForApply( request.candidate );
		/* 現在TableでRow候補が成立しない場合は反映経路の選択へ進めない。 */
		if ( assessment === null ) {
			return null;
		}

		return {
			tableIdentity: request.candidate.clientId,
			kind: 'row',
			affectedCellCount: assessment.affectedCellCount,
			destinationIndex: assessment.destinationRowIndex,
			summary: {
				kind: 'row',
				sourcePosition: request.candidate.sourceRowIndex + 1,
				destinationPosition: assessment.destinationRowIndex + 1,
			},
		};
	}

	const assessment = columnTableIntegration.assessColumnMoveForApply( request.candidate );
	/* 現在TableでColumn候補が成立しない場合は反映経路の選択へ進めない。 */
	if ( assessment === null ) {
		return null;
	}

	return {
		tableIdentity: request.candidate.clientId,
		kind: 'column',
		affectedCellCount: assessment.affectedCellCount,
		destinationIndex: assessment.destinationColumnIndex,
		summary: {
			kind: 'column',
			sourcePosition: request.candidate.sourceColumnIndex + 1,
			destinationPosition: assessment.destinationColumnIndex + 1,
		},
	};
};

/**
 * 対応Reorder KindのTable Integrationへ一回の確定更新を要求する。
 *
 * Table Integration自身が更新直前の現在Tableを最終権威として再照合するため、ここでは候補を加工しない。
 *
 * @param request 反映対象のReorder Kind固有候補。
 * @return 現在Tableへ安全に反映できた場合はtrue。
 */
const applyRequest = ( request: RfApplyRequest ): boolean => {
	/* 確定更新は候補のReorder Kindに対応するTable Integrationだけへ委譲する。 */
	if ( request.kind === 'row' ) {
		return rowTableIntegration.applyRowMove( request.candidate );
	}

	return columnTableIntegration.applyColumnMove( request.candidate );
};

/** RF反映ライフサイクルの初期公開状態。 */
const IDLE_SNAPSHOT: RfApplyCoordinationSnapshot = { phase: 'idle' };

/**
 * RF反映ライフサイクルの状態正本。
 *
 * 公開snapshot自体をStoreで保持し、状態不変時に同一参照を返せるようにする。
 * candidate・callback・確認表示用summaryは内部pendingとして保持する。
 */
const rfApplyCoordinationStore = createStore< RfApplyCoordinationStore >()(
	devtools(
		( set, get ) => ( {
			snapshot: IDLE_SNAPSHOT,
			pending: null,
			requestLarge: ( request, resolve, summary ) => {
				/* 一つの反映ライフサイクルが完了するまで別候補を重ねて保持しない。 */
				if ( get().snapshot.phase !== 'idle' ) {
					return false;
				}

				const tableIdentity = request.candidate.clientId;
				set(
					{
						snapshot: { phase: 'confirming', tableIdentity, kind: request.kind },
						pending: { request, resolve, summary },
					},
					undefined,
					'rf-apply/request-large'
				);
				return true;
			},
			requestRestoration: ( request, resolve, destinationIndex ) => {
				/* 通常反映成功後も表示復帰が完了するまで別候補を重ねて保持しない。 */
				if ( get().snapshot.phase !== 'idle' ) {
					return false;
				}

				const tableIdentity = request.candidate.clientId;
				set(
					{
						snapshot: {
							phase: 'restoring',
							tableIdentity,
							kind: request.kind,
							applied: true,
							destinationIndex,
						},
						pending: { request, resolve, summary: null },
					},
					undefined,
					'rf-apply/request-restoration'
				);
				return true;
			},
			continueApply: () => {
				const state = get();
				/* 確認対象が存在しない状態からContinueすることは内部ライフサイクル違反とする。 */
				if ( state.snapshot.phase !== 'confirming' || state.pending === null ) {
					throw new Error( 'RF apply continuation requires a confirming request.' );
				}

				set(
					{
						snapshot: {
							phase: 'applying',
							tableIdentity: state.snapshot.tableIdentity,
							kind: state.snapshot.kind,
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
				/* callbackの同期的な再入で古いライフサイクルを観測させないため、外部通知より先に内部状態を破棄する。 */
				set( { snapshot: IDLE_SNAPSHOT, pending: null }, undefined, 'rf-apply/cancel' );
				resolve( 'cancelled' );
			},
			apply: () => {
				const state = get();
				/* WordPress側で反映中表示が成立する前の更新要求は内部ライフサイクル違反とする。 */
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
							kind: state.snapshot.kind,
							applied,
							destinationIndex: assessment?.destinationIndex ?? null,
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
				set( { snapshot: IDLE_SNAPSHOT, pending: null }, undefined, 'rf-apply/complete' );
				resolve( result );
			},
		} ),
		{ name: 'Yamabiko Table Reorder / RF Apply Coordination' }
	)
);

/**
 * RF InteractionからApply要求を受け取る。
 *
 * candidateはApply時点の成立保証として信用せず現在Tableへ再照合する。通常反映は失敗時だけ同期的に完了し、
 * 成功時は表示復帰完了まで結果確定を待つ。各要求のcallbackは成功・失敗・取消のいずれかで一度だけ完了させる。
 *
 * @param request RF InteractionがApply要求時点で解決した候補。
 * @param resolve RF Interactionへライフサイクル結果を返すcallback。
 */
export const receiveRfApplyRequest = (
	request: RfApplyRequest,
	resolve: ( result: RfApplyResult ) => void
): void => {
	/* 進行中ライフサイクルと競合する要求は黙って破棄せず、呼び出し元Interactionをfailureで解放する。 */
	if ( rfApplyCoordinationStore.getState().snapshot.phase !== 'idle' ) {
		resolve( 'failure' );
		return;
	}

	const assessment = assessRequest( request );
	/* 受付時点の現在Tableで候補が成立しない場合は、Tableを変更せず要求を失敗として完了する。 */
	if ( assessment === null ) {
		resolve( 'failure' );
		return;
	}

	/* 大規模反映閾値以下では一回の確定更新を行い、成功時だけ既存の表示復帰へ接続する。 */
	if ( ! requiresLargeReorderApply( assessment.affectedCellCount ) ) {
		const applied = applyRequest( request );
		if ( ! applied ) {
			resolve( 'failure' );
			return;
		}

		const accepted = rfApplyCoordinationStore
			.getState()
			.requestRestoration( request, resolve, assessment.destinationIndex );
		/* 同期的な競合で保持できなかった場合もcallbackを未完了にしない。 */
		if ( ! accepted ) {
			resolve( 'failure' );
		}
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
 * RF反映ライフサイクルの変更を購読する。
 *
 * 公開状態をReact component lifecycleへ移さず、WordPress統合が外部状態として観測できる境界を提供する。
 *
 * @param listener 公開snapshotが変化したときにWordPress統合へ通知する購読者。
 * @return 購読を解除する関数。
 */
export const subscribeRfApplyCoordination = ( listener: () => void ): ( () => void ) =>
	rfApplyCoordinationStore.subscribe( listener );

/**
 * WordPress統合へ公開する現在ライフサイクルsnapshotを取得する。
 *
 * 状態が変わらない間はStoreが保持する同一参照を返し、Zustand Store自体や内部candidateは公開しない。
 *
 * @return RF反映の現在snapshot。
 */
export const getRfApplyCoordinationSnapshot = (): RfApplyCoordinationSnapshot =>
	rfApplyCoordinationStore.getState().snapshot;

/**
 * 確認ダイアログへ表示するRF移動summaryを取得する。
 *
 * ライフサイクル購読は既存snapshot購読を正本とし、このgetter専用の購読は持たない。
 * raw candidateや翻訳済み文言を公開せず、確認待ちの利用者向け1-based位置だけを返す。
 *
 * @return 確認表示用summary。確認表示を所有しない状態ではnull。
 */
export const getRfApplySummary = (): RfApplySummary | null =>
	rfApplyCoordinationStore.getState().pending?.summary ?? null;

/** 確認待ちRF反映をContinueし、WordPress側が反映中表示を成立させる段階へ進める。 */
export const continueRfApply = (): void => rfApplyCoordinationStore.getState().continueApply();

/** 確認待ちRF反映を破棄し、cleanup後にRF Interactionへcancelledを返す。 */
export const cancelRfApply = (): void => rfApplyCoordinationStore.getState().cancel();

/** WordPress側の反映中表示成立後に現在Tableを再照合し、一回の確定更新を要求する。 */
export const applyRfReorder = (): void => rfApplyCoordinationStore.getState().apply();

/** WordPress側の表示復帰完了後にcleanupし、RF Interactionへ結果を返す。 */
export const completeRfApplyRestoration = (): void =>
	rfApplyCoordinationStore.getState().complete();