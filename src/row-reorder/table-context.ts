/**
 * Table Reorderが利用する table DOM context を解決する。
 *
 * editor canvas referenceが属するdocumentを現在のeditor contextとして扱い、
 * 同じdocument内から対象Table blockとtbodyを組み立てる。
 */

/**
 * 解決済みTable blockが利用するDOM context。
 *
 * `blockElement`、`tbody`はすべて`document`に属し、`window`はその editor browsing
 * context に対応する Window であることを保証する。
 */
export type TableContext = {
	blockElement: HTMLElement;
	document: Document;
	window: Window;
	tbody: HTMLTableSectionElement;
};

/**
 * editor canvas referenceのowning documentからTable ReorderのDOM contextを組み立てる。
 *
 * owning documentの`defaultView`、block、table、先頭tbodyのいずれかを解決できない場合は
 * `null`を返す。
 *
 * @param referenceElement editor canvas内に所有するDOM reference element。
 * @param clientId         同じdocument内で解決するGutenberg blockのclientId。
 */
export const resolveTableContext = (
	referenceElement: Element,
	clientId: string
): TableContext | null => {
	const document = referenceElement.ownerDocument;
	const window = document.defaultView;
	if ( ! window ) {
		return null;
	}

	const blockElement = document.querySelector< HTMLElement >( `[data-block="${ clientId }"]` );
	const table = blockElement?.querySelector< HTMLTableElement >( 'table' ) ?? null;
	const tbody = table?.tBodies.item( 0 ) ?? null;
	if ( ! blockElement || ! table || ! tbody ) {
		return null;
	}

	return {
		blockElement,
		document,
		window,
		tbody,
	};
};
