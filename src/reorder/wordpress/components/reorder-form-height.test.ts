/**
 * Reorder Form（RF）の狭い表示で利用者が指定した高さがRF Sessionの寿命で保持・初期化されることを確認する。
 */

import { act, renderHook } from '@testing-library/react';

import { reorderFormHeight, useReorderFormNarrowHeight } from './reorder-form-height';

/**
 * 高さ変更操作を受ける狭いRF入力画面を現在documentへ作成する。
 *
 * @return RF Toolbar入口、高さ変更用header、折りたたみ操作。
 */
const createNarrowForm = () => {
	const anchor = document.createElement( 'button' );
	const popover = document.createElement( 'div' );
	const content = document.createElement( 'div' );
	const header = document.createElement( 'div' );
	const collapse = document.createElement( 'button' );
	popover.className = 'yamabiko-table-reorder-rf-popover is-narrow';
	content.className = 'components-popover__content';
	header.className = 'yamabiko-table-reorder-rf__header';
	collapse.className = 'yamabiko-table-reorder-rf__collapse';
	collapse.setAttribute( 'aria-expanded', 'true' );
	popover.append( content );
	content.append( header );
	header.append( collapse );
	document.body.append( anchor, popover );

	header.getBoundingClientRect = () => ( { top: 100 } ) as DOMRect;
	content.getBoundingClientRect = () => ( { height: 300 } ) as DOMRect;
	Object.assign( header, {
		hasPointerCapture: () => false,
		releasePointerCapture: jest.fn(),
		setPointerCapture: jest.fn(),
	} );

	return { anchor, collapse, header, popover };
};

/**
 * Pointer Event相当の入力を現在documentへ通知する。
 *
 * @param type      Pointer Event種別。
 * @param target    Eventの対象要素。
 * @param clientY   viewport上の縦位置。
 * @param pointerId Pointer操作の識別子。
 */
const dispatchPointer = (
	type: 'pointerdown' | 'pointermove' | 'pointerup',
	target: Element,
	clientY: number,
	pointerId = 1
): void => {
	const event = new Event( type, { bubbles: true, cancelable: true } );
	Object.defineProperties( event, {
		button: { value: 0 },
		clientY: { value: clientY },
		isPrimary: { value: true },
		pointerId: { value: pointerId },
	} );
	target.dispatchEvent( event );
};

describe( 'Reorder Form narrow height presentation state', () => {
	beforeEach( () => {
		document.body.replaceChildren();
		document.documentElement.style.removeProperty( '--yamabiko-table-reorder-rf-narrow-height' );
	} );

	/**
	 * 利用者が狭いRF入力画面の高さを変更した場合、同じRF Session中は再表示後も指定高さを維持することを確認する。
	 *
	 * 事前条件:
	 * - 狭いRF入力画面が300pxの高さで表示されている。
	 *
	 * 操作:
	 * - 上端グリップを40px上へ移動する。
	 * - RF Presentationをunmountして同じSessionで再mountする。
	 *
	 * 期待結果:
	 * - 340pxの利用者指定高さが再表示後も適用される。
	 */
	it( 'when the user resizes the narrow form, should preserve the requested height across presentation remounts in the same RF session', () => {
		reorderFormHeight.beginSession( 'table-remount' );
		const { anchor, header } = createNarrowForm();
		const firstRender = renderHook( () =>
			useReorderFormNarrowHeight( 'table-remount', anchor, true )
		);

		act( () => {
			dispatchPointer( 'pointerdown', header, 108 );
			dispatchPointer( 'pointermove', header, 68 );
			dispatchPointer( 'pointerup', header, 68 );
		} );

		expect(
			document.documentElement.style.getPropertyValue( '--yamabiko-table-reorder-rf-narrow-height' )
		).toBe( '340px' );

		firstRender.unmount();
		const secondRender = renderHook( () =>
			useReorderFormNarrowHeight( 'table-remount', anchor, true )
		);

		expect(
			document.documentElement.style.getPropertyValue( '--yamabiko-table-reorder-rf-narrow-height' )
		).toBe( '340px' );
		secondRender.unmount();
	} );

	/**
	 * 折りたたみ中のRFでは高さ変更操作を受け付けず、展開前に指定した高さを維持することを確認する。
	 *
	 * 事前条件:
	 * - 狭いRF入力画面で利用者指定高さが340pxに変更されている。
	 * - RFが折りたたまれている。
	 *
	 * 操作:
	 * - 折りたたみ表示の上端をさらに40px上へドラッグする。
	 *
	 * 期待結果:
	 * - 利用者指定高さは340pxのまま変更されない。
	 */
	it( 'when the narrow form is collapsed, should ignore resize gestures and preserve the requested height', () => {
		reorderFormHeight.beginSession( 'table-collapsed' );
		const { anchor, collapse, header } = createNarrowForm();
		const heightHook = renderHook( () =>
			useReorderFormNarrowHeight( 'table-collapsed', anchor, true )
		);

		act( () => {
			dispatchPointer( 'pointerdown', header, 108 );
			dispatchPointer( 'pointermove', header, 68 );
			dispatchPointer( 'pointerup', header, 68 );
		} );
		expect(
			document.documentElement.style.getPropertyValue( '--yamabiko-table-reorder-rf-narrow-height' )
		).toBe( '340px' );

		collapse.setAttribute( 'aria-expanded', 'false' );
		act( () => {
			dispatchPointer( 'pointerdown', header, 108 );
			dispatchPointer( 'pointermove', header, 68 );
			dispatchPointer( 'pointerup', header, 68 );
		} );

		expect(
			document.documentElement.style.getPropertyValue( '--yamabiko-table-reorder-rf-narrow-height' )
		).toBe( '340px' );
		heightHook.unmount();
	} );

	/**
	 * 新しいRF Sessionでは前回の利用者指定高さを引き継がないことを確認する。
	 *
	 * 事前条件:
	 * - 前回のRF Sessionで狭い入力画面の高さが変更されている。
	 *
	 * 操作:
	 * - 同じTableで新しいRF Sessionを開始する。
	 *
	 * 期待結果:
	 * - 利用者指定高さは破棄され、狭い表示は既定高さを利用できる状態へ戻る。
	 */
	it( 'when a new RF session starts for the same table, should reset the requested narrow height', () => {
		reorderFormHeight.beginSession( 'table-reopen' );
		const { anchor, header } = createNarrowForm();
		const heightHook = renderHook( () =>
			useReorderFormNarrowHeight( 'table-reopen', anchor, true )
		);
		act( () => {
			dispatchPointer( 'pointerdown', header, 108 );
			dispatchPointer( 'pointermove', header, 68 );
			dispatchPointer( 'pointerup', header, 68 );
		} );

		act( () => {
			reorderFormHeight.beginSession( 'table-reopen' );
		} );

		expect(
			document.documentElement.style.getPropertyValue( '--yamabiko-table-reorder-rf-narrow-height' )
		).toBe( '' );
		heightHook.unmount();
	} );
} );
