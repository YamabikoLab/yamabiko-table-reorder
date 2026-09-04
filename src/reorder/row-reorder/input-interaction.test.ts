/**
 * 行専用Input InteractionがPC入力条件を解釈し、開始候補行だけを一時Draggableとして所有することを検証する。
 *
 * Row Reorder Mode、DnD Engineの排他状態、対象tbodyの行所属、Touchとの入力境界、および入力一時状態のcleanupを
 * Input Interaction外部から観測できる振る舞いとして確認する。
 */

import type { DragDropManager } from '@dnd-kit/dom';
import { Draggable, PointerSensor } from '@dnd-kit/dom';

import { rowReorderMode } from '@/reorder/reorder-mode';

import { connectRowPcInputInteraction } from './input-interaction';

jest.mock( '@dnd-kit/dom', () => ( {
	Draggable: jest.fn().mockImplementation( () => ( {
		destroy: jest.fn(),
	} ) ),
	PointerSensor: {
		configure: jest.fn( ( options ) => ( { options } ) ),
	},
} ) );

jest.mock( '@/reorder/reorder-mode', () => ( {
	rowReorderMode: {
		isActive: jest.fn(),
	},
} ) );

/** DnD Engine接続のactive状態とdragend通知をテストから操作するための環境。 */
type EngineHarness = {
	manager: DragDropManager;
	setIdle: ( idle: boolean ) => void;
	emitDragEnd: () => void;
};

/** DnD Engineの排他状態とdragend購読だけを提供するテスト環境を生成する。 */
const createEngineHarness = (): EngineHarness => {
	let idle = true;
	let dragEndListener: ( () => void ) | null = null;
	const status = {} as { idle: boolean };
	Object.defineProperty( status, 'idle', {
		get: () => idle,
	} );
	const manager = {
		dragOperation: {
			status,
		},
		monitor: {
			addEventListener: jest.fn( ( name: string, listener: () => void ) => {
				if ( name === 'dragend' ) {
					dragEndListener = listener;
				}
				return (): void => {
					if ( dragEndListener === listener ) {
						dragEndListener = null;
					}
				};
			} ),
		},
	} as unknown as DragDropManager;

	return {
		manager,
		setIdle: ( nextIdle ) => {
			idle = nextIdle;
		},
		emitDragEnd: () => {
			dragEndListener?.();
		},
	};
};

/**
 * 対象tbodyと直接所有行を含むTableを生成する。
 *
 * @return 対象tbodyと2行分のTable行。
 */
const createTable = () => {
	const table = document.createElement( 'table' );
	const tableBody = document.createElement( 'tbody' );
	table.appendChild( tableBody );

	for ( let index = 0; index < 2; index++ ) {
		const row = document.createElement( 'tr' );
		row.appendChild( document.createElement( 'td' ) );
		tableBody.appendChild( row );
	}

	document.body.appendChild( table );
	return {
		table,
		tableBody,
		rows: Array.from( tableBody.rows ),
	};
};

/**
 * jsdom上でPointerEvent相当の開始入力を生成する。
 *
 * @param pointerType pointer入力の種別。
 * @param button      押下されたボタン。
 * @param isPrimary   primary pointerの場合はtrue。
 * @return pointerdownとしてdispatchできるEvent。
 */
const createPointerDown = ( pointerType = 'mouse', button = 0, isPrimary = true ): PointerEvent => {
	const event = new Event( 'pointerdown', { bubbles: true, cancelable: true } ) as PointerEvent;
	Object.defineProperties( event, {
		button: { value: button },
		isPrimary: { value: isPrimary },
		pointerType: { value: pointerType },
	} );
	return event;
};

/** DnD Engineへ登録されたDraggable生成を観測するJest代替。 */
const draggableMock = Draggable as unknown as jest.Mock;
/** Draggable専用PointerSensor設定を観測するJest代替。 */
const pointerSensorConfigureMock = PointerSensor.configure as unknown as jest.Mock;
/** 対象TableのRow Reorder Mode判定を操作するJest代替。 */
const isRowModeActiveMock = rowReorderMode.isActive as jest.MockedFunction<
	typeof rowReorderMode.isActive
>;

describe( 'Row PC Input Interaction', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		document.body.replaceChildren();
		isRowModeActiveMock.mockReturnValue( true );
	} );

	/**
	 * 概要:
	 * - 対象TableでRow Reorder Modeが有効なPC主入力から、開始候補行だけをDraggableへ登録することを確認する。
	 *
	 * 事前条件:
	 * - Table AでRow Reorder Modeが有効である。
	 * - DnD Engineはidleである。
	 *
	 * 操作:
	 * - tbody直下の2行目のセルからprimary mouseの主ボタンでpointerdownする。
	 *
	 * 期待結果:
	 * - 2行目だけがDraggableとして登録される。
	 * - 付随情報はTable Identityと0-based開始行位置だけである。
	 * - pointerdown自体はpreventDefaultされない。
	 */
	it( 'when a primary PC pointer starts on a direct row, should register only that row without preventing pointerdown', () => {
		const engine = createEngineHarness();
		const { tableBody, rows } = createTable();
		connectRowPcInputInteraction( tableBody, 'table-a', engine.manager );
		const event = createPointerDown();

		rows[ 1 ].cells[ 0 ].dispatchEvent( event );

		expect( draggableMock ).toHaveBeenCalledTimes( 1 );
		expect( draggableMock ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: {
					tableIdentity: 'table-a',
					sourceRowIndex: 1,
				},
				element: rows[ 1 ],
			} ),
			engine.manager
		);
		expect( event.defaultPrevented ).toBe( false );
	} );

	/**
	 * 概要:
	 * - Phase 4の一時Draggable自体もTouchを開始入力として受理しないことを確認する。
	 *
	 * 事前条件:
	 * - PC入力から開始候補行がDraggableへ登録されている。
	 *
	 * 操作:
	 * - Draggableへ設定されたPointerSensorの開始条件へTouch入力とmouse入力を渡す。
	 *
	 * 期待結果:
	 * - Touchは開始を拒否し、primary mouseの主ボタンは開始を許可する。
	 */
	it( 'when the temporary draggable evaluates another pointer, should reject touch at the sensor boundary', () => {
		const engine = createEngineHarness();
		const { tableBody, rows } = createTable();
		connectRowPcInputInteraction( tableBody, 'table-a', engine.manager );
		rows[ 0 ].cells[ 0 ].dispatchEvent( createPointerDown() );

		const sensorOptions = pointerSensorConfigureMock.mock.calls[ 0 ][ 0 ] as {
			preventActivation: ( event: PointerEvent ) => boolean;
		};

		expect( sensorOptions.preventActivation( createPointerDown( 'touch' ) ) ).toBe( true );
		expect( sensorOptions.preventActivation( createPointerDown( 'mouse' ) ) ).toBe( false );
	} );

	/**
	 * 概要:
	 * - PC開始条件またはRow Reorderの排他条件を満たさない入力では開始候補を登録しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象tbodyに開始候補になり得る行が存在する。
	 *
	 * 操作:
	 * - Touch、非primary pointer、主ボタン以外、Row Reorder Mode無効、active DnD中の各pointerdownを行う。
	 *
	 * 期待結果:
	 * - いずれの入力でもDraggableを登録しない。
	 */
	it( 'when the PC start conditions are not satisfied, should not register a draggable', () => {
		const engine = createEngineHarness();
		const { tableBody, rows } = createTable();
		connectRowPcInputInteraction( tableBody, 'table-a', engine.manager );
		const cell = rows[ 0 ].cells[ 0 ];

		cell.dispatchEvent( createPointerDown( 'touch' ) );
		cell.dispatchEvent( createPointerDown( 'mouse', 0, false ) );
		cell.dispatchEvent( createPointerDown( 'mouse', 1 ) );
		isRowModeActiveMock.mockReturnValueOnce( false );
		cell.dispatchEvent( createPointerDown() );
		engine.setIdle( false );
		cell.dispatchEvent( createPointerDown() );

		expect( draggableMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 対象tbody内に入れ子Tableが存在しても、その内側の行を開始候補にしないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aのセル内に別Tableのtbody行が存在する。
	 *
	 * 操作:
	 * - 入れ子Tableの行からPC pointerdownする。
	 *
	 * 期待結果:
	 * - 外側TableのInput InteractionはDraggableを登録しない。
	 */
	it( 'when pointerdown starts from a nested table row, should not register it for the outer tbody', () => {
		const engine = createEngineHarness();
		const { tableBody, rows } = createTable();
		const nestedTable = document.createElement( 'table' );
		const nestedBody = document.createElement( 'tbody' );
		const nestedRow = document.createElement( 'tr' );
		const nestedCell = document.createElement( 'td' );
		nestedRow.appendChild( nestedCell );
		nestedBody.appendChild( nestedRow );
		nestedTable.appendChild( nestedBody );
		rows[ 0 ].cells[ 0 ].appendChild( nestedTable );
		connectRowPcInputInteraction( tableBody, 'table-a', engine.manager );

		nestedCell.dispatchEvent( createPointerDown() );

		expect( draggableMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Input Interaction所有のDraggableが開始入力のLifecycleに合わせて破棄されることを確認する。
	 *
	 * 事前条件:
	 * - Table AでPC開始入力を受理できる。
	 *
	 * 操作:
	 * - 連続する開始入力、DnDへ発展しないpointerup、active DnDのdragend、接続解除を順に発生させる。
	 *
	 * 期待結果:
	 * - 前の開始候補は次の入力で破棄される。
	 * - idleのpointer終了では一時Draggableを破棄する。
	 * - active DnD中はpointer終了だけで破棄せず、dragendで破棄する。
	 * - すでに破棄済みの状態で接続解除しても重複破棄しない。
	 */
	it( 'when the input lifecycle ends, should discard the temporary draggable safely', async () => {
		const engine = createEngineHarness();
		const { tableBody, rows } = createTable();
		const disconnect = connectRowPcInputInteraction( tableBody, 'table-a', engine.manager );

		rows[ 0 ].cells[ 0 ].dispatchEvent( createPointerDown() );
		const firstDraggable = draggableMock.mock.results[ 0 ].value as { destroy: jest.Mock };
		rows[ 1 ].cells[ 0 ].dispatchEvent( createPointerDown() );
		const secondDraggable = draggableMock.mock.results[ 1 ].value as { destroy: jest.Mock };

		expect( firstDraggable.destroy ).toHaveBeenCalledTimes( 1 );

		window.dispatchEvent( new Event( 'pointerup' ) );
		await Promise.resolve();
		expect( secondDraggable.destroy ).toHaveBeenCalledTimes( 1 );

		rows[ 0 ].cells[ 0 ].dispatchEvent( createPointerDown() );
		const thirdDraggable = draggableMock.mock.results[ 2 ].value as { destroy: jest.Mock };
		engine.setIdle( false );
		window.dispatchEvent( new Event( 'pointercancel' ) );
		await Promise.resolve();
		expect( thirdDraggable.destroy ).not.toHaveBeenCalled();

		engine.emitDragEnd();
		expect( thirdDraggable.destroy ).toHaveBeenCalledTimes( 1 );

		disconnect();
		disconnect();
		expect( thirdDraggable.destroy ).toHaveBeenCalledTimes( 1 );
	} );
} );
