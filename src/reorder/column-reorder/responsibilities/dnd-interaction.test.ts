/**
 * 列専用DnD Interactionの主要なSession Lifecycleと分岐を、Production責務を接続した公開境界から確認する。
 */

import {
	cancelLargeColumnReorderApply,
	getLargeColumnReorderApplyState,
} from '@/reorder/column-reorder/responsibilities/reorder-apply';
import { reorderMode } from '@/reorder/reorder-mode';
import {
	columnDndInteraction,
	getColumnDndDestinationBoundaryIndex,
	getColumnDndPhase,
	subscribeColumnDndTerminationNotice,
} from './dnd-interaction';
import { columnTableIntegration } from './table-integration';
import {
	createColumnReorderTestRow,
	createColumnReorderTestTable,
	getColumnReorderTestTable,
	setColumnReorderTestTables,
} from './table-integration.test-utils';
import { resolveColumnReorderTarget } from './target-resolution';

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとColumn Reorder責務は実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './table-integration.test-utils' ).columnReorderTestBlockEditorStore,
} ) );

const target = { tableIdentity: 'table-a', sourceColumnIndex: 1 };

/** 識別可能な5列を持つ通常の現在Tableを登録する。 */
const setDefaultTable = (): void => {
	setColumnReorderTestTables( [
		createColumnReorderTestTable( 'table-a', [
			createColumnReorderTestRow( 'row-1' ),
			createColumnReorderTestRow( 'row-2' ),
			createColumnReorderTestRow( 'row-3' ),
			createColumnReorderTestRow( 'row-4' ),
		] ),
	] );
};

/** Production Target Resolutionで解決した対象からactive Sessionを開始する。 */
const startActiveSession = (): void => {
	const resolution = resolveColumnReorderTarget( target );
	if ( resolution.status !== 'resolved' ) {
		throw new Error( 'Column DnD lifecycle test target must be resolved.' );
	}
	columnDndInteraction.start( resolution.target, resolution.initialConstraints );
};

/** 現在Tableの先頭行にあるセル識別値を表示順で取得する。 */
const getCurrentColumnLabels = (): unknown[] => {
	const table = getColumnReorderTestTable( 'table-a' );
	const body = table?.attributes.body as
		| Array< { cells: Array< { content?: unknown } > } >
		| undefined;
	return body?.[ 0 ]?.cells.map( ( cell ) => cell.content ) ?? [];
};

/** 前テストが残した確認待ちの大規模反映をProduction操作で終了する。 */
const cancelPendingLargeApply = (): void => {
	if ( getLargeColumnReorderApplyState().phase === 'confirming' ) {
		cancelLargeColumnReorderApply();
	}
};

describe( 'Column DnD Interaction lifecycle', () => {
	let terminationNoticeListener: jest.Mock;
	let unsubscribeTerminationNotice: () => void;

	beforeEach( () => {
		columnDndInteraction.cancel();
		cancelPendingLargeApply();
		reorderMode.observeTable( '__column-dnd-lifecycle-test-reset__' );
		setDefaultTable();
		reorderMode.select( 'column', 'table-a' );
		terminationNoticeListener = jest.fn();
		unsubscribeTerminationNotice = subscribeColumnDndTerminationNotice( terminationNoticeListener );
	} );

	afterEach( () => {
		unsubscribeTerminationNotice();
		columnDndInteraction.cancel();
		cancelPendingLargeApply();
		reorderMode.observeTable( '__column-dnd-lifecycle-test-reset__' );
		setColumnReorderTestTables( [] );
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
	 * - Session開始では現在Table制約を取得し直さない。
	 */
	it( 'when start receives a resolved target, should begin an active session without resolving the table again', () => {
		const resolution = resolveColumnReorderTarget( target );
		if ( resolution.status !== 'resolved' ) {
			throw new Error( 'Column DnD lifecycle test target must be resolved.' );
		}
		const getConstraints = jest.spyOn( columnTableIntegration, 'getConstraints' );
		setColumnReorderTestTables( [] );

		columnDndInteraction.start( resolution.target, resolution.initialConstraints );

		expect( getColumnDndPhase() ).toBe( 'active' );
		expect( getConstraints ).not.toHaveBeenCalled();
	} );

	/** active Session中の再開始をLifecycle違反として拒否することを確認する。 */
	it( 'when start is called during an active session, should reject the lifecycle violation', () => {
		startActiveSession();
		const resolution = resolveColumnReorderTarget( target );
		if ( resolution.status !== 'resolved' ) {
			throw new Error( 'Column DnD lifecycle test target must be resolved.' );
		}

		expect( () =>
			columnDndInteraction.start( resolution.target, resolution.initialConstraints )
		).toThrow( 'Column DnD start requires an idle session.' );
	} );

	/**
	 * Session開始後のTable変更に影響されず、開始時制約で移動先を判定することを確認する。
	 *
	 * 期待結果:
	 * - 開始時に有効だった境界4と境界3を順に保持できる。
	 * - 移動先更新中は現在Table制約を取得し直さない。
	 */
	it( 'when destinations change during an active session, should validate them against the initial constraints', () => {
		startActiveSession();
		const getConstraints = jest.spyOn( columnTableIntegration, 'getConstraints' );
		setColumnReorderTestTables( [
			createColumnReorderTestTable( 'table-a', [ { cells: [ {}, {}, {}, { colspan: 2 } ] } ] ),
		] );

		columnDndInteraction.updateDestination( 4 );
		expect( getColumnDndDestinationBoundaryIndex() ).toBe( 4 );
		columnDndInteraction.updateDestination( 3 );

		expect( getColumnDndDestinationBoundaryIndex() ).toBe( 3 );
		expect( getConstraints ).not.toHaveBeenCalled();
	} );

	/** 列順を変えない位置、範囲外、分断不可境界を移動先として保持しないことを確認する。 */
	it( 'when a destination does not produce a valid column move, should keep the destination unavailable', () => {
		setColumnReorderTestTables( [
			createColumnReorderTestTable( 'table-a', [ { cells: [ {}, {}, {}, { colspan: 2 } ] } ] ),
		] );
		startActiveSession();

		for ( const destination of [ 1, 2, -1, 6, 4 ] ) {
			columnDndInteraction.updateDestination( destination );
			expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();
		}
	} );

	/** 一度成立した移動先の後に候補なしになった場合は以前の移動先を破棄することを確認する。 */
	it( 'when a valid destination is followed by no destination, should clear the previous destination', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 3 );
		columnDndInteraction.updateDestination( null );

		expect( getColumnDndDestinationBoundaryIndex() ).toBeNull();
	} );

	/**
	 * 小規模な列移動をProduction Tableへ直接反映することを確認する。
	 *
	 * 期待結果:
	 * - 2列目が4列目へ移動し、DnDとReorder Modeは継続可能な状態になる。
	 */
	it( 'when complete revalidation succeeds for a small move, should apply the column move and finish normally', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );

		columnDndInteraction.complete();

		expect( getCurrentColumnLabels() ).toEqual( [
			'row-1-1',
			'row-1-3',
			'row-1-4',
			'row-1-2',
			'row-1-5',
		] );
		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'column' );
		expect( getLargeColumnReorderApplyState().phase ).toBe( 'idle' );
	} );

	/**
	 * 大規模な列移動をDnD Session終了後にProduction確認付き反映へ引き渡すことを確認する。
	 *
	 * 期待結果:
	 * - Tableを直接変更せず、同期処理後に移動意図が確認待ちとして保持される。
	 */
	it( 'when affected cell count exceeds the threshold, should end the DnD session before requesting confirmation', async () => {
		setColumnReorderTestTables( [
			createColumnReorderTestTable(
				'table-a',
				Array.from( { length: 501 }, ( _value, rowIndex ) =>
					createColumnReorderTestRow( `row-${ rowIndex + 1 }` )
				)
			),
		] );
		startActiveSession();
		columnDndInteraction.updateDestination( 5 );

		columnDndInteraction.complete();

		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( getLargeColumnReorderApplyState().phase ).toBe( 'idle' );
		expect( getCurrentColumnLabels()[ 0 ] ).toBe( 'row-1-1' );
		await Promise.resolve();
		expect( getLargeColumnReorderApplyState() ).toMatchObject( {
			phase: 'confirming',
			move: { tableIdentity: 'table-a', sourceColumnIndex: 1, destinationBoundaryIndex: 5 },
			applied: false,
		} );
	} );

	/**
	 * 更新対象セル数を安全に算出できない場合はTableを変更しないことを確認する。
	 *
	 * Production公開境界では再照合とセル数算出の間へ同期的な状態変化を注入できないため、
	 * この失敗結果だけをTable Integration境界で一度だけ代替する。
	 */
	it( 'when affected cell count cannot be resolved, should terminate without changing the table', () => {
		jest.spyOn( columnTableIntegration, 'getAffectedCellCount' ).mockReturnValueOnce( null );
		const before = getCurrentColumnLabels();
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );

		columnDndInteraction.complete();

		expect( getCurrentColumnLabels() ).toEqual( before );
		expect( getLargeColumnReorderApplyState().phase ).toBe( 'idle' );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 列移動後にTableを利用できなくなった場合はReorder Modeを終了することを確認する。
	 *
	 * Production公開境界では列更新と終了後再照合の間だけ状態を変えられないため、
	 * 2回目の現在制約取得だけをTable Integration境界で利用不能へ置き換える。
	 */
	it( 'when the table becomes unavailable after a successful complete, should resolve reorder mode from the post-session table state', () => {
		const getConstraints = columnTableIntegration.getConstraints.bind( columnTableIntegration );
		jest
			.spyOn( columnTableIntegration, 'getConstraints' )
			.mockImplementationOnce( getConstraints )
			.mockImplementationOnce( getConstraints )
			.mockReturnValueOnce( null );
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );

		columnDndInteraction.complete();

		expect( getCurrentColumnLabels() ).toEqual( [
			'row-1-1',
			'row-1-3',
			'row-1-4',
			'row-1-2',
			'row-1-5',
		] );
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
	} );

	/** 有効な最終移動先がないdropをTable更新も通知もない通常終了として扱うことを確認する。 */
	it( 'when complete has no valid destination, should finish without applying a column move or notice', () => {
		const before = getCurrentColumnLabels();
		startActiveSession();

		columnDndInteraction.complete();

		expect( getCurrentColumnLabels() ).toEqual( before );
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	/** complete直前に移動元が横結合範囲へ含まれた場合は安全終了することを確認する。 */
	it( 'when current constraints reject the source, should terminate without applying the column move', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		setColumnReorderTestTables( [
			createColumnReorderTestTable( 'table-a', [
				{ cells: [ { content: 'merged', colspan: 2 }, {}, {}, {} ] },
			] ),
		] );
		const before = getCurrentColumnLabels();

		columnDndInteraction.complete();

		expect( getCurrentColumnLabels() ).toEqual( before );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/** complete直前に移動先が分断不可境界になった場合は安全終了することを確認する。 */
	it( 'when the destination becomes invalid before complete, should terminate without applying the column move', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		setColumnReorderTestTables( [
			createColumnReorderTestTable( 'table-a', [
				{ cells: [ {}, {}, {}, { content: 'merged', colspan: 2 } ] },
			] ),
		] );
		const before = getCurrentColumnLabels();

		columnDndInteraction.complete();

		expect( getCurrentColumnLabels() ).toEqual( before );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/** complete時に対象Tableを利用できない場合は部分更新せず安全終了することを確認する。 */
	it( 'when the table becomes unavailable before complete, should terminate without applying the column move', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		setColumnReorderTestTables( [] );

		columnDndInteraction.complete();

		expect( getCurrentColumnLabels() ).toEqual( [] );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 再照合後の属性更新が失敗した場合も安全終了することを確認する。
	 *
	 * Production公開境界では再照合と同期的な属性更新の間だけを決定的に失敗させられないため、
	 * 最終更新結果だけをTable Integration境界で一度だけ代替する。
	 */
	it( 'when the confirmed column move cannot be applied, should finish with a termination notice', () => {
		jest.spyOn( columnTableIntegration, 'applyColumnMove' ).mockReturnValueOnce( false );
		const before = getCurrentColumnLabels();
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );

		columnDndInteraction.complete();

		expect( getCurrentColumnLabels() ).toEqual( before );
		expect( terminationNoticeListener ).toHaveBeenCalledTimes( 1 );
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	/**
	 * Table Integrationの内部Errorを通常の安全終了へ変換しないことを確認する。
	 *
	 * 公開境界から内部Errorを決定的に発生させられないため、現在制約取得の失敗だけを一度注入する。
	 */
	it( 'when table integration throws during complete, should propagate the internal error without a termination notice', () => {
		startActiveSession();
		columnDndInteraction.updateDestination( 4 );
		jest.spyOn( columnTableIntegration, 'getConstraints' ).mockImplementationOnce( () => {
			throw new Error( 'Column Table Integration invariant violation.' );
		} );

		expect( () => columnDndInteraction.complete() ).toThrow(
			'Column Table Integration invariant violation.'
		);
		expect( terminationNoticeListener ).not.toHaveBeenCalled();
		expect( getColumnDndPhase() ).toBe( 'idle' );
	} );

	/** cancelではTableを更新せずSessionを終了し、列Reorder Modeを継続することを確認する。 */
	it( 'when an active session is canceled, should finish without applying a column move', () => {
		const before = getCurrentColumnLabels();
		startActiveSession();

		columnDndInteraction.cancel();

		expect( getCurrentColumnLabels() ).toEqual( before );
		expect( getColumnDndPhase() ).toBe( 'idle' );
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'column' );
	} );

	/** idle状態のcomplete要求を内部Lifecycle違反として扱うことを確認する。 */
	it( 'when complete is called while idle, should propagate the lifecycle error', () => {
		expect( () => columnDndInteraction.complete() ).toThrow(
			'Column DnD complete requires an active session.'
		);
	} );
} );
