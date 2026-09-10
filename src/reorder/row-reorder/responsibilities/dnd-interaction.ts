/**
 * 行専用DnD Interactionとして、DnD Engineの物理的なDnD進行をRow Reorderの意味状態へ変換する。
 *
 * activeな行DnD Sessionだけを共有状態として保持し、drop時に現在構造を再照合する。
 * 小規模反映は直接Table Integrationへ渡し、大規模反映はDnD Session終了後の確認Lifecycleへ移動意図だけを引き渡す。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { requiresLargeReorderApply } from '@/reorder/reorder-apply-policy';
import { rowReorderMode } from '@/reorder/reorder-mode';
import {
	isRowReorderTargetMovable,
	type RowReorderTarget,
} from '@/reorder/row-reorder/domain/target-validity';
import { requestLargeRowReorderApply } from '@/reorder/row-reorder/responsibilities/reorder-apply';
import { rowTableIntegration, type RowReorderConstraints } from '@/reorder/row-reorder/responsibilities/table-integration';

/** activeな行DnD中にDnD Interactionが所有する意味状態。 */
type RowDndSession = {
	tableIdentity: string;
	sourceRowIndex: number;
	destinationBoundaryIndex: number | null;
	initialConstraints: RowReorderConstraints;
};

type RowDndStoreState =
	| { phase: 'idle'; session: null }
	| { phase: 'active'; session: RowDndSession };

type RowDndStoreActions = {
	start: ( target: RowReorderTarget, initialConstraints: RowReorderConstraints ) => void;
	updateDestination: ( destinationBoundaryIndex: number | null ) => void;
	complete: () => void;
	cancel: () => void;
};

type RowDndStore = RowDndStoreState & RowDndStoreActions;
type RowDndStateListener = () => void;
type RowDndTerminationNoticeListener = () => void;

const rowDndTerminationNoticeListeners = new Set< RowDndTerminationNoticeListener >();

const emitRowDndTerminationNotice = (): void => {
	rowDndTerminationNoticeListeners.forEach( ( listener ) => listener() );
};

const resolveReorderModeAfterDnd = ( tableIdentity: string ): void => {
	const currentConstraints = rowTableIntegration.getConstraints( tableIdentity );
	const canContinue = currentConstraints !== null;
	rowReorderMode.resolveAfterDnd( tableIdentity, canContinue );
};

const isDestinationValid = (
	destinationBoundaryIndex: number,
	constraints: RowReorderConstraints
): boolean => {
	const destinationInRange =
		Number.isInteger( destinationBoundaryIndex ) &&
		destinationBoundaryIndex >= 0 &&
		destinationBoundaryIndex <= constraints.rowCount;
	if ( ! destinationInRange ) {
		return false;
	}
	const destinationAllowed = ! constraints.blockedBoundaries.includes( destinationBoundaryIndex );
	return destinationAllowed;
};

const rowDndStore = createStore< RowDndStore >()(
	devtools(
		( set, get ) => ( {
			phase: 'idle',
			session: null,
			start: ( target, initialConstraints ) => {
				if ( get().phase === 'active' ) {
					throw new Error( 'Row DnD start requires an idle session.' );
				}
				set(
					{
						phase: 'active',
						session: {
							tableIdentity: target.tableIdentity,
							sourceRowIndex: target.sourceRowIndex,
							destinationBoundaryIndex: null,
							initialConstraints,
						},
					},
					undefined,
					'row-dnd/start'
				);
			},
			updateDestination: ( destinationBoundaryIndex ) => {
				const state = get();
				if ( state.phase !== 'active' ) {
					throw new Error( 'Row DnD destination can only be updated during an active session.' );
				}
				const changesOrder =
					destinationBoundaryIndex !== null &&
					destinationBoundaryIndex !== state.session.sourceRowIndex &&
					destinationBoundaryIndex !== state.session.sourceRowIndex + 1;
				let validDestination: number | null = null;
				if (
					changesOrder &&
					destinationBoundaryIndex !== null &&
					isDestinationValid( destinationBoundaryIndex, state.session.initialConstraints )
				) {
					validDestination = destinationBoundaryIndex;
				}
				set(
					{
						phase: 'active',
						session: { ...state.session, destinationBoundaryIndex: validDestination },
					},
					undefined,
					'row-dnd/update-destination'
				);
			},
			complete: () => {
				const state = get();
				if ( state.phase !== 'active' ) {
					throw new Error( 'Row DnD complete requires an active session.' );
				}

				const { session } = state;
				let shouldNotifyTermination = false;
				try {
					if ( session.destinationBoundaryIndex === null ) {
						return;
					}

					const currentConstraints = rowTableIntegration.getConstraints( session.tableIdentity );
					const target: RowReorderTarget = {
						tableIdentity: session.tableIdentity,
						sourceRowIndex: session.sourceRowIndex,
					};
					if (
						currentConstraints === null ||
						! isRowReorderTargetMovable( target, currentConstraints ) ||
						! isDestinationValid( session.destinationBoundaryIndex, currentConstraints )
					) {
						shouldNotifyTermination = true;
						return;
					}

					const move = {
						clientId: session.tableIdentity,
						sourceRowIndex: session.sourceRowIndex,
						destinationBoundaryIndex: session.destinationBoundaryIndex,
					};
					const affectedCellCount = rowTableIntegration.getAffectedCellCount( move );
					if ( affectedCellCount === null ) {
						shouldNotifyTermination = true;
						return;
					}

					if ( requiresLargeReorderApply( affectedCellCount ) ) {
						const requested = requestLargeRowReorderApply( {
							tableIdentity: session.tableIdentity,
							sourceRowIndex: session.sourceRowIndex,
							destinationBoundaryIndex: session.destinationBoundaryIndex,
						} );
						if ( ! requested ) {
							shouldNotifyTermination = true;
						}
						return;
					}

					const applied = rowTableIntegration.applyRowMove( move );
					if ( ! applied ) {
						shouldNotifyTermination = true;
					}
				} finally {
					set( { phase: 'idle', session: null }, undefined, 'row-dnd/complete' );
					if ( shouldNotifyTermination ) {
						emitRowDndTerminationNotice();
					}
				}
			},
			cancel: () => {
				set( { phase: 'idle', session: null }, undefined, 'row-dnd/cancel' );
			},
		} ),
		{ name: 'Yamabiko Table Reorder / Row DnD' }
	)
);

/**
 * DnD Interactionの共有状態変更を購読する。
 *
 * @param listener 状態変更時の通知先。
 * @return 購読解除関数。
 */
export const subscribeRowDndState = ( listener: RowDndStateListener ): ( () => void ) =>
	rowDndStore.subscribe( listener );

/** 現在の行DnD Lifecycle状態を取得する。 */
export const getRowDndPhase = (): RowDndStoreState[ 'phase' ] => rowDndStore.getState().phase;

/** 現在の有効な移動先境界を取得する。 */
export const getRowDndDestinationBoundaryIndex = (): number | null => {
	const state = rowDndStore.getState();
	let destinationBoundaryIndex: number | null = null;
	if ( state.phase === 'active' ) {
		destinationBoundaryIndex = state.session.destinationBoundaryIndex;
	}
	return destinationBoundaryIndex;
};

/**
 * 行DnD異常終了通知を購読する。
 *
 * @param listener 通知対象のDnD終了時に呼び出すlistener。
 * @return 購読解除関数。
 */
export const subscribeRowDndTerminationNotice = (
	listener: RowDndTerminationNoticeListener
): ( () => void ) => {
	rowDndTerminationNoticeListeners.add( listener );
	const unsubscribe = (): void => rowDndTerminationNoticeListeners.delete( listener );
	return unsubscribe;
};

/** DnD Engine Lifecycleから利用する行専用DnD Interaction。 */
export const rowDndInteraction: RowDndStoreActions = {
	start: ( target, initialConstraints ) => rowDndStore.getState().start( target, initialConstraints ),
	updateDestination: ( destinationBoundaryIndex ) =>
		rowDndStore.getState().updateDestination( destinationBoundaryIndex ),
	complete: () => {
		const state = rowDndStore.getState();
		if ( state.phase !== 'active' ) {
			rowDndStore.getState().complete();
			return;
		}
		const tableIdentity = state.session.tableIdentity;
		rowDndStore.getState().complete();
		resolveReorderModeAfterDnd( tableIdentity );
	},
	cancel: () => {
		const state = rowDndStore.getState();
		if ( state.phase !== 'active' ) {
			rowDndStore.getState().cancel();
			return;
		}
		const tableIdentity = state.session.tableIdentity;
		rowDndStore.getState().cancel();
		resolveReorderModeAfterDnd( tableIdentity );
	},
};
