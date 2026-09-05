/**
 * 行並び替えのDnD境界が、物理DnDのLifecycleと現在位置をDnD Interactionへ正しく接続することを確認する。
 *
 * DnD Interaction本体の状態遷移は重複して検証せず、開始可否、開始成立、移動先境界の解決、
 * 終了種別、および行並び替え無効化時を含む一時登録破棄だけを検証する。
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

jest.mock( './presentation/insertion-line', () => ( {
	RowInsertionLine: () => null,
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

const getProviderProps = () => {
	const props = dragDropProviderMock.mock.calls.at( -1 )?.[ 0 ];
	if ( ! props ) {
		throw new Error( 'DragDropProvider props were not captured.' );
	}
	return props;
};

const createTableRows = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const first = document.createElement( 'tr' );
	const second = document.createElement( 'tr' );
	first.appendChild( document.createElement( 'td' ) );
	second.appendChild( document.createElement( 'td' ) );
	tbody.append( first, second );
	table.appendChild( tbody );
	return { first, second };
};

describe( 'Row DnD engine connection', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		activeDraggableRef = null;
	} );

	/**
	 * 概要:
	 * - 開始可否判定で開始不能となった物理DnDを成立させないことを確認する。
	 *
	 * 事前条件:
	 * - DnD Interactionが現在のTable構造では開始不能と判定する。
	 *
	 * 操作:
	 * - DnD Engineから開始前通知を受ける。
	 *
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

		expect( interactionMock.prepareStart ).toHaveBeenCalledWith( source );
		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 開始可否判定で確認した行制約を物理DnD開始成立後のSession開始へ引き継ぐことを確認する。
	 *
	 * 事前条件:
	 * - DnD Interactionが開始可能と判定し、その時点の行制約を返す。
	 *
	 * 操作:
	 * - 開始前通知の後に物理DnD開始通知を受ける。
	 *
	 * 期待結果:
	 * - 同じ移動対象と開始可否判定時の行制約でDnD Interactionのstartが1回呼ばれる。
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

		expect( interactionMock.start ).toHaveBeenCalledTimes( 1 );
		expect( interactionMock.start ).toHaveBeenCalledWith( source, constraints );
	} );

	/**
	 * 概要:
	 * - 行並び替えを無効化した時点で、未完了の開始準備とDraggable登録を破棄することを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えが有効で、開始可否確認済みの開始準備とDraggable登録が存在する。
	 *
	 * 操作:
	 * - 同じRowDndをenabled=falseへ切り替えた後、物理DnD開始通知を受ける。
	 *
	 * 期待結果:
	 * - Draggableが破棄され、無効化前の開始準備ではDnD Interactionのstartが呼ばれない。
	 */
	it( 'when row reordering becomes disabled, should discard the pending preparation and active draggable', () => {
		const constraints = { rowCount: 3, blockedBoundaries: [ 2 ] };
		interactionMock.prepareStart.mockReturnValue( constraints );
		const { rerender } = render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();
		const source = { tableIdentity: 'table-1', sourceRowIndex: 1 };
		const destroy = jest.fn();

		props.onBeforeDragStart( {
			operation: { source: { data: source } },
			preventDefault: jest.fn(),
		} as unknown as BeforeDragStartEvent );

		if ( activeDraggableRef === null ) {
			throw new Error( 'RowInput activeDraggable ref was not captured.' );
		}
		activeDraggableRef.current = { destroy } as unknown as Draggable;

		rerender(
			<RowDnd enabled={ false } tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const disabledProps = getProviderProps();
		disabledProps.onDragStart();

		expect( destroy ).toHaveBeenCalledTimes( 1 );
		expect( activeDraggableRef.current ).toBeNull();
		expect( interactionMock.start ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 現在ポインター位置から対象Tableのtbody直下行に対する0-based移動先境界を解決することを確認する。
	 *
	 * 事前条件:
	 * - 2行目の上半分を現在ポインターが指している。
	 *
	 * 操作:
	 * - DnD Engineから移動通知を受ける。
	 *
	 * 期待結果:
	 * - 2行目直前の境界である1がDnD Interactionへ通知される。
	 */
	it( 'when pointer movement targets the upper half of a direct tbody row, should update the destination to the boundary before that row', () => {
		const { first, second } = createTableRows();
		Object.defineProperty( first.ownerDocument, 'elementsFromPoint', {
			configurable: true,
			value: jest.fn( () => [ second ] ),
		} );
		jest.spyOn( second, 'getBoundingClientRect' ).mockReturnValue( {
			top: 100,
			height: 40,
			bottom: 140,
			left: 0,
			right: 100,
			width: 100,
			x: 0,
			y: 100,
			toJSON: () => ( {} ),
		} );
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();

		props.onDragMove( {
			operation: { source: { element: first } },
			nativeEvent: { clientX: 10, clientY: 110 },
		} as unknown as DragMoveEvent );

		expect( interactionMock.updateDestination ).toHaveBeenCalledWith( 1 );
	} );

	/**
	 * 概要:
	 * - 行の下半分を指した場合は、その行の直後を移動先境界として通知することを確認する。
	 *
	 * 事前条件:
	 * - 2行目の下半分を現在ポインターが指している。
	 *
	 * 操作:
	 * - DnD Engineから移動通知を受ける。
	 *
	 * 期待結果:
	 * - 2行目直後の境界である2がDnD Interactionへ通知される。
	 */
	it( 'when pointer movement targets the lower half of a direct tbody row, should update the destination to the boundary after that row', () => {
		const { first, second } = createTableRows();
		Object.defineProperty( first.ownerDocument, 'elementsFromPoint', {
			configurable: true,
			value: jest.fn( () => [ second ] ),
		} );
		jest.spyOn( second, 'getBoundingClientRect' ).mockReturnValue( {
			top: 100,
			height: 40,
			bottom: 140,
			left: 0,
			right: 100,
			width: 100,
			x: 0,
			y: 100,
			toJSON: () => ( {} ),
		} );
		render(
			<RowDnd enabled tableIdentity="table-1">
				{ () => <div /> }
			</RowDnd>
		);
		const props = getProviderProps();

		props.onDragMove( {
			operation: { source: { element: first } },
			nativeEvent: { clientX: 10, clientY: 130 },
		} as unknown as DragMoveEvent );

		expect( interactionMock.updateDestination ).toHaveBeenCalledWith( 2 );
	} );

	/**
	 * 概要:
	 * - 物理DnDのcancelと通常終了を、行DnD Sessionの取消と確定へ分岐して接続することを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineから終了通知を受けられる。
	 *
	 * 操作:
	 * - cancel終了と通常終了をそれぞれ通知する。
	 *
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
