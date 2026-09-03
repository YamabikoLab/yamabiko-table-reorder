import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { RowReorderConstraints, rowTableIntegration } from './table-integration';

type RowDndSession = {
	tableIdentity: string;
	sourceRowIndex: number;
	destinationBoundaryIndex: number | null;
	initialConstraints: RowReorderConstraints;
};

type RowDndSource = {
	tableIdentity: string;
	sourceRowIndex: number;
};

type RowDndStoreState =
	| {
			phase: 'idle';
			session: null;
	  }
	| {
			phase: 'active';
			session: RowDndSession;
	  };

type RowDndStoreActions = {
	canStart: ( source: RowDndSource ) => boolean;
	start: ( source: RowDndSource ) => void;
	updateDestination: ( destinationBoundaryIndex: number | null ) => void;
	complete: () => void;
	cancel: () => void;
};

type RowDndStore = RowDndStoreState & RowDndStoreActions;

type RowDndStartCandidate = {
	source: RowDndSource;
	initialConstraints: RowReorderConstraints;
};

let startCandidate: RowDndStartCandidate | null = null;

const isSameSource = ( left: RowDndSource, right: RowDndSource ): boolean =>
	left.tableIdentity === right.tableIdentity && left.sourceRowIndex === right.sourceRowIndex;

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

	return ! constraints.blockedBoundaries.includes( destinationBoundaryIndex );
};

const rowDndStore = createStore< RowDndStore >()(
	devtools(
		( set, get ) => ( {
			phase: 'idle',
			session: null,

			canStart: ( source ) => {
				const constraints = rowTableIntegration.getConstraints( source.tableIdentity );

				if ( constraints === null || ! isSourceMovable( source.sourceRowIndex, constraints ) ) {
					startCandidate = null;
					return false;
				}

				startCandidate = {
					source,
					initialConstraints: constraints,
				};

				return true;
			},

			start: ( source ) => {
				if ( startCandidate === null || ! isSameSource( startCandidate.source, source ) ) {
					throw new Error(
						'Row DnD start requires a valid start candidate established by canStart.'
					);
				}

				const session: RowDndSession = {
					tableIdentity: source.tableIdentity,
					sourceRowIndex: source.sourceRowIndex,
					destinationBoundaryIndex: null,
					initialConstraints: startCandidate.initialConstraints,
				};

				startCandidate = null;

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
				startCandidate = null;

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
