import { createElement, createRoot } from '@wordpress/element';

import { withColumnReorder } from './with-column-reorder';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

jest.mock( '@wordpress/components', () => ( {
	Button: 'button',
} ) );

type TableAttributes = {
	body: Array< {
		cells: Array< { content: string } >;
	} >;
};

const attributes: TableAttributes = {
	body: [
		{
			cells: [ { content: 'A' }, { content: 'B' }, { content: 'C' } ],
		},
	],
};

const BlockEdit = jest.fn( ( { clientId }: { clientId: string } ) =>
	createElement(
		'div',
		{ 'data-block': clientId },
		createElement(
			'table',
			null,
			createElement(
				'tbody',
				null,
				createElement(
					'tr',
					null,
					createElement( 'td', null, 'A' ),
					createElement( 'td', null, 'B' ),
					createElement( 'td', null, 'C' )
				)
			)
		)
	)
);

const WithColumnReorder = withColumnReorder( BlockEdit );
type WithColumnReorderProps = Parameters< typeof WithColumnReorder >[ 0 ];

const createProps = ( setAttributes = jest.fn() ): WithColumnReorderProps =>
	( {
		attributes,
		clientId: 'column-table',
		isSelected: true,
		name: 'core/table',
		setAttributes,
	} ) as unknown as WithColumnReorderProps;

const render = ( props: WithColumnReorderProps ) => {
	const container = document.createElement( 'div' );
	document.body.append( container );
	const root = createRoot( container );
	act( () => {
		root.render( createElement( WithColumnReorder, props ) );
	} );
	return {
		container,
		unmount: () => {
			act( () => {
				root.unmount();
			} );
			container.remove();
		},
	};
};

const pressKey = ( control: HTMLButtonElement, key: string ) => {
	const event = new KeyboardEvent( 'keydown', {
		bubbles: true,
		cancelable: true,
		key,
	} );
	act( () => {
		control.dispatchEvent( event );
	} );
	return event;
};

const clickControl = ( control: HTMLButtonElement ) => {
	act( () => {
		control.dispatchEvent(
			new MouseEvent( 'click', {
				bubbles: true,
				cancelable: true,
				detail: 1,
			} )
		);
	} );
};

const getControls = ( container: HTMLElement ): HTMLButtonElement[] =>
	Array.from(
		container.querySelectorAll< HTMLButtonElement >( '.yamabiko-column-reorder-control' )
	);

beforeAll( () => {
	Object.assign( globalThis, { IS_REACT_ACT_ENVIRONMENT: true } );
} );

beforeEach( () => {
	BlockEdit.mockClear();
	document.body.replaceChildren();
} );

describe( 'withColumnReorder', () => {
	it( 'moves and commits a column with the keyboard', () => {
		const setAttributes = jest.fn();
		const mounted = render( createProps( setAttributes ) );
		const controls = getControls( mounted.container );
		controls[ 0 ].focus();

		expect( pressKey( controls[ 0 ], 'Enter' ).defaultPrevented ).toBe( true );
		expect( controls[ 0 ].getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( pressKey( controls[ 0 ], 'ArrowRight' ).defaultPrevented ).toBe( true );
		expect( controls[ 1 ].dataset.destination ).toBe( 'true' );
		expect( pressKey( controls[ 0 ], ' ' ).defaultPrevented ).toBe( true );

		expect( setAttributes ).toHaveBeenCalledTimes( 1 );
		expect( setAttributes ).toHaveBeenCalledWith( {
			body: [
				{
					cells: [ { content: 'B' }, { content: 'A' }, { content: 'C' } ],
				},
			],
		} );
		expect( controls[ 1 ].ownerDocument.activeElement ).toBe( controls[ 1 ] );

		mounted.unmount();
	} );

	it( 'cancels keyboard movement and restores focus to the source control', () => {
		const setAttributes = jest.fn();
		const mounted = render( createProps( setAttributes ) );
		const controls = getControls( mounted.container );
		controls[ 1 ].focus();

		pressKey( controls[ 1 ], 'Enter' );
		pressKey( controls[ 1 ], 'ArrowRight' );
		expect( pressKey( controls[ 1 ], 'Escape' ).defaultPrevented ).toBe( true );

		expect( setAttributes ).not.toHaveBeenCalled();
		expect( controls[ 1 ].ownerDocument.activeElement ).toBe( controls[ 1 ] );
		expect( controls[ 1 ].getAttribute( 'aria-pressed' ) ).toBe( 'false' );

		mounted.unmount();
	} );

	it( 'selects a source and destination with a single pointer', () => {
		const setAttributes = jest.fn();
		const mounted = render( createProps( setAttributes ) );
		const controls = getControls( mounted.container );

		clickControl( controls[ 2 ] );
		expect( controls[ 2 ].getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect(
			mounted.container.querySelector( '.yamabiko-column-reorder-guidance' )?.textContent
		).toContain( 'Click a destination column' );

		clickControl( controls[ 0 ] );

		expect( setAttributes ).toHaveBeenCalledTimes( 1 );
		expect( setAttributes ).toHaveBeenCalledWith( {
			body: [
				{
					cells: [ { content: 'C' }, { content: 'A' }, { content: 'B' } ],
				},
			],
		} );
		expect( controls[ 0 ].ownerDocument.activeElement ).toBe( controls[ 0 ] );

		mounted.unmount();
	} );

	it( 'does not commit when the current column is chosen as the destination', () => {
		const setAttributes = jest.fn();
		const mounted = render( createProps( setAttributes ) );
		const controls = getControls( mounted.container );

		clickControl( controls[ 1 ] );
		clickControl( controls[ 1 ] );

		expect( setAttributes ).not.toHaveBeenCalled();
		expect( controls[ 1 ].ownerDocument.activeElement ).toBe( controls[ 1 ] );

		mounted.unmount();
	} );
} );
