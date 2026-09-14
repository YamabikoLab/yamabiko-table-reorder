/**
 * 結合セルにより列DnDを開始できない場合の利用者向け通知表示を検証する。
 *
 * Reorder Target Resolutionの開始可否判定は重複して検証せず、blocking merged rangeと操作位置の通知から表示開始、
 * 表示終了までのPresentationのLifecycleに限定する。
 */

import { act, render, screen } from '@testing-library/react';

import { notifyColumnStartRejection } from './start-rejection-notice-event';
import { ColumnStartRejectionNotice } from './start-rejection-notice';

let snackbarRemove: ( () => void ) | undefined;

jest.mock( '@/messages', () => ( {
	getColumnMergedRangeMessage: ( columnStart: number, columnEnd: number ) =>
		`columns ${ columnStart }-${ columnEnd }`,
} ) );

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: React.ReactNode; onRemove?: () => void } ) => {
		snackbarRemove = props.onRemove;
		return <div>{ props.children }</div>;
	},
} ) );

describe( 'ColumnStartRejectionNotice', () => {
	beforeEach( () => {
		snackbarRemove = undefined;
	} );

	afterEach( () => {
		jest.useRealTimers();
	} );

	/**
	 * 結合範囲による開始拒否を1-based列範囲として操作位置付近へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 列DnD開始拒否通知はまだ発生していない。
	 *
	 * 操作:
	 * - Presentationを描画し、0-basedで1〜2列目のblocking merged rangeと操作位置を通知する。
	 *
	 * 期待結果:
	 * - 通知前はメッセージを表示しない。
	 * - 通知後は2〜3列目として通知された位置へ表示する。
	 */
	it( 'when a merged-range start rejection is notified, should show the 1-based column range near the interaction position', () => {
		const { container } = render( <ColumnStartRejectionNotice /> );

		expect( screen.queryByText( 'columns 2-3' ) ).toBeNull();

		act( () => {
			notifyColumnStartRejection( {
				blockingMergedRange: { columnStart: 1, columnEnd: 2 },
				clientX: 120,
				clientY: 240,
			} );
		} );

		expect( screen.queryByText( 'columns 2-3' ) ).not.toBeNull();
		const notice = container.firstElementChild as HTMLElement | null;
		expect( notice?.style.left ).toBe( '120px' );
		expect( notice?.style.top ).toBe( '240px' );
	} );

	/**
	 * 一時通知の表示終了後にメッセージを残さないことを確認する。
	 *
	 * 事前条件:
	 * - 結合範囲による開始拒否通知でメッセージが表示されている。
	 *
	 * 操作:
	 * - WordPressの一時通知部品から表示終了を通知する。
	 *
	 * 期待結果:
	 * - 開始拒否メッセージが表示から除かれる。
	 */
	it( 'when the temporary notice is removed, should hide the rejection message', () => {
		render( <ColumnStartRejectionNotice /> );

		act( () => {
			notifyColumnStartRejection( {
				blockingMergedRange: { columnStart: 1, columnEnd: 2 },
				clientX: 120,
				clientY: 240,
			} );
		} );

		act( () => {
			snackbarRemove?.();
		} );

		expect( screen.queryByText( 'columns 2-3' ) ).toBeNull();
	} );
} );
