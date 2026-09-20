/**
 * RF Interactionが一つのRF Session lifecycle、現在Table基準の再評価、Apply境界を所有することを確認する。
 *
 * WordPress UIへ接続せず、既存Table Integration / Input Interpretation / Resolutionとの責務境界と、
 * Table Identity guard、Reorder Kind別入力保持、Apply結果復帰をRF Interactionの公開操作から検証する。
 */

import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import {
	cancelRfApply,
	completeRfApplyRestoration,
	getRfApplyCoordinationSnapshot,
} from './apply-coordination';
import { rfInteraction, rfInteractionStore } from './interaction';
import {
	createTestTableBlock,
	createTestTableRow,
	getTestTableBlock,
	installTestTableStore,
	resetRfInteractionTestState,
	setTestTableBlocks,
	updateTestTableAttributes,
} from './interaction.test-utils';

/* Jestで読み込めないBlock Editor Storeの環境境界だけをTest Doubleとし、YTRのProduction責務は実接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: Symbol( 'block-editor-store' ),
} ) );

jest.mock( '@wordpress/data', () => {
	const actualData = jest.requireActual( '@wordpress/data' );
	return Object.defineProperties( Object.create( actualData ), {
		dispatch: { enumerable: true, value: jest.fn() },
		select: { enumerable: true, value: jest.fn() },
	} );
} );

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
const createDefaultTable = ( clientId: string ) =>
	createTestTableBlock(
		clientId,
		[
			createTestTableRow( `${ clientId }-row-a` ),
			createTestTableRow( `${ clientId }-row-b` ),
			createTestTableRow( `${ clientId }-row-c` ),
		],
		[ { cells: [ { content: 'A' }, { content: 'B' }, { content: 'C' } ] } ]
	);

const createLargeTable = () =>
	createTestTableBlock(
		'table-a',
		Array.from( { length: 3 }, ( _value, rowIndex ) =>
			createTestTableRow( `row-${ rowIndex + 1 }`, 167 )
		)
	);

describe( 'RF Interaction', () => {
	beforeEach( () => {
		installTestTableStore();
		resetRfInteractionTestState();
		setTestTableBlocks( [ createDefaultTable( 'table-a' ), createDefaultTable( 'table-b' ) ] );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		resetRfInteractionTestState();
	} );

	/**
	 * 概要:
	 * - RF開始時はRow Reorderの初期Sessionになり、同一Tableの再openでは現在Sessionを維持することを確認する。
	 *
	 * 操作:
	 * - Table AでRFを開始し、Column Reorderへ切り替えた後にTable Aで再度openする。
	 *
	 * 期待結果:
	 * - 再open後もColumn Reorderが維持され、初期Row Reorderへ戻らない。
	 */
	it( 'when the same table is reopened, should preserve the current session', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.selectKind( 'table-a', 'column' );
		rfInteraction.open( 'table-a' );

		const session = rfInteractionStore.getState().session;
		expect( session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-a',
			kind: 'column',
		} );
	} );

	/**
	 * 概要:
	 * - 別TableでRFを開始した場合は新しいRow初期Sessionへ置き換わることを確認する。
	 *
	 * 事前条件:
	 * - Table AのRFでColumn Reorderが選択されている。
	 *
	 * 操作:
	 * - Table BでRFを開始する。
	 *
	 * 期待結果:
	 * - Table Bを対象とするRow Reorderの新しいSessionだけが残る。
	 */
	it( 'when another table is opened, should replace the session with a fresh row session', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.selectKind( 'table-a', 'column' );
		rfInteraction.open( 'table-b' );

		const session = rfInteractionStore.getState().session;
		expect( session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-b',
			kind: 'row',
			rowInput: {
				sourceRowNumber: '',
				targetRowNumber: '',
				position: null,
			},
		} );
	} );

	/**
	 * 概要:
	 * - Row / Column切替後も各Reorder Kindの入力値を独立して保持することを確認する。
	 *
	 * 操作:
	 * - Row入力を更新し、Columnへ切り替えてColumn入力を更新した後、Rowへ戻る。
	 *
	 * 期待結果:
	 * - Row入力とColumn入力の両方がSession内に保持される。
	 */
	it( 'when kinds are switched, should preserve inputs for both kinds', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		rfInteraction.selectKind( 'table-a', 'column' );
		rfInteraction.updateColumnInput( 'table-a', COLUMN_INPUT );
		rfInteraction.selectKind( 'table-a', 'row' );

		const session = rfInteractionStore.getState().session;
		expect( session ).toMatchObject( {
			status: 'open',
			kind: 'row',
			rowInput: ROW_INPUT,
			columnInput: COLUMN_INPUT,
		} );
	} );

	/**
	 * 概要:
	 * - 現在Sessionと一致しないTableやReorder Kindから遅れて届いた操作で現在Sessionを変更しないことを確認する。
	 *
	 * 事前条件:
	 * - Table AのSessionでRow入力を保持したままColumn Reorderが選択されている。
	 *
	 * 操作:
	 * - 別TableからcloseとColumn入力更新を要求し、切替前Row Reorderからも入力更新を要求する。
	 *
	 * 期待結果:
	 * - Table A / ColumnのSessionは維持され、保持済みRow入力と未更新Column入力が変化しない。
	 */
	it( 'when stale table or kind commands arrive, should preserve the current session', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		rfInteraction.selectKind( 'table-a', 'column' );

		rfInteraction.close( 'table-b' );
		rfInteraction.updateColumnInput( 'table-b', COLUMN_INPUT );
		rfInteraction.updateRowInput( 'table-a', {
			...ROW_INPUT,
			sourceRowNumber: '2',
		} );

		const session = rfInteractionStore.getState().session;
		expect( session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-a',
			kind: 'column',
			rowInput: ROW_INPUT,
			columnInput: {
				sourceColumnIndex: null,
				targetColumnIndex: null,
				position: null,
			},
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
	 * - Input Interpretationが確定したtargetの入力問題と現在有効な行番号範囲がそのまま保持される。
	 */
	it( 'when the active table changes, should re-evaluate the preserved input against the current table', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		updateTestTableAttributes( 'table-a', {
			body: [ createTestTableRow( 'current-row' ) ],
		} );

		rfInteraction.notifyTableChanged( 'table-a' );

		const session = rfInteractionStore.getState().session;
		expect( session ).toMatchObject( {
			status: 'open',
			rowInput: ROW_INPUT,
			evaluation: {
				kind: 'row',
				rowCount: 1,
				result: {
					status: 'not-ready',
					inputProblems: [
						{
							target: 'target',
							correction: { kind: 'row-number-range', min: 1, max: 1 },
						},
					],
				},
			},
		} );
	} );

	/**
	 * 概要:
	 * - Apply要求では表示時の結果を流用せず、要求時点の現在Tableで再評価したcandidateを渡すことを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow入力はresolvedとして表示されている。
	 *
	 * 操作:
	 * - Applyを要求する。
	 *
	 * 期待結果:
	 * - 要求時点の現在Tableから解決した移動がProduction Apply経路で反映され、Sessionはapplyingになる。
	 */
	it( 'when apply is requested, should send a freshly resolved candidate and enter applying', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );

		rfInteraction.requestApply( 'table-a' );

		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'restoring',
			tableIdentity: 'table-a',
			applied: true,
			moveSummary: { kind: 'row', sourcePosition: 1, destinationPosition: 3 },
		} );
		expect( getTestTableBlock( 'table-a' )?.attributes.body ).toMatchObject( [
			{
				cells: [
					{ content: 'table-a-row-b-1' },
					{ content: 'table-a-row-b-2' },
					{ content: 'table-a-row-b-3' },
				],
			},
			{
				cells: [
					{ content: 'table-a-row-c-1' },
					{ content: 'table-a-row-c-2' },
					{ content: 'table-a-row-c-3' },
				],
			},
			{
				cells: [
					{ content: 'table-a-row-a-1' },
					{ content: 'table-a-row-a-2' },
					{ content: 'table-a-row-a-3' },
				],
			},
		] );
		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'applying',
			tableIdentity: 'table-a',
			kind: 'row',
		} );
	} );

	/**
	 * 概要:
	 * - Column ReorderでもApply要求時点の現在評価からkind固有candidateを引き渡せることを確認する。
	 *
	 * 事前条件:
	 * - Table AのColumn入力はresolvedとして表示されている。
	 *
	 * 操作:
	 * - Column ReorderのApplyを要求する。
	 *
	 * 期待結果:
	 * - 要求時点の現在Tableから解決した列移動がProduction Apply経路で全sectionへ反映され、Column applying状態へ遷移する。
	 */
	it( 'when column apply is requested, should send the fresh column candidate and enter applying', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.selectKind( 'table-a', 'column' );
		rfInteraction.updateColumnInput( 'table-a', COLUMN_INPUT );

		rfInteraction.requestApply( 'table-a' );

		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'restoring',
			tableIdentity: 'table-a',
			applied: true,
			moveSummary: { kind: 'column', sourcePosition: 1, destinationPosition: 3 },
		} );
		expect( getTestTableBlock( 'table-a' )?.attributes ).toMatchObject( {
			head: [ { cells: [ { content: 'B' }, { content: 'C' }, { content: 'A' } ] } ],
			body: [
				{
					cells: [
						{ content: 'table-a-row-a-2' },
						{ content: 'table-a-row-a-3' },
						{ content: 'table-a-row-a-1' },
					],
				},
				{
					cells: [
						{ content: 'table-a-row-b-2' },
						{ content: 'table-a-row-b-3' },
						{ content: 'table-a-row-b-1' },
					],
				},
				{
					cells: [
						{ content: 'table-a-row-c-2' },
						{ content: 'table-a-row-c-3' },
						{ content: 'table-a-row-c-1' },
					],
				},
			],
		} );
		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'applying',
			tableIdentity: 'table-a',
			kind: 'column',
		} );
	} );

	/**
	 * 概要:
	 * - Apply直前の再評価で指定が成立しなくなった場合はApply Lifecycleを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow入力は一度resolvedとして表示されている。
	 *
	 * 操作:
	 * - Tableを1行へ変更し、変更通知を行わずApplyを要求する。
	 *
	 * 期待結果:
	 * - Apply Lifecycleは開始されず、Sessionはopenのまま最新not-ready結果を表示する。
	 */
	it( 'when fresh apply evaluation is not resolved, should stay open with the fresh result', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		updateTestTableAttributes( 'table-a', {
			body: [ createTestTableRow( 'current-row' ) ],
		} );

		rfInteraction.requestApply( 'table-a' );

		expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-a',
			kind: 'row',
			evaluation: {
				kind: 'row',
				result: { status: 'not-ready' },
			},
		} );
	} );

	/**
	 * 概要:
	 * - applying中は新しいRF操作やTable変更通知を受け付けないことを確認する。
	 *
	 * 事前条件:
	 * - Table AのApply要求がRF Apply Coordinationへ渡されている。
	 *
	 * 操作:
	 * - applying中に別Table open、close、Reorder Kind切替、入力更新、Table変更通知、二重Applyを要求する。
	 *
	 * 期待結果:
	 * - 現在のTable A / Row applying Sessionが変化せず、Apply要求も一回だけである。
	 */
	it( 'when applying is active, should ignore session-changing commands and duplicate apply requests', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		rfInteraction.requestApply( 'table-a' );
		const applySnapshot = getRfApplyCoordinationSnapshot();

		rfInteraction.open( 'table-b' );
		rfInteraction.close( 'table-a' );
		rfInteraction.selectKind( 'table-a', 'column' );
		rfInteraction.updateRowInput( 'table-a', {
			...ROW_INPUT,
			sourceRowNumber: '2',
		} );
		rfInteraction.notifyTableChanged( 'table-a' );
		rfInteraction.requestApply( 'table-a' );

		expect( getRfApplyCoordinationSnapshot() ).toBe( applySnapshot );
		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'applying',
			tableIdentity: 'table-a',
			kind: 'row',
			rowInput: ROW_INPUT,
		} );
	} );

	/**
	 * Production Applyの表示復帰完了後にsuccessを受け取り、Sessionを終了することを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow入力から通常反映を開始できる。
	 *
	 * 操作:
	 * - Applyを要求し、表示復帰を完了する。
	 *
	 * 期待結果:
	 * - RF Sessionがclosedになる。
	 */
	it( 'when apply succeeds, should close the session', () => {
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		rfInteraction.requestApply( 'table-a' );

		completeRfApplyRestoration();

		expect( rfInteractionStore.getState().session ).toEqual( { status: 'closed' } );
	} );

	/**
	 * 更新直前にだけ生じる反映失敗をProduction Apply Coordinationから受け取り、入力保持状態へ復帰することを確認する。
	 *
	 * 更新評価と属性更新は同期しており公開境界から決定的に失敗を差し込めないため、確定更新結果だけをTest Doubleで失敗にする。
	 *
	 * 事前条件:
	 * - Table AのRow指定は反映前評価まで成立する。
	 *
	 * 操作:
	 * - 確定更新が失敗する状態でApplyを要求する。
	 *
	 * 期待結果:
	 * - RF SessionがRow入力を保持したopenへ戻る。
	 */
	it( 'when apply fails, should reopen the session with its row input', () => {
		jest.spyOn( rowTableIntegration, 'applyRowMove' ).mockReturnValueOnce( false );
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );

		rfInteraction.requestApply( 'table-a' );

		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			rowInput: ROW_INPUT,
		} );
	} );

	/**
	 * 大規模反映のProduction確認Lifecycleを取り消した場合に入力保持状態へ復帰することを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow指定は大規模反映の確認対象になる。
	 *
	 * 操作:
	 * - Applyを要求し、確認待ちの反映を取り消す。
	 *
	 * 期待結果:
	 * - RF SessionがRow入力を保持したopenへ戻る。
	 */
	it( 'when apply is cancelled, should reopen the session with its row input', () => {
		setTestTableBlocks( [ createLargeTable() ] );
		rfInteraction.open( 'table-a' );
		rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		rfInteraction.requestApply( 'table-a' );

		cancelRfApply();

		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			rowInput: ROW_INPUT,
		} );
	} );
} );
