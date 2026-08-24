import { createSortableController } from './sortable-controller';
import {
	createSortableRuntime as createRuntime,
	createTableContext,
} from './sortable-controller.test-utils';
import { ensureSortableRuntime } from '@/common/sortable-runtime-loader';

jest.mock( '@wordpress/components', () => ( {
	Tooltip: ( { children }: { children: unknown } ) => children,
} ) );

jest.mock( '@/common/sortable-runtime-loader', () => ( {
	ensureSortableRuntime: jest.fn(),
} ) );

const ensureSortableRuntimeMock = ensureSortableRuntime as jest.MockedFunction<
	typeof ensureSortableRuntime
>;

const dispatchMousePointerEvent = (
	target: Element,
	type: string,
	clientX: number,
	clientY: number
) => {
	const event = new Event( type, { bubbles: true } );
	Object.defineProperties( event, {
		clientX: { value: clientX },
		clientY: { value: clientY },
		pointerType: { value: 'mouse' },
	} );
	target.dispatchEvent( event );
};

const flushPromises = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe( 'createSortableController hover scroll sync', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		ensureSortableRuntimeMock.mockReset();
	} );

	it( 'updates the visible handle when scrolling moves another row under a stationary mouse', async () => {
		const runtime = createRuntime();
		ensureSortableRuntimeMock.mockResolvedValue( runtime );
		const { context, tbody } = createTableContext( 3 );
		const callbacks: FrameRequestCallback[] = [];
		jest.spyOn( context.window, 'requestAnimationFrame' ).mockImplementation( ( callback ) => {
			callbacks.push( callback );
			return callbacks.length;
		} );
		jest.spyOn( context.window, 'cancelAnimationFrame' ).mockImplementation( () => undefined );

		let pointedElement: Element | null = tbody.rows.item( 0 );
		Object.defineProperty( document, 'elementFromPoint', {
			configurable: true,
			value: jest.fn( () => pointedElement ),
		} );

		const controller = createSortableController( {
			context,
			forbiddenInsertionIndices: [],
			interactionMode: 'hover',
			nonMovableRowIndices: [],
			onCommit: jest.fn(),
			rows: [ 'a', 'b', 'c' ],
			runtimeUrl: '/sortable.js',
		} );
		await flushPromises();

		const firstRow = tbody.rows.item( 0 );
		const secondRow = tbody.rows.item( 1 );
		const firstControl = firstRow?.querySelector< HTMLButtonElement >(
			'.yamabiko-table-reorder-handle-zone'
		);
		const secondControl = secondRow?.querySelector< HTMLButtonElement >(
			'.yamabiko-table-reorder-handle-zone'
		);
		if ( ! firstRow || ! secondRow || ! firstControl || ! secondControl ) {
			throw new Error( 'Expected row controls' );
		}

		dispatchMousePointerEvent( firstRow, 'pointerover', 120, 160 );
		expect( firstControl.dataset.visible ).toBe( 'true' );
		expect( secondControl.dataset.visible ).toBe( 'false' );

		pointedElement = secondRow;
		document.dispatchEvent( new Event( 'scroll' ) );
		while ( callbacks.length > 0 ) {
			callbacks.shift()?.( 0 );
		}

		expect( firstControl.dataset.visible ).toBe( 'false' );
		expect( secondControl.dataset.visible ).toBe( 'true' );
		expect( document.elementFromPoint ).toHaveBeenCalledWith( 120, 160 );

		controller.destroy();
	} );
} );
