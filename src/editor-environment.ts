/**
 * WordPress / Gutenberg editor browsing context の discovery を集約する。
 *
 * この境界は iframe / non-iframe の探索だけを担当し、DOM-local な Web API 利用を
 * wrapper 化しない。解決結果は都度生成し、iframe lifecycle をまたいで cache しない。
 */

/** 解決済み editor browsing context。 */
export type EditorEnvironment = {
	document: Document;
	window: Window;
};

/**
 * clientId に対応する block が document 内に存在するか確認する。
 *
 * @param document 探索対象 document。
 * @param clientId Gutenberg block の clientId。
 */
const containsBlock = ( document: Document, clientId: string ): boolean =>
	document.querySelector( `[data-block="${ clientId }"]` ) !== null;

/**
 * anchor の owning document を起点に、現在の editor browsing context を解決する。
 *
 * non-iframe editor を優先し、対象 block が root document に存在しない場合だけ
 * `iframe[name="editor-canvas"]` をすべて探索する。結果は cache しないため、iframe が
 * teardown / recreation された場合は次回呼び出しで新しい context を解決する。
 *
 * @param anchor   editor context 探索の起点となる DOM element。
 * @param clientId 解決対象 Gutenberg block の clientId。
 * @return 現在の editor document / window。解決できない場合は null。
 */
export const resolveEditorEnvironment = (
	anchor: Element,
	clientId: string
): EditorEnvironment | null => {
	const rootDocument = anchor.ownerDocument;
	if ( containsBlock( rootDocument, clientId ) ) {
		const view = rootDocument.defaultView;
		return view ? { document: rootDocument, window: view } : null;
	}

	const editorCanvases = rootDocument.querySelectorAll< HTMLIFrameElement >(
		'iframe[name="editor-canvas"]'
	);
	for ( const iframe of Array.from( editorCanvases ) ) {
		const editorDocument = iframe.contentDocument;
		if ( ! editorDocument || ! containsBlock( editorDocument, clientId ) ) {
			continue;
		}

		const editorWindow = editorDocument.defaultView;
		if ( ! editorWindow ) {
			continue;
		}

		return {
			document: editorDocument,
			window: editorWindow,
		};
	}

	return null;
};
