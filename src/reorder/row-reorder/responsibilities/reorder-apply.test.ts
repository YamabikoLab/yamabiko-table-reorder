/**
 * 行の確認付き大規模反映Lifecycleが、利用者の選択と反映直前のTable状態に従って安全に進むことを確認する。
 */

import {
	applyLargeRowReorder,
	cancelLargeRowReorderApply,
	completeLargeRowReorderApply,
	confirmLargeRowReorderApply,
	getLargeRowReorderApplyState,
	getLargeRowReorderDestinationRowIndex,
	requestLargeRowReorderApply,
} from './reorder-apply';
import {
	createRowReorderTestRow,
	createRowReorderTestTable,
	getRowReorderTestTable,
	setRowReorderTestTables,
} from './table-integration.test-utils';

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとTable Integrationは実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './table-integration.test-utils' ).rowReorderTestBlockEditorStore,
} ) );

const move = {
	tableIdentity: 'table-a',
	sourceRowIndex: 3,
	destinationBoundaryIndex: 1,
};

/** 識別可能な5行を持つ現在Tableを登録する。 */
const setDefaultTable = (): void => {
	setRowReorderTestTables( [
		createRowReorderTestTable(
			'table-a',
			[ 'A', 'B', 'C', 'D', 'E' ].map( ( label ) => createRowReorderTestRow( label, 1 ) )
		),
	] );
};

/** 現在Tableの行識別値を表示順で取得する。 */
const getCurrentRowLabels = (): unknown[] => {
	const table = getRowReorderTestTable( 'table-a' );
	const body = table?.attributes.body as Array< { cells: Array< { content?: unknown } > } >;
	return body.map( ( row ) => row.cells[ 0 ]?.content );
};

/** 公開Lifecycle操作だけを使って各テスト開始時に通常状態へ戻す。 */
const restoreIdleState = (): void => {
	const state = getLargeRowReorderApplyState();
	if ( state.phase === 'confirming' ) {
		cancelLargeRowReorderApply();
		return;
	}
	if ( state.phase === 'applying' ) {
		applyLargeRowReorder();
		completeLargeRowReorderApply();
		return;
	}
	if ( state.phase === 'remounting' ) {
		completeLargeRowReorderApply();
	}
};

describe( 'Large Row Reorder apply lifecycle', () => {
	beforeEach( () => {
		restoreIdleState();
		setDefaultTable();
	} );

	afterEach( () => {
		restoreIdleState();
		setRowReorderTestTables( [] );
	} );

	/**
	 * 確認付き大規模行反映の正常経路で、確認後に現在Tableを再照合してから反映することを確認する。
	 *
	 * 事前条件:
	 * - 確認対象の行移動は現在のTableでも有効である。
	 *
	 * 操作:
	 * - 大規模反映を要求し、利用者が続行した後に反映し、再mount完了を通知する。
	 *
	 * 期待結果:
	 * - 現在Tableの行順が1回の属性更新でA、D、B、C、Eになる。
	 * - 再mount中は反映済みとして扱われ、完了後は通常状態へ戻る。
	 */
	it( 'when a confirmed row move is still valid, should apply it once and complete the lifecycle', () => {
		expect( requestLargeRowReorderApply( move ) ).toBe( true );
		confirmLargeRowReorderApply();
		applyLargeRowReorder();

		expect( getCurrentRowLabels() ).toEqual( [ 'A-1', 'D-1', 'B-1', 'C-1', 'E-1' ] );
		expect( getLargeRowReorderApplyState() ).toMatchObject( {
			phase: 'remounting',
			move,
			applied: true,
		} );

		completeLargeRowReorderApply();
		expect( getLargeRowReorderApplyState() ).toMatchObject( {
			phase: 'idle',
			move: null,
			applied: false,
		} );
	} );

	/**
	 * 行Apply LifecycleがPresentationへ反映後最終位置を提供するとき、Table Integrationの方向固有解釈を正本として利用することを確認する。
	 *
	 * 事前条件:
	 * - 大規模行反映が確認待ちである。
	 * - 保持中Moveでは4行目を2行目の位置へ移動する。
	 *
	 * 操作:
	 * - 反映後最終行位置を取得する。
	 *
	 * 期待結果:
	 * - Table Integrationの方向固有解釈による0-based最終行位置1が返る。
	 */
	it( 'when a row apply holds a move, should provide its final row position from Table Integration', () => {
		requestLargeRowReorderApply( move );

		expect( getLargeRowReorderDestinationRowIndex() ).toBe( 1 );
	} );

	/**
	 * 利用者が確認を取り消した場合はTableを変更しないことを確認する。
	 *
	 * 事前条件:
	 * - 大規模行反映が確認待ちである。
	 *
	 * 操作:
	 * - 利用者がキャンセルする。
	 *
	 * 期待結果:
	 * - 行移動は反映されない。
	 * - 確認対象は破棄され通常状態へ戻る。
	 */
	it( 'when the user cancels a pending row move, should return to idle without changing the table', () => {
		const initialRows = getCurrentRowLabels();
		requestLargeRowReorderApply( move );
		cancelLargeRowReorderApply();

		expect( getCurrentRowLabels() ).toEqual( initialRows );
		expect( getLargeRowReorderApplyState() ).toMatchObject( {
			phase: 'idle',
			move: null,
			applied: false,
		} );
	} );

	/**
	 * 確認待ちの間にTable構造が変わった場合は、古い移動意図を現在Tableへ適用しないことを確認する。
	 *
	 * 事前条件:
	 * - 大規模行反映が確認待ちである。
	 * - 続行前に対象TableがBlock Editor Storeから消失する。
	 *
	 * 操作:
	 * - 利用者が続行し、反映を開始する。
	 *
	 * 期待結果:
	 * - 行移動は反映されない。
	 * - 対象Tableを戻すため再mount状態へ進む。
	 */
	it( 'when the current table can no longer validate a confirmed row move, should remount without applying it', () => {
		requestLargeRowReorderApply( move );
		confirmLargeRowReorderApply();
		setRowReorderTestTables( [] );
		applyLargeRowReorder();

		expect( getRowReorderTestTable( 'table-a' ) ).toBeNull();
		expect( getLargeRowReorderApplyState() ).toMatchObject( {
			phase: 'remounting',
			move,
			applied: false,
		} );
	} );

	/**
	 * 一つの確認付き大規模反映が進行中の間は別の行移動を重ねて受理しないことを確認する。
	 *
	 * 事前条件:
	 * - 一つ目の行移動が確認待ちである。
	 *
	 * 操作:
	 * - 別の行移動について確認付き反映を要求する。
	 *
	 * 期待結果:
	 * - 二つ目の要求は受理されない。
	 * - 最初の確認対象が維持される。
	 */
	it( 'when another row apply is already pending, should reject a second request', () => {
		requestLargeRowReorderApply( move );
		const anotherMove = { ...move, sourceRowIndex: 2 };

		expect( requestLargeRowReorderApply( anotherMove ) ).toBe( false );
		expect( getLargeRowReorderApplyState() ).toMatchObject( {
			phase: 'confirming',
			move,
			applied: false,
		} );
	} );
} );
