/**
 * Reorder Form（RF）が端末種別ではなく現在Editorの実利用幅からwide / narrow表示を判定することを確認する。
 */

import { act, renderHook } from '@testing-library/react';

import { useReorderFormNarrowLayout } from './reorder-form-layout';

describe( 'Reorder Form responsive layout', () => {
	/**
	 * Sidebar等によってEditorの主要表示領域だけが狭くなった場合もnarrow表示へ切り替わることを確認する。
	 *
	 * 事前条件:
	 * - ブラウザwindow自体はwideである。
	 * - Editorの主要表示領域はnarrow幅である。
	 *
	 * 操作:
	 * - RF Presentationを表示する。
	 * - その後、Editorの主要表示領域をwide幅へ変更する。
	 *
	 * 期待結果:
	 * - 初期表示ではnarrowと判定される。
	 * - Editorの主要表示領域が広がるとwideへ戻る。
	 */
	it( 'when the editor content width changes independently from the window, should update the narrow layout from that content width', () => {
		let contentWidth = 620;
		let resizeCallback: ResizeObserverCallback | null = null;
		class TestResizeObserver implements ResizeObserver {
			constructor( callback: ResizeObserverCallback ) {
				resizeCallback = callback;
			}

			disconnect(): void {}
			observe(): void {}
			unobserve(): void {}
		}
		Object.defineProperty( window, 'ResizeObserver', {
			configurable: true,
			value: TestResizeObserver,
		} );
		Object.defineProperty( window, 'innerWidth', {
			configurable: true,
			value: 1200,
		} );
		Object.defineProperty( window, 'visualViewport', {
			configurable: true,
			value: undefined,
		} );

		const editorContent = document.createElement( 'div' );
		editorContent.className = 'interface-interface-skeleton__content';
		editorContent.getBoundingClientRect = () =>
			( { width: contentWidth } as DOMRect );
		document.body.appendChild( editorContent );
		const anchor = document.createElement( 'button' );

		const layoutHook = renderHook( () => useReorderFormNarrowLayout( anchor ) );
		expect( layoutHook.result.current ).toBe( true );

		contentWidth = 900;
		act( () => {
			resizeCallback?.( [], {} as ResizeObserver );
		} );

		expect( layoutHook.result.current ).toBe( false );
		editorContent.remove();
	} );
} );
