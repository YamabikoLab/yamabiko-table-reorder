/**
 * Column DnD Engine Integrationが、Reorder Modeと二段階Target Resolutionを経て物理DnD LifecycleをColumn DnD Interactionへ接続することを確認する。
 *
 * dnd-kit自体の挙動は再現せず、event-timeのmode判定、mode離脱cleanup、第二段階解決、
 * Session開始、論理移動先、complete / cancel変換、DnD Engine Auto Scrollの無効化を検証する。
 */

import {
	AutoScroller,
	Cursor,
	Feedback,
	PreventSelection,
	type BeforeDragStartEvent,
	type DragEndEvent,
	type DragMoveEvent,
	type DragStartEvent,
	type Draggable,
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { columnDndInteraction } from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';
import { reorderMode } from '@/reorder/reorder-mode';
import { createColumnDestinationResolver } from './destination-resolution';
import { ColumnDnd } from './dnd';

jest.mock( '@dnd-kit/dom', () => ( {
	AutoScroller: { name: 'auto-scroller' },
	Cursor: { name: 'cursor' },
	PreventSelection: { name: 'prevent-selection' },
	Feedback: { name: 'feedback' },
	Draggable: jest.fn(),
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	DragDropProvider: jest.fn( ( props: { children: ReactNode } ) => props.children ),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/dnd-interaction', () => ( {
	columnDndInteraction: {
		start: jest.fn(),
		updateDestination: jest.fn(),
		complete: jest.fn(),
		cancel: jest.fn(),
	},
} ) );

jest.mock( './destination-resolution', () => ( {
	createColumnDestinationResolver: jest.fn(),
} ) );

jest.mock( '@/reorder/column-reorder/integration/horizontal-auto-scroll', () => ( {
	createColumnHorizontalAutoScroll: jest.fn( () => ( {
		start: jest.fn(),
		updatePointer: jest.fn(),
		stop: jest.fn(),
	} ) ),
} ) );

let activeDraggableRef: { current: Draggable | null } | null = null;
const columnInputPointerDownMock = jest.fn();

jest.mock( '@/reorder/column-reorder/responsibilities/input', () => ( {
	ColumnInput: ( props: {
		activeDraggable: { current: Draggable | null };
		children: ( handler: ( event: unknown ) => void ) => ReactNode;
	} ) => {
		activeDraggableRef = props.activeDraggable;
		return props.children( columnInputPointerDownMock );
	},
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/presentation/column-presentation', () => ( {
	ColumnPresentation: () => null,
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/target-resolution', () => ( {
	columnReorderTargetResolution: {
		resolve: jest.fn(),
	},
} ) );

const dragDropProviderMock = DragDropProvider as unknown as jest.Mock;
const destinationResolverFactoryMock = createColumnDestinationResolver as jest.MockedFunction<
	typeof createColumnDestinationResolver
>;
const targetResolutionMock = columnReorderTargetResolution as jest.Mocked<
	typeof columnReorderTargetResolution
>;
const dndInteractionMock = columnDndInteraction as jest.Mocked< typeof columnDndInteraction >;

/** 現在のDragDropProviderへ渡された物理DnD Lifecycle処理とplugin構成処理を取得する。 */
const getProviderProps = () => {
	const call = dragDropProviderMock.mock.calls.at( -1 );
	const props = call?.[ 0 ];
	if ( ! props ) {
		throw new Error( 'ColumnDnd did not render DragDropProvider.' );
	}
	return props;
};

const target = {
	tableIdentity: 'table-1',
	sourceColumnIndex: 1,
};

const resolvedTarget = {
	status: 'resolved' as const,
	target,
	initialConstraints: {
		columnCount: 4,
		blockedBoundaries: [],
	},
};

const resetReorderMode = () => {
	act( () => {
		reorderMode.observeTable( '__column-dnd-test-reset__' );
	} );
};

describe( 'Column DnD Engine Integration', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		activeDraggableRef = null;
		resetReorderMode();
		targetResolutionMock.resolve.mockReturnValue( resolvedTarget );
		destinationResolverFactoryMock.mockReturnValue( {
			resolve: jest.fn().mockReturnValue( 3 ),
		} );
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * Reorder Modeをevent-timeで確認し、列modeの入力だけをColumn Inputへ渡すことを確認する。
	 */
	it( 'when pointer input occurs, should forward it to Column Input only while column reorder mode is active', () => {
		let pointerDown: ( event: unknown ) => void = () => {};
		render(
			<ColumnDnd tableIdentity="table-1">
				{ ( handler ) => {
					pointerDown = handler as unknown as ( event: unknown ) => void;
					return <div />;
				} }
			</ColumnDnd>
		);
		const event = {};

		pointerDown( event );
		expect( columnInputPointerDownMock ).not.toHaveBeenCalled();

		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		pointerDown( event );
		expect( columnInputPointerDownMock ).toHaveBeenCalledWith( event );
	} );

	/**
	 * 第二段階解決が成立した物理DnDをColumn DnD Sessionへ接続することを確認する。
	 */
	it( 'when second-stage resolution succeeds and the physical drag completes, should connect the resolved target, logical destination, and complete lifecycle', () => {
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		const sourceElement = document.createElement( 'td' );
		const preventDefault = jest.fn();

		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart( {
			operation: { source: { element: sourceElement } },
		} as unknown as DragStartEvent );
		provider.onDragMove( {
			operation: { source: { element: sourceElement } },
		} as unknown as DragMoveEvent );
		provider.onDragEnd( { canceled: false } as unknown as DragEndEvent );

		expect( preventDefault ).not.toHaveBeenCalled();
		expect( dndInteractionMock.start ).toHaveBeenCalledWith(
			resolvedTarget.target,
			resolvedTarget.initialConstraints
		);
		expect( dndInteractionMock.updateDestination ).toHaveBeenCalledWith( 3 );
		expect( dndInteractionMock.complete ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * DnD EngineのAuto ScrollをColumn Reorderでは無効化することを確認する。
	 */
	it( 'when DnD engine plugins are configured, should disable engine auto scroll for column reorder', () => {
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const preservedPlugin = { name: 'preserved' };
		const plugins = getProviderProps().plugins( [
			Cursor,
			PreventSelection,
			Feedback,
			AutoScroller,
			preservedPlugin,
		] );

		expect( plugins ).toEqual( [ preservedPlugin ] );
	} );

	/**
	 * Destination Resolverを開始時に生成できない場合は最初のmoveで再試行する。
	 */
	it( 'when destination resolution is unavailable at drag start but available on move, should retry and forward the resolved logical boundary', () => {
		const resolver = { resolve: jest.fn().mockReturnValue( 2 ) };
		destinationResolverFactoryMock.mockReturnValueOnce( null ).mockReturnValueOnce( resolver );
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		const sourceElement = document.createElement( 'td' );
		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart( {
			operation: { source: { element: sourceElement } },
		} as unknown as DragStartEvent );
		const moveEvent = {
			operation: { source: { element: sourceElement } },
		} as unknown as DragMoveEvent;
		provider.onDragMove( moveEvent );

		expect( destinationResolverFactoryMock ).toHaveBeenCalledTimes( 2 );
		expect( resolver.resolve ).toHaveBeenCalledWith( moveEvent );
		expect( dndInteractionMock.updateDestination ).toHaveBeenCalledWith( 2 );
	} );

	/**
	 * 第二段階が成立しない場合は物理DnD開始を抑止する。
	 */
	it( 'when second-stage target resolution becomes unavailable, should prevent the physical drag and not start a column session', () => {
		targetResolutionMock.resolve.mockReturnValue( { status: 'unavailable' } );
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		const preventDefault = jest.fn();

		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart();

		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * Column Reorder Mode離脱時に未使用の解決結果とDraggable登録を即時破棄することを確認する。
	 */
	it( 'when column reorder mode ends, should discard the resolved start and active draggable without a React rerender', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		if ( activeDraggableRef === null ) {
			throw new Error( 'ColumnInput activeDraggable ref was not captured.' );
		}
		const destroy = jest.fn();
		activeDraggableRef.current = { destroy } as unknown as Draggable;

		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		provider.onDragStart();

		expect( destroy ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 取消終了はColumn DnD Sessionのcancelへ変換する。
	 */
	it( 'when the physical drag ends as canceled, should cancel the column session without completing it', () => {
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		getProviderProps().onDragEnd( { canceled: true } as unknown as DragEndEvent );

		expect( dndInteractionMock.cancel ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.complete ).not.toHaveBeenCalled();
	} );
} );
