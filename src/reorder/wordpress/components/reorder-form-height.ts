/**
 * Reorder Form（RF）の狭い表示で利用者が指定した高さをPresentation状態として所有する。
 *
 * RF Interactionの入力・並び替え状態とは分離し、同じRF Session中のReact再mountやwide / narrow切替では
 * 利用者が指定した高さを維持する。表示可能領域が一時的に不足する場合はCSS側で表示上だけ制限し、
 * 保存している指定高さ自体は変更しない。
 */

import { useEffect } from '@wordpress/element';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

/** RFの狭い表示へ適用する利用者指定高さを公開するCSS custom property。 */
const narrowHeightProperty = '--yamabiko-table-reorder-rf-narrow-height';

/** 高さ変更用グリップとして扱うheader上端の操作領域。 */
const resizeHandleHeight = 18;

/** RF入力画面を低くしすぎず、主要な操作へ内部スクロールで到達できる最小高さ。 */
const minimumNarrowHeight = 180;

/** RF入力画面を高くしすぎず、対象Tableを確認する領域を残す表示領域比率。 */
const maximumViewportRatio = 0.8;

/** RFの狭い表示で利用者が指定した高さを表す。 */
type ReorderFormHeightStore = {
	tableIdentity: string | null;
	height: number | null;
	beginSession: ( tableIdentity: string ) => void;
	setHeight: ( tableIdentity: string, height: number ) => void;
};

/**
 * RF入力画面の高さをReactのmount / unmountから独立して保持する。
 *
 * 新しいRF Sessionでは高さ指定を破棄し、Session中の利用者操作だけを現在Tableへ反映する。
 */
const reorderFormHeightStore = createStore< ReorderFormHeightStore >()( ( set, get ) => ( {
	tableIdentity: null,
	height: null,
	beginSession: ( tableIdentity ) => {
		set( { tableIdentity, height: null } );
	},
	setHeight: ( tableIdentity, height ) => {
		/* 終了済みまたは別Tableの古いPointer操作では現在Sessionの表示高さを変更しない。 */
		if ( get().tableIdentity !== tableIdentity ) {
			return;
		}

		set( { height } );
	},
} ) );

/** RF Session入口と狭い表示のPresentationへ提供する高さ状態操作。 */
export const reorderFormHeight = {
	/**
	 * 新しいRF Sessionを既定高さで開始する。
	 *
	 * @param tableIdentity 新しいRF Sessionの対象Table Identity。
	 */
	beginSession: ( tableIdentity: string ): void => {
		reorderFormHeightStore.getState().beginSession( tableIdentity );
	},
};

/**
 * 狭いRF入力画面の展開中に、高さ変更操作と同一Session中の高さ復元を現在Editor DOMへ接続する。
 *
 * header上端のグリップから開始したPointer操作だけを高さ変更として扱い、フォーム内容の通常スクロールや
 * input操作には介入しない。折りたたみ中はTable確認へ退避する状態として高さ変更を受け付けない。
 * 利用可能高さが縮小した場合の表示上の制限はCSSへ委ねるため、利用者指定高さを上書きせず、
 * 表示領域が戻った場合は元の高さを復元できる。
 *
 * @param tableIdentity RF Session対象Table Identity。
 * @param anchor        RF Toolbar入口のDOM要素。現在Editor DOM Contextの基準として利用する。
 * @param active        RF入力画面を表示するSessionが有効な場合はtrue。
 */
export const useReorderFormNarrowHeight = (
	tableIdentity: string,
	anchor: HTMLElement | null,
	active: boolean
): void => {
	const requestedHeight = useStore( reorderFormHeightStore, ( state ) => {
		const heightForTable = state.tableIdentity === tableIdentity ? state.height : null;
		return heightForTable;
	} );

	useEffect( () => {
		if ( anchor === null || ! active ) {
			return;
		}

		const root = anchor.ownerDocument.documentElement;
		if ( requestedHeight === null ) {
			root.style.removeProperty( narrowHeightProperty );
		} else {
			root.style.setProperty( narrowHeightProperty, `${ requestedHeight }px` );
		}

		return () => {
			root.style.removeProperty( narrowHeightProperty );
		};
	}, [ active, anchor, requestedHeight ] );

	useEffect( () => {
		if ( anchor === null || ! active ) {
			return;
		}

		const ownerDocument = anchor.ownerDocument;
		const view = ownerDocument.defaultView;
		if ( view === null ) {
			return;
		}

		const HTMLElementConstructor = ( view as Window & typeof globalThis ).HTMLElement;
		let pointerId: number | null = null;
		let startY = 0;
		let startHeight = 0;
		let resizeTarget: Element | null = null;

		/**
		 * RF狭い表示のheader上端から始まるprimary pointer操作だけを高さ変更として開始する。
		 *
		 * @param event 現在Editor documentで発生したpointerdown。
		 */
		const startResizing = ( event: PointerEvent ): void => {
			if ( ! event.isPrimary || event.button !== 0 ) {
				return;
			}

			const target = event.target as Element | null;
			const header = target?.closest( '.yamabiko-table-reorder-rf__header' ) ?? null;
			if ( header === null || target?.closest( 'button, input, select, textarea, a' ) !== null ) {
				return;
			}

			/* 折りたたみ中は高さ調整ではなくTable確認への退避状態として扱う。 */
			if (
				header.querySelector(
					'.yamabiko-table-reorder-rf__collapse[aria-expanded="false"]'
				) !== null
			) {
				return;
			}

			const popover = header.closest( '.yamabiko-table-reorder-rf-popover.is-narrow' );
			const content = header.closest( '.components-popover__content' );
			if ( popover === null || content === null ) {
				return;
			}

			const headerRect = header.getBoundingClientRect();
			if ( event.clientY - headerRect.top > resizeHandleHeight ) {
				return;
			}

			pointerId = event.pointerId;
			startY = event.clientY;
			startHeight = content.getBoundingClientRect().height;
			resizeTarget = header;
			if ( 'setPointerCapture' in header ) {
				( header as HTMLElement ).setPointerCapture( event.pointerId );
			}
			event.preventDefault();
		};

		/**
		 * 高さ変更中のPointer移動を利用者指定高さへ変換する。
		 *
		 * @param event 現在Editor documentで発生したpointermove。
		 */
		const resize = ( event: PointerEvent ): void => {
			if ( pointerId === null || event.pointerId !== pointerId ) {
				return;
			}

			const viewportHeight = view.visualViewport?.height ?? view.innerHeight;
			const maximumHeight = Math.max( minimumNarrowHeight, viewportHeight * maximumViewportRatio );
			const requested = startHeight + startY - event.clientY;
			const nextHeight = Math.min( Math.max( requested, minimumNarrowHeight ), maximumHeight );
			reorderFormHeightStore.getState().setHeight( tableIdentity, nextHeight );
			event.preventDefault();
		};

		/**
		 * 現在の高さ変更Pointer操作を終了する。
		 *
		 * @param event 現在Editor documentで発生したpointerupまたはpointercancel。
		 */
		const stopResizing = ( event: PointerEvent ): void => {
			if ( pointerId === null || event.pointerId !== pointerId ) {
				return;
			}

			if (
				resizeTarget instanceof HTMLElementConstructor &&
				resizeTarget.hasPointerCapture?.( event.pointerId )
			) {
				resizeTarget.releasePointerCapture( event.pointerId );
			}
			pointerId = null;
			resizeTarget = null;
		};

		ownerDocument.addEventListener( 'pointerdown', startResizing );
		ownerDocument.addEventListener( 'pointermove', resize );
		ownerDocument.addEventListener( 'pointerup', stopResizing );
		ownerDocument.addEventListener( 'pointercancel', stopResizing );

		return () => {
			ownerDocument.removeEventListener( 'pointerdown', startResizing );
			ownerDocument.removeEventListener( 'pointermove', resize );
			ownerDocument.removeEventListener( 'pointerup', stopResizing );
			ownerDocument.removeEventListener( 'pointercancel', stopResizing );
		};
	}, [ active, anchor, tableIdentity ] );
};
