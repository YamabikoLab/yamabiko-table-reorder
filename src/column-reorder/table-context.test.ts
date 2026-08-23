import { getColumnCells } from './table-context';

const createTable = ( markup: string ): HTMLTableElement => {
	document.body.innerHTML = markup;
	const table = document.querySelector( 'table' );
	if ( ! table ) {
		throw new Error( 'table fixture was not created' );
	}
	return table;
};

describe( 'getColumnCells', () => {
	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'returns the first-row cells for a regular table', () => {
		const table = createTable( `
			<table>
				<thead><tr><th>A</th><th>B</th></tr></thead>
				<tbody><tr><td>C</td><td>D</td></tr></tbody>
			</table>
		` );

		const cells = getColumnCells( table );
		expect( cells ).not.toBeNull();
		expect( cells ).toHaveLength( 2 );
		expect( cells?.map( ( cell ) => cell.textContent ) ).toEqual( [ 'A', 'B' ] );
	} );

	it( 'rejects inconsistent physical column counts', () => {
		const table = createTable( `
			<table>
				<tbody>
					<tr><td>A</td><td>B</td></tr>
					<tr><td>C</td></tr>
				</tbody>
			</table>
		` );

		expect( getColumnCells( table ) ).toBeNull();
	} );

	it.each( [
		'<tr><td colspan="2">A</td></tr>',
		'<tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr>',
	] )( 'rejects merged-cell tables: %s', ( rows ) => {
		const table = createTable( `<table><tbody>${ rows }</tbody></table>` );
		expect( getColumnCells( table ) ).toBeNull();
	} );
} );
