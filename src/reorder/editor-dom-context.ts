/**
 * 現在のエディターでDOM / Web APIを利用する際に参照するdocumentとwindowの組を表す。
 *
 * この値は、解決に使用した基準要素と同じエディター表示環境に属する。
 * エディターが再生成された後も有効であることは保証せず、必要な時点で現在の基準要素から解決し直す。
 */
export type EditorDomContext = {
	document: Document;
	window: Window;
};

/**
 * 現在のエディター画面内にある基準要素から、その要素と同じ表示環境のdocumentとwindowを解決する。
 *
 * 基準要素のownerDocumentを現在のdocumentとし、そのdefaultViewを現在のwindowとする。
 * 基準要素とは別のdocumentやwindowを代わりに使用せず、iframeも探索しない。解決結果は保持しない。
 * defaultViewを取得できない場合は、現在のエディター表示環境を解決できないためnullを返す。
 *
 * @param referenceElement 現在のエディター表示環境を特定するための基準要素。
 * @return 基準要素と同じ表示環境のdocumentとwindow。解決できない場合はnull。
 */
export function resolveEditorDomContext( referenceElement: Element ): EditorDomContext | null {
	const editorDocument = referenceElement.ownerDocument;
	const editorWindow = editorDocument.defaultView;

	/*
	 * 基準要素のdocumentに対応するwindowが存在しない場合は、別の表示環境を代用しない。
	 */
	if ( editorWindow === null ) {
		return null;
	}

	return {
		document: editorDocument,
		window: editorWindow,
	};
}
