import { resolveEditorEnvironment } from './editor-environment';

const appendBlock = ( targetDocument: Document, clientId: string ) => {
	const block = targetDocument.createElement( 'div' );
	block.dataset.block = clientId;
	targetDocument.body.append( block );
	return block;
};

describe( 'resolveEditorEnvironment', () => {
	beforeEach( () => {
		document.body.replaceChildren();
	} );

	it( 'prefers the root document when the block exists there', () => {
		const referenceElement = document.createElement( 'span' );
		document.body.append( referenceElement );
		appendBlock( document, 'root-block' );

		const iframe = document.createElement( 'iframe' );
		iframe.name = 'editor-canvas';
		document.body.append( iframe );
		if ( ! iframe.contentDocument ) {
			throw new Error( 'Expected iframe contentDocument in jsdom' );
		}
		appendBlock( iframe.contentDocument, 'root-block' );

		expect( resolveEditorEnvironment( referenceElement, 'root-block' ) ).toEqual( {
			document,
			window,
		} );
	} );

	it( 'falls back to the editor canvas iframe', () => {
		const referenceElement = document.createElement( 'span' );
		document.body.append( referenceElement );
		const iframe = document.createElement( 'iframe' );
		iframe.name = 'editor-canvas';
		document.body.append( iframe );
		if ( ! iframe.contentDocument ) {
			throw new Error( 'Expected iframe document in jsdom' );
		}
		appendBlock( iframe.contentDocument, 'iframe-block' );

		expect( resolveEditorEnvironment( referenceElement, 'iframe-block' ) ).toEqual( {
			document: iframe.contentDocument,
			window: iframe.contentDocument.defaultView,
		} );
	} );

	it( 'searches all editor canvas iframes for the matching block', () => {
		const referenceElement = document.createElement( 'span' );
		document.body.append( referenceElement );

		const firstIframe = document.createElement( 'iframe' );
		firstIframe.name = 'editor-canvas';
		document.body.append( firstIframe );
		if ( ! firstIframe.contentDocument ) {
			throw new Error( 'Expected first iframe contentDocument in jsdom' );
		}
		appendBlock( firstIframe.contentDocument, 'other-block' );

		const secondIframe = document.createElement( 'iframe' );
		secondIframe.name = 'editor-canvas';
		document.body.append( secondIframe );
		if ( ! secondIframe.contentDocument ) {
			throw new Error( 'Expected second iframe contentDocument in jsdom' );
		}
		appendBlock( secondIframe.contentDocument, 'target-block' );

		expect( resolveEditorEnvironment( referenceElement, 'target-block' ) ).toEqual( {
			document: secondIframe.contentDocument,
			window: secondIframe.contentDocument.defaultView,
		} );
	} );

	it( 'resolves the recreated iframe instead of retaining a stale context', () => {
		const referenceElement = document.createElement( 'span' );
		document.body.append( referenceElement );
		const firstIframe = document.createElement( 'iframe' );
		firstIframe.name = 'editor-canvas';
		document.body.append( firstIframe );
		if ( ! firstIframe.contentDocument ) {
			throw new Error( 'Expected iframe contentDocument in jsdom' );
		}
		appendBlock( firstIframe.contentDocument, 'recreated-block' );
		const firstEnvironment = resolveEditorEnvironment( referenceElement, 'recreated-block' );

		firstIframe.remove();
		const secondIframe = document.createElement( 'iframe' );
		secondIframe.name = 'editor-canvas';
		document.body.append( secondIframe );
		if ( ! secondIframe.contentDocument ) {
			throw new Error( 'Expected recreated iframe context in jsdom' );
		}
		appendBlock( secondIframe.contentDocument, 'recreated-block' );

		const secondEnvironment = resolveEditorEnvironment( referenceElement, 'recreated-block' );
		expect( secondEnvironment ).toEqual( {
			document: secondIframe.contentDocument,
			window: secondIframe.contentDocument.defaultView,
		} );
		expect( secondEnvironment?.document ).not.toBe( firstEnvironment?.document );
	} );

	it( 'returns null when no matching editor context can be resolved', () => {
		const referenceElement = document.createElement( 'span' );
		document.body.append( referenceElement );

		expect( resolveEditorEnvironment( referenceElement, 'missing-block' ) ).toBeNull();
	} );
} );
