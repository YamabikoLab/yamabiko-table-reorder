/**
 * PC Input InteractionからDnD Engineを経由して行専用DnD Interactionへ到達する接続経路を検証する。
 *
 * Input Interactionが一時Draggableへ付与した開始対象情報をDnD Engine通知として引き継ぎ、
 * 既存DnD Interactionの開始準備・Session開始境界が同じTableと行位置を受け取ることを確認する。
 */

import type { DragDropManager } from '@dnd-kit/dom';
import { Draggable } from '@dnd-kit/dom';

import { rowReorderMode } from '@/reorder/reorder-mode';

import {
	createRowDndOperationBoundary,
	type RowDndOperationBoundary,
	type RowDndStartPreparation,
} from './dnd-interaction';
import { connectRowDndInteraction } from './dnd-interaction-integration';
import { connectRowPcInputInteraction } from './input-interaction';

jest.mock( '@dnd-kit/dom', () => ( {
	Draggable: jest.fn().mockImplementation( () => ( {
		destroy: jest.fn(),
	} ) ),
	Droppable: jest.fn().mockImplementation( () => ( {
		destroy: jest.fn(),
	} ) ),
	PointerSensor: {
		configure: jest.fn( ( options ) => ( { options } ) ),
	},
} ) );

jest.mock( '@/reorder/reorder-mode', () => ( {
	rowReorderMode: {
		isActive: jest.fn( () => true ),
	},
} ) );

jest.mock( './dnd-interaction', () => ( {
	createRowDndOperationBoundary: jest.fn(),
} ) );

/** DnD Engineが登録するLifecycle通知をテストから発火するための関数型。 */
type EngineCallback = ( event: any ) => void;

/** DnD Engine接続を複数責務から同時に利用できるテスト環境。 */
type EngineHarness = {
	manager: DragDropManager;
	emit: ( name: string, event: unknown ) => void;
};

/** Input InteractionとDnD Interactionが同じmanagerへ接続できるテスト環境を生成する。 */
const createEngineHarness = (): EngineHarness => {
	const listeners = new Map< string, Set< EngineCallback > >();
	const manager = {
		actions: {
			stop: jest.fn(),
		},
		dragOperation: {
			status: {
				idle: true,
			},
		},
		monitor: {
			addEventListener: jest.fn( ( name: string, listener: EngineCallback ) => {
				const current = listeners.get( name ) ?? new Set< EngineCallback >();
				current.add( listener );
				listeners.set( name, current );

				return (): void => {
					current.delete( listener );
				};
			} ),
		},
	} as unknown as DragDropManager;

	return {
		manager,
		emit: ( name, event ) => {
			listeners.get( name )?.forEach( ( listener ) => listener( event ) );
		},
	};
};

/** DnD Interaction操作境界への到達だけを観測するテスト用代替を生成する。 */
const createBoundary = (): jest.Mocked< RowDndOperationBoundary > => ( {
	prepareStart: jest.fn(),
	start: jest.fn(),
	updateDestination: jest.fn(),
	complete: jest.fn(),
	cancel: jest.fn(),
	recoverFailure: jest.fn(),
	isRecovering: jest.fn( () => false ),
} );

/** PC pointerdownをjsdom上でdispatchするためのPointerEvent相当値を生成する。 */
const createPointerDown = (): PointerEvent => {
	const event = new Event( 'pointerdown', { bubbles: true, cancelable: true } ) as PointerEvent;
	Object.defineProperties( event, {
		button: { value: 0 },
		isPrimary: { value: true },
		pointerType: { value: 'mouse' },
	} );
	return event;
};

/** Input Interactionが生成したDraggable設定を観測するJest代替。 */
const draggableMock = Draggable as unknown as jest.Mock;
/** DnD Interaction接続が生成する操作境界を観測するJest代替。 */
const createBoundaryMock = createRowDndOperationBoundary as jest.MockedFunction<
	typeof createRowDndOperationBoundary
>;
/** Row Reorder Modeを有効状態にするJest代替。 */
const isRowModeActiveMock = rowReorderMode.isActive as jest.MockedFunction<
	typeof rowReorderMode.isActive
>;

describe( 'Row PC Input Interaction to DnD Interaction integration', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		document.body.replaceChildren();
		isRowModeActiveMock.mockReturnValue( true );
	} );

	/**
	 * 概要:
	 * - PC入力で解決した開始候補がDnD Engine通知を経由して既存DnD Interactionの開始境界へ到達することを確認する。
	 *
	 * 事前条件:
	 * - Table AでRow Reorder Modeが有効である。
	 * - Input InteractionとDnD Interactionが同じDnD Engine managerへ接続されている。
	 * - DnD InteractionはTable Aの2行目を開始可能と判定する。
	 *
	 * 操作:
	 * - Table Aの2行目からPC pointerdownし、生成されたDnD Engine開始対象でbeforedragstartとdragstartを通知する。
	 *
	 * 期待結果:
	 * - DnD InteractionのprepareStartへTable Aと0-based行位置1が渡される。
	 * - 同じ開始準備値でSession開始境界へ進む。
	 */
	it( 'when PC input becomes a physical drag, should reach the existing row DnD start boundary with the same source', () => {
		const engine = createEngineHarness();
		const boundary = createBoundary();
		const table = document.createElement( 'table' );
		const tableBody = document.createElement( 'tbody' );
		table.appendChild( tableBody );

		for ( let index = 0; index < 3; index++ ) {
			const row = document.createElement( 'tr' );
			row.appendChild( document.createElement( 'td' ) );
			tableBody.appendChild( row );
		}
		document.body.appendChild( table );

		const preparation: RowDndStartPreparation = {
			source: {
				tableIdentity: 'table-a',
				sourceRowIndex: 1,
			},
			initialConstraints: {
				rowCount: 3,
				blockedBoundaries: [],
			},
		};
		boundary.prepareStart.mockReturnValue( preparation );
		boundary.start.mockReturnValue( true );
		createBoundaryMock.mockReturnValue( boundary );
		connectRowDndInteraction( engine.manager );
		connectRowPcInputInteraction( tableBody, 'table-a', engine.manager );

		tableBody.rows[ 1 ].cells[ 0 ].dispatchEvent( createPointerDown() );
		const draggableInput = draggableMock.mock.calls[ 0 ][ 0 ] as {
			data: unknown;
			element: Element;
		};
		const source = {
			data: draggableInput.data,
			element: draggableInput.element,
		};
		const operation = {
			source,
			target: null,
			position: {
				current: {
					x: 0,
					y: 0,
				},
			},
		};

		engine.emit( 'beforedragstart', {
			operation,
			preventDefault: jest.fn(),
		} );
		engine.emit( 'dragstart', { operation } );

		expect( boundary.prepareStart ).toHaveBeenCalledWith( preparation.source );
		expect( boundary.start ).toHaveBeenCalledWith( preparation );
	} );
} );
