/**
 * RF Interactionが現在Table基準の再評価結果をRF Apply Coordinationへ直接渡し、
 * Apply結果に応じてSession lifecycleを更新することを確認する。
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

const COLUMN_INPUT = {
	sourceColumnIndex: 0,
	targetColumnIndex: 2,
	position: 'right' as const,
};

const COLUMNS = [
	{ columnIndex: 0, columnNumber: 1, heading: 'A' },
	{ columnIndex: 1, columnNumber: 2, heading: 'B' },
	{ columnIndex: 2, columnNumber: 3, heading: 'C' },
];

const resetInteraction = () => {
	rfInteractionStore.setState( { session: { status: 'closed' } } );
};

const mockedReceiveRfApplyRequest = jest.mocked( receiveRfApplyRequest );

describe( 'RF Interaction apply boundary', () => {
	beforeEach( () => {
		resetInteraction();
		mockedReceiveRfApplyRequest.mockReset();
		jest.spyOn( rowTableIntegration, 'getConstraints' ).mockReturnValue( {
			rowCount: 3,
			blockedBoundaries: [],
		} );
		jest.spyOn( columnTableIntegration, 'getColumnInputDescriptors' ).mockReturnValue( COLUMNS );
		jest.spyOn( rowRfResolution, 'resolve' ).mockReturnValue( {
			status: 'resolved',
			candidate: {
				clientId: 'table-a',
				sourceRowIndex: 0,
				destinationBoundaryIndex: 3,
			},
		} );
		jest.spyOn( columnRfResolution, 'resolve' ).mockReturnValue( {
			status: 'resolved',
			candidate: {
				clientId: 'table-a',
				sourceColumnIndex: 0,
				destinationBoundaryIndex: 3,
			},
		} );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		resetInteraction();
	} );

	/**
	 * 概要:
	 * - Apply要求時点の現在TableでRow指定を再評価し、fresh candidateをRF Apply Coordinationへ渡すことを確認する。
	 *
	 * 操作:
	 * - 表示時とは異なるcandidateをResolutionが返す状態でApplyを要求する。
	 *
	 * 期待結果:
	 * - fresh candidateが直接渡され、Sessionはapplyingになる。
	 */
	it( 'when row apply is requested, should pass the freshly resolved candidate directly to apply coordination', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		jest.spyOn( rowRfResolution, 'resolve' ).mockReturnValue( {
			status: 'resolved',
			candidate: {
				clientId: 'table-a',
				sourceRowIndex: 1,
				destinationBoundaryIndex: 0,
			},
		} );

		rfInteraction.requestApply( 'table-a' );

		expect( mockedReceiveRfApplyRequest ).toHaveBeenCalledTimes( 1 );
		expect( mockedReceiveRfApplyRequest ).toHaveBeenCalledWith(
		{
			kind: 'row',
			candidate: {
				clientId: 'table-a',
				sourceRowIndex: 1,
				destinationBoundaryIndex: 0,
			},
		},
		expect.any( Function )
	);
		expect( rfInteractionStore.getState().session ).toMatchObject( {
		status: 'applying',
		tableIdentity: 'table-a',
		kind: 'row',
	} );
	} );

	/**
	 * 概要:
	 * - Column ReorderでもApply要求時点のfresh candidateを同じ境界へ渡すことを確認する。
	 *
	 * 操作:
	 * - Column入力を成立させてApplyを要求する。
	 *
	 * 期待結果:
	 * - Column candidateがRF Apply Coordinationへ一度だけ渡される。
	 */
	it( 'when column apply is requested, should pass the freshly resolved column candidate directly to apply coordination', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.selectKind( 'table-a', 'column' );
		rfInteraction.updateColumnInput( 'table-a', COLUMN_INPUT );

		rfInteraction.requestApply( 'table-a' );

		expect( mockedReceiveRfApplyRequest ).toHaveBeenCalledTimes( 1 );
		expect( mockedReceiveRfApplyRequest ).toHaveBeenCalledWith(
		{
			kind: 'column',
			candidate: {
				clientId: 'table-a',
				sourceColumnIndex: 0,
				destinationBoundaryIndex: 3,
			},
		},
		expect.any( Function )
	);
	} );

	/**
	 * 概要:
	 * - Apply直前の再評価で指定が成立しない場合はApply Coordinationへ進まないことを確認する。
	 *
	 * 操作:
	 * - Apply要求時のRow Resolutionをno-opへ変化させる。
	 *
	 * 期待結果:
	 * - Apply要求は渡されず、Sessionはopenのままfreshなno-op結果を保持する。
	 */
	it( 'when fresh apply evaluation is not resolved, should stay open without calling apply coordination', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		jest.spyOn( rowRfResolution, 'resolve' ).mockReturnValue( { status: 'no-op' } );

		rfInteraction.requestApply( 'table-a' );

		expect( mockedReceiveRfApplyRequest ).not.toHaveBeenCalled();
		expect( rfInteractionStore.getState().session ).toMatchObject( {
		status: 'open',
		tableIdentity: 'table-a',
		kind: 'row',
		evaluation: {
			kind: 'row',
			result: { status: 'no-op' },
		},
	} );
	} );

	/**
	 * 概要:
	 * - applying中は二重ApplyやSession変更要求を受け付けないことを確認する。
	 *
	 * 操作:
	 * - 一度Applyを開始した後、別Table openと二重Applyを要求する。
	 *
	 * 期待結果:
	 * - Apply Coordinationへの要求は一回だけで、元のapplying Sessionが維持される。
	 */
	it( 'when applying is active, should ignore duplicate apply and session-changing commands', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		rfInteraction.requestApply( 'table-a' );

		rfInteraction.open( 'table-b' );
		rfInteraction.requestApply( 'table-a' );

		expect( mockedReceiveRfApplyRequest ).toHaveBeenCalledTimes( 1 );
		expect( rfInteractionStore.getState().session ).toMatchObject( {
		status: 'applying',
		tableIdentity: 'table-a',
		kind: 'row',
		rowInput: ROW_INPUT,
	} );
	} );

	/**
	 * 概要:
	 * - RF Apply Coordinationから返る結果を既存Session lifecycleへ反映できることを確認する。
	 *
	 * 操作:
	 * - success、failure、cancelledをそれぞれ完了callbackから返す。
	 *
	 * 期待結果:
	 * - successではclosedになり、failure / cancelledでは入力を保持したopenへ戻る。
	 */
	it.each( [
		[ 'success', { status: 'closed' } ],
		[ 'failure', { status: 'open', rowInput: ROW_INPUT } ],
		[ 'cancelled', { status: 'open', rowInput: ROW_INPUT } ],
	] as const )(
		'when apply resolves as %s, should transition to the expected session state',
		( result, expectedSession ) => {
			let resolveApply: ( result: RfApplyResult ) => void = () => undefined;
			mockedReceiveRfApplyRequest.mockImplementation( ( _request, resolve ) => {
				resolveApply = resolve;
			} );
			rfInteraction.open( 'table-a' );
			rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
			rfInteraction.requestApply( 'table-a' );

			resolveApply( result );

			expect( rfInteractionStore.getState().session ).toMatchObject( expectedSession );
		}
	);
} );
