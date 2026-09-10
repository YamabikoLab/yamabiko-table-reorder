/**
 * 列の確認付き大規模反映について、DnD Session終了後の確認・反映・再mount Lifecycleを所有する。
 *
 * DnD Interactionとは独立して確定済みの列移動意図だけを保持し、利用者が続行した後は現在Tableを再照合してから
 * Table Integrationへ反映を依頼する。通常の反映不能ではTableを変更せず再mountへ進む。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { isColumnReorderTargetMovable } from '@/reorder/column-reorder/domain/target-validity';
import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';

/** 確認後に現在Tableと再照合して反映する列移動意図。 */
export type LargeColumnReorderMove = {
	/** 対象Table個体を識別するclientId。 */
	tableIdentity: string;
	/** drop時点のTableを基準とする0-based移動元論理列位置。 */
	sourceColumnIndex: number;
	/** drop時点のTableを基準とする0-based移動先境界。 */
	destinationBoundaryIndex: number;
};

/** 列の確認付き大規模反映が取り得る状態。 */
export type LargeColumnReorderApplyState =
	| { phase: 'idle'; move: null; applied: false }
	| { phase: 'confirming'; move: LargeColumnReorderMove; applied: false }
	| { phase: 'applying'; move: LargeColumnReorderMove; applied: false }
	| { phase: 'remounting'; move: LargeColumnReorderMove; applied: boolean };

/** 列の確認付き大規模反映Lifecycleを進める操作。 */
type LargeColumnReorderApplyActions = {
	request: ( move: LargeColumnReorderMove ) => boolean;
	confirm: () => void;
	cancel: () => void;
	apply: () => void;
	complete: () => void;
};

/** 列の確認付き大規模反映について、共有状態と状態遷移操作を所有するStore。 */
type LargeColumnReorderApplyStore = LargeColumnReorderApplyState & LargeColumnReorderApplyActions;

/**
 * 移動先境界が現在の列制約に対して有効か判定する。
 *
 * @param destinationBoundaryIndex      再照合する0-based移動先境界。
 * @param constraints                   要求時点の論理列数と分断不可境界。
 * @param constraints.columnCount       要求時点の論理列数。
 * @param constraints.blockedBoundaries colspan等を分断するため利用できない列間境界。
 * @return 現在Tableで移動先として利用できる場合はtrue。
 */
const isDestinationValid = (
	destinationBoundaryIndex: number,
	constraints: { columnCount: number; blockedBoundaries: readonly number[] }
): boolean => {
	const destinationInRange =
		Number.isInteger( destinationBoundaryIndex ) &&
		destinationBoundaryIndex >= 0 &&
		destinationBoundaryIndex <= constraints.columnCount;
	const destinationAllowed =
		destinationInRange && ! constraints.blockedBoundaries.includes( destinationBoundaryIndex );
	return destinationAllowed;
};

/** 列の確認付き大規模反映をDnD SessionやReact mount状態から独立して保持する。 */
const largeColumnReorderApplyStore = createStore< LargeColumnReorderApplyStore >()(
	devtools(
		( set, get ) => ( {
			phase: 'idle',
			move: null,
			applied: false,
			request: ( move ) => {
				/* 一つの確認付き反映が完了するまで、別の列移動意図を重ねて受理しない。 */
				if ( get().phase !== 'idle' ) {
					return false;
				}
				set(
					{ phase: 'confirming', move, applied: false },
					undefined,
					'large-column-apply/request'
				);
				return true;
			},
			confirm: () => {
				const state = get();
				/* 利用者の確認対象が存在しない状態から反映開始へ進むことは内部契約違反とする。 */
				if ( state.phase !== 'confirming' ) {
					throw new Error( 'Large column reorder confirmation requires a pending move.' );
				}
				set(
					{ phase: 'applying', move: state.move, applied: false },
					undefined,
					'large-column-apply/confirm'
				);
			},
			cancel: () => {
				/* 確認待ち以外からのキャンセルはLifecycle上成立しないため内部契約違反とする。 */
				if ( get().phase !== 'confirming' ) {
					throw new Error( 'Large column reorder cancellation requires a pending move.' );
				}
				set(
					{ phase: 'idle', move: null, applied: false },
					undefined,
					'large-column-apply/cancel'
				);
			},
			apply: () => {
				const state = get();
				/* BlockEdit退避前の反映開始状態を経由しない更新要求は内部契約違反とする。 */
				if ( state.phase !== 'applying' ) {
					throw new Error( 'Large column reorder apply requires an applying move.' );
				}

				const constraints = columnTableIntegration.getConstraints( state.move.tableIdentity );
				const target = {
					tableIdentity: state.move.tableIdentity,
					sourceColumnIndex: state.move.sourceColumnIndex,
				};
				/* 確認待ちの間にTable構造が変わり得るため、移動元と移動先の双方が現在も成立する場合だけ反映する。 */
				const moveStillValid =
					constraints !== null &&
					isColumnReorderTargetMovable( target, constraints ) &&
					isDestinationValid( state.move.destinationBoundaryIndex, constraints );
				let applied = false;
				if ( moveStillValid ) {
					applied = columnTableIntegration.applyColumnMove( {
						clientId: state.move.tableIdentity,
						sourceColumnIndex: state.move.sourceColumnIndex,
						destinationBoundaryIndex: state.move.destinationBoundaryIndex,
					} );
				}
				/* 反映可否にかかわらず対象Tableを再mountし、更新結果がある場合だけ表示復帰先として扱う。 */
				set(
					{ phase: 'remounting', move: state.move, applied },
					undefined,
					'large-column-apply/remount'
				);
			},
			complete: () => {
				/* 対象Tableの再mountを経由していない完了要求は内部契約違反とする。 */
				if ( get().phase !== 'remounting' ) {
					throw new Error( 'Large column reorder completion requires a remounting move.' );
				}
				set(
					{ phase: 'idle', move: null, applied: false },
					undefined,
					'large-column-apply/complete'
				);
			},
		} ),
		{ name: 'Yamabiko Table Reorder / Large Column Apply' }
	)
);

/**
 * 確認付き大規模列反映を開始する。
 *
 * @param move DnD Session終了後に確認対象として保持する列移動意図。
 * @return 反映Lifecycleが未使用で移動意図を受理できた場合はtrue。
 */
export const requestLargeColumnReorderApply = ( move: LargeColumnReorderMove ): boolean =>
	largeColumnReorderApplyStore.getState().request( move );

/**
 * 列反映状態変更をReact境界から購読する。
 *
 * @param listener 反映状態が変化したときに呼び出す購読者。
 * @return 購読を解除する関数。
 */
export const subscribeLargeColumnReorderApply = ( listener: () => void ): ( () => void ) =>
	largeColumnReorderApplyStore.subscribe( listener );

/**
 * 現在の列反映状態を取得する。
 *
 * @return 確認付き大規模列反映の現在状態。
 */
export const getLargeColumnReorderApplyState = (): LargeColumnReorderApplyState =>
	largeColumnReorderApplyStore.getState();

/** 確認待ちの列移動について、利用者の続行選択を受けて反映開始状態へ進める。 */
export const confirmLargeColumnReorderApply = (): void =>
	largeColumnReorderApplyStore.getState().confirm();

/** 確認待ちの列移動を破棄し、Tableを変更せず通常状態へ戻す。 */
export const cancelLargeColumnReorderApply = (): void =>
	largeColumnReorderApplyStore.getState().cancel();

/** BlockEdit退避後に現在Tableを再照合して列移動を反映し、再mount状態へ進める。 */
export const applyLargeColumnReorder = (): void => largeColumnReorderApplyStore.getState().apply();

/** 再mountと表示復帰を完了して通常状態へ戻す。 */
export const completeLargeColumnReorderApply = (): void =>
	largeColumnReorderApplyStore.getState().complete();
