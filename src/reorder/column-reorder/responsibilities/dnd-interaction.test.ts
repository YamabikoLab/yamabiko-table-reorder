/**
 * 列専用DnD Interactionの主要なSession Lifecycleと分岐を、公開境界から確認する。
 *
 * 解決済みTargetから始まるSession開始、移動先判定、complete時の現在構造への再照合、
 * 反映規模による経路選択、正常な中止、外部状態変化、およびLifecycle違反を検証する。
 */

import { requestLargeColumnReorderApply } from '@/reorder/column-reorder/responsibilities/reorder-apply';
import { columnReorderMode } from '@/reorder/reorder-mode';
import {
	columnDndInteraction,
	getColumnDndDestinationBoundaryIndex,
	getColumnDndPhase,
	subscribeColumnDndTerminationNotice,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import type { ColumnReorderConstraints } from '@/reorder/column-reorder/responsibilities/table-integration';

jest.mock( '@/reorder/reorder-mode', () => ( {
	columnReorderMode: { resolveAfterDnd: jest.fn() },
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/reorder-apply', () => ( {
	requestLargeColumnReorderApply: jest.fn(),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/table-integration', () => ( {
	columnTableIntegration: {
		getConstraints: jest.fn(),
		getAffectedCellCount: jest.fn(),
		applyColumnMove: jest.fn(),
	},
} ) );

const getConstraintsMock = columnTableIntegration.getConstraints as jest.MockedFunction<
	typeof columnTableIntegration.getConstraints
>;
const getAffectedCellCountMock = columnTableIntegration.getAffectedCellCount as jest.MockedFunction<
	typeof columnTableIntegration.getAffectedCellCount
>;
const applyColumnMoveMock = columnTableIntegration.applyColumnMove as jest.MockedFunction<
	typeof columnTableIntegration.applyColumnMove
>;
const requestLargeColumnReorderApplyMock = requestLargeColumnReorderApply as jest.MockedFunction<
	typeof requestLargeColumnReorderApply
>;
const resolveAfterDndMock = columnReorderMode.resolveAfterDnd as jest.MockedFunction<
	typeof columnReorderMode.resolveAfterDnd
>;

const availableConstraints: ColumnReorderConstraints = {
	columnCount: 5,
	blockedBoundaries: [],
};
const target = { tableIdentity: 'table-a', sourceColumnIndex: 1 };

const startActiveSession = ( initialConstraints = availableConstraints ): void => {
	columnDndInteraction.start( target, initialConstraints );
};

describe( 'Column DnD Interaction lifecycle', () => {
	let terminationNoticeListener: jest.Mock;
	let unsubscribeTerminationNotice: () => void;

	beforeEach( () => {
		columnDndInteraction.cancel();
		jest.clearAllMocks();
		getConstraintsMock.mockReturnValue( availableConstraints );
		getAffectedCellCountMock.mockReturnValue( 20 );
		applyColumnMoveMock.mockReturnValue( true );
		requestLargeColumnReorderApplyMock.mockReturnValue( true );
		terminationNoticeListener = jest.fn();
		unsubscribeTerminationNotice = subscribeColumnDndTerminationNotice( terminationNoticeListener );
	} );

	afterEach( () => {
		unsubscribeTerminationNotice();
		columnDndInteraction.cancel();
	} );

	it( 'when start receives a resolved target, should begin an active session without resolving the table again', () => {
		startActiveSession();
		expect( getColumnDndPhase() ).toBe( 'active' );
		expect( getConstraintsMock ).not.toHaveBeenCalled();
	} );

	it( 'when start is called during an active session, should reject the lifecycle violation', () => {
		startActiveSession();
		expect( () => columnDndInteraction.start( target, availableConstraints ) ).toThrow(
			'Column DnD start requires an idle session.'
		);
	} );

	it( 'when destinations change during an active session, should validate them against the initial constraints', () => {
		startActiveSession( { columnCount: 5, blockedBoundaries: [ 4 ] } );
		columnDndInteraction.updateDestination( 4 );
		expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();
		columnDndInteraction.updateDestination( 3 );
		expect( getColumnDndDestinationBoundaryIndex() ).toBe( 3 );
		expect( getConstraintsMock ).not.toHaveBeenCalled();
	} );

	it( 'when a destination does not produce a valid column move, should keep the destination unavailable', () => {
		startActiveSession( { columnCount: 5, blockedBoundaries: [ 4 ] } );
		for ( const destination of [ 1, 2, -1, 6, 4 ] ) {
			columnDndInteraction.updateDestination( destination );
			expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();
		}
	} );

	it( 'when a valid destination is followed by no destination, should clear the previous destination', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 3 );
		columnDndInteraction.updateDestination( null );
		expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();
	} );

	it( 'when complete revalidation succeeds for a small move, should apply the column move and finish normally', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		columnDndInteraction.complete();

		expect( getAffectedCellCountMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceColumnIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( applyColumnMoveMock ).toHaveBeenCalledTimes( 1 );
		expect( requestLargeColumnReorderApplyMock ).not.toHaveBeenCalled();
		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );

	it( 'when affected cell count exceeds the threshold, should defer the move and end the DnD session', () => {
		getAffectedCellCountMock.mockReturnValue( 2_001 );
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		columnDndInteraction.complete();

		expect( requestLargeColumnReorderApplyMock ).toHaveBeenCalledWith( {
			tableIdentity: 'table-a',
			sourceColumnIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	it( 'when affected cell count cannot be resolved, should terminate without changing the table', () => {
		getAffectedCellCountMock.mockReturnValue( null );
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		columnDndInteraction.complete();

		expect( requestLargeColumnReorderApplyMock ).not.toHaveBeenCalled();
		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'when current constraints reject the source, should terminate without applying the column move', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( { columnCount: 5, blockedBoundaries: [ 2 ] } );
		columnDndInteraction.complete();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'when the confirmed column move cannot be applied, should finish with a termination notice', () => {
		applyColumnMoveMock.mockReturnValueOnce( false );
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		columnDndInteraction.complete();

		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	it( 'when an active session is canceled, should finish without applying a column move', () => {
		startActiveSession();
		columnDndInteraction.cancel();

		expect( applyColumnMoveMock ).not.toHaveBeenCalled();
		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );
} );
