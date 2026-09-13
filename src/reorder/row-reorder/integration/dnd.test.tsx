/**
 * 行並び替えのDnD境界が、Reorder Modeと物理DnD Lifecycleを各責務へ正しく接続することを確認する。
 *
 * Reorder Target Resolutionと移動先解決は独立責務としてmockし、この境界ではevent-timeのmode判定、
 * mode離脱cleanup、開始前解決、開始成立、移動先解決結果の接続、終了種別、およびAuto Scroll方向を検証する。
 */

import {
	AutoScroller,
	type BeforeDragStartEvent,
	type DragEndEvent,
	type DragMoveEvent,
	type Draggable,
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { reorderMode } from '@/reorder/reorder-mode';
import { createRowDestinationResolver } from '@/reorder/row-reorder/integration/destination-resolution';
import { rowDndInteraction } from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import { rowReorderTargetResolution } from '@/reorder/row-reorder/responsibilities/target-resolution';
import { RowDnd } from './dnd';

jest.mock( '@dnd-kit/dom', () => ( {
	AutoScroller: {
		configure: jest.fn( () => ( { configured: true } ) ),
	},
	Cursor: {},
	PreventSelection: {},
	Feedback: {},
	Draggable: jest.fn(),
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/dnd-interaction', () => ( {
	rowDndInteraction: {
		start: jest.fn(),
		updateDestination: jest.fn(),
		complete: jest.fn(),
		cancel: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/target-resolution', () => ( {
	rowReorderTargetResolution: {
		resolve: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/row-reorder/integration/destination-resolution', () => ( {
	createRowDestinationResolver: jest.fn(),
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/presentation/row-presentation', () => ( {
	RowPresentation: () => null,
} ) );

let activeDraggableRef: { current: Draggable | null } | null = null;
const rowInputPointerDownMock = jest.fn();

jest.mock( '@/reorder/row-reorder/responsibilities/input', () => ( {
	RowInput: ( props: {
		activeDraggable: { current: Draggable | null };
		children: ( handler: ( event: unknown ) => void ) => ReactNode;
	} ) => {
		activeDraggableRef = props.activeDraggable;
		return props.children( rowInputPointerDownMock );
	},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	DragDropProvider: jest.fn( ( props: { children: ReactNode } ) => props.children ),
} ) );

const dragDropProviderMock = DragDropProvider as unknown as jest.Mock;
const autoScrollerConfigureMock = AutoScroller.configure as jest.Mock;
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

/**
 * 開始可能なTarget Resolution結果を設定する。
 * @param sourceRowIndex
 */
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

/** Reorder Modeを通常編集へ戻す。 */
const resetReorderMode = () => {
	act( () => {
		reorderMode.observeTable( '__row-dnd-test-reset__' );
	} );
};

describe( 'Row DnD engine connection', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		activeDraggableRef = null;
		destinationResolverFactoryMock.mockReturnValue( null );
		resetReorderMode();
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * 行DnDでは縦方向だけAuto Scrollを許可することを確認する。
	 */
	it( 'when row DnD plugins are resolved, should enable auto scroll only on the vertical axis', () => {
		render( <RowDnd tableIdentity="table-1">{ () => <div /> }</RowDnd> );
		const props = getProviderProps();
		const unrelatedPlugin = {};
		const plugins = props.plugins( [ unrelatedPlugin, AutoScroller ] );

		expect( autoScrollerConfigureMock ).toHaveBeenCalledWith( {
			threshold: { x: 0, y: 0.2 },
		} );
		expect( plugins ).toEqual( [
			unrelatedPlugin,
			autoScrollerConfigureMock.mock.results[ 0 ]?.value,
		] );
	} );

	/**
	 * Reorder Modeをevent-timeで確認し、行modeの入力だけをRow Inputへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - DnD境界は通常編集状態から同じReact identityで存在している。
	 *
	 * 操作:
	 * - 通常編集状態と行mode状態で同じpointer handlerへ入力する。
	 *
	 * 期待結果:
	 * - 通常編集の入力はRow Inputへ渡らず、行modeの入力だけが渡る。
	 */
	it( 'when pointer input occurs, should forward it to Row Input only while row reorder mode is active', () => {
		let pointerDown: ( event: unknown ) => void = () => {};
		render(
			<RowDnd tableIdentity="table-1">
				{ ( handler ) => {
					pointerDown = handler as unknown as ( event: unknown ) => void;
					return <div />;
				} }
			</RowDnd>
		);
		const event = {};

		pointerDown( event );
		expect( rowInputPointerDownMock ).not.toHaveBeenCalled();

		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		pointerDown( event );
		expect( rowInputPointerDownMock ).toHaveBeenCalledWith( event );
	} );

	/**
	 * Target Resolutionで開始不能となった物理DnDを成立させないことを確認する。
	 */
	it( 'when target resolution rejects the source, should prevent the physical drag from starting', () => {
		targetResolutionMock.resolve.mockReturnValue( { status: 'unavailable' } );
		render( <RowDnd tableIdentity="table-1">{ () => <div /> }</RowDnd> );
		const props = getProviderProps();
		const preventDefault = jest.fn();
		const target = { tableIdentity: 'table-1', sourceRowIndex: 1 };

		props.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		props.onDragStart();

		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 解決済みTargetと開始時制約を物理DnD開始成立後のSession開始へ引き継ぐことを確認する。
	 */
	it( 'when physical drag starts after target resolution, should start the row DnD session with the resolved target and constraints', () => {
		const { target, initialConstraints } = mockResolvedTarget( 1 );
		render( <RowDnd tableIdentity="table-1">{ () => <div /> }</RowDnd> );
		const props = getProviderProps();

		props.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		props.onDragStart();

		expect( interactionMock.start ).toHaveBeenCalledWith( target, initialConstraints );
	} );

	/**
	 * Row Reorder Mode離脱時に未使用の解決結果とDraggable登録を即時破棄することを確認する。
	 */
	it( 'when row reorder mode ends, should discard the resolved start and active draggable without a React rerender', () => {
		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		const { target } = mockResolvedTarget( 1 );
		render( <RowDnd tableIdentity="table-1">{ () => <div /> }</RowDnd> );
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

		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		props.onDragStart();

		expect( destroy ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * DnD接続境界終了時にDraggable登録を破棄することを確認する。
	 */
	it( 'when the row DnD connection unmounts, should destroy the active draggable', () => {
		const { unmount } = render( <RowDnd tableIdentity="table-1">{ () => <div /> }</RowDnd> );
		if ( activeDraggableRef === null ) {
			throw new Error( 'RowInput activeDraggable ref was not captured.' );
		}
		const destroy = jest.fn();
		activeDraggableRef.current = { destroy } as unknown as Draggable;

		unmount();
		expect( destroy ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 移動先解決境界が返した論理境界をDnD Interactionへ接続することを確認する。
	 */
	it( 'when destination resolution returns a boundary, should update the DnD interaction with that boundary', () => {
		const sourceElement = document.createElement( 'tr' );
		const resolve = jest.fn().mockReturnValue( 1 );
		destinationResolverFactoryMock.mockReturnValue( { resolve } );
		const { target } = mockResolvedTarget();
		render( <RowDnd tableIdentity="table-1">{ () => <div /> }</RowDnd> );
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

		expect( resolve ).toHaveBeenCalledWith( moveEvent );
		expect( interactionMock.updateDestination ).toHaveBeenCalledWith( 1 );
	} );

	/**
	 * 物理DnDのcancelと通常終了をSessionの取消と確定へ分岐して接続することを確認する。
	 */
	it( 'when physical drag ends, should cancel a canceled drag and complete a normal drag', () => {
		render( <RowDnd tableIdentity="table-1">{ () => <div /> }</RowDnd> );
		const props = getProviderProps();

		props.onDragEnd( { canceled: true } as DragEndEvent );
		expect( interactionMock.cancel ).toHaveBeenCalledTimes( 1 );

		jest.clearAllMocks();
		props.onDragEnd( { canceled: false } as DragEndEvent );
		expect( interactionMock.complete ).toHaveBeenCalledTimes( 1 );
	} );
} );
