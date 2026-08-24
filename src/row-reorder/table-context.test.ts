import { resolveTableContext } from './table-context';

const appendTableBlock = ( targetDocument: Document, clientId: string ) => {
	const block = targetDocument.createElement( 'div' );
	block.dataset.block = clientId;
	const table = targetDocument.createElement( 'table' );
	const tbody = targetDocument.createElement( 'tbody' );
	table.append( tbody );
	block.append( table );
	targetDocument.body.append( block );
	return { block, tbody };
};

describe( 'resolveTableContext', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'resolves the Table context from the reference element owning document', () => {
		const referenceElement = document.createElement( 'span' );
		document.body.append( referenceElement );
		const { block, tbody } = appendTableBlock( document, 'root-block' );

		expect( resolveTableContext( referenceElement, 'root-block' ) ).toEqual( {
			blockElement: block,
			document,
			window,
			tbody,
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

		expect( resolveTableContext( referenceElement, 'shared-block' ) ).toEqual( {
			blockElement: iframeTable.block,
			document: iframe.contentDocument,
			window: iframe.contentWindow,
			tbody: iframeTable.tbody,
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

		expect( resolveTableContext( referenceElement, 'iframe-only-block' ) ).toBeNull();
	} );

	it( 'returns null when a complete Table context cannot be resolved', () => {
		const referenceElement = document.createElement( 'span' );
		document.body.append( referenceElement );
		const block = document.createElement( 'div' );
		block.dataset.block = 'incomplete-block';
		document.body.append( block );

		expect( resolveTableContext( referenceElement, 'missing-block' ) ).toBeNull();
		expect( resolveTableContext( referenceElement, 'incomplete-block' ) ).toBeNull();
	} );
} );
