import { moveColumn } from './column-order';

const createCell = ( id: string ) => ( { id } );

const createRow = ( ...cells: ReturnType< typeof createCell >[] ) => ( { cells } );

describe( 'moveColumn', () => {
	it( 'moves the same column across head, body, and foot', () => {
		const head = [ createRow( createCell( 'h-a' ), createCell( 'h-b' ), createCell( 'h-c' ) ) ];
		const body = [
			createRow( createCell( 'b1-a' ), createCell( 'b1-b' ), createCell( 'b1-c' ) ),
			createRow( createCell( 'b2-a' ), createCell( 'b2-b' ), createCell( 'b2-c' ) ),
		];
		const foot = [ createRow( createCell( 'f-a' ), createCell( 'f-b' ), createCell( 'f-c' ) ) ];
		const attributes = { head, body, foot, caption: 'caption' };

		const moved = moveColumn( attributes, 0, 2 );

		expect( moved ).not.toBeNull();
		expect( moved?.head[ 0 ].cells ).toEqual( [ head[ 0 ].cells[ 1 ], head[ 0 ].cells[ 2 ], head[ 0 ].cells[ 0 ] ] );
		expect( moved?.body[ 0 ].cells ).toEqual( [ body[ 0 ].cells[ 1 ], body[ 0 ].cells[ 2 ], body[ 0 ].cells[ 0 ] ] );
		expect( moved?.body[ 1 ].cells ).toEqual( [ body[ 1 ].cells[ 1 ], body[ 1 ].cells[ 2 ], body[ 1 ].cells[ 0 ] ] );
		expect( moved?.foot[ 0 ].cells ).toEqual( [ foot[ 0 ].cells[ 1 ], foot[ 0 ].cells[ 2 ], foot[ 0 ].cells[ 0 ] ] );
		expect( moved?.caption ).toBe( attributes.caption );
	} );

	it( 'supports missing table sections without adding them', () => {
		const attributes = {
			body: [ createRow( createCell( 'a' ), createCell( 'b' ) ) ],
			caption: 'body only',
		};

		const moved = moveColumn( attributes, 1, 0 );

		expect( moved ).toEqual( {
			body: [ { cells: [ attributes.body[ 0 ].cells[ 1 ], attributes.body[ 0 ].cells[ 0 ] ] } ],
			caption: 'body only',
		} );
		expect( moved ).not.toHaveProperty( 'head' );
		expect( moved ).not.toHaveProperty( 'foot' );
	} );

	it( 'preserves cell object identity and unrelated row data', () => {
		const first = createCell( 'a' );
		const second = createCell( 'b' );
		const row = { cells: [ first, second ], custom: { value: 1 } };
		const attributes = { body: [ row ], meta: { value: 2 } };

		const moved = moveColumn( attributes, 0, 1 );

		expect( moved?.body[ 0 ].cells[ 0 ] ).toBe( second );
		expect( moved?.body[ 0 ].cells[ 1 ] ).toBe( first );
		expect( moved?.body[ 0 ].custom ).toBe( row.custom );
		expect( moved?.meta ).toBe( attributes.meta );
	} );

	it( 'does not mutate the source attributes, sections, rows, or cells arrays', () => {
		const row = createRow( createCell( 'a' ), createCell( 'b' ), createCell( 'c' ) );
		const attributes = { body: [ row ] };
		const originalCells = [ ...row.cells ];

		const moved = moveColumn( attributes, 2, 0 );

		expect( attributes.body[ 0 ] ).toBe( row );
		expect( attributes.body[ 0 ].cells ).toEqual( originalCells );
		expect( moved ).not.toBe( attributes );
		expect( moved?.body ).not.toBe( attributes.body );
		expect( moved?.body[ 0 ] ).not.toBe( row );
		expect( moved?.body[ 0 ].cells ).not.toBe( row.cells );
	} );

	it( 'returns an equivalent copy when moving to the same position', () => {
		const attributes = {
			body: [ createRow( createCell( 'a' ), createCell( 'b' ) ) ],
		};

		const moved = moveColumn( attributes, 1, 1 );

		expect( moved ).toEqual( attributes );
		expect( moved ).not.toBe( attributes );
		expect( moved?.body ).not.toBe( attributes.body );
	} );

	it.each( [
		[ -1, 0 ],
		[ 0, -1 ],
		[ 3, 0 ],
		[ 0, 3 ],
		[ 0.5, 1 ],
		[ 0, 1.5 ],
	] )( 'returns null for invalid indices %p -> %p', ( oldColumnIndex, newColumnIndex ) => {
		const attributes = {
			body: [ createRow( createCell( 'a' ), createCell( 'b' ), createCell( 'c' ) ) ],
		};

		expect( moveColumn( attributes, oldColumnIndex, newColumnIndex ) ).toBeNull();
	} );

	it( 'returns null when rows do not have a consistent cell count', () => {
		const attributes = {
			head: [ createRow( createCell( 'h-a' ), createCell( 'h-b' ) ) ],
			body: [ createRow( createCell( 'b-a' ), createCell( 'b-b' ), createCell( 'b-c' ) ) ],
		};

		expect( moveColumn( attributes, 0, 1 ) ).toBeNull();
	} );

	it( 'returns null for malformed section or row shapes', () => {
		expect( moveColumn( { body: 'invalid' }, 0, 1 ) ).toBeNull();
		expect( moveColumn( { body: [ { content: 'missing cells' } ] }, 0, 1 ) ).toBeNull();
	} );

	it( 'returns null when no table rows are available', () => {
		expect( moveColumn( { head: [], body: [], foot: [] }, 0, 0 ) ).toBeNull();
		expect( moveColumn( { caption: 'no sections' }, 0, 0 ) ).toBeNull();
	} );
} );
