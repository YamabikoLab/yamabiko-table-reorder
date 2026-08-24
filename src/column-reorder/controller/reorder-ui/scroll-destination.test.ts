import { scrollColumnDestinationIntoView } from './scroll-destination';

const setRect = ( element: Element, rect: Partial< DOMRect > ) => {
	jest.spyOn( element, 'getBoundingClientRect' ).mockReturnValue( {
		bottom: 100,
		height: 100,
		left: 0,
		right: 100,
		top: 0,
		width: 100,
		x: 0,
		y: 0,
		toJSON: () => ( {} ),
		...rect,
	} );
};

const createTable = () => {
	const scrollContainer = document.createElement( 'div' );
	scrollContainer.style.overflowX = 'auto';
	const table = document.createElement( 'table' );
	const row = table.insertRow();
	const first = row.insertCell();
	const second = row.insertCell();
	scrollContainer.append( table );
	document.body.append( scrollContainer );
	return { columns: [ first, second ], scrollContainer, table };
};

beforeEach( () => {
	document.body.replaceChildren();
	jest.spyOn( window, 'scrollBy' ).mockImplementation( () => undefined );
} );

afterEach( () => {
	jest.restoreAllMocks();
} );

describe( 'scrollColumnDestinationIntoView', () => {
	it( 'does nothing for an invalid insertion boundary', () => {
		const { columns, table } = createTable();

		scrollColumnDestinationIntoView( window, table, columns, 3 );

		expect( window.scrollBy ).not.toHaveBeenCalled();
	} );

	it( 'does not scroll when the destination is already visible', () => {
		const { columns, table } = createTable();
		setRect( columns[ 0 ], { left: 100, right: 200 } );

		scrollColumnDestinationIntoView( window, table, columns, 0 );

		expect( window.scrollBy ).not.toHaveBeenCalled();
	} );

	it( 'scrolls the window by the minimum amount when no horizontal container exists', () => {
		const { columns, scrollContainer, table } = createTable();
		scrollContainer.style.overflowX = 'visible';
		setRect( columns[ 0 ], { left: -40, right: 60 } );

		scrollColumnDestinationIntoView( window, table, columns, 0 );

		expect( window.scrollBy ).toHaveBeenCalledWith( {
			behavior: 'auto',
			left: -64,
			top: 0,
		} );
	} );

	it( 'uses the nearest horizontal scroll container for a destination beyond the right edge', () => {
		const { columns, scrollContainer, table } = createTable();
		Object.defineProperties( scrollContainer, {
			clientWidth: { configurable: true, value: 300 },
			scrollWidth: { configurable: true, value: 600 },
		} );
		setRect( scrollContainer, { left: 20, right: 320, width: 300 } );
		setRect( columns[ 1 ], { left: 250, right: 380 } );
		const scrollBy = jest.fn();
		scrollContainer.scrollBy = scrollBy;

		scrollColumnDestinationIntoView( window, table, columns, 2 );

		expect( scrollBy ).toHaveBeenCalledWith( {
			behavior: 'auto',
			left: 84,
			top: 0,
		} );
		expect( window.scrollBy ).not.toHaveBeenCalled();
	} );

	it( 'does not scroll when the visible horizontal area is too narrow for the margin', () => {
		const { columns, scrollContainer, table } = createTable();
		Object.defineProperties( scrollContainer, {
			clientWidth: { configurable: true, value: 40 },
			scrollWidth: { configurable: true, value: 80 },
		} );
		setRect( scrollContainer, { left: 0, right: 40, width: 40 } );
		setRect( columns[ 0 ], { left: -20, right: 20 } );
		const scrollBy = jest.fn();
		scrollContainer.scrollBy = scrollBy;

		scrollColumnDestinationIntoView( window, table, columns, 0 );

		expect( scrollBy ).not.toHaveBeenCalled();
		expect( window.scrollBy ).not.toHaveBeenCalled();
	} );
} );
