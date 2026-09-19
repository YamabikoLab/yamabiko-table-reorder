/**
 * RF Apply Coordinationが確定Move summaryを成功結果の正本として通常反映と確認付き大規模反映へ引き渡す契約を確認する。
 */

import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import {
	applyRfReorder,
	cancelRfApply,
	completeRfApplyRestoration,
	continueRfApply,
	getRfApplyCoordinationSnapshot,
	getRfApplySummary,
	receiveRfApplyRequest,
	subscribeRfApplyCoordination,
} from './apply-coordination';
import type { RfApplyRequest, RfApplyResult } from './interaction';

jest.mock( '@/reorder/row-reorder/responsibilities/table-integration', () => ( {
	rowTableIntegration: {
		assessRowMoveForApply: jest.fn(),
		applyRowMove: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/table-integration', () => ( {
	columnTableIntegration: {
		assessColumnMoveForApply: jest.fn(),
		applyColumnMove: jest.fn(),
	},
} ) );

const rowAssessmentMock = rowTableIntegration.assessRowMoveForApply as jest.Mock;
const rowApplyMock = rowTableIntegration.applyRowMove as jest.Mock;
const columnAssessmentMock = columnTableIntegration.assessColumnMoveForApply as jest.Mock;
const columnApplyMock = columnTableIntegration.applyColumnMove as jest.Mock;

const rowRequest: RfApplyRequest = {
	kind: 'row',
	candidate: {
		clientId: 'table-row',
		sourceRowIndex: 1,
		destinationBoundaryIndex: 4,
	},
};

const columnRequest: RfApplyRequest = {
	kind: 'column',
	candidate: {
		clientId: 'table-column',
		sourceColumnIndex: 2,
		destinationBoundaryIndex: 0,
	},
};

const rowMoveSummary = {
	kind: 'row' as const,
	sourcePosition: 2,
	destinationPosition: 4,
};

const columnMoveSummary = {
	kind: 'column' as const,
	sourcePosition: 3,
	destinationPosition: 1,
};

describe( 'RF Apply Coordination', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * 小規模Row反映成功では受付時assessmentのMove summaryを表示復帰とsuccess結果で共有することを確認する。
	 */
	it( 'when a direct row apply succeeds, should keep one confirmed move summary through restoration and completion', () => {
		rowAssessmentMock.mockReturnValue( { affectedCellCount: 10, destinationRowIndex: 3 } );
		rowApplyMock.mockReturnValue( true );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );

		expect( rowApplyMock ).toHaveBeenCalledTimes( 1 );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'restoring',
			tableIdentity: 'table-row',
			applied: true,
			moveSummary: rowMoveSummary,
		} );
		expect( getRfApplySummary() ).toBeNull();
		expect( resolve ).not.toHaveBeenCalled();

		completeRfApplyRestoration();

		expect( resolve ).toHaveBeenCalledWith( {
			status: 'success',
			moveSummary: rowMoveSummary,
		} );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
	} );

	/** 小規模Column反映失敗ではMove summaryを結果へ残さず即時failureにすることを確認する。 */
	it( 'when a direct column apply fails, should resolve failure without a move summary', () => {
		columnAssessmentMock.mockReturnValue( {
			affectedCellCount: 10,
			destinationColumnIndex: 0,
		} );
		columnApplyMock.mockReturnValue( false );
		const resolve = jest.fn();

		receiveRfApplyRequest( columnRequest, resolve );

		expect( resolve ).toHaveBeenCalledWith( { status: 'failure' } );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
	} );

	/** 現在Table再照合が不成立ならTableを変更せずfailureにすることを確認する。 */
	it( 'when current-table assessment rejects a request, should resolve failure without applying', () => {
		rowAssessmentMock.mockReturnValue( null );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );

		expect( rowApplyMock ).not.toHaveBeenCalled();
		expect( resolve ).toHaveBeenCalledWith( { status: 'failure' } );
	} );

	/**
	 * 大規模反映では確認用summaryをconfirming終了時に破棄し、Continue後の再assessmentを成功結果の正本にすることを確認する。
	 */
	it( 'when a large row request completes, should replace the confirmation summary with the post-continue assessment summary', () => {
		rowAssessmentMock
			.mockReturnValueOnce( { affectedCellCount: 501, destinationRowIndex: 3 } )
			.mockReturnValueOnce( { affectedCellCount: 501, destinationRowIndex: 1 } );
		rowApplyMock.mockReturnValue( true );
		const results: RfApplyResult[] = [];
		const resolve = jest.fn( ( result: RfApplyResult ) => {
			results.push( result );
			expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
		} );

		receiveRfApplyRequest( rowRequest, resolve );
		expect( getRfApplySummary() ).toEqual( rowMoveSummary );

		continueRfApply();
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'applying',
			tableIdentity: 'table-row',
			kind: 'row',
		} );
		expect( getRfApplySummary() ).toBeNull();

		applyRfReorder();
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'restoring',
			tableIdentity: 'table-row',
			applied: true,
			moveSummary: {
				kind: 'row',
				sourcePosition: 2,
				destinationPosition: 2,
			},
		} );

		completeRfApplyRestoration();
		expect( results ).toEqual( [
			{
				status: 'success',
				moveSummary: {
					kind: 'row',
					sourcePosition: 2,
					destinationPosition: 2,
				},
			},
		] );
	} );

	/** 大規模反映のCancelではcleanup後にcancelledを返し、確認summaryを残さないことを確認する。 */
	it( 'when a confirming request is cancelled, should clean up before resolving cancelled', () => {
		columnAssessmentMock.mockReturnValue( {
			affectedCellCount: 501,
			destinationColumnIndex: 0,
		} );
		const resolve = jest.fn( ( result: RfApplyResult ) => {
			expect( result ).toEqual( { status: 'cancelled' } );
			expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
			expect( getRfApplySummary() ).toBeNull();
		} );

		receiveRfApplyRequest( columnRequest, resolve );
		expect( getRfApplySummary() ).toEqual( columnMoveSummary );
		cancelRfApply();

		expect( columnApplyMock ).not.toHaveBeenCalled();
		expect( resolve ).toHaveBeenCalledTimes( 1 );
	} );

	/** Continue後に候補が不成立になった場合はMove summaryなしのfailure restoringを経由することを確認する。 */
	it( 'when a large request becomes stale after continue, should restore without a move summary and resolve failure', () => {
		rowAssessmentMock
			.mockReturnValueOnce( { affectedCellCount: 501, destinationRowIndex: 3 } )
			.mockReturnValueOnce( null );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );
		continueRfApply();
		applyRfReorder();

		expect( rowApplyMock ).not.toHaveBeenCalled();
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'restoring',
			tableIdentity: 'table-row',
			kind: 'row',
			applied: false,
		} );

		completeRfApplyRestoration();
		expect( resolve ).toHaveBeenCalledWith( { status: 'failure' } );
	} );

	/** 再assessment成立後の確定更新失敗でも確定Move summaryをfailure結果へ残さないことを確認する。 */
	it( 'when a large final update fails, should restore failure without retaining a move summary', () => {
		rowAssessmentMock.mockReturnValue( { affectedCellCount: 501, destinationRowIndex: 3 } );
		rowApplyMock.mockReturnValue( false );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );
		continueRfApply();
		applyRfReorder();

		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'restoring',
			tableIdentity: 'table-row',
			kind: 'row',
			applied: false,
		} );
		completeRfApplyRestoration();
		expect( resolve ).toHaveBeenCalledWith( { status: 'failure' } );
	} );

	/** 進行中Lifecycleと競合する別要求は既存Lifecycleを置換せずfailureで解放することを確認する。 */
	it( 'when another request arrives during an RF lifecycle, should fail the competing request without replacing the pending one', () => {
		rowAssessmentMock.mockReturnValue( { affectedCellCount: 501, destinationRowIndex: 3 } );
		const firstResolve = jest.fn();
		const secondResolve = jest.fn();

		receiveRfApplyRequest( rowRequest, firstResolve );
		receiveRfApplyRequest( columnRequest, secondResolve );

		expect( secondResolve ).toHaveBeenCalledWith( { status: 'failure' } );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'confirming',
			tableIdentity: 'table-row',
			kind: 'row',
		} );

		cancelRfApply();
		expect( firstResolve ).toHaveBeenCalledWith( { status: 'cancelled' } );
	} );

	/** cleanupが外部callbackより先に完了し、購読解除後は状態変更通知が止まることを確認する。 */
	it( 'when completion resolves, should clean up first and respect lifecycle unsubscription', () => {
		rowAssessmentMock.mockReturnValue( { affectedCellCount: 501, destinationRowIndex: 3 } );
		rowApplyMock.mockReturnValue( true );
		const listener = jest.fn();
		const resolve = jest.fn( () => {
			expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
		} );
		const unsubscribe = subscribeRfApplyCoordination( listener );

		receiveRfApplyRequest( rowRequest, resolve );
		continueRfApply();
		expect( listener ).toHaveBeenCalledTimes( 2 );

		unsubscribe();
		applyRfReorder();
		completeRfApplyRestoration();

		expect( listener ).toHaveBeenCalledTimes( 2 );
		expect( resolve ).toHaveBeenCalledWith( {
			status: 'success',
			moveSummary: rowMoveSummary,
		} );
	} );

	/** useSyncExternalStore向けsnapshotが状態不変時に同一参照を返すことを確認する。 */
	it( 'when the lifecycle state is unchanged, should return the same public snapshot reference', () => {
		rowAssessmentMock.mockReturnValue( { affectedCellCount: 501, destinationRowIndex: 3 } );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );
		const confirming = getRfApplyCoordinationSnapshot();
		expect( getRfApplyCoordinationSnapshot() ).toBe( confirming );

		continueRfApply();
		expect( getRfApplyCoordinationSnapshot() ).not.toBe( confirming );

		rowAssessmentMock.mockReturnValue( null );
		applyRfReorder();
		completeRfApplyRestoration();
	} );
} );
