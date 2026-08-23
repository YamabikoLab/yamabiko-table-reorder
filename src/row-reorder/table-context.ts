/**
 * Table Reorderが利用する table DOM context を解決する。
 *
 * editor browsing context の detection / discovery は Editor Environment に委譲し、
 * この module は解決済み editor document から対象 Table block と tbody を組み立てる。
 */

import { resolveEditorEnvironment } from '@/common/editor-environment';

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
 * anchorを起点に解決した Editor Environment からTable ReorderのDOM contextを組み立てる。
 *
 * block、table、先頭tbodyのいずれかを解決できない場合は`null`を返す。
 *
 * @param anchor   Table blockの探索起点となるDOM element。
 * @param clientId 解決対象となるGutenberg blockのclientId。
 */
export const resolveTableContext = ( anchor: Element, clientId: string ): TableContext | null => {
	const environment = resolveEditorEnvironment( anchor, clientId );
	if ( ! environment ) {
		return null;
	}

	const blockElement = environment.document.querySelector< HTMLElement >(
		`[data-block="${ clientId }"]`
	);
	const table = blockElement?.querySelector< HTMLTableElement >( 'table' ) ?? null;
	const tbody = table?.tBodies.item( 0 ) ?? null;
	if ( ! blockElement || ! table || ! tbody ) {
		return null;
	}

	return {
		blockElement,
		document: environment.document,
		window: environment.window,
		tbody,
	};
};
