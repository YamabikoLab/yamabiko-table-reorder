/**
 * 行専用DnD Interactionの主要なSession Lifecycleと分岐を、Production責務を接続した公開境界から確認する。
 */

import { reorderMode } from '@/reorder/reorder-mode';
import {
	cancelLargeRowReorderApply,
	getLargeRowReorderApplyState,
} from '@/reorder/row-reorder/responsibilities/reorder-apply';
import {
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	rowDndInteraction,
	subscribeRowDndTerminationNotice,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';
import {
	createRowReorderTestRow,
	createRowReorderTestTable,
	getRowReorderTestTable,
	setRowReorderTestTables,
} from '@/reorder/row-reorder/responsibilities/table-integration.test-utils';
import { resolveRowReorderTarget } from '@/reorder/row-reorder/responsibilities/target-resolution';

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとRow Reorder責務は実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( '@/reorder/row-reorder/responsibilities/table-integration.test-utils' )
		.rowReorderTestBlockEditorStore,
} ) );

const target = {
	tableIdentity: 'table-a',
	sourceRowIndex: 1,
};

/** 識別可能な5行を持つ通常の現在Tableを登録する。 */
const setDefaultTable = (): void => {
	setRowReorderTestTables( [
		createRowReorderTestTable(
			'table-a',
			Array.from( { length: 5 }, ( _value, rowIndex ) =>
				createRowReorderTestRow( `row-${ rowIndex + 1 }` )
			)
		),
	] );
};

/** Production Target Resolutionで解決した対象からactive Sessionを開始する。 */
const startActiveSession = (): void => {
	const resolution = resolveRowReorderTarget( target );
	if ( resolution.status !== 'resolved' ) {
		throw new Error( 'Row DnD lifecycle test target must be resolved.' );
	}
	rowDndInteraction.start( resolution.target, resolution.initialConstraints );
};

/** 現在Tableの行識別値を表示順で取得する。 */
const getCurrentRowLabels = (): unknown[] => {
	const table = getRowReorderTestTable( 'table-a' );
	const body = table?.attributes.body as Array< { cells: Array< { content?: unknown } > } >;
	return body.map( ( row ) => row.cells[ 0 ]?.content );
};

/** 前テストが残した確認待ちの大規模反映をProduction操作で終了する。 */
const cancelPendingLargeApply = (): void => {
	if ( getLargeRowReorderApplyState().phase === 'confirming' ) {
		cancelLargeRowReorderApply();
	}
};

describe( 'Row DnD Interaction lifecycle', () => {
	let terminationNoticeListener: jest.Mock;
	let unsubscribeTerminationNotice: () => void;

	beforeEach( () => {
		rowDndInteraction.cancel();
		cancelPendingLargeApply();
		reorderMode.observeTable( '__row-dnd-lifecycle-test-reset__' );
		setDefaultTable();
		reorderMode.select( 'row', 'table-a' );
		terminationNoticeListener = jest.fn();
		unsubscribeTerminationNotice = subscribeRowDndTerminationNotice( terminationNoticeListener );
	} );

	afterEach( () => {
		unsubscribeTerminationNotice();
		rowDndInteraction.cancel();
		cancelPendingLargeApply();
		reorderMode.observeTable( '__row-dnd-lifecycle-test-reset__' );
		setRowReorderTestTables( [] );
		jest.restoreAllMocks();
	} );

	/**
	 * 解決済みTargetから、Tableを再解決せずactive Sessionを開始できることを確認する。
	 *
	 * 事前条件:
	 * - DnD Interactionはidleで、Target Resolution済みの結果がある。
	 * - 解決後に現在Tableは利用不能になっている。
	 *
	 * 操作:
	 * - 解決済みTargetと開始時制約でSessionを開始する。
	 *
	 * 期待結果:
	 * - 開始時の解決結果だけでactiveへ遷移する。
	 */
	it( 'when start receives a resolved target, should begin an active session without resolving the table again', () => {
		const resolution = resolveRowReorderTarget( target );
		if ( resolution.status !== 'resolved' ) {
			throw new Error( 'Row DnD lifecycle test target must be resolved.' );
		}
		setRowReorderTestTables( [] );

		rowDndInteraction.start( resolution.target, resolution.initialConstraints );

		expect( getRowDndPhase() ).toBe( 'active' );
	} );

	/**
	 * active Session中に別Sessionを開始できないことを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが存在する。
	 *
	 * 操作:
	 * - start()を再度実行する。
	 *
	 * 期待結果:
	 * - Lifecycle違反としてErrorになる。
	 */
	it( 'when start is called during an active session, should reject the lifecycle violation', () => {
		startActiveSession();
		const resolution = resolveRowReorderTarget( target );
		if ( resolution.status !== 'resolved' ) {
			throw new Error( 'Row DnD lifecycle test target must be resolved.' );
		}

		expect( () =>
			rowDndInteraction.start( resolution.target, resolution.initialConstraints )
		).toThrow( 'Row DnD start requires an idle session.' );
	} );

	/**
	 * DnD中の移動先をSession開始時の行制約で判定することを確認する。
	 *
	 * 事前条件:
	 * - Session開始後に現在Tableの境界4が分断不可へ変化している。
	 *
	 * 操作:
	 * - 境界4、続いて境界3へ移動先を更新する。
	 *
	 * 期待結果:
	 * - 開始時制約に基づき、最後の境界3が保持される。
	 */
	it( 'when destinations change during an active session, should validate them against the initial constraints', () => {
		startActiveSession();
		setRowReorderTestTables( [
			createRowReorderTestTable( 'table-a', [
				createRowReorderTestRow( 'row-1' ),
				createRowReorderTestRow( 'row-2' ),
				createRowReorderTestRow( 'row-3' ),
				{ cells: [ { content: 'merged', rowspan: 2 }, {}, {} ] },
				{ cells: [ {}, {} ] },
			] ),
		] );

		rowDndInteraction.updateDestination( 4 );
		expect( getRowDndDestinationBoundaryIndex() ).toBe( 4 );
		rowDndInteraction.updateDestination( 3 );

		expect( getRowDndDestinationBoundaryIndex() ).toBe( 3 );
	} );

	/**
	 * 小規模な行移動は確認を挟まずProduction Tableへ直接反映することを確認する。
	 *
	 * 事前条件:
	 * - complete時の移動が有効で、更新対象セル数は閾値以下である。
	 *
	 * 操作:
	 * - 境界4を移動先としてcomplete()する。
	 *
	 * 期待結果:
	 * - 行移動が一度反映され、DnDとReorder Modeは継続可能な状態になる。
	 */
	it( 'when complete revalidation succeeds for a small move, should apply the row move and finish normally', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( getCurrentRowLabels() ).toEqual( [
			'row-1-1',
			'row-3-1',
			'row-4-1',
			'row-2-1',
			'row-5-1',
		] );
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'row' );
		expect( getLargeRowReorderApplyState().phase ).toBe( 'idle' );
	} );

	/**
	 * 大規模な行移動はDnD Session終了後にProduction確認付き反映へ引き渡すことを確認する。
	 *
	 * 事前条件:
	 * - 更新対象セル数が共通閾値を超えるTableと移動が存在する。
	 *
	 * 操作:
	 * - 有効な移動先でcomplete()する。
	 *
	 * 期待結果:
	 * - Tableを直接変更せずDnD Sessionをidleへ戻す。
	 * - 同期処理後に移動意図が確認待ちとして保持される。
	 */
	it( 'when affected cell count exceeds the threshold, should end the DnD session before requesting confirmation', async () => {
		setRowReorderTestTables( [
			createRowReorderTestTable(
				'table-a',
				Array.from( { length: 1_001 }, ( _value, rowIndex ) =>
					createRowReorderTestRow( `row-${ rowIndex + 1 }`, 2 )
				)
			),
		] );
		const resolution = resolveRowReorderTarget( {
			tableIdentity: 'table-a',
			sourceRowIndex: 0,
		} );
		if ( resolution.status !== 'resolved' ) {
			throw new Error( 'Large Row DnD test target must be resolved.' );
		}
		rowDndInteraction.start( resolution.target, resolution.initialConstraints );
		rowDndInteraction.updateDestination( 1_001 );

		rowDndInteraction.complete();

		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( getLargeRowReorderApplyState().phase ).toBe( 'idle' );
		expect( getCurrentRowLabels()[ 0 ] ).toBe( 'row-1-1' );

		await Promise.resolve();

		expect( getLargeRowReorderApplyState() ).toMatchObject( {
			phase: 'confirming',
			move: {
				tableIdentity: 'table-a',
				sourceRowIndex: 0,
				destinationBoundaryIndex: 1_001,
			},
			applied: false,
		} );
	} );

	/**
	 * 更新対象セル数を安全に算出できない場合はTableを変更しないことを確認する。
	 *
	 * Production公開境界では再照合とセル数算出の間へ同期的な状態変化を注入できないため、
	 * この失敗結果だけをTable Integration境界で一度だけ代替する。
	 *
	 * 期待結果:
	 * - Tableを変更せず、異常終了通知を発行する。
	 */
	it( 'when affected cell count cannot be resolved, should terminate without changing the table', () => {
		jest.spyOn( rowTableIntegration, 'getAffectedCellCount' ).mockReturnValueOnce( null );
		const before = getCurrentRowLabels();
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( getCurrentRowLabels() ).toEqual( before );
		expect( getLargeRowReorderApplyState().phase ).toBe( 'idle' );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 有効な最終移動先がないdropを正常終了として扱うことを確認する。
	 *
	 * 操作:
	 * - 移動先を保持せずcomplete()する。
	 *
	 * 期待結果:
	 * - Tableを更新せず異常終了通知も発生しない。
	 */
	it( 'when complete has no valid destination, should finish without applying a row move or notice', () => {
		const before = getCurrentRowLabels();
		startActiveSession();

		rowDndInteraction.complete();

		expect( getCurrentRowLabels() ).toEqual( before );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * complete直前に移動元が結合範囲へ含まれた場合は安全終了することを確認する。
	 *
	 * 期待結果:
	 * - Tableを更新せず異常終了通知を一度発行する。
	 */
	it( 'when the source becomes invalid before complete, should terminate without applying the row move', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );
		setRowReorderTestTables( [
			createRowReorderTestTable( 'table-a', [
				{ cells: [ { content: 'merged', rowspan: 2 }, {}, {} ] },
				{ cells: [ {}, {} ] },
				createRowReorderTestRow( 'row-3' ),
				createRowReorderTestRow( 'row-4' ),
				createRowReorderTestRow( 'row-5' ),
			] ),
		] );
		const before = getCurrentRowLabels();

		rowDndInteraction.complete();

		expect( getCurrentRowLabels() ).toEqual( before );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * complete直前に移動先が分断不可境界になった場合は安全終了することを確認する。
	 *
	 * 期待結果:
	 * - Tableを更新せず異常終了通知を一度発行する。
	 */
	it( 'when the destination becomes invalid before complete, should terminate without applying the row move', () => {
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );
		setRowReorderTestTables( [
			createRowReorderTestTable( 'table-a', [
				createRowReorderTestRow( 'row-1' ),
				createRowReorderTestRow( 'row-2' ),
				createRowReorderTestRow( 'row-3' ),
				{ cells: [ { content: 'merged', rowspan: 2 }, {}, {} ] },
				{ cells: [ {}, {} ] },
			] ),
		] );
		const before = getCurrentRowLabels();

		rowDndInteraction.complete();

		expect( getCurrentRowLabels() ).toEqual( before );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * 再照合後の属性更新が失敗した場合も安全終了することを確認する。
	 *
	 * Production公開境界では再照合と同期的な属性更新の間だけを決定的に失敗させられないため、
	 * 最終更新結果だけをTable Integration境界で一度だけ代替する。
	 *
	 * 期待結果:
	 * - idleへ戻り、異常終了通知を一度発行する。
	 */
	it( 'when the confirmed row move cannot be applied, should finish with a termination notice', () => {
		jest.spyOn( rowTableIntegration, 'applyRowMove' ).mockReturnValueOnce( false );
		const before = getCurrentRowLabels();
		startActiveSession();
		rowDndInteraction.updateDestination( 4 );

		rowDndInteraction.complete();

		expect( getCurrentRowLabels() ).toEqual( before );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getRowDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * cancelではTableを更新せずSessionを終了することを確認する。
	 *
	 * 事前条件:
	 * - active Sessionが存在する。
	 *
	 * 操作:
	 * - cancel()する。
	 *
	 * 期待結果:
	 * - Table更新なしでidleへ戻り、行Reorder Modeを継続する。
	 */
	it( 'when an active session is canceled, should finish without applying a row move', () => {
		const before = getCurrentRowLabels();
		startActiveSession();

		rowDndInteraction.cancel();

		expect( getCurrentRowLabels() ).toEqual( before );
		expect( getRowDndPhase() ).toBe( 'idle' );
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'row' );
	} );
} );
