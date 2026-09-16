/**
 * 列専用DnD InteractionのReact購読境界が、Reorder Presentation向け公開状態をReact描画へ正しく接続することを確認する。
 *
 * DnD Interaction本体のLifecycleや状態遷移は重複して検証せず、各公開Hookが現在状態を取得し、
 * 共有状態の変更通知へ追従し、React利用者の終了時に購読を解除する責務だけを検証する。
 */

import { act, renderHook } from '@testing-library/react';

import {
	getColumnDndDestinationBoundaryIndex,
	getColumnDndPhase,
	subscribeColumnDndState,
} from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import {
	useColumnDndDestinationBoundaryIndex,
	useColumnDndPhase,
} from '@/reorder/column-reorder/integration/dnd-interaction-react';

jest.mock( '@/reorder/column-reorder/responsibilities/dnd-interaction', () => ( {
	getColumnDndDestinationBoundaryIndex: jest.fn(),
	getColumnDndPhase: jest.fn(),
	subscribeColumnDndState: jest.fn(),
} ) );

const getColumnDndPhaseMock = getColumnDndPhase as jest.MockedFunction< typeof getColumnDndPhase >;
const getColumnDndDestinationBoundaryIndexMock =
	getColumnDndDestinationBoundaryIndex as jest.MockedFunction<
		typeof getColumnDndDestinationBoundaryIndex
	>;
const subscribeColumnDndStateMock = subscribeColumnDndState as jest.MockedFunction<
	typeof subscribeColumnDndState
>;

type ColumnDndStateListener = Parameters< typeof subscribeColumnDndState >[ 0 ];

const columnDndStateListeners = new Set< ColumnDndStateListener >();

/** 現在のReact購読者へ列DnD共有状態の変更を通知する。 */
const notifyColumnDndStateChange = (): void => {
	columnDndStateListeners.forEach( ( listener ) => {
		listener();
	} );
};

describe( 'Column DnD React state interface', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		columnDndStateListeners.clear();
		getColumnDndPhaseMock.mockReturnValue( 'idle' );
		getColumnDndDestinationBoundaryIndexMock.mockReturnValue( null );
		subscribeColumnDndStateMock.mockImplementation( ( listener ) => {
			columnDndStateListeners.add( listener );

			return () => {
				columnDndStateListeners.delete( listener );
			};
		} );
	} );

	it( 'when hooks mount with existing column DnD state, should expose each current public value', () => {
		getColumnDndPhaseMock.mockReturnValue( 'active' );
		getColumnDndDestinationBoundaryIndexMock.mockReturnValue( 4 );

		const phase = renderHook( useColumnDndPhase );
		const destination = renderHook( useColumnDndDestinationBoundaryIndex );

		expect( phase.result.current ).toBe( 'active' );
		expect( destination.result.current ).toBe( 4 );
	} );

	it( 'when column DnD state changes, should update every subscribed public value', () => {
		const phase = renderHook( useColumnDndPhase );
		const destination = renderHook( useColumnDndDestinationBoundaryIndex );

		getColumnDndPhaseMock.mockReturnValue( 'active' );
		getColumnDndDestinationBoundaryIndexMock.mockReturnValue( 4 );

		act( () => {
			notifyColumnDndStateChange();
		} );

		expect( phase.result.current ).toBe( 'active' );
		expect( destination.result.current ).toBe( 4 );
	} );

	it( 'when React consumers unmount, should release their column DnD state subscriptions', () => {
		const phase = renderHook( useColumnDndPhase );
		const destination = renderHook( useColumnDndDestinationBoundaryIndex );

		expect( columnDndStateListeners.size ).toBeGreaterThan( 0 );

		phase.unmount();
		destination.unmount();

		expect( columnDndStateListeners.size ).toBe( 0 );
	} );
} );
