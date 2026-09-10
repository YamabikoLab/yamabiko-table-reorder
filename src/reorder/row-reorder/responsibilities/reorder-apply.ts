/**
 * 行の確認付き大規模反映について、DnD Session終了後の確認・反映・再mount Lifecycleを所有する。
 *
 * DnD Interactionとは独立して確定済みの行移動意図だけを保持し、Continue後は現在Tableを再照合してから
 * Table Integrationへ反映を依頼する。通常の反映不能ではTableを変更せず再mountへ進む。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { isRowReorderTargetMovable } from '@/reorder/row-reorder/domain/target-validity';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

/** 確認後に再照合して反映する行移動意図。 */
export type LargeRowReorderMove = {
	/** 対象Table個体を識別するclientId。 */
	tableIdentity: string;
	/** drop時点のtbodyを基準とする0-based移動元行位置。 */
	sourceRowIndex: number;
	/** drop時点のtbodyを基準とする0-based移動先境界。 */
	destinationBoundaryIndex: number;
};

/** 行の確認付き大規模反映が取り得る状態。 */
export type LargeRowReorderApplyState =
	| { phase: 'idle'; move: null; applied: false }
	| { phase: 'confirming'; move: LargeRowReorderMove; applied: false }
	| { phase: 'applying'; move: LargeRowReorderMove; applied: false }
	| { phase: 'remounting'; move: LargeRowReorderMove; applied: boolean };

type LargeRowReorderApplyActions = {
	request: ( move: LargeRowReorderMove ) => boolean;
	confirm: () => void;
	cancel: () => void;
	apply: () => void;
	complete: () => void;
};

type LargeRowReorderApplyStore = LargeRowReorderApplyState & LargeRowReorderApplyActions;

/** 移動先境界が現在の行制約に対して有効か判定する。 */
const isDestinationValid = (
	destinationBoundaryIndex: number,
	constraints: { rowCount: number; blockedBoundaries: readonly number[] }
): boolean => {
	const destinationInRange =
		Number.isInteger( destinationBoundaryIndex ) &&
		destinationBoundaryIndex >= 0 &&
		destinationBoundaryIndex <= constraints.rowCount;
	const destinationAllowed =
		destinationInRange && ! constraints.blockedBoundaries.includes( destinationBoundaryIndex );
	return destinationAllowed;
};

/** 行の確認付き大規模反映をDnD SessionやReact mount状態から独立して保持する。 */
const largeRowReorderApplyStore = createStore< LargeRowReorderApplyStore >()(
	devtools(
		( set, get ) => ( {
			phase: 'idle',
			move: null,
			applied: false,
			request: ( move ) => {
				if ( get().phase !== 'idle' ) {
					return false;
				}
				set( { phase: 'confirming', move, applied: false }, undefined, 'large-row-apply/request' );
				return true;
			},
			confirm: () => {
				const state = get();
				if ( state.phase !== 'confirming' ) {
					throw new Error( 'Large row reorder confirmation requires a pending move.' );
				}
				set( { phase: 'applying', move: state.move, applied: false }, undefined, 'large-row-apply/confirm' );
			},
			cancel: () => {
				if ( get().phase !== 'confirming' ) {
					throw new Error( 'Large row reorder cancellation requires a pending move.' );
				}
				set( { phase: 'idle', move: null, applied: false }, undefined, 'large-row-apply/cancel' );
			},
			apply: () => {
				const state = get();
				if ( state.phase !== 'applying' ) {
					throw new Error( 'Large row reorder apply requires an applying move.' );
				}

				const constraints = rowTableIntegration.getConstraints( state.move.tableIdentity );
				const target = {
					tableIdentity: state.move.tableIdentity,
					sourceRowIndex: state.move.sourceRowIndex,
				};
				const moveStillValid =
					constraints !== null &&
					isRowReorderTargetMovable( target, constraints ) &&
					isDestinationValid( state.move.destinationBoundaryIndex, constraints );
				let applied = false;
				if ( moveStillValid ) {
					applied = rowTableIntegration.applyRowMove( {
						clientId: state.move.tableIdentity,
						sourceRowIndex: state.move.sourceRowIndex,
						destinationBoundaryIndex: state.move.destinationBoundaryIndex,
					} );
				}
				set( { phase: 'remounting', move: state.move, applied }, undefined, 'large-row-apply/remount' );
			},
			complete: () => {
				if ( get().phase !== 'remounting' ) {
					throw new Error( 'Large row reorder completion requires a remounting move.' );
				}
				set( { phase: 'idle', move: null, applied: false }, undefined, 'large-row-apply/complete' );
			},
		} ),
		{ name: 'Yamabiko Table Reorder / Large Row Apply' }
	)
);

/** 確認付き大規模行反映を開始する。 */
export const requestLargeRowReorderApply = ( move: LargeRowReorderMove ): boolean =>
	largeRowReorderApplyStore.getState().request( move );

/** 行反映状態変更をReact境界から購読する。 */
export const subscribeLargeRowReorderApply = ( listener: () => void ): ( () => void ) =>
	largeRowReorderApplyStore.subscribe( listener );

/** 現在の行反映状態を取得する。 */
export const getLargeRowReorderApplyState = (): LargeRowReorderApplyState =>
	largeRowReorderApplyStore.getState();

/** 確認済み行移動を反映開始状態へ進める。 */
export const confirmLargeRowReorderApply = (): void => largeRowReorderApplyStore.getState().confirm();

/** 確認待ち行移動を破棄する。 */
export const cancelLargeRowReorderApply = (): void => largeRowReorderApplyStore.getState().cancel();

/** BlockEdit退避後に現在Tableを再照合して行移動を反映し、再mount状態へ進める。 */
export const applyLargeRowReorder = (): void => largeRowReorderApplyStore.getState().apply();

/** 再mountと表示復帰を完了して通常状態へ戻す。 */
export const completeLargeRowReorderApply = (): void => largeRowReorderApplyStore.getState().complete();
