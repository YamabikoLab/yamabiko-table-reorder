import { devtools } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import { RowReorderConstraints } from './table-integration';

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
