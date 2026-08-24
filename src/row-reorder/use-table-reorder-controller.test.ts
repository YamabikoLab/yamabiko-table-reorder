import { createElement, createRoot } from '@wordpress/element';

import {
	createSortableController,
	type SortableController,
} from './controller/sortable-controller';
import { resolveTableContext, type TableContext } from './table-context';
import { useTableReorderController } from './use-table-reorder-controller';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

type ControllerOptions = Parameters< typeof createSortableController >[ 0 ];
type HookOptions = Parameters< typeof useTableReorderController >[ 0 ];

type MockController = {
	destroy: jest.MockedFunction< SortableController[ 'destroy' ] >;
	focusRowControl: jest.MockedFunction< SortableController[ 'focusRowControl' ] >;
	focusRowControlAt: jest.MockedFunction< SortableController[ 'focusRowControlAt' ] >;
};

jest.mock( './controller/sortable-controller', () => ( {
	createSortableController: jest.fn(),
} ) );

jest.mock( './table-context', () => ( {
	resolveTableContext: jest.fn(),
} ) );

const createSortableControllerMock = createSortableController as jest.MockedFunction<
	typeof createSortableController
>;
const resolveTableContextMock = resolveTableContext as jest.MockedFunction<
	typeof resolveTableContext
>;

const createContext = ( matches = true ): TableContext => {
	const blockElement = document.createElement( 'div' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	blockElement.append( table );
	const contextWindow = Object.create( window ) as Window;
	Object.defineProperty( contextWindow, 'matchMedia', {
		configurable: true,
		value: jest.fn( () => ( { matches } ) as MediaQueryList ),
	} );

	return {
		blockElement,
		document,
		tbody,
		window: contextWindow,
	};
};

const createMockController = ( focusResult = true ): MockController => ( {
	destroy: jest.fn(),
	focusRowControl: jest.fn( () => 'focused' ),
	focusRowControlAt: jest.fn< boolean, [ number ] >( () => focusResult ),
} );

const Harness = ( props: {
	referenceKey: string;
	options: HookOptions;
	renderReference: boolean;
} ) => {
	const { editorCanvasReferenceRef } = useTableReorderController( props.options );
	return props.renderReference
		? createElement( 'span', { key: props.referenceKey, ref: editorCanvasReferenceRef } )
		: null;
};

const createOptions = ( overrides: Partial< HookOptions > = {} ): HookOptions => ( {
	body: [ 'a', 'b', 'c' ],
	clientId: 'table-client-id',
	enabled: true,
	forbiddenInsertionIndices: [],
	interactionMode: 'hover',
	nonMovableRowIndices: [],
	onBodyCommit: jest.fn(),
	...overrides,
} );

const mountHook = ( initialOptions: HookOptions, initialRenderReference = true ) => {
	const container = document.createElement( 'div' );
	document.body.append( container );
	const root = createRoot( container );
	let options = initialOptions;
	let referenceKey = 'reference-a';
	let renderReference = initialRenderReference;
	const render = () => {
		act( () => {
			root.render( createElement( Harness, { referenceKey, options, renderReference } ) );
		} );
	};
	render();

	return {
		rerender: ( overrides: Partial< HookOptions > ) => {
			options = { ...options, ...overrides };
			render();
		},
		replaceReference: () => {
			referenceKey = referenceKey === 'reference-a' ? 'reference-b' : 'reference-a';
			render();
		},
		removeReference: () => {
			renderReference = false;
			render();
		},
		unmount: () => {
			act( () => {
				root.unmount();
			} );
		},
	};
};

const flushLifecycleMicrotasks = () => {
	act( () => {
		jest.runAllTimers();
	} );
};

const getControllerOptions = ( callIndex: number ): ControllerOptions => {
	const call = createSortableControllerMock.mock.calls[ callIndex ];
	if ( ! call ) {
		throw new Error( `Expected controller creation call ${ callIndex }` );
	}
	return call[ 0 ];
};

beforeAll( () => {
	Object.assign( globalThis, { IS_REACT_ACT_ENVIRONMENT: true } );
} );

beforeEach( () => {
	jest.useFakeTimers();
	document.body.replaceChildren();
	createSortableControllerMock.mockReset();
	resolveTableContextMock.mockReset();
	resolveTableContextMock.mockReturnValue( createContext() );
	createSortableControllerMock.mockImplementation( () => createMockController() );
	Object.assign( window, {
		yamabikoTableReorder: { runtimeUrl: '/sortable.js' },
	} );
} );

afterEach( () => {
	jest.runOnlyPendingTimers();
	jest.useRealTimers();
	Reflect.deleteProperty( window, 'yamabikoTableReorder' );
	document.body.replaceChildren();
} );

describe( 'useTableReorderController', () => {
	it( 'does not resolve table context when the editor canvas reference is unavailable', () => {
		const harness = mountHook( createOptions(), false );
		flushLifecycleMicrotasks();

		expect( resolveTableContextMock ).not.toHaveBeenCalled();
		expect( createSortableControllerMock ).not.toHaveBeenCalled();
		harness.unmount();
	} );

	it( 'does not create a controller when the runtime URL is unavailable', () => {
		Object.assign( window, { yamabikoTableReorder: {} } );
		const harness = mountHook( createOptions() );
		flushLifecycleMicrotasks();

		expect( resolveTableContextMock ).not.toHaveBeenCalled();
		expect( createSortableControllerMock ).not.toHaveBeenCalled();
		harness.unmount();
	} );

	it( 'does not create a controller when table context resolution fails', () => {
		resolveTableContextMock.mockReturnValue( null );
		const harness = mountHook( createOptions() );
		flushLifecycleMicrotasks();

		expect( resolveTableContextMock ).toHaveBeenCalledTimes( 1 );
		expect( createSortableControllerMock ).not.toHaveBeenCalled();
		harness.unmount();
	} );

	it( 'does not create a hover controller without a fine hover pointer', () => {
		resolveTableContextMock.mockReturnValue( createContext( false ) );
		const harness = mountHook( createOptions() );
		flushLifecycleMicrotasks();

		expect( createSortableControllerMock ).not.toHaveBeenCalled();
		harness.unmount();
	} );

	it( 'does not create a controller when cleanup happens before its creation microtask', () => {
		const harness = mountHook( createOptions() );
		harness.removeReference();
		flushLifecycleMicrotasks();

		expect( createSortableControllerMock ).not.toHaveBeenCalled();
		harness.unmount();
	} );

	it( 'cleans up and recreates the controller when the editor canvas reference DOM node is replaced', () => {
		const firstContext = createContext();
		const secondContext = createContext();
		const firstController = createMockController();
		const secondController = createMockController();
		resolveTableContextMock
			.mockReturnValueOnce( firstContext )
			.mockReturnValueOnce( secondContext );
		createSortableControllerMock
			.mockReturnValueOnce( firstController )
			.mockReturnValueOnce( secondController );
		const harness = mountHook( createOptions() );
		flushLifecycleMicrotasks();
		const firstReference = resolveTableContextMock.mock.calls[ 0 ]?.[ 0 ];

		harness.replaceReference();
		flushLifecycleMicrotasks();
		const secondReference = resolveTableContextMock.mock.calls[ 1 ]?.[ 0 ];

		expect( firstController.destroy ).toHaveBeenCalledTimes( 1 );
		expect( firstReference ).toBeInstanceOf( HTMLSpanElement );
		expect( secondReference ).toBeInstanceOf( HTMLSpanElement );
		expect( secondReference ).not.toBe( firstReference );
		expect( createSortableControllerMock ).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining( { context: secondContext } )
		);
		harness.unmount();
		flushLifecycleMicrotasks();
	} );

	it( 'keeps pending focus until a recreated controller restores it successfully', () => {
		const firstController = createMockController();
		const failedFocusController = createMockController( false );
		const restoredFocusController = createMockController( true );
		createSortableControllerMock
			.mockReturnValueOnce( firstController )
			.mockReturnValueOnce( failedFocusController )
			.mockReturnValueOnce( restoredFocusController );
		const firstBody = [ 'a', 'b', 'c' ];
		const secondBody = [ 'b', 'a', 'c' ];
		const thirdBody = [ 'b', 'c', 'a' ];
		const harness = mountHook( createOptions( { body: firstBody } ) );
		flushLifecycleMicrotasks();

		act( () => {
			getControllerOptions( 0 ).onCommit( secondBody, 1 );
		} );
		harness.rerender( { body: secondBody } );
		flushLifecycleMicrotasks();
		expect( failedFocusController.focusRowControlAt ).toHaveBeenCalledWith( 1 );

		harness.rerender( { body: thirdBody } );
		flushLifecycleMicrotasks();
		expect( restoredFocusController.focusRowControlAt ).toHaveBeenCalledWith( 1 );
		harness.unmount();
		flushLifecycleMicrotasks();
	} );
} );
