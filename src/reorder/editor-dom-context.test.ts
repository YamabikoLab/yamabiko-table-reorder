import { resolveEditorDomContext } from './editor-dom-context';

describe( 'Editor DOM Context', () => {
	/**
	 * 基準要素と同じeditor contextのdocumentとwindowを解決できることを確認する。
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
	 * documentに対応するwindowを取得できない場合はcontextを解決しないことを確認する。
	 *
	 * 事前条件:
	 * - 基準要素がdefaultViewを持たないdocumentに属している。
	 *
	 * 操作:
	 * - その基準要素を指定してEditor DOM Contextを解決する。
	 *
	 * 期待結果:
	 * - global document / windowへfallbackせずnullが返される。
	 */
	it( 'when the reference document has no default view, should return null', () => {
		const detachedDocument = document.implementation.createHTMLDocument();
		const referenceElement = detachedDocument.createElement( 'div' );

		expect( detachedDocument.defaultView ).toBeNull();
		expect( resolveEditorDomContext( referenceElement ) ).toBeNull();
	} );
} );
