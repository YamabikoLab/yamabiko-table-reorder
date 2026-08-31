/**
 * Editor DOM Contextが現在の基準要素に属する表示環境だけを解決することを検証する。
 *
 * iframeと非iframeの両方で、古い表示環境を保持せず、利用できない表示環境を別の値で代用しないことを確認する。
 */

import { resolveEditorDomContext } from './editor-dom-context';

describe( 'Editor DOM Context', () => {
	/**
	 * 基準要素と同じエディター表示環境のdocumentとwindowを解決できることを確認する。
	 *
	 * 事前条件:
	 * - 現在のdocumentに基準要素が存在する。
	 * - そのdocumentには対応するwindowが存在する。
	 *
	 * 操作:
	 * - 基準要素を指定してEditor DOM Contextを解決する。
	 *
	 * 期待結果:
	 * - 基準要素のownerDocumentと、そのdocumentのdefaultViewが返される。
	 */
	it( 'when the reference element belongs to an active document, should return its document and window', () => {
		const referenceElement = document.createElement( 'div' );

		expect( resolveEditorDomContext( referenceElement ) ).toEqual( {
			document: referenceElement.ownerDocument,
			window: referenceElement.ownerDocument.defaultView,
		} );
	} );

	/**
	 * globalとは異なる表示環境に属する基準要素から、その表示環境を解決できることを確認する。
	 *
	 * 事前条件:
	 * - iframe内に、globalとは異なるdocumentとwindowが存在する。
	 * - 基準要素はそのiframe内のdocumentに属している。
	 *
	 * 操作:
	 * - iframe内の基準要素を指定してEditor DOM Contextを解決する。
	 *
	 * 期待結果:
	 * - globalのdocumentやwindowではなく、基準要素のownerDocumentとそのdefaultViewが返される。
	 */
	it( 'when the reference element belongs to a different browsing context, should return that document and window', () => {
		const iframe = document.createElement( 'iframe' );
		document.body.append( iframe );

		const iframeDocument = iframe.contentDocument;
		const iframeWindow = iframe.contentWindow;

		expect( iframeDocument ).not.toBeNull();
		expect( iframeWindow ).not.toBeNull();

		if ( iframeDocument === null || iframeWindow === null ) {
			iframe.remove();
			throw new Error( 'iframe browsing context was not created' );
		}

		const referenceElement = iframeDocument.createElement( 'div' );

		expect( referenceElement.ownerDocument ).not.toBe( document );
		expect( iframeWindow ).not.toBe( window );
		expect( resolveEditorDomContext( referenceElement ) ).toEqual( {
			document: iframeDocument,
			window: iframeWindow,
		} );

		iframe.remove();
	} );

	/**
	 * エディター表示環境が再生成された場合は、現在の基準要素から新しいcontextを解決し直すことを確認する。
	 *
	 * 事前条件:
	 * - 最初のiframeに属する基準要素からcontextを解決済みである。
	 * - その後、別のiframeが現在のエディター表示環境として生成されている。
	 *
	 * 操作:
	 * - 新しいiframeに属する基準要素からEditor DOM Contextを改めて解決する。
	 *
	 * 期待結果:
	 * - 以前のcontextを保持せず、新しい基準要素のdocumentとwindowが返される。
	 */
	it( 'when the editor browsing context changes, should resolve the current reference context again', () => {
		const firstIframe = document.createElement( 'iframe' );
		document.body.append( firstIframe );
		const firstDocument = firstIframe.contentDocument;

		expect( firstDocument ).not.toBeNull();
		if ( firstDocument === null ) {
			firstIframe.remove();
			throw new Error( 'first iframe browsing context was not created' );
		}

		const firstReference = firstDocument.createElement( 'div' );
		const firstContext = resolveEditorDomContext( firstReference );
		firstIframe.remove();

		const currentIframe = document.createElement( 'iframe' );
		document.body.append( currentIframe );
		const currentDocument = currentIframe.contentDocument;
		const currentWindow = currentIframe.contentWindow;

		expect( currentDocument ).not.toBeNull();
		expect( currentWindow ).not.toBeNull();
		if ( currentDocument === null || currentWindow === null ) {
			currentIframe.remove();
			throw new Error( 'current iframe browsing context was not created' );
		}

		const currentReference = currentDocument.createElement( 'div' );
		const currentContext = resolveEditorDomContext( currentReference );

		expect( currentContext ).toEqual( {
			document: currentDocument,
			window: currentWindow,
		} );
		expect( currentContext ).not.toEqual( firstContext );

		currentIframe.remove();
	} );

	/**
	 * documentに対応するwindowを取得できない場合は、別の表示環境を代用しないことを確認する。
	 *
	 * 事前条件:
	 * - 基準要素がdefaultViewを持たないdocumentに属している。
	 *
	 * 操作:
	 * - その基準要素を指定してEditor DOM Contextを解決する。
	 *
	 * 期待結果:
	 * - 他のdocumentやwindowを代わりに使用せずnullが返される。
	 */
	it( 'when the reference document has no default view, should return null', () => {
		const detachedDocument = document.implementation.createHTMLDocument();
		const referenceElement = detachedDocument.createElement( 'div' );

		expect( detachedDocument.defaultView ).toBeNull();
		expect( resolveEditorDomContext( referenceElement ) ).toBeNull();
	} );
} );
