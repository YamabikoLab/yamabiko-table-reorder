/**
 * RF Apply Coordinationが通常反映と確認付き大規模反映を分離し、現在Table再照合、Lifecycle、summary、結果返却を所有するContractを確認する。
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
	direction: 'row',
	candidate: {
		clientId: 'table-row',
		sourceRowIndex: 1,
		destinationBoundaryIndex: 4,
	},
};

const columnRequest: RfApplyRequest = {
	direction: 'column',
	candidate: {
		clientId: 'table-column',
		sourceColumnIndex: 2,
		destinationBoundaryIndex: 0,
	},
};

describe( 'RF Apply Coordination', () => {
	beforeEach( () => {
		jest.clearAllMocks();
	} );

	/**
	 * 小規模なRF候補は長期Lifecycleを作らず同期的に反映できることを確認する。
	 *
	 * 事前条件:
	 * - Row候補は現在Tableで成立し、更新対象セル数は大規模反映閾値以下である。
	 * - Table Integrationの確定更新も成功する。
	 *
	 * 操作:
	 * - RF Apply要求を受け付ける。
	 *
	 * 期待結果:
	 * - 一回の確定更新だけが要求される。
	 * - callbackへsuccessが一度返る。
	 * - 大規模反映Lifecycleとsummaryは作られない。
	 */
	it( 'when a row request uses the direct path, should apply once and resolve success without long-lived state', () => {
		rowAssessmentMock.mockReturnValue( { affectedCellCount: 10, destinationRowIndex: 3 } );
		rowApplyMock.mockReturnValue( true );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );

		expect( rowApplyMock ).toHaveBeenCalledTimes( 1 );
		expect( rowApplyMock ).toHaveBeenCalledWith( rowRequest.candidate );
		expect( resolve ).toHaveBeenCalledTimes( 1 );
		expect( resolve ).toHaveBeenCalledWith( 'success' );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
		expect( getRfApplySummary() ).toBeNull();
	} );

	/**
	 * Apply要求時の現在Table再照合が成立しない場合はTableを変更しないことを確認する。
	 *
	 * 事前条件:
	 * - RF InteractionからRow候補が渡される。
	 * - Table IntegrationのApply Assessmentでは現在候補が成立しない。
	 *
	 * 操作:
	 * - RF Apply要求を受け付ける。
	 *
	 * 期待結果:
	 * - 確定更新は要求されない。
	 * - callbackへfailureが一度返る。
	 */
	it( 'when current-table assessment rejects a request, should resolve failure without applying', () => {
		rowAssessmentMock.mockReturnValue( null );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );

		expect( rowApplyMock ).not.toHaveBeenCalled();
		expect( resolve ).toHaveBeenCalledTimes( 1 );
		expect( resolve ).toHaveBeenCalledWith( 'failure' );
	} );

	/**
	 * 大規模Row反映では確認、反映中、表示復帰を順に経てからsuccessを返すことを確認する。
	 *
	 * 事前条件:
	 * - Apply要求時とContinue後の現在TableでRow候補が成立する。
	 * - 更新対象セル数は大規模反映閾値を超え、確定更新は成功する。
	 *
	 * 操作:
	 * - Apply要求、Continue、反映開始、表示復帰完了を順に通知する。
	 *
	 * 期待結果:
	 * - Continue時点ではTableを変更しない。
	 * - confirmingからapplying、restoring、idleへ遷移する。
	 * - callbackはcleanup後にsuccessで一度だけ呼ばれる。
	 */
	it( 'when a large row request completes, should resolve success only after restoration and cleanup', () => {
		rowAssessmentMock.mockReturnValue( { affectedCellCount: 501, destinationRowIndex: 3 } );
		rowApplyMock.mockReturnValue( true );
		const results: RfApplyResult[] = [];
		const resolve = jest.fn( ( result: RfApplyResult ) => {
			results.push( result );
			expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
			expect( getRfApplySummary() ).toBeNull();
		} );

		receiveRfApplyRequest( rowRequest, resolve );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'confirming',
			tableIdentity: 'table-row',
			direction: 'row',
		} );
		expect( getRfApplySummary() ).toEqual( {
			direction: 'row',
			sourcePosition: 2,
			destinationPosition: 4,
		} );

		continueRfApply();
		expect( rowApplyMock ).not.toHaveBeenCalled();
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'applying',
			tableIdentity: 'table-row',
			direction: 'row',
		} );

		applyRfReorder();
		expect( rowAssessmentMock ).toHaveBeenCalledTimes( 2 );
		expect( rowApplyMock ).toHaveBeenCalledTimes( 1 );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'restoring',
			tableIdentity: 'table-row',
			direction: 'row',
			applied: true,
		} );
		expect( resolve ).not.toHaveBeenCalled();

		completeRfApplyRestoration();
		expect( results ).toEqual( [ 'success' ] );
		expect( resolve ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 大規模反映のCancelではTableを変更せず、内部状態を破棄してからcancelledを返すことを確認する。
	 *
	 * 事前条件:
	 * - Column候補が大規模反映としてconfirmingに入っている。
	 *
	 * 操作:
	 * - Cancelを通知する。
	 *
	 * 期待結果:
	 * - 確定更新は要求されない。
	 * - callback時点ではLifecycleとsummaryがcleanup済みである。
	 * - cancelledが一度だけ返る。
	 */
	it( 'when a confirming request is cancelled, should clean up before resolving cancelled', () => {
		columnAssessmentMock.mockReturnValue( {
			affectedCellCount: 501,
			destinationColumnIndex: 0,
		} );
		const resolve = jest.fn( ( result: RfApplyResult ) => {
			expect( result ).toBe( 'cancelled' );
			expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
			expect( getRfApplySummary() ).toBeNull();
		} );

		receiveRfApplyRequest( columnRequest, resolve );
		expect( getRfApplySummary() ).toEqual( {
			direction: 'column',
			sourcePosition: 3,
			destinationPosition: 1,
		} );

		cancelRfApply();

		expect( columnApplyMock ).not.toHaveBeenCalled();
		expect( resolve ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * Continue後に現在Tableが変化して候補が成立しなくなった場合、stale候補を反映しないことを確認する。
	 *
	 * 事前条件:
	 * - Apply要求時にはRow候補が大規模反映として成立する。
	 * - 反映開始時の再照合では候補が成立しない。
	 *
	 * 操作:
	 * - Continue後に反映開始と表示復帰完了を通知する。
	 *
	 * 期待結果:
	 * - Table Integrationの確定更新は呼ばれない。
	 * - restoringを経由した後にfailureが返る。
	 */
	it( 'when a large request becomes stale after continue, should restore without applying and resolve failure', () => {
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
			direction: 'row',
			applied: false,
		} );
		expect( resolve ).not.toHaveBeenCalled();

		completeRfApplyRestoration();
		expect( resolve ).toHaveBeenCalledTimes( 1 );
		expect( resolve ).toHaveBeenCalledWith( 'failure' );
	} );

	/**
	 * 一つの大規模反映Lifecycle中に別要求が来ても、二つ目のInteractionを未完了にしないことを確認する。
	 *
	 * 事前条件:
	 * - Row候補がconfirmingとして保持されている。
	 * - 別のColumn候補がApplyを要求する。
	 *
	 * 操作:
	 * - 二つ目のApply要求を受け付ける。
	 *
	 * 期待結果:
	 * - 二つ目のcallbackへfailureが一度返る。
	 * - 最初の確認Lifecycleは維持される。
	 */
	it( 'when another request arrives during a large lifecycle, should fail the competing request without replacing the pending one', () => {
		rowAssessmentMock.mockReturnValue( { affectedCellCount: 501, destinationRowIndex: 3 } );
		const firstResolve = jest.fn();
		const secondResolve = jest.fn();

		receiveRfApplyRequest( rowRequest, firstResolve );
		receiveRfApplyRequest( columnRequest, secondResolve );

		expect( secondResolve ).toHaveBeenCalledTimes( 1 );
		expect( secondResolve ).toHaveBeenCalledWith( 'failure' );
		expect( firstResolve ).not.toHaveBeenCalled();
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'confirming',
			tableIdentity: 'table-row',
			direction: 'row',
		} );

		cancelRfApply();
		expect( firstResolve ).toHaveBeenCalledTimes( 1 );
		expect( firstResolve ).toHaveBeenCalledWith( 'cancelled' );
	} );

	/**
	 * useSyncExternalStore向けsnapshotが状態不変時に同一参照を返すことを確認する。
	 *
	 * 事前条件:
	 * - Row候補が大規模反映としてconfirmingに入る。
	 *
	 * 操作:
	 * - 同じ状態でsnapshotを複数回取得し、その後Continueする。
	 *
	 * 期待結果:
	 * - 状態不変時は同一参照が返る。
	 * - Lifecycleが変化すると新しいsnapshot参照になる。
	 */
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
