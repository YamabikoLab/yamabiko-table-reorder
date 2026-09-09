/**
 * Column DnD Engine Integrationが、YTR側の水平自動スクロールをDnD Sessionへ正しく接続することを確認する。
 *
 * 水平スクロールそのものの判定や進行は専用責務のテストへ委ね、この境界ではスクロール後の移動先再解決とDnD終了時の破棄だけを検証する。
 */

import {
	type BeforeDragStartEvent,
	type DragEndEvent,
	type DragMoveEvent,
	type DragStartEvent,
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { createColumnDestinationResolver } from '@/reorder/column-reorder/integration/destination-resolution';
import {
	createColumnHorizontalAutoScroll,
	type ColumnPointerPosition,
} from '@/reorder/column-reorder/integration/horizontal-auto-scroll';
import { columnDndInteraction } from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { columnReorderTargetResolution } from '@/reorder/column-reorder/responsibilities/target-resolution';
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

jest.mock( '@/reorder/column-reorder/integration/destination-resolution', () => ( {
	createColumnDestinationResolver: jest.fn(),
} ) );

jest.mock( '@/reorder/column-reorder/integration/horizontal-auto-scroll', () => ( {
	createColumnHorizontalAutoScroll: jest.fn(),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/dnd-interaction', () => ( {
	columnDndInteraction: {
		start: jest.fn(),
		updateDestination: jest.fn(),
		complete: jest.fn(),
		cancel: jest.fn(),
	},
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
const autoScrollFactoryMock = createColumnHorizontalAutoScroll as jest.MockedFunction<
	typeof createColumnHorizontalAutoScroll
>;
const targetResolutionMock = columnReorderTargetResolution as jest.Mocked<
	typeof columnReorderTargetResolution
>;
const dndInteractionMock = columnDndInteraction as jest.Mocked< typeof columnDndInteraction >;

/** 現在のDragDropProviderへ渡された物理DnD Lifecycle処理を取得する。 */
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

describe( 'Column DnD horizontal auto scroll integration', () => {
	let onAutoScroll: ( position: ColumnPointerPosition ) => void;
	const autoScrollStart = jest.fn();
	const autoScrollUpdatePointer = jest.fn();
	const autoScrollStop = jest.fn();

	beforeEach( () => {
		jest.clearAllMocks();
		targetResolutionMock.resolve.mockReturnValue( resolvedTarget );
		autoScrollFactoryMock.mockImplementation( ( onScroll ) => {
			onAutoScroll = onScroll;
			return {
				start: autoScrollStart,
				updatePointer: autoScrollUpdatePointer,
				stop: autoScrollStop,
			};
		} );
	} );

	/**
	 * 水平自動スクロールでTableの画面位置だけが変化した場合も、現在の移動先を更新できることを確認する。
	 *
	 * 事前条件:
	 * - Column DnD Sessionが開始している。
	 * - 最新のポインター移動からDestination Resolutionが利用できる。
	 *
	 * 操作:
	 * - 通常のmove通知後、ポインターを動かさずに水平自動スクロール完了を通知する。
	 *
	 * 期待結果:
	 * - 最新の物理入力位置を使ってDestination Resolutionが再実行される。
	 * - 再解決した論理列間境界がDnD Interactionへ反映される。
	 */
	it( 'when horizontal auto scroll moves the table without a new pointer move, should resolve and update the destination again', () => {
		const resolver = {
			resolve: jest.fn().mockReturnValue( 2 ),
		};
		destinationResolverFactoryMock.mockReturnValue( resolver );
		render(
			<ColumnDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</ColumnDnd>
		);
		const provider = getProviderProps();
		const sourceElement = document.createElement( 'td' );
		const moveEvent = {
			nativeEvent: { clientX: 190, clientY: 50 },
			operation: {
				source: {
					element: sourceElement,
				},
			},
		} as unknown as DragMoveEvent;

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
		provider.onDragMove( moveEvent );
		resolver.resolve.mockClear();
		dndInteractionMock.updateDestination.mockClear();

		onAutoScroll( { clientX: 190, clientY: 50 } );

		expect( resolver.resolve ).toHaveBeenCalledTimes( 1 );
		expect( resolver.resolve ).toHaveBeenCalledWith( moveEvent );
		expect( dndInteractionMock.updateDestination ).toHaveBeenCalledWith( 2 );
	} );

	/**
	 * 物理DnD終了時に水平自動スクロールのSession状態を破棄することを確認する。
	 *
	 * 事前条件:
	 * - Column DnD Session開始時に水平自動スクロールが対象Tableへ接続されている。
	 *
	 * 操作:
	 * - 物理DnDを正常終了する。
	 *
	 * 期待結果:
	 * - 水平自動スクロールの停止が要求される。
	 * - Column DnD Sessionは通常どおりcompleteされる。
	 */
	it( 'when the physical column drag ends, should stop horizontal auto scroll before completing the session', () => {
		destinationResolverFactoryMock.mockReturnValue( {
			resolve: jest.fn().mockReturnValue( 2 ),
		} );
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
		autoScrollStop.mockClear();

		provider.onDragEnd( { canceled: false } as unknown as DragEndEvent );

		expect( autoScrollStop ).toHaveBeenCalledTimes( 1 );
		expect( dndInteractionMock.complete ).toHaveBeenCalledTimes( 1 );
	} );
} );
