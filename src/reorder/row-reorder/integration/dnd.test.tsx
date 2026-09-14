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

let mockActiveDraggableRef: { current: Draggable | null } | null = null;
const mockRowInputPointerDown = jest.fn();

jest.mock( '@/reorder/row-reorder/responsibilities/input', () => ( {
	RowInput: ( props: {
		activeDraggable: { current: Draggable | null };
		children: ( handler: ( event: unknown ) => void ) => ReactNode;
	} ) => {
		mockActiveDraggableRef = props.activeDraggable;
		return props.children( mockRowInputPointerDown );
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
		mockActiveDraggableRef = null;
		destinationResolverFactoryMock.mockReturnValue( null );
		resetReorderMode();
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * 概要:
	 * - 行DnDでは縦方向だけAuto Scrollを許可することを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineの既定plugin群にAutoScrollerが含まれる。
	 *
	 * 操作:
	 * - Row DnD境界を描画し、plugin構成を解決する。
	 *
	 * 期待結果:
	 * - 横方向のAuto Scrollは無効化される。
	 * - 縦方向のAuto Scrollは既定の有効範囲で利用できる。
	 * - 既定AutoScrollerは重複して残らない。
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
	 * 概要:
	 * - Reorder Modeをevent-timeで確認し、行modeの入力だけをRow Inputへ渡すことを確認する。
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
		expect( mockRowInputPointerDown ).not.toHaveBeenCalled();

		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		pointerDown( event );
		expect( mockRowInputPointerDown ).toHaveBeenCalledWith( event );
	} );

	/**
	 * 概要:
	 * - Target Resolutionで開始不能となった物理DnDを成立させないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Target Resolutionが現在のTable構造では利用不能と解決する。
	 *
	 * 操作:
	 * - DnD Engineから開始前通知を受ける。
	 *
	 * 期待結果:
	 * - 対象Targetが現在制約で再解決される。
	 * - 物理DnD開始が取消され、DnD Interactionのstartは呼ばれない。
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

		expect( targetResolutionMock.resolve ).toHaveBeenCalledWith( target );
		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 解決済みTargetと開始時制約を物理DnD開始成立後のSession開始へ引き継ぐことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Target Resolutionが開始可能な解決結果を返す。
	 *
	 * 操作:
	 * - 開始前通知の後に物理DnD開始通知を受ける。
	 *
	 * 期待結果:
	 * - 解決結果のTargetと開始時制約でstartが1回呼ばれる。
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
	 * 概要:
	 * - Row Reorder Mode離脱時に未使用の解決結果とDraggable登録を即時破棄することを確認する。
	 *
	 * 事前条件:
	 * - 行modeで解決済みの開始対象とDraggable登録が存在する。
	 *
	 * 操作:
	 * - React再描画を行わずRow Reorder Modeから離脱する。
	 *
	 * 期待結果:
	 * - Draggableが破棄され、離脱前の解決結果ではstartが呼ばれない。
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

		if ( mockActiveDraggableRef === null ) {
			throw new Error( 'RowInput activeDraggable ref was not captured.' );
		}
		const destroy = jest.fn();
		mockActiveDraggableRef.current = { destroy } as unknown as Draggable;

		act( () => {
			reorderMode.select( 'row', 'table-1' );
		} );
		props.onDragStart();

		expect( destroy ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - DnD接続境界終了時にDraggable登録を破棄することを確認する。
	 *
	 * 事前条件:
	 * - DnD境界に一時Draggableが登録されている。
	 *
	 * 操作:
	 * - RowDndをunmountする。
	 *
	 * 期待結果:
	 * - Draggableが破棄され、境界終了後へ一時登録を持ち越さない。
	 */
	it( 'when the row DnD connection unmounts, should destroy the active draggable', () => {
		const { unmount } = render( <RowDnd tableIdentity="table-1">{ () => <div /> }</RowDnd> );
		if ( mockActiveDraggableRef === null ) {
			throw new Error( 'RowInput activeDraggable ref was not captured.' );
		}
		const destroy = jest.fn();
		mockActiveDraggableRef.current = { destroy } as unknown as Draggable;

		unmount();
		expect( destroy ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - 移動先解決境界が返した論理境界をDnD Interactionへ接続することを確認する。
	 *
	 * 事前条件:
	 * - DnD開始時に移動先解決境界が成立し、現在位置から境界1を返す。
	 *
	 * 操作:
	 * - 物理DnD開始後に移動通知を受ける。
	 *
	 * 期待結果:
	 * - 開始元要素でDestination Resolverが生成される。
	 * - 解決済みの境界1がDnD Interactionへ通知される。
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

		expect( destinationResolverFactoryMock ).toHaveBeenCalledWith( sourceElement );
		expect( resolve ).toHaveBeenCalledWith( moveEvent );
		expect( interactionMock.updateDestination ).toHaveBeenCalledWith( 1 );
	} );

	/**
	 * 概要:
	 * - 現在位置から有効な移動先を解決できない場合にDnD Interactionの移動先をnullへ更新することを確認する。
	 *
	 * 事前条件:
	 * - DnD開始時に移動先解決境界が成立している。
	 *
	 * 操作:
	 * - 有効な移動先がない物理入力位置へ移動する。
	 *
	 * 期待結果:
	 * - DnD Interactionへnullが通知される。
	 */
	it( 'when destination resolution returns no destination, should clear the DnD interaction destination', () => {
		const sourceElement = document.createElement( 'tr' );
		const resolve = jest.fn().mockReturnValue( null );
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
		expect( interactionMock.updateDestination ).toHaveBeenCalledWith( null );
	} );

	/**
	 * 概要:
	 * - DnD開始時にDestination Resolverを生成できない場合も、最初の移動通知で生成を再試行できることを確認する。
	 *
	 * 事前条件:
	 * - DnD開始時はDestination Resolverを生成できない。
	 * - 最初のmove時には開始元要素からResolverを生成できる。
	 *
	 * 操作:
	 * - 物理DnD開始後に最初の移動通知を受ける。
	 *
	 * 期待結果:
	 * - move時にResolver生成が再試行される。
	 * - 解決された論理境界がDnD Interactionへ通知される。
	 */
	it( 'when destination resolution was unavailable at drag start, should create it from the first drag move', () => {
		const sourceElement = document.createElement( 'tr' );
		const resolve = jest.fn().mockReturnValue( 2 );
		destinationResolverFactoryMock.mockReturnValueOnce( null ).mockReturnValueOnce( { resolve } );
		const { target } = mockResolvedTarget();
		render( <RowDnd tableIdentity="table-1">{ () => <div /> }</RowDnd> );
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

		expect( destinationResolverFactoryMock ).toHaveBeenCalledTimes( 2 );
		expect( destinationResolverFactoryMock ).toHaveBeenLastCalledWith( sourceElement );
		expect( resolve ).toHaveBeenCalledWith( moveEvent );
		expect( interactionMock.updateDestination ).toHaveBeenCalledWith( 2 );
	} );

	/**
	 * 概要:
	 * - 物理DnDのcancelと通常終了をSessionの取消と確定へ分岐して接続することを確認する。
	 *
	 * 操作:
	 * - canceledな終了通知と通常終了通知をそれぞれ行う。
	 *
	 * 期待結果:
	 * - canceled時はcancelだけが呼ばれcompleteは呼ばれない。
	 * - 通常終了時はcompleteだけが呼ばれcancelは呼ばれない。
	 */
	it( 'when physical drag ends, should cancel a canceled drag and complete a normal drag', () => {
		render( <RowDnd tableIdentity="table-1">{ () => <div /> }</RowDnd> );
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
