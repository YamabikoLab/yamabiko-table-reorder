/**
 * 結合セルにより行DnDを開始できない場合の利用者向け通知表示を検証する。
 *
 * Reorder Target Resolutionの開始可否判定は重複して検証せず、blocking merged rangeと操作位置の通知から表示開始、
 * 表示更新、表示終了までのPresentationのLifecycleに限定する。
 */

import { act, render, screen } from '@testing-library/react';

import { notifyRowStartRejection } from './start-rejection-notice-event';
import { RowStartRejectionNotice } from './start-rejection-notice';

let snackbarRemove: ( () => void ) | undefined;

jest.mock( '@/messages', () => ( {
	getRowMergedRangeMessage: ( rowStart: number, rowEnd: number ) => `rows ${ rowStart }-${ rowEnd }`,
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

	afterEach( () => {
		jest.useRealTimers();
	} );

	/**
	 * 概要:
	 * - 結合範囲による開始拒否時に1-based行範囲を操作位置付近へ表示することを確認する。
	 * 事前条件:
	 * - 行DnD開始拒否通知はまだ発生していない。
	 * 操作:
	 * - Presentationを描画し、0-basedで1〜3行目のblocking merged rangeと操作位置を通知する。
	 * 期待結果:
	 * - 通知前はメッセージを表示せず、通知後は2〜4行目として通知された位置へ表示する。
	 */
	it( 'when a merged-range start rejection is notified, should show the 1-based row range near the interaction position', () => {
		const { container } = render( <RowStartRejectionNotice /> );

		expect( screen.queryByText( 'rows 2-4' ) ).toBeNull();

		act( () => {
			notifyRowStartRejection( {
				blockingMergedRange: { rowStart: 1, rowEnd: 3 },
				clientX: 120,
				clientY: 240,
			} );
		} );

		expect( screen.queryByText( 'rows 2-4' ) ).not.toBeNull();
		const notice = container.firstElementChild as HTMLElement | null;
		expect( notice?.style.left ).toBe( '120px' );
		expect( notice?.style.top ).toBe( '240px' );
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
			notifyRowStartRejection( {
				blockingMergedRange: { rowStart: 1, rowEnd: 3 },
				clientX: 120,
				clientY: 240,
			} );
		} );
		expect( screen.queryByText( 'rows 2-4' ) ).not.toBeNull();

		act( () => {
			snackbarRemove?.();
		} );

		expect( screen.queryByText( 'rows 2-4' ) ).toBeNull();
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
			notifyRowStartRejection( {
				blockingMergedRange: { rowStart: 0, rowEnd: 1 },
				clientX: 120,
				clientY: 240,
			} );
		} );
		const removePreviousNotice = snackbarRemove;

		act( () => {
			notifyRowStartRejection( {
				blockingMergedRange: { rowStart: 2, rowEnd: 4 },
				clientX: 180,
				clientY: 300,
			} );
		} );

		act( () => {
			removePreviousNotice?.();
		} );

		expect( screen.queryByText( 'rows 3-5' ) ).not.toBeNull();
	} );

	/**
	 * 概要:
	 * - 連続した開始拒否では最新通知の表示時間を新しい通知から数え直すことを確認する。
	 * 事前条件:
	 * - 最初の開始拒否通知が表示されている。
	 * 操作:
	 * - 表示時間の途中で新しい開始拒否を通知し、最初の通知なら終了する時点まで時間を進める。
	 * 期待結果:
	 * - 最新通知は残り、その通知自身の表示時間が経過した後だけ終了する。
	 */
	it( 'when a newer rejection arrives before the timeout, should restart the display duration for the latest notice', () => {
		jest.useFakeTimers();
		render( <RowStartRejectionNotice /> );

		act( () => {
			notifyRowStartRejection( {
				blockingMergedRange: { rowStart: 0, rowEnd: 1 },
				clientX: 120,
				clientY: 240,
			} );
			jest.advanceTimersByTime( 1000 );
			notifyRowStartRejection( {
				blockingMergedRange: { rowStart: 2, rowEnd: 4 },
				clientX: 180,
				clientY: 300,
			} );
			jest.advanceTimersByTime( 500 );
		} );

		expect( screen.queryByText( 'rows 3-5' ) ).not.toBeNull();

		act( () => {
			jest.advanceTimersByTime( 1000 );
		} );

		expect( screen.queryByText( 'rows 3-5' ) ).toBeNull();
	} );
} );
