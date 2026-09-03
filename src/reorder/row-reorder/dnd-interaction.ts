/**
 * 行専用DnD Interactionとして、DnD Engineの物理的なDnD進行をRow Reorderの意味状態へ変換する。
 *
 * DnD開始前の開始可否判定、activeな行DnD Session、移動先更新、確定、cancelのLifecycleを所有する。
 * 開始可否判定で確認した行制約は開始候補の値としてstartへ引き継ぎ、Session開始時に外部Table構造を取得し直さない。
 */

import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { RowReorderConstraints, rowTableIntegration } from './table-integration';

/** activeな行DnD中にDnD Interactionが所有する意味状態。 */
type RowDndSession = {
	tableIdentity: string;
	sourceRowIndex: number;
	destinationBoundaryIndex: number | null;
	initialConstraints: RowReorderConstraints;
};

/** DnD開始可否判定の対象となる行を表す。 */
export type RowDndSource = {
	tableIdentity: string;
	sourceRowIndex: number;
};

/**
 * 1回の開始可否判定で成立した開始候補を表す。
 *
 * 物理的なDnDが成立した場合だけstartへ渡し、成立しなかった場合は保持せず破棄する。
 */
export type RowDndStartCandidate = {
	source: RowDndSource;
	initialConstraints: RowReorderConstraints;
};

/** DnD Interactionが保持できる有効状態を表す。 */
type RowDndStoreState =
	| {
			phase: 'idle';
			session: null;
	  }
	| {
			phase: 'active';
			session: RowDndSession;
	  };

/** DnD Interaction Storeが状態遷移のために提供する操作を表す。 */
type RowDndStoreActions = {
	prepareStart: ( source: RowDndSource ) => RowDndStartCandidate | null;
	start: ( candidate: RowDndStartCandidate ) => void;
	updateDestination: ( destinationBoundaryIndex: number | null ) => void;
	complete: () => void;
	cancel: () => void;
};

type RowDndStore = RowDndStoreState & RowDndStoreActions;

/**
 * 移動対象行が現在の行制約に対して行単位で移動可能か判定する。
 *
 * @param sourceRowIndex 移動対象の0-based行位置。
 * @param constraints    判定基準とする行制約。
 * @return 行単位の移動でTable構造を保持できる場合はtrue。
 */
const isSourceMovable = ( sourceRowIndex: number, constraints: RowReorderConstraints ): boolean => {
	const sourceInRange =
		Number.isInteger( sourceRowIndex ) &&
		sourceRowIndex >= 0 &&
		sourceRowIndex < constraints.rowCount;

	if ( ! sourceInRange ) {
		return false;
	}

	const sourceCrossesBlockedBoundary =
		constraints.blockedBoundaries.includes( sourceRowIndex ) ||
		constraints.blockedBoundaries.includes( sourceRowIndex + 1 );

	return ! sourceCrossesBlockedBoundary;
};

/**
 * 移動先境界が判定基準の行制約に対して有効か判定する。
 *
 * @param destinationBoundaryIndex 移動先の0-based挿入位置。
 * @param constraints              判定基準とする行制約。
 * @return 行を挿入してTable構造を保持できる場合はtrue。
 */
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

/**
 * 行DnD SessionとLifecycleを所有するStore。
 *
 * active Sessionだけを共有状態として保持し、物理的なDnD成立前の開始候補はStoreへ保存しない。
 */
const rowDndStore = createStore< RowDndStore >()(
	devtools(
		( set, get ) => ( {
			phase: 'idle',
			session: null,

			prepareStart: ( source ) => {
				const initialConstraints = rowTableIntegration.getConstraints( source.tableIdentity );

				if (
					initialConstraints === null ||
					! isSourceMovable( source.sourceRowIndex, initialConstraints )
				) {
					return null;
				}

				return {
					source,
					initialConstraints,
				};
			},

			start: ( candidate ) => {
				const session: RowDndSession = {
					tableIdentity: candidate.source.tableIdentity,
					sourceRowIndex: candidate.source.sourceRowIndex,
					destinationBoundaryIndex: null,
					initialConstraints: candidate.initialConstraints,
				};

				set(
					{
						phase: 'active',
						session,
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

				const validDestination =
					destinationBoundaryIndex !== null &&
					isDestinationValid( destinationBoundaryIndex, state.session.initialConstraints )
						? destinationBoundaryIndex
						: null;

				set(
					{
						phase: 'active',
						session: {
							...state.session,
							destinationBoundaryIndex: validDestination,
						},
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

				try {
					if ( session.destinationBoundaryIndex === null ) {
						return;
					}

					const currentConstraints = rowTableIntegration.getConstraints( session.tableIdentity );

					if (
						currentConstraints === null ||
						! isSourceMovable( session.sourceRowIndex, currentConstraints ) ||
						! isDestinationValid( session.destinationBoundaryIndex, currentConstraints )
					) {
						return;
					}

					rowTableIntegration.applyRowMove( {
						clientId: session.tableIdentity,
						sourceRowIndex: session.sourceRowIndex,
						destinationBoundaryIndex: session.destinationBoundaryIndex,
					} );
				} finally {
					set(
						{
							phase: 'idle',
							session: null,
						},
						undefined,
						'row-dnd/complete'
					);
				}
			},

			cancel: () => {
				set(
					{
						phase: 'idle',
						session: null,
					},
					undefined,
					'row-dnd/cancel'
				);
			},
		} ),
		{
			name: 'Yamabiko Table Reorder / Row DnD',
		}
	)
);

/**
 * DnD Engine Lifecycleから利用する行専用DnD Interactionの内部仕様。
 *
 * Store自体や状態置換手段は公開せず、開始候補の準備とSession Lifecycleの操作だけを公開する。
 */
export const rowDndInteraction: RowDndStoreActions = {
	prepareStart: ( source ) => rowDndStore.getState().prepareStart( source ),
	start: ( candidate ) => rowDndStore.getState().start( candidate ),
	updateDestination: ( destinationBoundaryIndex ) =>
		rowDndStore.getState().updateDestination( destinationBoundaryIndex ),
	complete: () => rowDndStore.getState().complete(),
	cancel: () => rowDndStore.getState().cancel(),
};
