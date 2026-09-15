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
import { resolveColumnDndLayoutAvailability } from '@/reorder/column-reorder/responsibilities/layout-availability';
import { resolveColumnReorderTarget } from '@/reorder/column-reorder/responsibilities/target-resolution';
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

const mockHorizontalAutoScrollStart = jest.fn();

jest.mock( '@/reorder/column-reorder/integration/horizontal-auto-scroll', () => ( {
	createColumnHorizontalAutoScroll: jest.fn( () => ( {
		start: mockHorizontalAutoScrollStart,
		updatePointer: jest.fn(),
		stop: jest.fn(),
	} ) ),
} ) );

let mockActiveDraggableRef: { current: Draggable | null } | null = null;
const mockColumnInputPointerDown = jest.fn();

jest.mock( '@/reorder/column-reorder/responsibilities/input', () => ( {
	ColumnInput: ( props: {
		activeDraggable: { current: Draggable | null };
		children: ( handler: ( event: unknown ) => void ) => ReactNode;
	} ) => {
		mockActiveDraggableRef = props.activeDraggable;
		return props.children( mockColumnInputPointerDown );
	},
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/presentation/column-presentation', () => ( {
	ColumnPresentation: () => null,
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/target-resolution', () => ( {
	resolveColumnReorderTarget: jest.fn(),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/layout-availability', () => ( {
	resolveColumnDndLayoutAvailability: jest.fn(),
} ) );

const dragDropProviderMock = DragDropProvider as unknown as jest.Mock;
const destinationResolverFactoryMock = createColumnDestinationResolver as jest.MockedFunction<
	typeof createColumnDestinationResolver
>;
const resolveColumnReorderTargetMock = resolveColumnReorderTarget as jest.MockedFunction<
	typeof resolveColumnReorderTarget
>;
const resolveColumnDndLayoutAvailabilityMock =
	resolveColumnDndLayoutAvailability as jest.MockedFunction<
		typeof resolveColumnDndLayoutAvailability
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
		mockActiveDraggableRef = null;
		resetReorderMode();
		resolveColumnReorderTargetMock.mockReturnValue( resolvedTarget );
		resolveColumnDndLayoutAvailabilityMock.mockReturnValue( 'available' );
		destinationResolverFactoryMock.mockReturnValue( {
			resolve: jest.fn().mockReturnValue( 3 ),
		} );
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * 概要:
	 * - Reorder Modeをevent-timeで確認し、列modeの入力だけをColumn Inputへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - DnD境界は通常編集状態から同じReact identityで存在している。
	 *
	 * 操作:
	 * - 通常編集状態と列mode状態で同じpointer handlerへ入力する。
	 *
	 * 期待結果:
	 * - 通常編集の入力はColumn Inputへ渡らず、列modeの入力だけが渡る。
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
		expect( mockColumnInputPointerDown ).not.toHaveBeenCalled();

		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		pointerDown( event );
		expect( mockColumnInputPointerDown ).toHaveBeenCalledWith( event );
	} );

	/**
	 * 概要:
	 * - 第二段階解決が成立した物理DnDをColumn DnD Sessionへ接続し、論理移動先だけを進行へ渡すことを確認する。
	 *
	 * 事前条件:
	 * - 第一段階で登録されたTargetが第二段階でも開始可能である。
	 * - Destination Resolutionは現在位置を論理列間境界3として解決する。
	 *
	 * 操作:
	 * - before start、start、move、正常endの順に物理DnD通知を行う。
	 *
	 * 期待結果:
	 * - 第二段階の解決済みTargetと開始時制約でSessionが開始される。
	 * - moveでは論理列間境界3だけがDnD Interactionへ渡される。
	 * - 正常endはcompleteへ変換され、cancelは呼ばれない。
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
		expect( resolveColumnReorderTargetMock ).toHaveBeenCalledWith( target );
		expect( dndInteractionMock.start ).toHaveBeenCalledWith(
			resolvedTarget.target,
			resolvedTarget.initialConstraints
		);
		expect( dndInteractionMock.updateDestination ).toHaveBeenCalledWith( 3 );
		expect( dndInteractionMock.complete ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.cancel ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Column ReorderではDnD EngineのAuto Scrollを利用しないことを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineの既定pluginにAutoScrollerとその他の標準pluginが含まれる。
	 *
	 * 操作:
	 * - Column DnD境界のplugin構成を解決する。
	 *
	 * 期待結果:
	 * - Column Reorderで利用しない既定pluginは除外され、その他のpluginだけが維持される。
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
	 * 概要:
	 * - Destination Resolutionを開始時に生成できなくても、最初のmoveで再解決して論理移動先へ接続できることを確認する。
	 *
	 * 事前条件:
	 * - 第二段階Target Resolutionは開始可能である。
	 * - DnD開始時はDestination Resolverを生成できないが、最初のmoveでは生成できる。
	 *
	 * 操作:
	 * - before start、start、moveの順に物理DnD通知を行う。
	 *
	 * 期待結果:
	 * - move時にResolver生成が再試行され、解決された論理列間境界がDnD Interactionへ渡される。
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
	 * 概要:
	 * - 第一段階後のTable変化で第二段階が成立しない場合にColumn DnD Sessionを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - active DnD成立直前のTarget Resolutionが利用不能を返す。
	 *
	 * 操作:
	 * - before start通知後にstart通知を行う。
	 *
	 * 期待結果:
	 * - 入力Targetが第二段階解決へ渡される。
	 * - 物理DnD開始は抑止され、DnD InteractionのSessionは開始されない。
	 */
	it( 'when second-stage target resolution becomes unavailable, should prevent the physical drag and not start a column session', () => {
		resolveColumnReorderTargetMock.mockReturnValue( { status: 'unavailable' } );
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		const preventDefault = jest.fn();

		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart();

		expect( resolveColumnReorderTargetMock ).toHaveBeenCalledWith( target );
		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Toolbar表示後に物理列配置が失われても、active DnD成立直前の現在DOMでSession開始を拒否することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Target Resolutionは論理列の開始を許可する。
	 * - 開始元セルを含む現在TableのColumn DnD Layout Availabilityはunavailableである。
	 *
	 * 操作:
	 * - 物理DnDのbefore start通知を行った後にstart通知を行う。
	 *
	 * 期待結果:
	 * - 現在の開始元TableがfreshなLayout Availability評価へ渡される。
	 * - 物理DnD開始が抑止され、Session、水平Auto Scroll、移動先解決は開始されない。
	 */
	it( 'when the current column layout is unavailable before active drag, should reject every column DnD side effect', () => {
		resolveColumnDndLayoutAvailabilityMock.mockReturnValue( 'unavailable' );
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		const table = document.createElement( 'table' );
		const row = document.createElement( 'tr' );
		const sourceElement = document.createElement( 'td' );
		const preventDefault = jest.fn();
		row.appendChild( sourceElement );
		table.appendChild( row );

		provider.onBeforeDragStart( {
			operation: { source: { data: target, element: sourceElement } },
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart( {
			operation: { source: { element: sourceElement } },
		} as unknown as DragStartEvent );

		expect( resolveColumnDndLayoutAvailabilityMock ).toHaveBeenCalledWith( table );
		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.start ).not.toHaveBeenCalled();
		expect( mockHorizontalAutoScrollStart ).not.toHaveBeenCalled();
		expect( destinationResolverFactoryMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Session開始前に正常終了した物理DnD試行を意味的な終了処理へ接続しないことを確認する。
	 *
	 * 事前条件:
	 * - 第二段階解決は成立しているが、物理DnD開始通知はまだ行われていない。
	 *
	 * 操作:
	 * - canceledではない終了通知を行う。
	 *
	 * 期待結果:
	 * - Sessionのcompleteとcancelはどちらも要求されない。
	 */
	it( 'when a physical drag ends normally before the column session starts, should not complete or cancel a session', () => {
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		provider.onDragEnd( { canceled: false } as unknown as DragEndEvent );

		expect( dndInteractionMock.complete ).not.toHaveBeenCalled();
		expect( dndInteractionMock.cancel ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Session開始前に取消終了した物理DnD試行を意味的な終了処理へ接続しないことを確認する。
	 *
	 * 事前条件:
	 * - 第二段階解決は成立しているが、物理DnD開始通知はまだ行われていない。
	 *
	 * 操作:
	 * - canceledな終了通知を行う。
	 *
	 * 期待結果:
	 * - Sessionのcompleteとcancelはどちらも要求されない。
	 */
	it( 'when a physical drag is canceled before the column session starts, should not complete or cancel a session', () => {
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		provider.onDragEnd( { canceled: true } as unknown as DragEndEvent );

		expect( dndInteractionMock.complete ).not.toHaveBeenCalled();
		expect( dndInteractionMock.cancel ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Column Reorder Mode離脱時に未使用の解決結果とDraggable登録を即時破棄することを確認する。
	 *
	 * 事前条件:
	 * - 列modeで第二段階解決済みの開始対象とDraggable登録が存在する。
	 *
	 * 操作:
	 * - React再描画を行わずColumn Reorder Modeから離脱する。
	 *
	 * 期待結果:
	 * - Draggableが破棄され、離脱前の解決結果ではSessionを開始できない。
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

		if ( mockActiveDraggableRef === null ) {
			throw new Error( 'ColumnInput activeDraggable ref was not captured.' );
		}
		const destroy = jest.fn();
		mockActiveDraggableRef.current = { destroy } as unknown as Draggable;

		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		provider.onDragStart();

		expect( destroy ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 物理DnDの取消終了をColumn DnD Sessionのcancelへ変換することを確認する。
	 *
	 * 事前条件:
	 * - 物理DnD開始通知によってColumn DnD Sessionが開始されている。
	 *
	 * 操作:
	 * - canceledなend通知を行う。
	 *
	 * 期待結果:
	 * - completeではなくcancelだけが要求される。
	 */
	it( 'when the physical drag ends as canceled, should cancel the column session without completing it', () => {
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart();

		provider.onDragEnd( { canceled: true } as unknown as DragEndEvent );

		expect( dndInteractionMock.cancel ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.complete ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Session開始後の一時状態cleanupが、後続の意味的な終了処理を妨げないことを確認する。
	 *
	 * 事前条件:
	 * - Column Reorder Modeで列DnD Sessionが開始されている。
	 *
	 * 操作:
	 * - mode離脱によるcleanup後に物理DnDを正常終了する。
	 *
	 * 期待結果:
	 * - 開始済みSessionのcompleteが1回要求される。
	 */
	it( 'when transient state is cleared after the column session starts, should still complete the session on drag end', () => {
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart();
		act( () => {
			reorderMode.select( 'column', 'table-1' );
		} );

		provider.onDragEnd( { canceled: false } as unknown as DragEndEvent );

		expect( dndInteractionMock.complete ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - 終了済みの物理DnD試行情報を次の試行へ持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - 一回目の物理DnDはSessionを開始して正常終了している。
	 * - 二回目は第二段階解決後、Session開始前に終了する。
	 *
	 * 操作:
	 * - 二回目の物理DnDを正常終了する。
	 *
	 * 期待結果:
	 * - 一回目の開始成立情報ではcompleteもcancelも要求されない。
	 */
	it( 'when a later physical column drag ends before session start, should not reuse the prior attempt state', () => {
		render( <ColumnDnd tableIdentity="table-1">{ () => <div /> }</ColumnDnd> );
		const provider = getProviderProps();
		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart();
		provider.onDragEnd( { canceled: false } as unknown as DragEndEvent );

		jest.clearAllMocks();
		provider.onBeforeDragStart( {
			operation: { source: { data: target } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		provider.onDragEnd( { canceled: false } as unknown as DragEndEvent );

		expect( dndInteractionMock.complete ).not.toHaveBeenCalled();
		expect( dndInteractionMock.cancel ).not.toHaveBeenCalled();
	} );
} );
