/**
 * RF InteractionがApply結果をReact描画履歴から独立した未消費Outcomeとして保持・消費することを確認する。
 */

import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import { receiveRfApplyRequest } from './apply-coordination';
import { columnRfResolution } from './column-resolution';
import { rfInteraction, rfInteractionStore, type RfApplyResult } from './interaction';
import { rowRfResolution } from './row-resolution';

jest.mock( './apply-coordination', () => ( {
	receiveRfApplyRequest: jest.fn(),
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/table-integration', () => ( {
	columnTableIntegration: {
		getColumnInputDescriptors: jest.fn(),
	},
} ) );

const ROW_INPUT = {
	sourceRowNumber: '1',
	targetRowNumber: '3',
	position: 'below' as const,
};

const resetInteraction = () => {
	rfInteractionStore.setState( {
		session: { status: 'closed' },
		applyOutcome: { status: 'idle' },
	} );
};

const mockedReceiveRfApplyRequest = jest.mocked( receiveRfApplyRequest );

const arrangeResolvedRowApply = ( result: RfApplyResult ) => {
	jest.spyOn( rowTableIntegration, 'getConstraints' ).mockReturnValue( {
		rowCount: 3,
		blockedBoundaries: [],
	} );
	jest.spyOn( columnTableIntegration, 'getColumnInputDescriptors' ).mockReturnValue( [] );
	jest.spyOn( rowRfResolution, 'resolve' ).mockReturnValue( {
		status: 'resolved',
		candidate: {
			clientId: 'table-a',
			sourceRowIndex: 0,
			destinationBoundaryIndex: 3,
		},
	} );
	jest.spyOn( columnRfResolution, 'resolve' ).mockReturnValue( { status: 'not-ready' } );
	mockedReceiveRfApplyRequest.mockImplementation( ( _request, resolve ) => {
		resolve( result );
	} );
};

describe( 'RF Interaction apply outcome', () => {
	beforeEach( () => {
		resetInteraction();
		mockedReceiveRfApplyRequest.mockReset();
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		resetInteraction();
	} );

	/**
	 * 概要:
	 * - 通常RF反映が同期的に完了しても成功結果を未消費Outcomeとして保持できることを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow指定はApply可能である。
	 *
	 * 操作:
	 * - RF Apply CoordinationがApply要求中に同期的にsuccessを返す。
	 *
	 * 期待結果:
	 * - Sessionはclosedになる。
	 * - Table Aのsuccess OutcomeがReact描画とは独立して保持される。
	 */
	it( 'when apply succeeds synchronously, should retain a successful outcome after closing the session', () => {
		arrangeResolvedRowApply( 'success' );
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );

		rfInteraction.requestApply( 'table-a' );

		expect( rfInteractionStore.getState().session ).toEqual( { status: 'closed' } );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( {
			status: 'success',
			tableIdentity: 'table-a',
		} );
	} );

	/**
	 * 概要:
	 * - RF反映失敗を成功と区別したOutcomeとして保持することを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow指定はApply可能である。
	 *
	 * 操作:
	 * - RF Apply Coordinationがfailureを返す。
	 *
	 * 期待結果:
	 * - 入力を保持したopen Sessionへ戻る。
	 * - Table Aのfailure Outcomeが保持される。
	 */
	it( 'when apply fails, should retain a failure outcome while reopening the session', () => {
		arrangeResolvedRowApply( 'failure' );
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );

		rfInteraction.requestApply( 'table-a' );

		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-a',
			rowInput: ROW_INPUT,
		} );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( {
			status: 'failure',
			tableIdentity: 'table-a',
		} );
	} );

	/**
	 * 概要:
	 * - 利用者による確認取消を完了通知対象として残さないことを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow指定はApply可能である。
	 *
	 * 操作:
	 * - RF Apply Coordinationがcancelledを返す。
	 *
	 * 期待結果:
	 * - 入力を保持したopen Sessionへ戻る。
	 * - Apply Outcomeはidleのままである。
	 */
	it( 'when apply is cancelled, should reopen the session without a completion outcome', () => {
		arrangeResolvedRowApply( 'cancelled' );
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );

		rfInteraction.requestApply( 'table-a' );

		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-a',
			rowInput: ROW_INPUT,
		} );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );
	} );

	/**
	 * 概要:
	 * - 新しいRF Session開始時に前回の未消費結果を引き継がないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aの成功Outcomeが残っている。
	 *
	 * 操作:
	 * - Table Bで新しいRF Sessionを開始する。
	 *
	 * 期待結果:
	 * - 新SessionはTable Bを対象として開始する。
	 * - 前回の成功Outcomeはidleへ戻る。
	 */
	it( 'when a new RF session starts, should clear an older completion outcome', () => {
		jest.spyOn( rowTableIntegration, 'getConstraints' ).mockReturnValue( {
			rowCount: 3,
			blockedBoundaries: [],
		} );
		rfInteractionStore.setState( {
			applyOutcome: { status: 'success', tableIdentity: 'table-a' },
		} );

		rfInteraction.open( 'table-b' );

		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-b',
		} );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );
	} );

	/**
	 * 概要:
	 * - 完了結果は対象Tableからだけ消費できることを確認する。
	 *
	 * 事前条件:
	 * - Table Aの成功Outcomeが未消費である。
	 *
	 * 操作:
	 * - Table Bから消費を要求した後、Table Aから消費を要求する。
	 *
	 * 期待結果:
	 * - Table Bからの要求では成功Outcomeを保持する。
	 * - Table Aからの要求でidleへ戻る。
	 */
	it( 'when completion is consumed, should clear it only for the owning table', () => {
		rfInteractionStore.setState( {
			applyOutcome: { status: 'success', tableIdentity: 'table-a' },
		} );

		rfInteraction.consumeApplyOutcome( 'table-b' );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( {
			status: 'success',
			tableIdentity: 'table-a',
		} );

		rfInteraction.consumeApplyOutcome( 'table-a' );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );
	} );
} );
