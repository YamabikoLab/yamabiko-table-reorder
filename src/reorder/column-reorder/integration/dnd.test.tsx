/**
 * Column DnD Engine Integrationが、二段階Target Resolutionを経て物理DnD LifecycleをColumn DnD Interactionへ接続することを確認する。
 *
 * dnd-kit自体の挙動は再現せず、第二段階解決、Session開始、論理移動先、complete / cancel変換、
 * DnD Engine Auto Scrollの無効化、および無効化時に開始前状態を持ち越さないLifecycleを責務境界から観測できる振る舞いとして検証する。
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
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { columnDndInteraction } from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';
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

jest.mock( '@/reorder/column-reorder/responsibilities/input', () => ( {
	ColumnInput: ( props: { children: ( handler: () => void ) => ReactNode } ) =>
		props.children( () => undefined ),
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
	const call = dragDropProviderMock.mock.calls[ dragDropProviderMock.mock.calls.length - 1 ];
	const props = call?.[ 0 ];

	if ( ! props ) {
		throw new Error( 'ColumnDnd did not render DragDropProvider.' );
	}

	return props as {
		plugins: ( defaults: unknown[] ) => unknown[];
		onBeforeDragStart: ( event: BeforeDragStartEvent ) => void;
		onDragStart: ( event?: DragStartEvent ) => void;
		onDragMove: ( event: DragMoveEvent ) => void;
		onDragEnd: ( event: DragEndEvent ) => void;
	};
};

/** テストで利用するColumn Reorder Target。 */
const target = {
	tableIdentity: 'table-1',
	sourceColumnIndex: 1,
};

/** 第二段階解決が成立する既定結果。 */
const resolvedTarget = {
	status: 'resolved' as const,
	target,
	initialConstraints: {
		columnCount: 4,
		blockedBoundaries: [],
	},
};

describe( 'Column DnD Engine Integration', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		targetResolutionMock.resolve.mockReturnValue( resolvedTarget );
		destinationResolverFactoryMock.mockReturnValue( {
			resolve: jest.fn().mockReturnValue( 3 ),
		} );
	} );

	/**
	 * 第二段階解決が成立した物理DnDをColumn DnD Sessionへ接続し、論理移動先だけを進行へ渡すことを確認する。
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
	 * - 正常endはcompleteへ変換される。
	 */
	it( 'when second-stage resolution succeeds and the physical drag completes, should connect the resolved target, logical destination, and complete lifecycle', () => {
		render(
			<ColumnDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</ColumnDnd>
		);
		const provider = getProviderProps();
		const sourceElement = document.createElement( 'td' );
		const preventDefault = jest.fn();

		provider.onBeforeDragStart( {
			operation: {
				source: {
					data: target,
				},
			},
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart( {
			operation: {
				source: {
					element: sourceElement,
				},
			},
		} as unknown as DragStartEvent );
		provider.onDragMove( {
			operation: {
				source: {
					element: sourceElement,
				},
			},
		} as unknown as DragMoveEvent );
		provider.onDragEnd( { canceled: false } as unknown as DragEndEvent );

		expect( preventDefault ).not.toHaveBeenCalled();
		expect( targetResolutionMock.resolve ).toHaveBeenCalledWith( target );
		expect( dndInteractionMock.start ).toHaveBeenCalledWith(
			resolvedTarget.target,
			resolvedTarget.initialConstraints
		);
		expect( dndInteractionMock.updateDestination ).toHaveBeenCalledWith( 3 );
		expect( dndInteractionMock.complete ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.cancel ).not.toHaveBeenCalled();
	} );

	/**
	 * Column DnD Engine IntegrationがDnD EngineのAuto Scrollを利用しないことを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineの既定pluginにはAutoScrollerとその他の標準pluginが含まれる。
	 *
	 * 操作:
	 * - Column DnD境界のplugin構成を要求する。
	 *
	 * 期待結果:
	 * - 既定AutoScrollerは除外され、Column Reorderの物理スクロールと競合しない。
	 * - その他の除外対象外pluginだけが維持される。
	 */
	it( 'when DnD engine plugins are configured, should disable engine auto scroll for column reorder', () => {
		render(
			<ColumnDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</ColumnDnd>
		);
		const provider = getProviderProps();
		const preservedPlugin = { name: 'preserved' };

		const plugins = provider.plugins( [
			Cursor,
			PreventSelection,
			Feedback,
			AutoScroller,
			preservedPlugin,
		] );

		expect( plugins ).toEqual( [ preservedPlugin ] );
	} );

	/**
	 * Destination Resolutionを開始時に生成できなくても、最初のmoveで再解決して論理移動先へ接続できることを確認する。
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
	it( 'when destination resolution is unavailable at drag start but available on move, should retry once and forward the resolved logical boundary', () => {
		const resolver = {
			resolve: jest.fn().mockReturnValue( 2 ),
		};
		destinationResolverFactoryMock.mockReturnValueOnce( null ).mockReturnValueOnce( resolver );
		render(
			<ColumnDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</ColumnDnd>
		);
		const provider = getProviderProps();
		const sourceElement = document.createElement( 'td' );

		provider.onBeforeDragStart( {
			operation: {
				source: {
					data: target,
				},
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart( {
			operation: {
				source: {
					element: sourceElement,
				},
			},
		} as unknown as DragStartEvent );
		const moveEvent = {
			operation: {
				source: {
					element: sourceElement,
				},
			},
		} as unknown as DragMoveEvent;
		provider.onDragMove( moveEvent );

		expect( destinationResolverFactoryMock ).toHaveBeenCalledTimes( 2 );
		expect( resolver.resolve ).toHaveBeenCalledWith( moveEvent );
		expect( dndInteractionMock.updateDestination ).toHaveBeenCalledWith( 2 );
	} );

	/**
	 * 第一段階後のTable変化で第二段階が成立しない場合にColumn DnD Sessionを開始しないことを確認する。
	 *
	 * 事前条件:
	 * - active DnD成立直前のTarget Resolutionが利用不能を返す。
	 *
	 * 操作:
	 * - before start通知後にstart通知を行う。
	 *
	 * 期待結果:
	 * - 物理DnD開始は抑止され、DnD InteractionのSessionは開始されない。
	 */
	it( 'when second-stage target resolution becomes unavailable, should prevent the physical drag and not start a column session', () => {
		targetResolutionMock.resolve.mockReturnValue( { status: 'unavailable' } );
		render(
			<ColumnDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</ColumnDnd>
		);
		const provider = getProviderProps();
		const preventDefault = jest.fn();

		provider.onBeforeDragStart( {
			operation: {
				source: {
					data: target,
				},
			},
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart( {
			operation: {
				source: {},
			},
		} as unknown as DragStartEvent );

		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 物理DnDの取消終了をColumn DnD Sessionのcancelへ変換することを確認する。
	 *
	 * 事前条件:
	 * - 第二段階解決が成立しColumn DnD Sessionが開始している。
	 *
	 * 操作:
	 * - canceledなend通知を行う。
	 *
	 * 期待結果:
	 * - completeではなくcancelだけが要求される。
	 */
	it( 'when the physical drag ends as canceled, should cancel the column session without completing it', () => {
		render(
			<ColumnDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</ColumnDnd>
		);
		const provider = getProviderProps();

		provider.onBeforeDragStart( {
			operation: {
				source: {
					data: target,
				},
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		provider.onDragStart( {
			operation: {
				source: {},
			},
		} as unknown as DragStartEvent );
		provider.onDragEnd( { canceled: true } as unknown as DragEndEvent );

		expect( dndInteractionMock.cancel ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.complete ).not.toHaveBeenCalled();
	} );

	/**
	 * Column Reorder無効化後の再有効化で、無効化前の開始候補を持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - 第二段階Target Resolutionだけが成立し、まだSession開始通知は行われていない。
	 *
	 * 操作:
	 * - Column Reorderを無効化してから再度有効化し、新しい入力なしでstart通知を行う。
	 *
	 * 期待結果:
	 * - 無効化前の解決結果ではColumn DnD Sessionを開始できない。
	 */
	it( 'when column reorder is disabled and enabled again, should not start from the candidate resolved before disablement', () => {
		const { rerender } = render(
			<ColumnDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</ColumnDnd>
		);
		let provider = getProviderProps();

		provider.onBeforeDragStart( {
			operation: {
				source: {
					data: target,
				},
			},
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		rerender(
			<ColumnDnd enabled={ false } tableIdentity="table-1">
				{ () => <div /> }
			</ColumnDnd>
		);
		rerender(
			<ColumnDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</ColumnDnd>
		);
		provider = getProviderProps();
		provider.onDragStart( {
			operation: {
				source: {},
			},
		} as unknown as DragStartEvent );

		expect( dndInteractionMock.start ).not.toHaveBeenCalled();
	} );
} );
