/**
 * 行専用DnD Interactionの主要なSession Lifecycleと分岐を、公開境界から確認する。
 *
 * 開始可否はReorder Target Resolutionの責務として別テストで検証し、ここでは解決済みTargetから始まる
 * Session開始、移動先判定、complete時の現在構造への再照合、反映規模による経路選択、正常な中止、外部状態変化、およびLifecycle違反を検証する。
 */

import { rowReorderMode } from '@/reorder/reorder-mode';
import { requestLargeRowReorderApply } from '@/reorder/row-reorder/responsibilities/reorder-apply';

import {
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	rowDndInteraction,
	subscribeRowDndTerminationNotice,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';
import type { RowReorderConstraints } from '@/reorder/row-reorder/responsibilities/table-integration';

jest.mock( '@/reorder/reorder-mode', () => ( {
	rowReorderMode: {
		resolveAfterDnd: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/reorder-apply', () => ( {
	requestLargeRowReorderApply: jest.fn(),
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
		getAffectedCellCount: jest.fn(),
		applyRowMove: jest.fn(),
	},
} ) );

const getConstraintsMock = rowTableIntegration.getConstraints as jest.MockedFunction<
	typeof rowTableIntegration.getConstraints
>;
const getAffectedCellCountMock = rowTableIntegration.getAffectedCellCount as jest.MockedFunction<
	typeof rowTableIntegration.getAffectedCellCount
>;
const applyRowMoveMock = rowTableIntegration.applyRowMove as jest.MockedFunction<
	typeof rowTableIntegration.applyRowMove
>;
const requestLargeRowReorderApplyMock = requestLargeRowReorderApply as jest.MockedFunction<
	typeof requestLargeRowReorderApply
>;
const resolveAfterDndMock = rowReorderMode.resolveAfterDnd as jest.MockedFunction<
	typeof rowReorderMode.resolveAfterDnd
>;

const availableConstraints: RowReorderConstraints = {
	rowCount: 5,
	blockedBoundaries: [],
};

const target = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

/**
 * 解決済みReorder Targetから通常のactive Sessionを開始する。
 *
 * @param initialConstraints Session開始時の判定基準として使用する行制約。
 */
const startActiveSession = ( initialConstraints = availableConstraints ): void => {
	rowDndInteraction.start( target, initialConstraints );
};

describe( 'Row DnD Interaction lifecycle', () => {
	let terminationNoticeListener: jest.Mock;
	let unsubscribeTerminationNotice: () => void;

	beforeEach( () => {
		rowDndInteraction.cancel();
		jest.clearAllMocks();
		getConstraintsMock.mockReturnValue( availableConstraints );
		getAffectedCellCountMock.mockReturnValue( 20 );
		applyRowMoveMock.mockReturnValue( true );
		requestLargeRowReorderApplyMock.mockReturnValue( true );
		terminationNoticeListener = jest.fn();
		unsubscribeTerminationNotice = subscribeRowDndTerminationNotice( terminationNoticeListener );
	} );

	afterEach( () => {
		unsubscribeTerminationNotice();
		rowDndInteraction.cancel();
	} );

	it( 'when start receives a resolved target, should begin an active session without resolving the table again', () => {
		startActiveSession();

		expect( getRowDndPhase() ).toBe( 'active' );
		expect( getConstraintsMock ).not.toHaveBeenCalled();
	} );

	it( 'when start is called during an active session, should reject the lifecycle violation', () => {
		startActiveSession();

		expect( () => rowDndInteraction.start( target, availableConstraints ) ).toThrow(
			'Row DnD start requires an idle session.'
		);
	} );

	it( 'when destinations change during an active session, should validate them against the initial constraints', () => {
		startActiveSession( {
			rowCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		rowDndInteraction.updateDestination( 4 );
		expect( getRowDndDestinationBoundaryIndex() ).toBeNull();

		rowDndInteraction.updateDestination( 3 );

		expect( getRowDndDestinationBoundaryIndex() ).toBe( 3 );
		expect( getConstraintsMock ).not.toHaveBeenCalled();
	} );

	it( 'when complete revalidation succeeds for a small move, should apply the row move and finish normally', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( getAffectedCellCountMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( applyRowMoveMock ).toHaveBeenCalledWith( {
			clientId: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( requestLargeRowReorderApplyMock ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );

	it( 'when affected cell count exceeds the threshold, should defer the move and end the DnD session', () => {
		getAffectedCellCountMock.mockReturnValue( 2_001 );
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( requestLargeRowReorderApplyMock ).toHaveBeenCalledWith( {
			tableIdentity: 'table-a',
			sourceRowIndex: 1,
			destinationBoundaryIndex: 4,
		} );
		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	it( 'when affected cell count cannot be resolved, should terminate without changing the table', () => {
		getAffectedCellCountMock.mockReturnValue( null );
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( requestLargeRowReorderApplyMock ).not.toHaveBeenCalled();
		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'when complete has no valid destination, should finish without applying a row move or notice', () => {
		startActiveSession();

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	it( 'when the source becomes invalid before complete, should terminate without applying the row move', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 2 ],
		} );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	it( 'when the destination becomes invalid before complete, should terminate without applying the row move', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );
		getConstraintsMock.mockReturnValueOnce( {
			rowCount: 5,
			blockedBoundaries: [ 4 ],
		} );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	it( 'when the confirmed row move cannot be applied, should finish with a termination notice', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );
		applyRowMoveMock.mockReturnValueOnce( false );

		rowDndInteraction.complete();

		expect( applyRowMoveMock ).toHaveBeenCalledTimes( 1 );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	it( 'when an active session is canceled, should finish without applying a row move', () => {
		startActiveSession();

		rowDndInteraction.cancel();

		expect( applyRowMoveMock ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( resolveAfterDndMock ).toHaveBeenCalledWith( 'table-a', true );
	} );
} );
