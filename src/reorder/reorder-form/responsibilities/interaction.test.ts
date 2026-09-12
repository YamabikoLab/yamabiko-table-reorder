/**
 * RF Interactionが一つのRF Session lifecycle、現在Table基準の再評価、Apply境界を所有することを確認する。
 *
 * WordPress UIへ接続せず、既存Table Integration / Input Interpretation / Resolutionとの責務境界と、
 * Table Identity guard、方向別入力保持、Apply結果復帰をRF Interactionの公開操作から検証する。
 */

import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import { columnRfResolution } from './column-resolution';
import {
	connectRfApplyCoordination,
	rfInteraction,
	rfInteractionStore,
	type RfApplyRequest,
	type RfApplyResult,
} from './interaction';
import { rowRfResolution } from './row-resolution';

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

describe( 'RF Interaction', () => {
	beforeEach( () => {
		resetInteraction();
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
	 * - RF開始時はRow方向の初期Sessionになり、同一Tableの再openでは現在Sessionを維持することを確認する。
	 *
	 * 操作:
	 * - Table AでRFを開始し、Columnへ切り替えた後にTable Aで再度openする。
	 *
	 * 期待結果:
	 * - 再open後もColumn方向が維持され、初期Row方向へ戻らない。
	 */
	it( 'when the same table is reopened, should preserve the current session', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.selectDirection( 'table-a', 'column' );
		rfInteraction.open( 'table-a' );

		const session = rfInteractionStore.getState().session;
		expect( session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-a',
			direction: 'column',
		} );
	} );

	/**
	 * 概要:
	 * - 別TableでRFを開始した場合は新しいRow初期Sessionへ置き換わることを確認する。
	 *
	 * 事前条件:
	 * - Table AのRFでColumn方向が選択されている。
	 *
	 * 操作:
	 * - Table BでRFを開始する。
	 *
	 * 期待結果:
	 * - Table Bを対象とするRow方向の新しいSessionだけが残る。
	 */
	it( 'when another table is opened, should replace the session with a fresh row session', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.selectDirection( 'table-a', 'column' );
		rfInteraction.open( 'table-b' );

		const session = rfInteractionStore.getState().session;
		expect( session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-b',
			direction: 'row',
			rowInput: {
				sourceRowNumber: '',
				targetRowNumber: '',
				position: null,
			},
		} );
	} );

	/**
	 * 概要:
	 * - Row / Column切替後も各方向の入力値を独立して保持することを確認する。
	 *
	 * 操作:
	 * - Row入力を更新し、Columnへ切り替えてColumn入力を更新した後、Rowへ戻る。
	 *
	 * 期待結果:
	 * - Row入力とColumn入力の両方がSession内に保持される。
	 */
	it( 'when directions are switched, should preserve inputs for both directions', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		rfInteraction.selectDirection( 'table-a', 'column' );
		rfInteraction.updateColumnInput( 'table-a', COLUMN_INPUT );
		rfInteraction.selectDirection( 'table-a', 'row' );

		const session = rfInteractionStore.getState().session;
		expect( session ).toMatchObject( {
			status: 'open',
			direction: 'row',
			rowInput: ROW_INPUT,
			columnInput: COLUMN_INPUT,
		} );
	} );

	/**
	 * 概要:
	 * - 外部Table変更通知で保持入力を維持したまま現在Table基準の結果を更新することを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow入力は現在3行Tableに対して成立している。
	 *
	 * 操作:
	 * - 現在行数を1行へ変更した状態としてTable変更を通知する。
	 *
	 * 期待結果:
	 * - Row入力値は保持され、現在結果はnot-readyへ更新される。
	 */
	it( 'when the active table changes, should re-evaluate the preserved input against the current table', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		jest.spyOn( rowTableIntegration, 'getConstraints' ).mockReturnValue( {
			rowCount: 1,
			blockedBoundaries: [],
		} );

		rfInteraction.notifyTableChanged( 'table-a' );

		const session = rfInteractionStore.getState().session;
		expect( session ).toMatchObject( {
			status: 'open',
			rowInput: ROW_INPUT,
			evaluation: {
				direction: 'row',
				rowCount: 1,
				result: { status: 'not-ready' },
			},
		} );
	} );

	/**
	 * 概要:
	 * - Apply要求では表示時の結果を流用せず、要求時点の現在Tableで再評価したcandidateを渡すことを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow入力はresolvedとして表示されている。
	 * - RF Apply Coordinationの受信境界が接続されている。
	 *
	 * 操作:
	 * - Resolutionが返すcandidateを変更してからApplyを要求する。
	 *
	 * 期待結果:
	 * - 変更後のfresh candidateがApply要求として渡され、Sessionはapplyingになる。
	 */
	it( 'when apply is requested, should send a freshly resolved candidate and enter applying', () => {
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
		let received: RfApplyRequest | null = null;
		const disconnect = connectRfApplyCoordination( ( request ) => {
			received = request;
		} );

		rfInteraction.requestApply( 'table-a' );

		expect( received ).toEqual( {
			direction: 'row',
			candidate: {
				clientId: 'table-a',
				sourceRowIndex: 1,
				destinationBoundaryIndex: 0,
			},
		} );
		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'applying',
			tableIdentity: 'table-a',
			direction: 'row',
		} );
		disconnect();
	} );

	/**
	 * 概要:
	 * - applying中は新しいRF操作やTable変更通知を受け付けないことを確認する。
	 *
	 * 事前条件:
	 * - Table AのApply要求がRF Apply Coordinationへ渡されている。
	 *
	 * 操作:
	 * - applying中に別Table open、close、方向切替、入力更新、Table変更通知、二重Applyを要求する。
	 *
	 * 期待結果:
	 * - 現在のTable A / Row applying Sessionが変化せず、Apply要求も一回だけである。
	 */
	it( 'when applying is active, should ignore session-changing commands and duplicate apply requests', () => {
		let requestCount = 0;
		const disconnect = connectRfApplyCoordination( () => {
			requestCount++;
		} );
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		rfInteraction.requestApply( 'table-a' );

		rfInteraction.open( 'table-b' );
		rfInteraction.close( 'table-a' );
		rfInteraction.selectDirection( 'table-a', 'column' );
		rfInteraction.updateRowInput( 'table-a', {
			...ROW_INPUT,
			sourceRowNumber: '2',
		} );
		rfInteraction.notifyTableChanged( 'table-a' );
		rfInteraction.requestApply( 'table-a' );

		expect( requestCount ).toBe( 1 );
		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'applying',
			tableIdentity: 'table-a',
			direction: 'row',
			rowInput: ROW_INPUT,
		} );
		disconnect();
	} );

	/**
	 * 概要:
	 * - Apply結果に応じてSessionを終了または入力保持状態へ復帰できることを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow入力からApply Lifecycleが開始できる。
	 *
	 * 操作:
	 * - success、failure、cancelledをそれぞれRF Interactionへ返す。
	 *
	 * 期待結果:
	 * - successではclosedになり、failure / cancelledではRow入力を保持したopenへ戻る。
	 */
	it.each( [
		[ 'success', 'closed' ],
		[ 'failure', 'open' ],
		[ 'cancelled', 'open' ],
	] as const )(
		'when apply resolves as %s, should transition the session to %s',
		( result, expectedStatus ) => {
			let resolveApply: ( result: RfApplyResult ) => void = () => undefined;
			const disconnect = connectRfApplyCoordination( ( _request, resolve ) => {
				resolveApply = resolve;
			} );
			rfInteraction.open( 'table-a' );
			rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
			rfInteraction.requestApply( 'table-a' );

			resolveApply( result );

			const session = rfInteractionStore.getState().session;
			expect( session.status ).toBe( expectedStatus );
			if ( expectedStatus === 'open' ) {
				expect( session ).toMatchObject( { rowInput: ROW_INPUT } );
			}
			disconnect();
		}
	);
} );
