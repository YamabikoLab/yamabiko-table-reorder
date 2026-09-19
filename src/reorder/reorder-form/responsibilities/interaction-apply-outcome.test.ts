/**
 * RF Interactionが反映結果をReact描画履歴から独立した未提示Outcomeとして保持・提示済み化することを確認する。
 */

import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import { receiveRfApplyRequest } from './apply-coordination';
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

const ROW_MOVE_SUMMARY = {
	kind: 'row' as const,
	sourcePosition: 1,
	destinationPosition: 3,
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
	jest.spyOn( rowRfResolution, 'resolve' ).mockReturnValue( {
		status: 'resolved',
		candidate: {
			clientId: 'table-a',
			sourceRowIndex: 0,
			destinationBoundaryIndex: 3,
		},
	} );
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
	 * 通常RF反映が同期的に完了しても確定Move summaryを含む成功結果を未提示Outcomeとして保持できることを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow指定はApply可能である。
	 *
	 * 操作:
	 * - RF Apply CoordinationがApply要求中にsuccessと確定Move summaryを返す。
	 *
	 * 期待結果:
	 * - Sessionはclosedになる。
	 * - Table Aのsuccess Outcomeが同じMove summaryを保持する。
	 */
	it( 'when apply succeeds synchronously, should retain the confirmed move summary in the outcome', () => {
		arrangeResolvedRowApply( { status: 'success', moveSummary: ROW_MOVE_SUMMARY } );
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );

		rfInteraction.requestApply( 'table-a' );

		expect( rfInteractionStore.getState().session ).toEqual( { status: 'closed' } );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( {
			status: 'success',
			tableIdentity: 'table-a',
			moveSummary: ROW_MOVE_SUMMARY,
		} );
	} );

	/** RF反映失敗はMove summaryを持たないOutcomeとして保持することを確認する。 */
	it( 'when apply fails, should retain a failure outcome while reopening the session', () => {
		arrangeResolvedRowApply( { status: 'failure' } );
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

	/** 利用者による確認取消を結果通知対象として残さないことを確認する。 */
	it( 'when apply is cancelled, should reopen the session without an apply outcome', () => {
		arrangeResolvedRowApply( { status: 'cancelled' } );
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

	/** 新しい反映開始時は前回の未提示失敗結果を今回の反映へ持ち越さないことを確認する。 */
	it( 'when retry starts after a failure, should clear the previous failure outcome', () => {
		arrangeResolvedRowApply( { status: 'failure' } );
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		rfInteraction.requestApply( 'table-a' );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( {
			status: 'failure',
			tableIdentity: 'table-a',
		} );

		mockedReceiveRfApplyRequest.mockImplementation( () => undefined );
		rfInteraction.requestApply( 'table-a' );

		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'applying',
			tableIdentity: 'table-a',
		} );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );
	} );

	/** 新しいRF Session開始時に前回の未提示結果を引き継がないことを確認する。 */
	it( 'when a new RF session starts, should clear an older apply outcome', () => {
		jest.spyOn( rowTableIntegration, 'getConstraints' ).mockReturnValue( {
			rowCount: 3,
			blockedBoundaries: [],
		} );
		rfInteractionStore.setState( {
			applyOutcome: {
				status: 'success',
				tableIdentity: 'table-a',
				moveSummary: ROW_MOVE_SUMMARY,
			},
		} );

		rfInteraction.open( 'table-b' );

		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-b',
		} );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );
	} );

	/** 未提示の反映結果は対象TableのWordPress接続からだけ提示済みにできることを確認する。 */
	it( 'when apply outcome is marked presented, should clear it only for the owning table', () => {
		rfInteractionStore.setState( {
			applyOutcome: {
				status: 'success',
				tableIdentity: 'table-a',
				moveSummary: ROW_MOVE_SUMMARY,
			},
		} );

		rfInteraction.consumeApplyOutcome( 'table-b' );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( {
			status: 'success',
			tableIdentity: 'table-a',
			moveSummary: ROW_MOVE_SUMMARY,
		} );

		rfInteraction.consumeApplyOutcome( 'table-a' );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );
	} );
} );
