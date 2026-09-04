/**
 * 行専用DnD InteractionのReact購読境界が、公開状態をReact描画へ正しく接続することを確認する。
 *
 * DnD Interaction本体のLifecycleや状態遷移は重複して検証せず、各公開Hookが現在状態を取得し、
 * 共有状態の変更通知へ追従し、React利用者の終了時に購読を解除する責務だけを検証する。
 */

import { act, renderHook } from '@testing-library/react';

import {
	getRowDndActive,
	getRowDndDestinationBoundaryIndex,
	getRowDndPhase,
	subscribeRowDndState,
} from './dnd-interaction';
import {
	useRowDndActive,
	useRowDndDestinationBoundaryIndex,
	useRowDndPhase,
} from './dnd-interaction-react';

jest.mock( './dnd-interaction', () => ( {
	getRowDndActive: jest.fn(),
	getRowDndDestinationBoundaryIndex: jest.fn(),
	getRowDndPhase: jest.fn(),
	subscribeRowDndState: jest.fn(),
} ) );

const getRowDndPhaseMock = getRowDndPhase as jest.MockedFunction< typeof getRowDndPhase >;
const getRowDndActiveMock = getRowDndActive as jest.MockedFunction< typeof getRowDndActive >;
const getRowDndDestinationBoundaryIndexMock =
	getRowDndDestinationBoundaryIndex as jest.MockedFunction<
		typeof getRowDndDestinationBoundaryIndex
	>;
const subscribeRowDndStateMock = subscribeRowDndState as jest.MockedFunction<
	typeof subscribeRowDndState
>;

type RowDndStateListener = Parameters< typeof subscribeRowDndState >[ 0 ];

const rowDndStateListeners = new Set< RowDndStateListener >();

/** 現在のReact購読者へ行DnD共有状態の変更を通知する。 */
const notifyRowDndStateChange = (): void => {
	rowDndStateListeners.forEach( ( listener ) => {
		listener();
	} );
};

describe( 'Row DnD React state interface', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		rowDndStateListeners.clear();
		getRowDndPhaseMock.mockReturnValue( 'idle' );
		getRowDndActiveMock.mockReturnValue( false );
		getRowDndDestinationBoundaryIndexMock.mockReturnValue( null );
		subscribeRowDndStateMock.mockImplementation( ( listener ) => {
			rowDndStateListeners.add( listener );

			return () => {
				rowDndStateListeners.delete( listener );
			};
		} );
	} );

	/**
	 * 概要:
	 * - 各公開Hookが、それぞれの利用者に必要な現在の行DnD共有状態を返すことを確認する。
	 *
	 * 事前条件:
	 * - 行DnDはactiveで、現在の有効移動先境界は4である。
	 *
	 * 操作:
	 * - phase、active状態、移動先境界を公開する各Hookをmountする。
	 *
	 * 期待結果:
	 * - 各Hookは対応する現在状態としてactive、true、4を返す。
	 */
	it( 'when hooks mount with existing row DnD state, should expose each current public value', () => {
		getRowDndPhaseMock.mockReturnValue( 'active' );
		getRowDndActiveMock.mockReturnValue( true );
		getRowDndDestinationBoundaryIndexMock.mockReturnValue( 4 );

		const phase = renderHook( useRowDndPhase );
		const active = renderHook( useRowDndActive );
		const destination = renderHook( useRowDndDestinationBoundaryIndex );

		expect( phase.result.current ).toBe( 'active' );
		expect( active.result.current ).toBe( true );
		expect( destination.result.current ).toBe( 4 );
	} );

	/**
	 * 概要:
	 * - 行DnD共有状態の変更通知を受けたとき、各公開Hookが最新状態へ追従することを確認する。
	 *
	 * 事前条件:
	 * - 各Hookはidle、非active、移動先なしの状態を購読している。
	 *
	 * 操作:
	 * - 共有状態をactive、移動先境界4へ変更し、購読者へ状態変更を通知する。
	 *
	 * 期待結果:
	 * - 各HookのReact描画結果がactive、true、4へ更新される。
	 */
	it( 'when row DnD state changes, should update every subscribed public value', () => {
		const phase = renderHook( useRowDndPhase );
		const active = renderHook( useRowDndActive );
		const destination = renderHook( useRowDndDestinationBoundaryIndex );

		getRowDndPhaseMock.mockReturnValue( 'active' );
		getRowDndActiveMock.mockReturnValue( true );
		getRowDndDestinationBoundaryIndexMock.mockReturnValue( 4 );

		act( () => {
			notifyRowDndStateChange();
		} );

		expect( phase.result.current ).toBe( 'active' );
		expect( active.result.current ).toBe( true );
		expect( destination.result.current ).toBe( 4 );
	} );

	/**
	 * 概要:
	 * - React利用者が終了したとき、行DnD共有状態への購読を残さないことを確認する。
	 *
	 * 事前条件:
	 * - phase、active状態、移動先境界の各Hookが共有状態を購読している。
	 *
	 * 操作:
	 * - すべてのHookをunmountする。
	 *
	 * 期待結果:
	 * - React利用者に対応する行DnD共有状態の購読がすべて解除される。
	 */
	it( 'when React consumers unmount, should release their row DnD state subscriptions', () => {
		const phase = renderHook( useRowDndPhase );
		const active = renderHook( useRowDndActive );
		const destination = renderHook( useRowDndDestinationBoundaryIndex );

		expect( rowDndStateListeners.size ).toBeGreaterThan( 0 );

		phase.unmount();
		active.unmount();
		destination.unmount();

		expect( rowDndStateListeners.size ).toBe( 0 );
	} );
} );
