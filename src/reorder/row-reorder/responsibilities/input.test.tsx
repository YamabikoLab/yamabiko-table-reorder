/**
 * 行並び替えのポインター入力境界が、開始可能なPCとタッチ端末の入力だけを現在Tableの行DnD開始候補へ接続することを確認する。
 *
 * DnD Engine内部の挙動は再現せず、入力境界が所有する入力受理条件、対象行の限定、
 * Reorder Target Resolutionによる開始可否、開始拒否通知、一時Draggable登録の差し替え、
 * および行DnD固有のEngine設定だけを検証する。Reorder Modeの有効判定はDnD接続境界の責務とする。
 */

import { Draggable, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { RowInput, type RowDndPointerDownHandler } from './input';
import { notifyRowStartRejection } from './presentation/start-rejection-notice-event';
import { rowReorderTargetResolution } from './target-resolution';

jest.mock( '@dnd-kit/dom', () => ( {
	Draggable: jest.fn(),
	PointerSensor: {
		configure: jest.fn(),
	},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropManager: jest.fn(),
} ) );

jest.mock( './target-resolution', () => ( {
	rowReorderTargetResolution: {
		resolve: jest.fn(),
	},
} ) );

jest.mock( './presentation/start-rejection-notice-event', () => ( {
	notifyRowStartRejection: jest.fn(),
} ) );

const draggableConstructorMock = Draggable as unknown as jest.Mock;
const pointerSensorConfigureMock = PointerSensor.configure as jest.MockedFunction<
	typeof PointerSensor.configure
>;
const useDragDropManagerMock = useDragDropManager as jest.MockedFunction<
	typeof useDragDropManager
>;
const targetResolutionMock = rowReorderTargetResolution as jest.Mocked<
	typeof rowReorderTargetResolution
>;
const notifyRowStartRejectionMock = notifyRowStartRejection as jest.MockedFunction<
	typeof notifyRowStartRejection
>;

const createManager = ( idle = true ) =>
	( {
		dragOperation: {
			status: { idle },
		},
	} ) as ReturnType< typeof useDragDropManager >;

const createDirectRowTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = `
		<table><tbody>
			<tr><td>row 0</td></tr>
			<tr><td>row 1</td></tr>
		</tbody></table>
	`;
	const rows = currentTarget.querySelectorAll( 'tbody > tr' );
	const cells = currentTarget.querySelectorAll( 'tbody > tr > td' );
	return { currentTarget, rows, cells };
};

const createNestedRowTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = `
		<table><tbody><tr><td>
			<table><tbody><tr><td data-testid="nested-cell">nested</td></tr></tbody></table>
		</td></tr></tbody></table>
	`;
	const target = currentTarget.querySelector( '[data-testid="nested-cell"]' );
	if ( target === null ) {
		throw new Error( 'Nested row test target could not be created.' );
	}
	return { currentTarget, target };
};

const createPointerEvent = ( options: {
	target: Element;
	currentTarget: Element;
	isPrimary?: boolean;
	button?: number;
	pointerType?: string;
	clientX?: number;
	clientY?: number;
} ): ReactPointerEvent< Element > =>
	( {
		target: options.target,
		currentTarget: options.currentTarget,
		isPrimary: options.isPrimary ?? true,
		button: options.button ?? 0,
		pointerType: options.pointerType ?? 'mouse',
		clientX: options.clientX ?? 0,
		clientY: options.clientY ?? 0,
		preventDefault: jest.fn(),
	} ) as unknown as ReactPointerEvent< Element >;

const renderRowInput = () => {
	const capturedHandler: { current: RowDndPointerDownHandler | null } = { current: null };
	const activeDraggable: { current: Draggable | null } = { current: null };

	render(
		<RowInput tableIdentity="table-1" activeDraggable={ activeDraggable }>
			{ ( handler ) => {
				capturedHandler.current = handler;
				return <div />;
			} }
		</RowInput>
	);

	if ( capturedHandler.current === null ) {
		throw new Error( 'RowInput did not provide a pointer handler.' );
	}

	return { pointerDownHandler: capturedHandler.current, activeDraggable };
};

describe( 'Row DnD input boundary', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		draggableConstructorMock.mockImplementation( () => ( { destroy: jest.fn() } ) );
		useDragDropManagerMock.mockReturnValue( createManager() );
		targetResolutionMock.resolve.mockImplementation( ( target ) => ( {
			status: 'resolved',
			target,
			initialConstraints: { rowCount: 2, blockedBoundaries: [] },
		} ) );
	} );

	it( 'when primary mouse input targets direct tbody rows, should register the current row and replace the previous candidate', () => {
		const { currentTarget, rows, cells } = createDirectRowTarget();
		const { pointerDownHandler, activeDraggable } = renderRowInput();

		pointerDownHandler( createPointerEvent( { target: cells[ 0 ], currentTarget } ) );
		const firstDraggable = activeDraggable.current;
		pointerDownHandler( createPointerEvent( { target: cells[ 1 ], currentTarget } ) );

		expect( draggableConstructorMock ).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining( {
				id: 'ytr-row:table-1:0',
				element: rows[ 0 ],
				data: { tableIdentity: 'table-1', sourceRowIndex: 0 },
			} ),
			expect.anything()
		);
		expect( firstDraggable?.destroy ).toHaveBeenCalledTimes( 1 );
		expect( draggableConstructorMock ).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining( {
				id: 'ytr-row:table-1:1',
				element: rows[ 1 ],
				data: { tableIdentity: 'table-1', sourceRowIndex: 1 },
			} ),
			expect.anything()
		);
		const pointerSensorOptions = pointerSensorConfigureMock.mock.calls[ 0 ]?.[ 0 ];
		expect(
			pointerSensorOptions?.preventActivation?.( {} as globalThis.PointerEvent, {} as Draggable )
		).toBe( false );
	} );

	it( 'when target resolution rejects the row, should notify the blocking cell without registering a draggable', () => {
		const blockingMergedCell = {
			rowStart: 0,
			rowEnd: 1,
			columnStart: 1,
			columnEnd: 2,
		};
		targetResolutionMock.resolve.mockReturnValue( {
			status: 'rejected',
			blockingMergedCell,
		} );
		const { currentTarget, cells } = createDirectRowTarget();
		const { pointerDownHandler } = renderRowInput();

		pointerDownHandler(
			createPointerEvent( { target: cells[ 0 ], currentTarget, clientX: 120, clientY: 240 } )
		);

		expect( targetResolutionMock.resolve ).toHaveBeenCalledWith( {
			tableIdentity: 'table-1',
			sourceRowIndex: 0,
		} );
		expect( notifyRowStartRejectionMock ).toHaveBeenCalledWith( {
			blockingMergedCell,
			clientX: 120,
			clientY: 240,
		} );
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	it( 'when target resolution is unavailable, should not notify or register a draggable', () => {
		targetResolutionMock.resolve.mockReturnValue( { status: 'unavailable' } );
		const { currentTarget, cells } = createDirectRowTarget();
		const { pointerDownHandler } = renderRowInput();
		pointerDownHandler( createPointerEvent( { target: cells[ 0 ], currentTarget } ) );

		expect( notifyRowStartRejectionMock ).not.toHaveBeenCalled();
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	it( 'when primary touch input targets a direct tbody row, should register that row as the drag source', () => {
		const { currentTarget, rows, cells } = createDirectRowTarget();
		const { pointerDownHandler } = renderRowInput();
		pointerDownHandler(
			createPointerEvent( { target: cells[ 0 ], currentTarget, pointerType: 'touch' } )
		);

		expect( draggableConstructorMock ).toHaveBeenCalledWith(
			expect.objectContaining( { element: rows[ 0 ] } ),
			expect.anything()
		);
	} );

	it.each( [
		{ label: 'non-primary pointer', isPrimary: false, button: 0, pointerType: 'mouse', idle: true },
		{ label: 'secondary button', isPrimary: true, button: 1, pointerType: 'mouse', idle: true },
		{
			label: 'additional pointer during active DnD',
			isPrimary: true,
			button: 0,
			pointerType: 'touch',
			idle: false,
		},
	] )(
		'when $label input is not eligible to start row DnD, should not register a draggable',
		( { isPrimary, button, pointerType, idle } ) => {
			useDragDropManagerMock.mockReturnValue( createManager( idle ) );
			const { currentTarget, cells } = createDirectRowTarget();
			const { pointerDownHandler } = renderRowInput();
			pointerDownHandler(
				createPointerEvent( {
					target: cells[ 0 ],
					currentTarget,
					isPrimary,
					button,
					pointerType,
				} )
			);
			expect( draggableConstructorMock ).not.toHaveBeenCalled();
		}
	);

	it( 'when pointer input targets a nested table row, should not register that row as the current table drag source', () => {
		const { currentTarget, target } = createNestedRowTarget();
		const { pointerDownHandler } = renderRowInput();
		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );

		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );
} );
