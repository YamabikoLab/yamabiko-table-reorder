/**
 * 行並び替えのDnD境界が、物理DnDのLifecycleと現在位置をDnD Interactionへ正しく接続することを確認する。
 *
 * Presentationは独立責務として検証し、この境界では開始可否、開始成立、移動先境界の解決、終了種別、
 * および行並び替え無効化時を含む一時登録破棄だけを検証する。
 */

import type { BeforeDragStartEvent, DragEndEvent, DragMoveEvent, Draggable } from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { rowDndInteraction } from './dnd-interaction';
import { RowDnd } from './dnd';

jest.mock( './dnd-interaction', () => ( {
	rowDndInteraction: {
		prepareStart: jest.fn(),
		start: jest.fn(),
		updateDestination: jest.fn(),
		complete: jest.fn(),
		cancel: jest.fn(),
	},
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

/** DnD Engine境界へ渡された最新のcallback群を取得する。 */
const getProviderProps = () => {
	const props = dragDropProviderMock.mock.calls.at( -1 )?.[ 0 ];
	if ( ! props ) {
		throw new Error( 'DragDropProvider props were not captured.' );
	}
	return props;
};

/** 40px高の2行を持つ移動先判定用Tableを作成する。 */
const createTableRows = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const rows = Array.from( { length: 2 }, ( _, index ) => {
		const row = document.createElement( 'tr' );
		row.appendChild( document.createElement( 'td' ) );
		jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue( {
			top: index * 40,
			bottom: ( index + 1 ) * 40,
			left: 0,
			right: 100,
			width: 100,
			height: 40,
			x: 0,
			y: index * 40,
			toJSON: () => ( {} ),
		} );
		return row;
	} );
	tbody.append( ...rows );
	table.appendChild( tbody );
	jest.spyOn( tbody, 'getBoundingClientRect' ).mockReturnValue( {
		top: 0,
		bottom: 80,
		left: 0,
		right: 100,
		width: 100,
		height: 80,
		x: 0,
		y: 0,
		toJSON: () => ( {} ),
	} );
	return rows;
};

describe( 'Row DnD engine connection', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		activeDraggableRef = null;
	} );

	/**
	 * 概要:
	 * - 開始可否判定で開始不能となった物理DnDを成立させないことを確認する。
	 * 事前条件:
	 * - DnD Interactionが現在のTable構造では開始不能と判定する。
	 * 操作:
	 * - DnD Engineから開始前通知を受ける。
	 * 期待結果:
	 * - 物理DnD開始が取消され、DnD Interactionのstartは呼ばれない。
	 */
	it( 'when prepareStart rejects the source, should prevent the physical drag from starting', () => {
		interactionMock.prepareStart.mockReturnValue( null );
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		const preventDefault = jest.fn();
		const source = { tableIdentity: 'table-1', sourceRowIndex: 1 };

		props.onBeforeDragStart( {
			operation: { source: { data: source } },
			preventDefault,
		} as unknown as BeforeDragStartEvent );
		props.onDragStart();

		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 開始可否判定で確認した行制約を物理DnD開始成立後のSession開始へ引き継ぐことを確認する。
	 * 事前条件:
	 * - DnD Interactionが開始可能と判定し、その時点の行制約を返す。
	 * 操作:
	 * - 開始前通知の後に物理DnD開始通知を受ける。
	 * 期待結果:
	 * - 同じ移動対象と開始可否判定時の行制約でstartが1回呼ばれる。
	 */
	it( 'when physical drag starts after an accepted preparation, should start the row DnD session with the prepared constraints', () => {
		const constraints = { rowCount: 3, blockedBoundaries: [ 2 ] };
		interactionMock.prepareStart.mockReturnValue( constraints );
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		const source = { tableIdentity: 'table-1', sourceRowIndex: 1 };

		props.onBeforeDragStart( {
			operation: { source: { data: source } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		props.onDragStart();

		expect( interactionMock.start ).toHaveBeenCalledWith( source, constraints );
	} );

	/**
	 * 概要:
	 * - 行並び替えを無効化した時点で未完了の開始準備とDraggable登録を破棄することを確認する。
	 * 事前条件:
	 * - 開始可否確認済みの開始準備とDraggable登録が存在する。
	 * 操作:
	 * - enabled=falseへ切り替える。
	 * 期待結果:
	 * - Draggableが破棄され、無効化前の開始準備ではstartが呼ばれない。
	 */
	it( 'when row reordering becomes disabled, should discard the pending preparation and active draggable', () => {
		interactionMock.prepareStart.mockReturnValue( { rowCount: 3, blockedBoundaries: [] } );
		const { rerender } = render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		props.onBeforeDragStart( {
			operation: { source: { data: { tableIdentity: 'table-1', sourceRowIndex: 1 } } },
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
	 * - DnD開始時の論理配置を基準に現在ポインター位置から移動先境界を解決することを確認する。
	 * 事前条件:
	 * - 2行目の上半分を現在ポインターが指している。
	 * 操作:
	 * - 物理DnD開始後に移動通知を受ける。
	 * 期待結果:
	 * - 2行目直前の境界である1がDnD Interactionへ通知される。
	 */
	it( 'when pointer movement targets the upper half of a row, should update the destination to the boundary before that row', () => {
		const rows = createTableRows();
		interactionMock.prepareStart.mockReturnValue( { rowCount: 2, blockedBoundaries: [] } );
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		props.onBeforeDragStart( {
			operation: { source: { data: { tableIdentity: 'table-1', sourceRowIndex: 0 } } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );
		props.onDragStart( { operation: { source: { element: rows[ 0 ] } } } );
		props.onDragMove( {
			operation: { source: { element: rows[ 0 ] } },
			nativeEvent: { clientX: 10, clientY: 50 },
		} as unknown as DragMoveEvent );

		expect( interactionMock.updateDestination ).toHaveBeenCalledWith( 1 );
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
