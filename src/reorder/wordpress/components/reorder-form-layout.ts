/**
 * Reorder Form（RF）の入力画面をwide / narrowへ切り替えるため、現在Editorの利用可能幅を観測する。
 *
 * RF Interactionとは分離したPresentation状態として扱い、Sidebar等でEditorの実利用領域だけが変化する場合も追従する。
 */

import { useEffect, useState } from '@wordpress/element';

/** TableとRFを同時に確認しやすいwide表示から下部dockへ切り替える基準幅。 */
const narrowViewportWidth = 700;

/** WordPress Editorの主要な編集表示領域。Sidebar開閉による利用可能幅の変化を反映する。 */
const editorContentSelector = '.interface-interface-skeleton__content';

/**
 * RF anchorと同じdocumentから、Sidebar等を除いたEditorの主要表示領域を取得する。
 *
 * @param anchor RF Toolbar入口のDOM要素。
 * @return Editorの主要表示領域。取得できない場合はnull。
 */
const getEditorContent = ( anchor: HTMLElement ): Element | null =>
	anchor.ownerDocument.querySelector( editorContentSelector );

/**
 * 現在EditorでRFが利用できる表示幅を取得する。
 *
 * Editorの主要表示領域を取得できる場合はその実幅を優先し、iframe等で取得できない場合は
 * anchorと同じ表示環境のvisual viewportまたはwindow幅へフォールバックする。
 *
 * @param anchor        RF Toolbar入口のDOM要素。
 * @param editorContent Editorの主要表示領域。
 * @return RF Presentationが利用できる現在幅。表示環境を解決できない場合はnull。
 */
const getAvailableWidth = ( anchor: HTMLElement, editorContent: Element | null ): number | null => {
	const view = anchor.ownerDocument.defaultView;
	if ( view === null ) {
		return null;
	}

	const contentWidth = editorContent?.getBoundingClientRect().width ?? 0;
	if ( contentWidth > 0 ) {
		return contentWidth;
	}

	const availableWidth = view.visualViewport?.width ?? view.innerWidth;
	return availableWidth;
};

/**
 * 現在Editorの利用可能幅に応じたRF narrow表示状態をReactへ提供する。
 *
 * @param anchor RF Toolbar入口のDOM要素。現在Editor DOM Contextの基準として利用する。
 * @return RFを下部dock表示へ切り替える場合はtrue。
 */
export const useReorderFormNarrowLayout = ( anchor: HTMLElement | null ): boolean => {
	const [ isNarrow, setIsNarrow ] = useState( false );

	useEffect( () => {
		if ( anchor === null ) {
			setIsNarrow( false );
			return;
		}

		const view = anchor.ownerDocument.defaultView;
		if ( view === null ) {
			setIsNarrow( false );
			return;
		}

		const editorContent = getEditorContent( anchor );
		const visualViewport = view.visualViewport;
		const updateLayout = (): void => {
			const availableWidth = getAvailableWidth( anchor, editorContent );
			setIsNarrow( availableWidth !== null && availableWidth <= narrowViewportWidth );
		};

		updateLayout();
		view.addEventListener( 'resize', updateLayout );
		visualViewport?.addEventListener( 'resize', updateLayout );

		const ResizeObserverConstructor = view.ResizeObserver;
		const resizeObserver =
			editorContent !== null && ResizeObserverConstructor !== undefined
				? new ResizeObserverConstructor( updateLayout )
				: null;
		resizeObserver?.observe( editorContent as Element );

		return () => {
			view.removeEventListener( 'resize', updateLayout );
			visualViewport?.removeEventListener( 'resize', updateLayout );
			resizeObserver?.disconnect();
		};
	}, [ anchor ] );

	return isNarrow;
};
