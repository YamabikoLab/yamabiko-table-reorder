import { createElement, createRoot, useState } from '@wordpress/element';

import { withColumnReorder } from './with-column-reorder';

const { act } = jest.requireActual< { act: ( callback: () => void ) => void } >( 'react' );

type TableAttributes = {
	body: Array< {
		cells: Array< { content: string } >;
	} >;
};

const initialAttributes: TableAttributes = {
	body: [
		{
			cells: [ { content: 'A' }, { content: 'B' }, { content: 'C' } ],
		},
	],
};

const BlockEdit = jest.fn(
	( { attributes, clientId }: { attributes: TableAttributes; clientId: string } ) =>
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
						...attributes.body[ 0 ].cells.map( ( cell ) =>
							createElement( 'td', { key: cell.content }, cell.content )
						)
					)
				)
			)
		)
);

const WithColumnReorder = withColumnReorder( BlockEdit );
type WithColumnReorderProps = Parameters< typeof WithColumnReorder >[ 0 ];

const createProps = (
	attributes: TableAttributes,
	setAttributes: ( nextAttributes: TableAttributes ) => void
): WithColumnReorderProps =>
	( {
		attributes,
		clientId: 'column-table',
		isSelected: true,
		name: 'core/table',
		setAttributes,
	} ) as unknown as WithColumnReorderProps;

const render = () => {
	const container = document.createElement( 'div' );
	document.body.append( container );
	const root = createRoot( container );
	const setAttributes = jest.fn();
	const Harness = () => {
		const [ attributes, setCurrentAttributes ] = useState( initialAttributes );
		return createElement(
			WithColumnReorder,
			createProps( attributes, ( nextAttributes ) => {
				setAttributes( nextAttributes );
				setCurrentAttributes( nextAttributes );
			} )
		);
	};
	act( () => {
		root.render( createElement( Harness ) );
	} );
	return {
		container,
		setAttributes,
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

const click = ( control: HTMLButtonElement ) => {
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
		container.querySelectorAll< HTMLButtonElement >( '.yamabiko-table-reorder-column-handle-zone' )
	);

beforeAll( () => {
	Object.assign( globalThis, { IS_REACT_ACT_ENVIRONMENT: true } );
} );

beforeEach( () => {
	BlockEdit.mockClear();
	document.body.replaceChildren();
} );

describe( 'withColumnReorder', () => {
	it( 'moves a keyboard destination by insertion boundary and restores focus after commit', () => {
		const mounted = render();
		let controls = getControls( mounted.container );
		controls[ 0 ].focus();

		expect( pressKey( controls[ 0 ], 'Enter' ).defaultPrevented ).toBe( true );
		expect( controls[ 0 ].getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect( pressKey( controls[ 0 ], 'ArrowRight' ).defaultPrevented ).toBe( true );
		expect(
			document.body.querySelector< HTMLElement >( '.yamabiko-table-reorder-column-insertion-line' )
				?.dataset.insertionIndex
		).toBe( '2' );
		expect( pressKey( controls[ 0 ], ' ' ).defaultPrevented ).toBe( true );

		expect( mounted.setAttributes ).toHaveBeenCalledTimes( 1 );
		expect( mounted.setAttributes ).toHaveBeenCalledWith( {
			body: [
				{
					cells: [ { content: 'B' }, { content: 'A' }, { content: 'C' } ],
				},
			],
		} );
		controls = getControls( mounted.container );
		expect( controls[ 1 ].ownerDocument.activeElement ).toBe( controls[ 1 ] );

		mounted.unmount();
	} );

	it( 'cancels keyboard movement and restores focus to the source control', () => {
		const mounted = render();
		const controls = getControls( mounted.container );
		controls[ 1 ].focus();

		pressKey( controls[ 1 ], 'Enter' );
		pressKey( controls[ 1 ], 'ArrowRight' );
		expect( pressKey( controls[ 1 ], 'Escape' ).defaultPrevented ).toBe( true );

		expect( mounted.setAttributes ).not.toHaveBeenCalled();
		expect( controls[ 1 ].ownerDocument.activeElement ).toBe( controls[ 1 ] );
		expect( controls[ 1 ].getAttribute( 'aria-pressed' ) ).toBe( 'false' );

		mounted.unmount();
	} );

	it( 'selects a source and insertion destination with a single pointer', () => {
		const mounted = render();
		let controls = getControls( mounted.container );

		click( controls[ 2 ] );
		expect( controls[ 2 ].getAttribute( 'aria-pressed' ) ).toBe( 'true' );
		expect(
			document.body.querySelector( '.yamabiko-table-reorder-column-guidance' )?.textContent
		).toContain( 'Click destination' );
		const destination = document.body.querySelector< HTMLButtonElement >(
			'.yamabiko-table-reorder-column-destination[data-new-index="0"]'
		);
		expect( destination?.dataset.insertionIndex ).toBe( '0' );
		expect( destination ).not.toBeNull();
		click( destination as HTMLButtonElement );

		expect( mounted.setAttributes ).toHaveBeenCalledTimes( 1 );
		expect( mounted.setAttributes ).toHaveBeenCalledWith( {
			body: [
				{
					cells: [ { content: 'C' }, { content: 'A' }, { content: 'B' } ],
				},
			],
		} );
		controls = getControls( mounted.container );
		expect( controls[ 0 ].ownerDocument.activeElement ).toBe( controls[ 0 ] );

		mounted.unmount();
	} );

	it( 'does not commit when keyboard confirmation stays at the source position', () => {
		const mounted = render();
		const controls = getControls( mounted.container );

		controls[ 1 ].focus();
		pressKey( controls[ 1 ], 'Enter' );
		pressKey( controls[ 1 ], 'Enter' );

		expect( mounted.setAttributes ).not.toHaveBeenCalled();
		expect( controls[ 1 ].ownerDocument.activeElement ).toBe( controls[ 1 ] );

		mounted.unmount();
	} );
} );
