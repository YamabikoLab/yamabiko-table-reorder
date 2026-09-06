/**
 * 結合セルにより行DnDを開始できない場合の利用者向け通知表示を検証する。
 *
 * Reorder Target Resolutionの開始可否判定は重複して検証せず、開始拒否理由の通知から表示開始、
 * 表示更新、表示終了までのPresentationのLifecycleに限定する。
 */

import { act, render, screen } from '@testing-library/react';

import { notifyRowStartRejection, RowStartRejectionNotice } from './start-rejection-notice';

let snackbarRemove: ( () => void ) | undefined;

jest.mock( '@/messages', () => ( {
	getRowDndStartRejectionMessage: () => 'start rejection message',
} ) );

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: React.ReactNode; onRemove?: () => void } ) => {
		snackbarRemove = props.onRemove;
		return <div>{ props.children }</div>;
	},
} ) );

describe( 'RowStartRejectionNotice', () => {
	beforeEach( () => {
		snackbarRemove = undefined;
	} );

	/**
	 * 概要:
	 * - Designで定義された結合範囲による開始拒否時だけメッセージを表示することを確認する。
	 * 事前条件:
	 * - 行DnD開始拒否通知はまだ発生していない。
	 * 操作:
	 * - Presentationを描画し、結合範囲による開始拒否理由を通知する。
	 * 期待結果:
	 * - 通知前はメッセージを表示せず、通知後は利用者向け開始拒否メッセージを表示する。
	 */
	it( 'when a merged-range start rejection is notified, should show the rejection message', () => {
		render( <RowStartRejectionNotice /> );

		expect( screen.queryByText( 'start rejection message' ) ).toBeNull();

		act( () => {
			notifyRowStartRejection( 'merged-range' );
		} );

		expect( screen.queryByText( 'start rejection message' ) ).not.toBeNull();
	} );

	/**
	 * 概要:
	 * - 一時通知の表示終了後にメッセージを残さないことを確認する。
	 * 事前条件:
	 * - 結合範囲による開始拒否通知でメッセージが表示されている。
	 * 操作:
	 * - WordPressの一時通知部品から表示終了を通知する。
	 * 期待結果:
	 * - 開始拒否メッセージが表示から除かれる。
	 */
	it( 'when the temporary notice is removed, should hide the rejection message', () => {
		render( <RowStartRejectionNotice /> );

		act( () => {
			notifyRowStartRejection( 'merged-range' );
		} );
		expect( screen.queryByText( 'start rejection message' ) ).not.toBeNull();

		act( () => {
			snackbarRemove?.();
		} );

		expect( screen.queryByText( 'start rejection message' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 表示中に新しい開始拒否通知が発生した場合、先の通知終了で新しい通知を消さないことを確認する。
	 * 事前条件:
	 * - 最初の開始拒否通知によりメッセージが表示されている。
	 * - 最初の通知に対応する表示終了処理を保持している。
	 * 操作:
	 * - 続けて新しい開始拒否通知を発行した後、先の通知に対応する表示終了処理を実行する。
	 * 期待結果:
	 * - 新しい開始拒否メッセージは表示されたままになる。
	 */
	it( 'when a newer rejection notice is shown before the previous notice is removed, should keep the newer notice visible', () => {
		render( <RowStartRejectionNotice /> );

		act( () => {
			notifyRowStartRejection( 'merged-range' );
		} );
		const removePreviousNotice = snackbarRemove;

		act( () => {
			notifyRowStartRejection( 'merged-range' );
		} );

		act( () => {
			removePreviousNotice?.();
		} );

		expect( screen.queryByText( 'start rejection message' ) ).not.toBeNull();
	} );
} );
