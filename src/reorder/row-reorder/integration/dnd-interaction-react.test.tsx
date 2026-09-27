/**
 * 行専用DnD InteractionのReact購読境界が、Production共有状態をReact描画へ正しく接続することを確認する。
 */

import { act, render, renderHook } from '@testing-library/react';

import {
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	rowDndInteraction,
} from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import {
	createRowReorderTestRow,
	createRowReorderTestTable,
	setRowReorderTestTables,
} from '@/reorder/row-reorder/responsibilities/table-integration.test-utils';
import { resolveRowReorderTarget } from '@/reorder/row-reorder/responsibilities/target-resolution';
import {
	useRowDndDestinationBoundaryIndex,
	useRowDndPhase,
} from '@/reorder/row-reorder/integration/dnd-interaction-react';

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとDnD Interactionは実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( '@/reorder/row-reorder/responsibilities/table-integration.test-utils' )
		.rowReorderTestBlockEditorStore,
} ) );

/** Production Target Resolutionで解決した対象から行DnD Sessionを開始する。 */
const startSession = (): void => {
	const resolution = resolveRowReorderTarget( {
		tableIdentity: 'table-a',
		sourceRowIndex: 1,
	} );
	if ( resolution.status !== 'resolved' ) {
		throw new Error( 'Row DnD React test target must be resolved.' );
	}
	rowDndInteraction.start( resolution.target, resolution.initialConstraints );
};

describe( 'Row DnD React state interface', () => {
	beforeEach( () => {
		act( () => {
			rowDndInteraction.cancel();
		} );
		setRowReorderTestTables( [
			createRowReorderTestTable(
				'table-a',
				Array.from( { length: 5 }, ( _value, rowIndex ) =>
					createRowReorderTestRow( `row-${ rowIndex + 1 }` )
				)
			),
		] );
	} );

	afterEach( () => {
		act( () => {
			rowDndInteraction.cancel();
		} );
		setRowReorderTestTables( [] );
	} );

	/**
	 * 各公開Hookが、mount時点のProduction行DnD共有状態を返すことを確認する。
	 *
	 * 事前条件:
	 * - 行DnDはactiveで、現在の有効な移動先境界は4である。
	 *
	 * 操作:
	 * - phaseと移動先境界を公開する各Hookをmountする。
	 *
	 * 期待結果:
	 * - 各Hookは対応する現在状態としてactiveと4を返す。
	 */
	it( 'when hooks mount with existing row DnD state, should expose each current public value', () => {
		act( () => {
			startSession();
			rowDndInteraction.updateDestination( 4 );
		} );

		const phase = renderHook( useRowDndPhase );
		const destination = renderHook( useRowDndDestinationBoundaryIndex );

		expect( phase.result.current ).toBe( 'active' );
		expect( destination.result.current ).toBe( 4 );
	} );

	/**
	 * Production行DnD共有状態が変化したとき、各公開Hookが最新状態へ追従することを確認する。
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
	it( 'when row DnD state changes, should update every subscribed public value', () => {
		const phase = renderHook( useRowDndPhase );
		const destination = renderHook( useRowDndDestinationBoundaryIndex );

		act( () => {
			startSession();
			rowDndInteraction.updateDestination( 4 );
		} );

		expect( phase.result.current ).toBe( 'active' );
		expect( destination.result.current ).toBe( 4 );
	} );

	/**
	 * React利用者が終了した後は、Production共有状態の変更で描画されないことを確認する。
	 *
	 * 事前条件:
	 * - phaseと移動先境界を読むReact利用者がmountされている。
	 *
	 * 操作:
	 * - 利用者をunmountした後、Production操作で行DnD状態を変更する。
	 *
	 * 期待結果:
	 * - 終了した利用者は再描画されない。
	 * - Production共有状態自体は通常どおり更新される。
	 */
	it( 'when React consumers unmount, should release their row DnD state subscriptions', () => {
		const renderObserver = jest.fn();
		const Consumer = () => {
			const phase = useRowDndPhase();
			const destination = useRowDndDestinationBoundaryIndex();
			renderObserver( phase, destination );
			return null;
		};
		const consumer = render( <Consumer /> );
		const renderCountBeforeUnmount = renderObserver.mock.calls.length;

		consumer.unmount();
		act( () => {
			startSession();
			rowDndInteraction.updateDestination( 4 );
		} );

		expect( renderObserver ).toHaveBeenCalledTimes( renderCountBeforeUnmount );
		expect( getRowDndPhase() ).toBe( 'active' );
		expect( getRowDndDestinationBoundaryIndex() ).toBe( 4 );
	} );
} );
