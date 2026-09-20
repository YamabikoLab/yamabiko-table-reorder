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
import {
	createTestTableBlock,
	createTestTableRow,
	getTestTableBlock,
	resetRfInteractionTestState,
	setTestTableBlocks,
	updateTestTableAttributes,
} from './interaction.test-utils';
import type { TestTableRow } from './interaction.test-utils';

/* Jestで読み込めないBlock Editor Storeの環境境界だけを代替し、WordPress Dataは実Storeへ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './block-editor-store.test-utils' ).testBlockEditorStore,
} ) );

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

/**
 * Row Applyテストで利用する4行Tableを作成する。
 *
 * @param cellCount 各行に含める物理セル数。
 * @param rowPrefix 各行の現在Identityを識別する表示値の接頭辞。
 * @return Row Table Integrationへ登録できるCore Table Block。
 */
const createRowTable = ( cellCount: number, rowPrefix: string ) =>
	createTestTableBlock(
		'table-row',
		Array.from( { length: 4 }, ( _value, rowIndex ) =>
			createTestTableRow( `${ rowPrefix }-${ rowIndex + 1 }`, cellCount )
		)
	);

/**
 * Column Applyテストで利用する4列Tableを作成する。
 *
 * @param rowCount Tableに含める行数。
 * @return Column Table Integrationへ登録できるCore Table Block。
 */
const createColumnTable = ( rowCount: number ) =>
	createTestTableBlock(
		'table-column',
		Array.from( { length: rowCount }, ( _value, rowIndex ) =>
			createTestTableRow( `column-row-${ rowIndex + 1 }`, 4 )
		)
	);

/**
 * Test Block Editor Storeにある現在Tableのbodyを取得する。
 *
 * @param clientId 対象Table個体を識別するclientId。
 * @return 現在Tableのtbody行集合。
 */
const getTableBody = ( clientId: string ): TestTableRow[] =>
	getTestTableBlock( clientId )?.attributes.body as TestTableRow[];

describe( 'RF Apply Coordination', () => {
	beforeEach( () => {
		resetRfInteractionTestState();
		setTestTableBlocks( [ createRowTable( 1, 'initial-row' ), createColumnTable( 1 ) ] );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		resetRfInteractionTestState();
	} );

	/**
	 * 概要:
	 * - 小規模Row反映成功では現在Tableから確定したMove summaryを表示復帰とsuccess結果で共有することを確認する。
	 *
	 * 事前条件:
	 * - 4行Tableの2行目を末尾へ移動する候補が成立している。
	 *
	 * 操作:
	 * - RF Apply要求を受け付け、表示復帰を完了する。
	 *
	 * 期待結果:
	 * - Production Table Integrationが現在Tableの行順を更新する。
	 * - 同じ確定Move summaryが表示復帰状態と成功結果に引き渡される。
	 */
	it( 'when a direct row apply succeeds, should keep one confirmed move summary through restoration and completion', () => {
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );

		expect( getTableBody( 'table-row' ).map( ( row ) => row.cells[ 0 ].content ) ).toEqual( [
			'initial-row-1-1',
			'initial-row-3-1',
			'initial-row-4-1',
			'initial-row-2-1',
		] );
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

	/**
	 * 概要:
	 * - 小規模Column反映失敗ではMove summaryを結果へ残さず即時failureにすることを確認する。
	 *
	 * 事前条件:
	 * - 4列Tableの3列目を先頭へ移動する候補が現在Tableで成立している。
	 * - 確定更新は失敗する。
	 *
	 * 操作:
	 * - RF Apply要求を受け付ける。
	 *
	 * 期待結果:
	 * - Tableは変更されず、Move summaryなしの`failure`が返る。
	 * - Apply Coordinationは`idle`へ戻る。
	 */
	it( 'when a direct column apply fails, should resolve failure without a move summary', () => {
		const originalBody = getTableBody( 'table-column' );
		// 更新評価と属性更新は同期しているため、公開境界から作れない確定更新失敗だけを注入する。
		jest.spyOn( columnTableIntegration, 'applyColumnMove' ).mockReturnValueOnce( false );
		const resolve = jest.fn();

		receiveRfApplyRequest( columnRequest, resolve );

		expect( resolve ).toHaveBeenCalledWith( { status: 'failure' } );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
		expect( getTableBody( 'table-column' ) ).toBe( originalBody );
	} );

	/**
	 * 概要:
	 * - 現在Table再照合が不成立ならTableを変更せずfailureにすることを確認する。
	 *
	 * 事前条件:
	 * - Row候補が参照するTableは現在Storeに存在しない。
	 *
	 * 操作:
	 * - RF Apply要求を受け付ける。
	 *
	 * 期待結果:
	 * - 既存Tableを変更せず、Move summaryなしの`failure`が返る。
	 */
	it( 'when current-table assessment rejects a request, should resolve failure without applying', () => {
		setTestTableBlocks( [ createColumnTable( 1 ) ] );
		const originalBody = getTableBody( 'table-column' );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );

		expect( resolve ).toHaveBeenCalledWith( { status: 'failure' } );
		expect( getTableBody( 'table-column' ) ).toBe( originalBody );
	} );

	/**
	 * 概要:
	 * - 大規模反映では確認用summaryをconfirming終了時に破棄し、Continue後の現在Tableを成功結果の正本にすることを確認する。
	 *
	 * 事前条件:
	 * - 更新対象が501セルになる4行Tableで、2行目を末尾へ移動する候補が成立している。
	 *
	 * 操作:
	 * - Apply要求を確認待ちへ進め、Continue後に同じ構造の現在Tableへ置き換えて反映する。
	 *
	 * 期待結果:
	 * - 確認用summaryは反映中に破棄される。
	 * - 置換後の現在Tableが移動され、再評価で確定したMove summaryが成功結果になる。
	 */
	it( 'when a large row request completes after the table changes, should apply the current table with the post-continue summary', () => {
		setTestTableBlocks( [ createRowTable( 167, 'confirmation-row' ) ] );
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

		setTestTableBlocks( [ createRowTable( 167, 'current-row' ) ] );
		applyRfReorder();
		expect( getTableBody( 'table-row' ).map( ( row ) => row.cells[ 0 ].content ) ).toEqual( [
			'current-row-1-1',
			'current-row-3-1',
			'current-row-4-1',
			'current-row-2-1',
		] );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'restoring',
			tableIdentity: 'table-row',
			applied: true,
			moveSummary: {
				kind: 'row',
				sourcePosition: 2,
				destinationPosition: 4,
			},
		} );

		completeRfApplyRestoration();
		expect( results ).toEqual( [
			{
				status: 'success',
				moveSummary: {
					kind: 'row',
					sourcePosition: 2,
					destinationPosition: 4,
				},
			},
		] );
	} );

	/**
	 * 概要:
	 * - 大規模反映のCancelではcleanup後にcancelledを返し、確認summaryを残さないことを確認する。
	 *
	 * 事前条件:
	 * - 更新対象が501セルになるColumn候補が確認待ちになっている。
	 *
	 * 操作:
	 * - 確認待ちの反映を取り消す。
	 *
	 * 期待結果:
	 * - Tableは変更されず、内部状態の破棄後に`cancelled`が返る。
	 * - 確認用summaryは残らない。
	 */
	it( 'when a confirming request is cancelled, should clean up before resolving cancelled', () => {
		setTestTableBlocks( [ createColumnTable( 167 ) ] );
		const originalBody = getTableBody( 'table-column' );
		const resolve = jest.fn( ( result: RfApplyResult ) => {
			expect( result ).toEqual( { status: 'cancelled' } );
			expect( getRfApplyCoordinationSnapshot() ).toEqual( { phase: 'idle' } );
			expect( getRfApplySummary() ).toBeNull();
		} );

		receiveRfApplyRequest( columnRequest, resolve );
		expect( getRfApplySummary() ).toEqual( columnMoveSummary );
		cancelRfApply();

		expect( getTableBody( 'table-column' ) ).toBe( originalBody );
		expect( resolve ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - Continue後に候補が不成立になった場合はMove summaryなしのfailure restoringを経由することを確認する。
	 *
	 * 事前条件:
	 * - 更新対象が501セルになるRow候補が確認待ちになっている。
	 *
	 * 操作:
	 * - Continue後に現在Tableを3行へ変更し、範囲外になった候補の反映を要求する。
	 *
	 * 期待結果:
	 * - 変更後のTableへ移動は反映されない。
	 * - Move summaryなしの失敗表示復帰を経て`failure`が返る。
	 */
	it( 'when a large request becomes stale after continue, should restore without a move summary and resolve failure', () => {
		setTestTableBlocks( [ createRowTable( 167, 'large-row' ) ] );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );
		continueRfApply();
		const changedBody = [
			createTestTableRow( 'changed-row-1' ),
			createTestTableRow( 'changed-row-2' ),
			createTestTableRow( 'changed-row-3' ),
		];
		updateTestTableAttributes( 'table-row', { body: changedBody } );
		applyRfReorder();

		expect( getTableBody( 'table-row' ) ).toEqual( changedBody );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'restoring',
			tableIdentity: 'table-row',
			kind: 'row',
			applied: false,
		} );

		completeRfApplyRestoration();
		expect( resolve ).toHaveBeenCalledWith( { status: 'failure' } );
	} );

	/**
	 * 概要:
	 * - 再assessment成立後の確定更新失敗でも確定Move summaryをfailure結果へ残さないことを確認する。
	 *
	 * 事前条件:
	 * - 更新対象が501セルになるRow候補が反映中になっている。
	 * - 現在Tableで再評価は成立するが確定更新は失敗する。
	 *
	 * 操作:
	 * - Row反映と表示復帰完了を要求する。
	 *
	 * 期待結果:
	 * - Tableは変更されない。
	 * - Move summaryなしの失敗表示復帰を経て`failure`が返る。
	 */
	it( 'when a large final update fails, should restore failure without retaining a move summary', () => {
		setTestTableBlocks( [ createRowTable( 167, 'large-row' ) ] );
		const originalBody = getTableBody( 'table-row' );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );
		continueRfApply();
		// 更新評価と属性更新は同期しているため、公開境界から作れない確定更新失敗だけを注入する。
		jest.spyOn( rowTableIntegration, 'applyRowMove' ).mockReturnValueOnce( false );
		applyRfReorder();

		expect( getTableBody( 'table-row' ) ).toBe( originalBody );
		expect( getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'restoring',
			tableIdentity: 'table-row',
			kind: 'row',
			applied: false,
		} );
		completeRfApplyRestoration();
		expect( resolve ).toHaveBeenCalledWith( { status: 'failure' } );
	} );

	/**
	 * 概要:
	 * - 進行中Lifecycleと競合する別要求は既存Lifecycleを置換せずfailureで解放することを確認する。
	 *
	 * 事前条件:
	 * - 大規模Row反映が確認待ちになっている。
	 *
	 * 操作:
	 * - 別TableのColumn反映を要求する。
	 *
	 * 期待結果:
	 * - 先行するRow反映は確認待ちのまま保持される。
	 * - 競合するColumn要求だけが`failure`で完了する。
	 */
	it( 'when another request arrives during an RF lifecycle, should fail the competing request without replacing the pending one', () => {
		setTestTableBlocks( [ createRowTable( 167, 'large-row' ), createColumnTable( 1 ) ] );
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

	/**
	 * 概要:
	 * - cleanupが外部callbackより先に完了し、購読解除後は状態変更通知が止まることを確認する。
	 *
	 * 事前条件:
	 * - 大規模Row反映の状態変更を購読している。
	 *
	 * 操作:
	 * - 確認待ちから反映中へ進めた後に購読を解除し、反映と表示復帰を完了する。
	 *
	 * 期待結果:
	 * - 購読解除後の状態変更は通知されない。
	 * - cleanup後に確定Move summaryを持つ`success`が返る。
	 */
	it( 'when completion resolves, should clean up first and respect lifecycle unsubscription', () => {
		setTestTableBlocks( [ createRowTable( 167, 'large-row' ) ] );
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

	/**
	 * 概要:
	 * - useSyncExternalStore向けsnapshotが状態不変時に同一参照を返すことを確認する。
	 *
	 * 事前条件:
	 * - 大規模Row反映が確認待ちになっている。
	 *
	 * 操作:
	 * - 状態変更前後の公開snapshotを取得する。
	 *
	 * 期待結果:
	 * - 状態不変時は同一参照が返る。
	 * - Continueによる状態変更後は異なる参照が返る。
	 */
	it( 'when the lifecycle state is unchanged, should return the same public snapshot reference', () => {
		setTestTableBlocks( [ createRowTable( 167, 'large-row' ) ] );
		const resolve = jest.fn();

		receiveRfApplyRequest( rowRequest, resolve );
		const confirming = getRfApplyCoordinationSnapshot();
		expect( getRfApplyCoordinationSnapshot() ).toBe( confirming );

		continueRfApply();
		expect( getRfApplyCoordinationSnapshot() ).not.toBe( confirming );

		updateTestTableAttributes( 'table-row', {
			body: [ createTestTableRow( 'changed-row-1' ) ],
		} );
		applyRfReorder();
		completeRfApplyRestoration();
	} );
} );
