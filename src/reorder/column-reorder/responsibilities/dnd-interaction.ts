/**
 * 列専用DnD Interactionとして、解決済みReorder Targetから始まるColumn DnD Sessionの意味状態とLifecycleを所有する。
 *
 * activeな列DnD Sessionだけを共有状態として保持し、drop時に現在構造を再照合する。
 * 小規模反映は直接Table Integrationへ渡し、大規模反映はDnD Session終了後の確認Lifecycleへ移動意図だけを引き渡す。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import {
	isColumnReorderTargetMovable,
	type ColumnReorderTarget,
} from '@/reorder/column-reorder/domain/target-validity';
import { requestLargeColumnReorderApply } from '@/reorder/column-reorder/responsibilities/reorder-apply';
import { columnTableIntegration, type ColumnReorderConstraints } from '@/reorder/column-reorder/responsibilities/table-integration';
import { requiresLargeReorderApply } from '@/reorder/reorder-apply-policy';
import { columnReorderMode } from '@/reorder/reorder-mode';

/** activeな列DnD中にDnD Interactionが所有する意味状態。 */
type ColumnDndSession = {
	tableIdentity: string;
	sourceColumnIndex: number;
	destinationBoundaryIndex: number | null;
	initialConstraints: ColumnReorderConstraints;
};

type ColumnDndStoreState =
	| { phase: 'idle'; session: null }
	| { phase: 'active'; session: ColumnDndSession };

type ColumnDndStoreActions = {
	start: ( target: ColumnReorderTarget, initialConstraints: ColumnReorderConstraints ) => void;
	updateDestination: ( destinationBoundaryIndex: number | null ) => void;
	complete: () => void;
	cancel: () => void;
};

type ColumnDndStore = ColumnDndStoreState & ColumnDndStoreActions;
type ColumnDndStateListener = () => void;
type ColumnDndTerminationNoticeListener = () => void;

const columnDndTerminationNoticeListeners = new Set< ColumnDndTerminationNoticeListener >();

const emitColumnDndTerminationNotice = (): void => {
	columnDndTerminationNoticeListeners.forEach( ( listener ) => listener() );
};

const resolveReorderModeAfterDnd = ( tableIdentity: string ): void => {
	const currentConstraints = columnTableIntegration.getConstraints( tableIdentity );
	const canContinue = currentConstraints !== null;
	columnReorderMode.resolveAfterDnd( tableIdentity, canContinue );
};

const isDestinationValid = (
	destinationBoundaryIndex: number,
	constraints: ColumnReorderConstraints
): boolean => {
	const destinationInRange =
		Number.isInteger( destinationBoundaryIndex ) &&
		destinationBoundaryIndex >= 0 &&
		destinationBoundaryIndex <= constraints.columnCount;
	if ( ! destinationInRange ) {
		return false;
	}
	const destinationAllowed = ! constraints.blockedBoundaries.includes( destinationBoundaryIndex );
	return destinationAllowed;
};

const columnDndStore = createStore< ColumnDndStore >()(
	devtools(
		( set, get ) => ( {
			phase: 'idle',
			session: null,
			start: ( target, initialConstraints ) => {
				if ( get().phase === 'active' ) {
					throw new Error( 'Column DnD start requires an idle session.' );
				}
				set(
					{
						phase: 'active',
						session: {
							tableIdentity: target.tableIdentity,
							sourceColumnIndex: target.sourceColumnIndex,
							destinationBoundaryIndex: null,
							initialConstraints,
						},
					},
					undefined,
					'column-dnd/start'
				);
			},
			updateDestination: ( destinationBoundaryIndex ) => {
				const state = get();
				if ( state.phase !== 'active' ) {
					throw new Error( 'Column DnD destination can only be updated during an active session.' );
				}
				const changesOrder =
					destinationBoundaryIndex !== null &&
					destinationBoundaryIndex !== state.session.sourceColumnIndex &&
					destinationBoundaryIndex !== state.session.sourceColumnIndex + 1;
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
					'column-dnd/update-destination'
				);
			},
			complete: () => {
				const state = get();
				if ( state.phase !== 'active' ) {
					throw new Error( 'Column DnD complete requires an active session.' );
				}

				const { session } = state;
				let shouldNotifyTermination = false;
				try {
					if ( session.destinationBoundaryIndex === null ) {
						return;
					}

					const currentConstraints = columnTableIntegration.getConstraints( session.tableIdentity );
					const target: ColumnReorderTarget = {
						tableIdentity: session.tableIdentity,
						sourceColumnIndex: session.sourceColumnIndex,
					};
					if (
						currentConstraints === null ||
						! isColumnReorderTargetMovable( target, currentConstraints ) ||
						! isDestinationValid( session.destinationBoundaryIndex, currentConstraints )
					) {
						shouldNotifyTermination = true;
						return;
					}

					const move = {
						clientId: session.tableIdentity,
						sourceColumnIndex: session.sourceColumnIndex,
						destinationBoundaryIndex: session.destinationBoundaryIndex,
					};
					const affectedCellCount = columnTableIntegration.getAffectedCellCount( move );
					if ( affectedCellCount === null ) {
						shouldNotifyTermination = true;
						return;
					}

					if ( requiresLargeReorderApply( affectedCellCount ) ) {
						const requested = requestLargeColumnReorderApply( {
							tableIdentity: session.tableIdentity,
							sourceColumnIndex: session.sourceColumnIndex,
							destinationBoundaryIndex: session.destinationBoundaryIndex,
						} );
						if ( ! requested ) {
							shouldNotifyTermination = true;
						}
						return;
					}

					const applied = columnTableIntegration.applyColumnMove( move );
					if ( ! applied ) {
						shouldNotifyTermination = true;
					}
				} finally {
					set( { phase: 'idle', session: null }, undefined, 'column-dnd/complete' );
					if ( shouldNotifyTermination ) {
						emitColumnDndTerminationNotice();
					}
				}
			},
			cancel: () => {
				set( { phase: 'idle', session: null }, undefined, 'column-dnd/cancel' );
			},
		} ),
		{ name: 'Yamabiko Table Reorder / Column DnD' }
	)
);

/**
 * DnD Interactionの共有状態変更を購読する。
 *
 * @param listener 状態変更時の通知先。
 * @return 購読解除関数。
 */
export const subscribeColumnDndState = ( listener: ColumnDndStateListener ): ( () => void ) =>
	columnDndStore.subscribe( listener );

/** 現在のColumn DnD Lifecycle状態を取得する。 */
export const getColumnDndPhase = (): ColumnDndStoreState[ 'phase' ] => columnDndStore.getState().phase;

/** active Sessionの移動元論理列を取得する。 */
export const getColumnDndSourceColumnIndex = (): number | null => {
	const state = columnDndStore.getState();
	let sourceColumnIndex: number | null = null;
	if ( state.phase === 'active' ) {
		sourceColumnIndex = state.session.sourceColumnIndex;
	}
	return sourceColumnIndex;
};

/** 現在の有効な移動先境界を取得する。 */
export const getColumnDndDestinationBoundaryIndex = (): number | null => {
	const state = columnDndStore.getState();
	let destinationBoundaryIndex: number | null = null;
	if ( state.phase === 'active' ) {
		destinationBoundaryIndex = state.session.destinationBoundaryIndex;
	}
	return destinationBoundaryIndex;
};

/**
 * 列DnD異常終了通知を購読する。
 *
 * @param listener 通知対象のDnD終了時に呼び出すlistener。
 * @return 購読解除関数。
 */
export const subscribeColumnDndTerminationNotice = (
	listener: ColumnDndTerminationNoticeListener
): ( () => void ) => {
	columnDndTerminationNoticeListeners.add( listener );
	const unsubscribe = (): void => columnDndTerminationNoticeListeners.delete( listener );
	return unsubscribe;
};

/** DnD Engine Lifecycleから利用する列専用DnD Interaction。 */
export const columnDndInteraction: ColumnDndStoreActions = {
	start: ( target, initialConstraints ) => columnDndStore.getState().start( target, initialConstraints ),
	updateDestination: ( destinationBoundaryIndex ) =>
		columnDndStore.getState().updateDestination( destinationBoundaryIndex ),
	complete: () => {
		const state = columnDndStore.getState();
		if ( state.phase !== 'active' ) {
			columnDndStore.getState().complete();
			return;
		}
		const tableIdentity = state.session.tableIdentity;
		columnDndStore.getState().complete();
		resolveReorderModeAfterDnd( tableIdentity );
	},
	cancel: () => {
		const state = columnDndStore.getState();
		if ( state.phase !== 'active' ) {
			columnDndStore.getState().cancel();
			return;
		}
		const tableIdentity = state.session.tableIdentity;
		columnDndStore.getState().cancel();
		resolveReorderModeAfterDnd( tableIdentity );
	},
};
