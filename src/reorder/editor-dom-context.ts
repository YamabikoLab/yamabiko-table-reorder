/**
 * 現在のeditorでDOM / Web APIを利用するためのdocumentとwindowを表す。
 *
 * このcontextは、解決に使用した基準要素と同じeditor lifecycleに属する。
 * editor lifecycleをまたいだ有効性は保証しない。
 */
export type EditorDomContext = {
	document: Document;
	window: Window;
};

/**
 * 現在のeditor canvas内に存在する基準要素からeditor DOM contextを解決する。
 *
 * 基準要素が属するdocumentと、そのdocumentに対応するwindowだけを返す。
 * global document / windowへのfallbackやiframe探索は行わず、解決結果も保持しない。
 * documentに対応するwindowを取得できない場合は、現在のeditor contextを解決できないためnullを返す。
 */
export function resolveEditorDomContext(
	referenceElement: Element
): EditorDomContext | null {
	const editorDocument = referenceElement.ownerDocument;
	const editorWindow = editorDocument.defaultView;

	if ( editorWindow === null ) {
		return null;
	}

	return {
		document: editorDocument,
		window: editorWindow,
	};
}
