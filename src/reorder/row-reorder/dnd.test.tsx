/**
 * 行並び替えのDnD境界が、物理DnDのLifecycleを各責務へ正しく接続することを確認する。
 *
 * Reorder Target Resolutionと移動先解決は独立責務としてmockし、この境界では開始前解決、開始成立、
 * 移動先解決結果の接続、終了種別、および行並び替え無効化時を含む一時状態破棄だけを検証する。
 */

import type { BeforeDragStartEvent, DragEndEvent, DragMoveEvent, Draggable } from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { rowDndInteraction } from './dnd-interaction';
import { RowDnd } from './dnd';
import { createRowDestinationResolver } from './destination-resolution';
import { rowReorderTargetResolution } from './target-resolution';

jest.mock( '@dnd-kit/dom', () => ( {
	Cursor: {},
	PreventSelection: {},
	Feedback: {},
	Draggable: jest.fn(),
} ) );

jest.mock( './dnd-interaction', () => ( {
	rowDndInteraction: {
		start: jest.fn(),
		updateDestination: jest.fn(),
		complete: jest.fn(),
		cancel: jest.fn(),
	},
} ) );

jest.mock( './target-resolution', () => ( {
	rowReorderTargetResolution: {
		resolve: jest.fn(),
	},
} ) );

jest.mock( './destination-resolution', () => ( {
	createRowDestinationResolver: jest.fn(),
} ) );

jest.mock( './presentation/row-presentation', () => ( {
	RowPresentation: () => null,
} ) );

let activeDraggableRef: { current: Draggable | null } | null = null;

jest.mock( './input', () => ( {
	RowInput: ( props: {
		activeDraggable: { current: Draggable | null };
		children: ( handler: () => void ) => ReactNode;
	} ) => {
		activeDraggableRef = props.activeDraggable;
		return props.children( () => undefined );
	},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	DragDropProvider: jest.fn( ( props: { children: ReactNode } ) => props.children ),
} ) );

const dragDropProviderMock = DragDropProvider as unknown as jest.Mock;
const interactionMock = rowDndInteraction as jest.Mocked< typeof rowDndInteraction >;
const targetResolutionMock = rowReorderTargetResolution as jest.Mocked<
	typeof rowReorderTargetResolution
>;
const destinationResolverFactoryMock = createRowDestinationResolver as jest.MockedFunction<
	typeof createRowDestinationResolver
>;

/** DnD Engine境界へ渡された最新のcallback群を取得する。 */
const getProviderProps = () => {
	const props = dragDropProviderMock.mock.calls.at( -1 )?.[ 0 ];
	if ( ! props ) {
		throw new Error( 'DragDropProvider props were not captured.' );
	}
	return props;
};

/** 開始可能なTarget Resolution結果を設定する。 */
const mockResolvedTarget = ( sourceRowIndex = 0 ) => {
	const target = { tableIdentity: 'table-1', sourceRowIndex };
	const initialConstraints = { rowCount: 3, blockedBoundaries: [] as number[] };
	targetResolutionMock.resolve.mockReturnValue( {
		status: 'resolved',
		target,
		initialConstraints,
	} );
	return { target, initialConstraints };
};

describe( 'Row DnD engine connection', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		activeDraggableRef = null;
		destinationResolverFactoryMock.mockReturnValue( null );
	} );

	/**
	 * 概要:
	 * - Target Resolutionで開始不能となった物理DnDを成立させないことを確認する。
	 * 事前条件:
	 * - Reorder Target Resolutionが現在のTable構造では利用不能と解決する。
	 * 操作:
	 * - DnD Engineから開始前通知を受ける。
	 * 期待結果:
	 * - 物理DnD開始が取消され、DnD Interactionのstartは呼ばれない。
	 */
	it( 'when target resolution rejects the source, should prevent the physical drag from starting', () => {
		targetResolutionMock.resolve.mockReturnValue( { status: 'unavailable' } );
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		const preventDefault = jest.fn();
		const target = { tableIdentity: 'table-1', sourceRowIndex: 1 };

		props.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		props.onDragStart();

		expect( targetResolutionMock.resolve ).toHaveBeenCalledWith( target );
		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 解決済みTargetと開始時制約を物理DnD開始成立後のSession開始へ引き継ぐことを確認する。
	 * 事前条件:
	 * - Reorder Target Resolutionが開始可能な解決結果を返す。
	 * 操作:
	 * - 開始前通知の後に物理DnD開始通知を受ける。
	 * 期待結果:
	 * - 解決結果のTargetと開始時制約でstartが1回呼ばれる。
	 */
	it( 'when physical drag starts after target resolution, should start the row DnD session with the resolved target and constraints', () => {
		const { target, initialConstraints } = mockResolvedTarget( 1 );
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();

		props.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		props.onDragStart();

		expect( interactionMock.start ).toHaveBeenCalledWith( target, initialConstraints );
	} );

	/**
	 * 概要:
	 * - 行並び替えを無効化した時点で未使用の解決結果とDraggable登録を破棄することを確認する。
	 * 事前条件:
	 * - 解決済みの開始対象とDraggable登録が存在する。
	 * 操作:
	 * - enabled=falseへ切り替える。
	 * 期待結果:
	 * - Draggableが破棄され、無効化前の解決結果ではstartが呼ばれない。
	 */
	it( 'when row reordering becomes disabled, should discard the resolved start and active draggable', () => {
		const { target } = mockResolvedTarget( 1 );
		const { rerender } = render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		props.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		if ( activeDraggableRef === null ) {
			throw new Error( 'RowInput activeDraggable ref was not captured.' );
		}
		const destroy = jest.fn();
		activeDraggableRef.current = { destroy } as unknown as Draggable;

		rerender(
			<RowDnd enabled={ false } tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		getProviderProps().onDragStart();

		expect( destroy ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - DnD接続境界が終了した時点でDraggable登録を破棄することを確認する。
	 * 事前条件:
	 * - 解決済みの開始対象とDraggable登録が存在する。
	 * 操作:
	 * - RowDndをunmountする。
	 * 期待結果:
	 * - Draggableが破棄され、境界終了後へ一時登録を持ち越さない。
	 */
	it( 'when the row DnD connection unmounts, should destroy the active draggable', () => {
		const { target } = mockResolvedTarget( 1 );
		const { unmount } = render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		props.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		if ( activeDraggableRef === null ) {
			throw new Error( 'RowInput activeDraggable ref was not captured.' );
		}
		const destroy = jest.fn();
		activeDraggableRef.current = { destroy } as unknown as Draggable;

		unmount();

		expect( destroy ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - 移動先解決境界が返した論理的な移動先をDnD Interactionへ接続することを確認する。
	 * 事前条件:
	 * - DnD開始時に移動先解決境界が成立し、現在位置から境界1を返す。
	 * 操作:
	 * - 物理DnD開始後に移動通知を受ける。
	 * 期待結果:
	 * - 解決済みの境界1がDnD Interactionへ通知される。
	 */
	it( 'when destination resolution returns a boundary, should update the DnD interaction with that boundary', () => {
		const sourceElement = document.createElement( 'tr' );
		const resolve = jest.fn().mockReturnValue( 1 );
		destinationResolverFactoryMock.mockReturnValue( { resolve } );
		const { target } = mockResolvedTarget();
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		props.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		props.onDragStart( { operation: { source: { element: sourceElement } } } );
		const moveEvent = {
			operation: { source: { element: sourceElement } },
			nativeEvent: { clientX: 10, clientY: 50 },
		} as unknown as DragMoveEvent;
		props.onDragMove( moveEvent );

		expect( destinationResolverFactoryMock ).toHaveBeenCalledWith( sourceElement );
		expect( resolve ).toHaveBeenCalledWith( moveEvent );
		expect( interactionMock.updateDestination ).toHaveBeenCalledWith( 1 );
	} );

	/**
	 * 概要:
	 * - 現在位置から有効な移動先を解決できない場合にnullへ更新することを確認する。
	 * 事前条件:
	 * - DnD開始時に移動先解決境界が成立している。
	 * 操作:
	 * - 有効な移動先がない物理入力位置へ移動する。
	 * 期待結果:
	 * - DnD Interactionへnullが通知される。
	 */
	it( 'when destination resolution returns no destination, should clear the DnD interaction destination', () => {
		const sourceElement = document.createElement( 'tr' );
		const resolve = jest.fn().mockReturnValue( null );
		destinationResolverFactoryMock.mockReturnValue( { resolve } );
		const { target } = mockResolvedTarget();
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		props.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		props.onDragStart( { operation: { source: { element: sourceElement } } } );
		props.onDragMove( {
			operation: { source: { element: sourceElement } },
			nativeEvent: { clientX: 120, clientY: 50 },
		} as unknown as DragMoveEvent );

		expect( interactionMock.updateDestination ).toHaveBeenCalledWith( null );
	} );

	/**
	 * 概要:
	 * - DnD開始通知で移動先解決境界を作れなくても最初の移動通知で補完できることを確認する。
	 * 事前条件:
	 * - Row DnD Sessionは開始済みである。
	 * 操作:
	 * - 最初の物理移動通知を受ける。
	 * 期待結果:
	 * - その移動通知から解決境界を生成し、移動先をDnD Interactionへ通知する。
	 */
	it( 'when destination resolution was unavailable at drag start, should create it from the first drag move', () => {
		const sourceElement = document.createElement( 'tr' );
		const resolve = jest.fn().mockReturnValue( 2 );
		destinationResolverFactoryMock.mockReturnValueOnce( null ).mockReturnValueOnce( { resolve } );
		const { target } = mockResolvedTarget();
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		props.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		props.onDragStart( { operation: { source: { element: undefined } } } );
		const moveEvent = {
			operation: { source: { element: sourceElement } },
			nativeEvent: { clientX: 10, clientY: 50 },
		} as unknown as DragMoveEvent;

		props.onDragMove( moveEvent );

		expect( destinationResolverFactoryMock ).toHaveBeenNthCalledWith( 1, undefined );
		expect( destinationResolverFactoryMock ).toHaveBeenNthCalledWith( 2, sourceElement );
		expect( resolve ).toHaveBeenCalledWith( moveEvent );
		expect( interactionMock.updateDestination ).toHaveBeenCalledWith( 2 );
	} );

	/**
	 * 概要:
	 * - 物理DnDのcancelと通常終了をSessionの取消と確定へ分岐して接続することを確認する。
	 * 事前条件:
	 * - DnD Engineから終了通知を受けられる。
	 * 操作:
	 * - cancel終了と通常終了をそれぞれ通知する。
	 * 期待結果:
	 * - cancelではcancelだけ、通常終了ではcompleteだけが呼ばれる。
	 */
	it( 'when physical drag ends, should cancel a canceled drag and complete a normal drag', () => {
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();

		props.onDragEnd( { canceled: true } as DragEndEvent );
		expect( interactionMock.cancel ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.complete ).not.toHaveBeenCalled();

		jest.clearAllMocks();
		props.onDragEnd( { canceled: false } as DragEndEvent );
		expect( interactionMock.complete ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.cancel ).not.toHaveBeenCalled();
	} );
} );
