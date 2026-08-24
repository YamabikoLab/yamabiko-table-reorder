import { createRowControls, getRowRepresentativeText, HANDLE_ZONE_CLASS } from './row-controls';
import type { TableContext } from '@/row-reorder/table-context';

jest.mock( '@wordpress/components', () => ( {
	Tooltip: ( { children }: { children: unknown } ) => children,
} ) );

const createTable = ( labels: string[] ) => {
	const blockElement = document.createElement( 'div' );
	const wrapper = document.createElement( 'figure' );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	table.append( tbody );
	wrapper.append( table );
	blockElement.append( wrapper );
	document.body.append( blockElement );

	for ( const label of labels ) {
		const row = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.textContent = label;
		row.append( cell );
		tbody.append( row );
	}

	const context: TableContext = {
		blockElement,
		document,
		tbody,
		window,
	};
	return { context, table, tbody, wrapper };
};

const mockRowPositions = ( tbody: HTMLTableSectionElement, getOffset: () => number ) => {
	return Array.from( tbody.rows ).map( ( row, index ) =>
		jest.spyOn( row, 'getBoundingClientRect' ).mockImplementation(
			() =>
				( {
					top: index * 40 - getOffset(),
					bottom: index * 40 + 40 - getOffset(),
					height: 40,
					left: 0,
					right: 400,
					width: 400,
					x: 0,
					y: index * 40 - getOffset(),
					toJSON: () => ( {} ),
				} ) as DOMRect
		)
	);
};

describe( 'row-controls', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		jest.restoreAllMocks();
	} );

	it( 'binds controls only around the viewport and reuses pool slots after scroll', () => {
		const labels = Array.from( { length: 100 }, ( _value, index ) => `Row ${ index + 1 }` );
		const { context, tbody } = createTable( labels );
		let offset = 0;
		const callbacks: FrameRequestCallback[] = [];
		mockRowPositions( tbody, () => offset );
		jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation( ( callback ) => {
			callbacks.push( callback );
			return callbacks.length;
		} );
		jest.spyOn( window, 'cancelAnimationFrame' ).mockImplementation( () => undefined );

		const controls = createRowControls( context, [], { showAll: false } );
		const initialControls = Array.from(
			tbody.querySelectorAll< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` )
		);
		expect( initialControls.length ).toBeGreaterThan( 0 );
		expect( initialControls.length ).toBeLessThan( 100 );
		const firstPooledControl = initialControls[ 0 ];

		offset = 3200;
		tbody.dispatchEvent( new Event( 'scroll' ) );
		expect( callbacks ).toHaveLength( 1 );
		callbacks.shift()?.( 0 );

		const scrolledControls = Array.from(
			tbody.querySelectorAll< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` )
		);
		expect( scrolledControls.length ).toBeLessThan( 100 );
		expect( tbody.rows.item( 0 )?.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBeNull();
		expect( firstPooledControl.isConnected ).toBe( true );
		expect( firstPooledControl.closest( 'tr' )?.sectionRowIndex ).toBeGreaterThan( 0 );

		controls.cleanup();
		expect( tbody.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBeNull();
	} );

	it( 'does not measure every row when resolving a large initial viewport', () => {
		const labels = Array.from( { length: 4096 }, ( _value, index ) => `Row ${ index + 1 }` );
		const { context, tbody } = createTable( labels );
		let offset = 80000;
		const rowRectSpies = mockRowPositions( tbody, () => offset );

		const controls = createRowControls( context, [], { showAll: false } );
		const measuredRows = rowRectSpies.filter( ( spy ) => spy.mock.calls.length > 0 ).length;
		expect( measuredRows ).toBeLessThan( 100 );
		expect( tbody.querySelectorAll( `.${ HANDLE_ZONE_CLASS }` ).length ).toBeLessThan( 100 );

		controls.cleanup();
		offset = 0;
	} );

	it( 'updates a nearby scroll incrementally without remeasuring all rows', () => {
		const labels = Array.from( { length: 4096 }, ( _value, index ) => `Row ${ index + 1 }` );
		const { context, tbody } = createTable( labels );
		let offset = 80000;
		const callbacks: FrameRequestCallback[] = [];
		const rowRectSpies = mockRowPositions( tbody, () => offset );
		jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation( ( callback ) => {
			callbacks.push( callback );
			return callbacks.length;
		} );
		jest.spyOn( window, 'cancelAnimationFrame' ).mockImplementation( () => undefined );
		const controls = createRowControls( context, [], { showAll: false } );
		rowRectSpies.forEach( ( spy ) => spy.mockClear() );

		offset += 40;
		document.dispatchEvent( new Event( 'scroll' ) );
		callbacks.shift()?.( 0 );

		const measuredRows = rowRectSpies.filter( ( spy ) => spy.mock.calls.length > 0 ).length;
		expect( measuredRows ).toBeLessThan( 20 );
		controls.cleanup();
	} );

	it( 'fully resynchronizes row-specific state when a pooled control is rebound', () => {
		const { context, tbody } = createTable( [ 'Alpha', 'Beta' ] );
		let offset = 0;
		const callbacks: FrameRequestCallback[] = [];
		jest
			.spyOn( tbody.rows.item( 0 )!, 'getBoundingClientRect' )
			.mockImplementation( () => ( { top: -offset, bottom: 40 - offset } ) as DOMRect );
		jest
			.spyOn( tbody.rows.item( 1 )!, 'getBoundingClientRect' )
			.mockImplementation( () => ( { top: 3000 - offset, bottom: 3040 - offset } ) as DOMRect );
		jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation( ( callback ) => {
			callbacks.push( callback );
			return callbacks.length;
		} );
		jest.spyOn( window, 'cancelAnimationFrame' ).mockImplementation( () => undefined );
		const firstCell = tbody.rows.item( 0 )!.cells.item( 0 )!;
		firstCell.style.paddingInlineStart = '7px';

		const controls = createRowControls( context, [], { showAll: false } );
		const control = tbody.rows
			.item( 0 )!
			.querySelector< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` )!;
		expect( control.getAttribute( 'aria-label' ) ).toBe( 'Reorder row 1: Alpha' );
		controls.setVisible( control, true );
		controls.setPressed( control, true );
		expect( control.dataset.visible ).toBe( 'true' );
		expect( control.getAttribute( 'aria-pressed' ) ).toBe( 'true' );

		offset = 3000;
		document.dispatchEvent( new Event( 'scroll' ) );
		callbacks.shift()?.( 0 );

		const rebound = tbody.rows
			.item( 1 )!
			.querySelector< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` )!;
		expect( rebound ).toBe( control );
		expect( rebound.getAttribute( 'aria-label' ) ).toBe( 'Reorder row 2: Beta' );
		expect( rebound.getAttribute( 'aria-pressed' ) ).toBe( 'false' );
		expect( rebound.dataset.visible ).toBe( 'false' );
		expect( rebound.getAttribute( 'aria-describedby' ) ).toContain( '-pointer' );
		expect( firstCell.style.paddingInlineStart ).toBe( '7px' );

		controls.cleanup();
	} );

	it( 'keeps a pinned control bound offscreen until it is unpinned', () => {
		const { context, tbody } = createTable( [ 'Alpha', 'Beta' ] );
		let offset = 0;
		const callbacks: FrameRequestCallback[] = [];
		jest
			.spyOn( tbody.rows.item( 0 )!, 'getBoundingClientRect' )
			.mockImplementation( () => ( { top: -offset, bottom: 40 - offset } ) as DOMRect );
		jest
			.spyOn( tbody.rows.item( 1 )!, 'getBoundingClientRect' )
			.mockImplementation( () => ( { top: 3000 - offset, bottom: 3040 - offset } ) as DOMRect );
		jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation( ( callback ) => {
			callbacks.push( callback );
			return callbacks.length;
		} );
		jest.spyOn( window, 'cancelAnimationFrame' ).mockImplementation( () => undefined );

		const controls = createRowControls( context, [], { showAll: false } );
		const control = tbody.rows
			.item( 0 )!
			.querySelector< HTMLButtonElement >( `.${ HANDLE_ZONE_CLASS }` )!;
		controls.pin( control );
		offset = 3000;
		document.dispatchEvent( new Event( 'scroll' ) );
		callbacks.shift()?.( 0 );
		expect( tbody.rows.item( 0 )?.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBe( control );

		controls.unpin( control );
		callbacks.shift()?.( 0 );
		expect( tbody.rows.item( 0 )?.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBeNull();
		controls.cleanup();
	} );

	it( 'coalesces nested scroll and resize into one context-window animation frame and cancels it', () => {
		const { context, tbody } = createTable( [ 'Alpha' ] );
		const requestAnimationFrame = jest
			.spyOn( context.window, 'requestAnimationFrame' )
			.mockReturnValue( 42 );
		const cancelAnimationFrame = jest
			.spyOn( context.window, 'cancelAnimationFrame' )
			.mockImplementation( () => undefined );
		const controls = createRowControls( context, [], { showAll: false } );
		const nestedScroller = document.createElement( 'div' );
		tbody.rows.item( 0 )!.cells.item( 0 )!.append( nestedScroller );

		nestedScroller.dispatchEvent( new Event( 'scroll' ) );
		context.window.dispatchEvent( new Event( 'resize' ) );
		expect( requestAnimationFrame ).toHaveBeenCalledTimes( 1 );

		controls.cleanup();
		expect( cancelAnimationFrame ).toHaveBeenCalledWith( 42 );
	} );

	it( 'adds only the missing first-column width in touch reorder mode and restores it', () => {
		const { context, table, wrapper } = createTable( [ 'Alpha', 'Beta' ] );
		const sizingCell = table.rows.item( 0 )?.cells.item( 0 );
		if ( ! sizingCell ) {
			throw new Error( 'Expected sizing cell' );
		}
		table.style.minWidth = '400px';
		sizingCell.style.width = '20px';
		wrapper.style.overflowX = 'hidden';
		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue( { width: 408 } as DOMRect );
		jest.spyOn( sizingCell, 'getBoundingClientRect' ).mockReturnValue( { width: 27 } as DOMRect );

		const controls = createRowControls( context, [], { showAll: true } );
		expect( wrapper.style.overflowX ).toBe( 'auto' );
		expect( table.style.minWidth ).toBe( '445px' );
		expect( sizingCell.style.width ).toBe( '64px' );

		controls.cleanup();
		expect( wrapper.style.overflowX ).toBe( 'hidden' );
		expect( table.style.minWidth ).toBe( '400px' );
		expect( sizingCell.style.width ).toBe( '20px' );
	} );

	it( 'materializes an offscreen movable row on demand', () => {
		const { context, tbody } = createTable( [ 'Alpha', 'Beta' ] );
		jest
			.spyOn( tbody.rows.item( 0 )!, 'getBoundingClientRect' )
			.mockReturnValue( { top: 0, bottom: 40 } as DOMRect );
		jest
			.spyOn( tbody.rows.item( 1 )!, 'getBoundingClientRect' )
			.mockReturnValue( { top: 3000, bottom: 3040 } as DOMRect );
		const controls = createRowControls( context, [], { showAll: false } );
		const secondRow = tbody.rows.item( 1 )!;
		expect( secondRow.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBeNull();

		const control = controls.ensureControl( secondRow );
		expect( control ).not.toBeNull();
		expect( secondRow.querySelector( `.${ HANDLE_ZONE_CLASS }` ) ).toBe( control );
		controls.cleanup();
	} );

	it( 'uses the first non-empty cell as representative row text', () => {
		const { tbody } = createTable( [ '' ] );
		const row = tbody.rows.item( 0 );
		if ( ! row ) {
			throw new Error( 'Expected table row' );
		}
		row.append( document.createElement( 'td' ) );
		row.cells.item( 1 )!.textContent = 'Second cell';
		expect( getRowRepresentativeText( row ) ).toBe( 'Second cell' );
	} );
} );