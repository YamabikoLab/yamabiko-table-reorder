/**
 * RF Interactionが反映結果をReact描画履歴から独立した未提示Outcomeとして保持・提示済み化することを確認する。
 */

import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import { cancelRfApply, completeRfApplyRestoration } from './apply-coordination';
import { rfInteraction, rfInteractionStore } from './interaction';
import {
	createTestTableBlock,
	createTestTableRow,
	installTestTableStore,
	resetRfInteractionTestState,
	setTestTableBlocks,
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

const ROW_MOVE_SUMMARY = {
	kind: 'row' as const,
	sourcePosition: 1,
	destinationPosition: 3,
};

const createDefaultTable = ( clientId: string ) =>
	createTestTableBlock( clientId, [
		createTestTableRow( `${ clientId }-row-a` ),
		createTestTableRow( `${ clientId }-row-b` ),
		createTestTableRow( `${ clientId }-row-c` ),
	] );

const createLargeTable = () =>
	createTestTableBlock(
		'table-a',
		Array.from( { length: 3 }, ( _value, rowIndex ) =>
			createTestTableRow( `row-${ rowIndex + 1 }`, 167 )
		)
	);

const requestRowApply = () => {
	rfInteraction.open( 'table-a' );
	rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
	rfInteraction.requestApply( 'table-a' );
};

describe( 'RF Interaction apply outcome', () => {
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
	 * 通常RF反映の表示復帰完了後に確定Move summaryを含む成功結果を未提示Outcomeとして保持できることを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow指定はApply可能である。
	 *
	 * 操作:
	 * - Production Apply経路でRowを反映し、表示復帰を完了する。
	 *
	 * 期待結果:
	 * - Sessionはclosedになる。
	 * - Table Aのsuccess Outcomeが同じMove summaryを保持する。
	 */
	it( 'when apply succeeds, should retain the confirmed move summary in the outcome', () => {
		requestRowApply();

		completeRfApplyRestoration();

		expect( rfInteractionStore.getState().session ).toEqual( { status: 'closed' } );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( {
			status: 'success',
			tableIdentity: 'table-a',
			moveSummary: ROW_MOVE_SUMMARY,
		} );
	} );

	/**
	 * RF反映失敗はMove summaryを持たないOutcomeとして保持することを確認する。
	 *
	 * 事前条件:
	 * - Row指定は反映前評価まで成立するが、確定更新が失敗する。
	 * - 更新評価と属性更新の間に公開境界から決定的な失敗を作れないため、確定更新結果だけをTest Doubleで失敗にする。
	 *
	 * 操作:
	 * - Applyを要求する。
	 *
	 * 期待結果:
	 * - Sessionは入力を保持したopenへ戻る。
	 * - Table Aのfailure OutcomeがMove summaryなしで保持される。
	 */
	it( 'when apply fails, should retain a failure outcome while reopening the session', () => {
		jest.spyOn( rowTableIntegration, 'applyRowMove' ).mockReturnValueOnce( false );

		requestRowApply();

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
	 * 利用者による確認取消を結果通知対象として残さないことを確認する。
	 *
	 * 事前条件:
	 * - Row指定は大規模反映の確認対象になる。
	 *
	 * 操作:
	 * - Applyを要求し、確認待ちの反映を取り消す。
	 *
	 * 期待結果:
	 * - Sessionは入力を保持したopenへ戻る。
	 * - Apply Outcomeはidleのままになる。
	 */
	it( 'when apply is cancelled, should reopen the session without an apply outcome', () => {
		setTestTableBlocks( [ createLargeTable() ] );
		requestRowApply();

		cancelRfApply();

		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'open',
			tableIdentity: 'table-a',
			rowInput: ROW_INPUT,
		} );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );
	} );

	/**
	 * 新しい反映開始時は前回の未提示失敗結果を今回の反映へ持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - 最初の確定更新失敗によりTable Aのfailure Outcomeが保持されている。
	 * - 同期的な更新失敗は公開境界から再現できないため、最初の確定更新結果だけをTest Doubleで失敗にする。
	 *
	 * 操作:
	 * - 同じ入力で再度Applyを要求する。
	 *
	 * 期待結果:
	 * - Sessionは新しい反映のapplyingになる。
	 * - 前回のfailure Outcomeがidleへ戻る。
	 */
	it( 'when retry starts after a failure, should clear the previous failure outcome', () => {
		const applyRowMove = jest
			.spyOn( rowTableIntegration, 'applyRowMove' )
			.mockReturnValueOnce( false );
		requestRowApply();
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( {
			status: 'failure',
			tableIdentity: 'table-a',
		} );

		applyRowMove.mockRestore();
		rfInteraction.requestApply( 'table-a' );

		expect( rfInteractionStore.getState().session ).toMatchObject( {
			status: 'applying',
			tableIdentity: 'table-a',
		} );
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );
	} );

	/**
	 * 新しいRF Session開始時に前回の未提示結果を引き継がないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aの未提示success Outcomeが保持されている。
	 *
	 * 操作:
	 * - Table BのRF Sessionを開始する。
	 *
	 * 期待結果:
	 * - Table BのSessionがopenになる。
	 * - 古いApply Outcomeはidleへ戻る。
	 */
	it( 'when a new RF session starts, should clear an older apply outcome', () => {
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

	/**
	 * 未提示の反映結果は対象TableのWordPress接続からだけ提示済みにできることを確認する。
	 *
	 * 事前条件:
	 * - Table Aの未提示success Outcomeが保持されている。
	 *
	 * 操作:
	 * - Table B、Table Aの順に提示済み化を要求する。
	 *
	 * 期待結果:
	 * - Table Bからの要求ではOutcomeが維持される。
	 * - 所有者であるTable Aからの要求でOutcomeがidleへ戻る。
	 */
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
