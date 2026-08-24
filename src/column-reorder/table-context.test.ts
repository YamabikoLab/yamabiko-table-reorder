import { getColumnCells, resolveColumnTableContext } from './table-context';

const createTable = ( markup: string ): HTMLTableElement => {
	document.body.innerHTML = markup;
	const table = document.querySelector( 'table' );
	if ( ! table ) {
		throw new Error( 'table fixture was not created' );
	}
	return table;
};

const appendTableBlock = ( targetDocument: Document, clientId: string ) => {
	const block = targetDocument.createElement( 'div' );
	block.dataset.block = clientId;
	const table = targetDocument.createElement( 'table' );
	const tbody = targetDocument.createElement( 'tbody' );
	const row = targetDocument.createElement( 'tr' );
	const cell = targetDocument.createElement( 'td' );
	row.append( cell );
	tbody.append( row );
	table.append( tbody );
	block.append( table );
	targetDocument.body.append( block );
	return { block, cell, table };
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

describe( 'resolveColumnTableContext', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'resolves the Column context from the reference element owning document', () => {
		const referenceElement = document.createElement( 'span' );
		document.body.append( referenceElement );
		const { block, cell, table } = appendTableBlock( document, 'root-block' );

		expect( resolveColumnTableContext( referenceElement, 'root-block' ) ).toEqual( {
			blockElement: block,
			columns: [ cell ],
			document,
			table,
			window,
		} );
	} );

	it( 'uses only the reference element owning document', () => {
		const iframe = document.createElement( 'iframe' );
		document.body.append( iframe );
		if ( ! iframe.contentDocument || ! iframe.contentWindow ) {
			throw new Error( 'Expected iframe document and window in jsdom' );
		}
		const referenceElement = iframe.contentDocument.createElement( 'span' );
		iframe.contentDocument.body.append( referenceElement );
		const iframeTable = appendTableBlock( iframe.contentDocument, 'shared-block' );
		appendTableBlock( document, 'shared-block' );

		expect( resolveColumnTableContext( referenceElement, 'shared-block' ) ).toEqual( {
			blockElement: iframeTable.block,
			columns: [ iframeTable.cell ],
			document: iframe.contentDocument,
			table: iframeTable.table,
			window: iframe.contentWindow,
		} );
	} );

	it( 'does not search another document for the target block', () => {
		const referenceElement = document.createElement( 'span' );
		document.body.append( referenceElement );
		const iframe = document.createElement( 'iframe' );
		document.body.append( iframe );
		if ( ! iframe.contentDocument ) {
			throw new Error( 'Expected iframe contentDocument in jsdom' );
		}
		appendTableBlock( iframe.contentDocument, 'iframe-only-block' );

		expect( resolveColumnTableContext( referenceElement, 'iframe-only-block' ) ).toBeNull();
	} );

	it( 'returns null when the owning document has no defaultView', () => {
		const detachedDocument = document.implementation.createHTMLDocument();
		const referenceElement = detachedDocument.createElement( 'span' );
		detachedDocument.body.append( referenceElement );
		appendTableBlock( detachedDocument, 'detached-block' );

		expect( detachedDocument.defaultView ).toBeNull();
		expect( resolveColumnTableContext( referenceElement, 'detached-block' ) ).toBeNull();
	} );
} );
