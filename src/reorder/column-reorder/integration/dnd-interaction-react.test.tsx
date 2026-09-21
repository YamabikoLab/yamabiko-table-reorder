/**
 * 列専用DnD InteractionのReact購読境界が、Production共有状態をReact描画へ正しく接続することを確認する。
 */

import { act, render, renderHook } from '@testing-library/react';

import {
	columnDndInteraction,
	getColumnDndDestinationBoundaryIndex,
	getColumnDndPhase,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import {
	createColumnReorderTestRow,
	createColumnReorderTestTable,
	setColumnReorderTestTables,
} from '@/reorder/column-reorder/responsibilities/table-integration.test-utils';
import { resolveColumnReorderTarget } from '@/reorder/column-reorder/responsibilities/target-resolution';
import { useColumnDndDestinationBoundaryIndex, useColumnDndPhase } from './dnd-interaction-react';

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとDnD Interactionは実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual(
		'@/reorder/column-reorder/responsibilities/table-integration.test-utils'
	).columnReorderTestBlockEditorStore,
} ) );

/** Production Target Resolutionで解決した対象から列DnD Sessionを開始する。 */
const startSession = (): void => {
	const resolution = resolveColumnReorderTarget( {
		tableIdentity: 'table-a',
		sourceColumnIndex: 1,
	} );
	if ( resolution.status !== 'resolved' ) {
		throw new Error( 'Column DnD React test target must be resolved.' );
	}
	columnDndInteraction.start( resolution.target, resolution.initialConstraints );
};

describe( 'Column DnD React state interface', () => {
	beforeEach( () => {
		act( () => {
			columnDndInteraction.cancel();
		} );
		setColumnReorderTestTables( [
			createColumnReorderTestTable( 'table-a', [ createColumnReorderTestRow( 'row-1' ) ] ),
		] );
	} );

	afterEach( () => {
		act( () => {
			columnDndInteraction.cancel();
		} );
		setColumnReorderTestTables( [] );
	} );

	/**
	 * 各公開Hookが、mount時点のProduction列DnD共有状態を返すことを確認する。
	 *
	 * 事前条件:
	 * - 列DnDはactiveで、現在の有効な移動先境界は4である。
	 *
	 * 操作:
	 * - phaseと移動先境界を公開する各Hookをmountする。
	 *
	 * 期待結果:
	 * - 各Hookは対応する現在状態としてactiveと4を返す。
	 */
	it( 'when hooks mount with existing column DnD state, should expose each current public value', () => {
		act( () => {
			startSession();
			columnDndInteraction.updateDestination( 4 );
		} );

		const phase = renderHook( useColumnDndPhase );
		const destination = renderHook( useColumnDndDestinationBoundaryIndex );

		expect( phase.result.current ).toBe( 'active' );
		expect( destination.result.current ).toBe( 4 );
	} );

	/**
	 * Production列DnD共有状態が変化したとき、各公開Hookが最新状態へ追従することを確認する。
	 *
	 * 事前条件:
	 * - 各Hookはidleかつ移動先なしの状態を購読している。
	 *
	 * 操作:
	 * - Production操作でSessionを開始し、移動先境界4へ更新する。
	 *
	 * 期待結果:
	 * - 各HookのReact描画結果がactiveと4へ更新される。
	 */
	it( 'when column DnD state changes, should update every subscribed public value', () => {
		const phase = renderHook( useColumnDndPhase );
		const destination = renderHook( useColumnDndDestinationBoundaryIndex );

		act( () => {
			startSession();
			columnDndInteraction.updateDestination( 4 );
		} );

		expect( phase.result.current ).toBe( 'active' );
		expect( destination.result.current ).toBe( 4 );
	} );

	/**
	 * React利用者が終了した後は、Production共有状態の変更で描画されないことを確認する。
	 *
	 * 期待結果:
	 * - 終了した利用者は再描画されず、Production共有状態自体は通常どおり更新される。
	 */
	it( 'when React consumers unmount, should release their column DnD state subscriptions', () => {
		const renderObserver = jest.fn();
		const Consumer = () => {
			const phase = useColumnDndPhase();
			const destination = useColumnDndDestinationBoundaryIndex();
			renderObserver( phase, destination );
			return null;
		};
		const consumer = render( <Consumer /> );
		const renderCountBeforeUnmount = renderObserver.mock.calls.length;

		consumer.unmount();
		act( () => {
			startSession();
			columnDndInteraction.updateDestination( 4 );
		} );

		expect( renderObserver ).toHaveBeenCalledTimes( renderCountBeforeUnmount );
		expect( getColumnDndPhase() ).toBe( 'active' );
		expect( getColumnDndDestinationBoundaryIndex() ).toBe( 4 );
	} );
} );
