/**
 * 列DnDを安全に継続できず終了した場合の利用者向け通知表示を検証する。
 *
 * DnD Interactionの終了理由判定は重複して検証せず、通知イベントから表示開始、表示終了、購読解除までのPresentation Lifecycleに限定する。
 */

import { act, render, screen } from '@testing-library/react';

import { ColumnTerminationNotice } from './termination-notice';

let terminationListener: ( () => void ) | null = null;
let snackbarRemove: ( () => void ) | undefined;

jest.mock( '@/messages', () => ( {
	getDndTerminationMessage: () => 'termination message',
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/dnd-interaction', () => ( {
	subscribeColumnDndTerminationNotice: ( listener: () => void ) => {
		terminationListener = listener;
		return () => {
			terminationListener = null;
		};
	},
} ) );

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: React.ReactNode; onRemove?: () => void } ) => {
		snackbarRemove = props.onRemove;
		return <div>{ props.children }</div>;
	},
} ) );

describe( 'ColumnTerminationNotice', () => {
	beforeEach( () => {
		terminationListener = null;
		snackbarRemove = undefined;
	} );

	/**
	 * DnD Interactionが通知対象と判断した終了だけを利用者向け表示へ接続することを確認する。
	 *
	 * 事前条件:
	 * - 列DnD終了通知はまだ発生していない。
	 *
	 * 操作:
	 * - Presentationを描画し、DnD Interactionから終了通知を発行する。
	 *
	 * 期待結果:
	 * - 通知前はメッセージを表示しない。
	 * - 通知後は利用者向け終了メッセージを表示する。
	 */
	it( 'when a termination notice is emitted, should show the termination message', () => {
		render( <ColumnTerminationNotice /> );

		expect( screen.queryByText( 'termination message' ) ).toBeNull();

		act( () => {
			terminationListener?.();
		} );

		expect( screen.queryByText( 'termination message' ) ).not.toBeNull();
	} );

	/**
	 * 一時通知の表示終了後にメッセージを残さないことを確認する。
	 *
	 * 事前条件:
	 * - 終了通知によりメッセージが表示されている。
	 *
	 * 操作:
	 * - WordPressの一時通知部品から表示終了を通知する。
	 *
	 * 期待結果:
	 * - 終了メッセージが表示から除かれる。
	 */
	it( 'when the temporary notice is removed, should hide the termination message', () => {
		render( <ColumnTerminationNotice /> );

		act( () => {
			terminationListener?.();
		} );

		act( () => {
			snackbarRemove?.();
		} );

		expect( screen.queryByText( 'termination message' ) ).toBeNull();
	} );

	/**
	 * Presentation終了時にDnD Interactionの終了通知購読を解除することを確認する。
	 *
	 * 事前条件:
	 * - Presentationが終了通知を購読している。
	 *
	 * 操作:
	 * - Presentationをunmountする。
	 *
	 * 期待結果:
	 * - 終了通知の購読が残らない。
	 */
	it( 'when the presentation unmounts, should unsubscribe from termination notices', () => {
		const { unmount } = render( <ColumnTerminationNotice /> );
		expect( terminationListener ).not.toBeNull();

		unmount();

		expect( terminationListener ).toBeNull();
	} );
} );
