/**
 * 結合セルにより行DnDを開始できない場合の利用者向け通知表示を検証する。
 *
 * 原因となる結合セル位置と操作位置の表示要求から、表示開始、更新、終了までのPresentation Lifecycleに限定する。
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from '@wordpress/element';
import type { ReactNode } from 'react';

import {
	RowStartRejectionNotice,
	type RowStartRejectionNoticeHandle,
} from './start-rejection-notice';
import { DND_START_REJECTION_NOTICE_DURATION_MS } from '@/reorder/reorder-tuning';

let snackbarRemove: ( () => void ) | undefined;

/* @wordpress/componentsの公開入口はJest変換対象外のESM-only uuidを読み込むため、Snackbarの表示・dismiss境界だけを代替する。 */
jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode; onRemove?: () => void } ) => {
		snackbarRemove = props.onRemove;
		return (
			<button type="button" aria-label="Dismiss this notice" onClick={ props.onRemove }>
				{ props.children }
			</button>
		);
	},
} ) );

const request = {
	blockingMergedRange: {
		rowStart: 0,
		rowEnd: 1,
		columnStart: 2,
		columnEnd: 3,
	},
	clientX: 120,
	clientY: 240,
};
const message = 'A merged cell spanning rows 1–2 and columns 3–4 prevents this move.';
const newerMessage = 'A merged cell spanning rows 2–3 and columns 3–4 prevents this move.';

describe( 'RowStartRejectionNotice', () => {
	beforeEach( () => {
		snackbarRemove = undefined;
	} );

	afterEach( () => {
		jest.useRealTimers();
	} );

	/**
	 * 原因セル位置を利用者向け位置へ変換し、操作位置付近へ表示することを確認する。
	 *
	 * 操作:
	 * - 0-basedの結合セル範囲と操作位置をNoticeへ渡す。
	 *
	 * 期待結果:
	 * - 行・列位置が1-basedへ変換された共通文言を、指定位置へ表示する。
	 */
	it( 'when a start rejection is shown, should display the one-based blocking range near the interaction position', () => {
		const noticeRef = createRef< RowStartRejectionNoticeHandle >();
		const { container } = render( <RowStartRejectionNotice ref={ noticeRef } /> );

		expect( screen.queryByText( message ) ).toBeNull();
		act( () => noticeRef.current?.show( request ) );

		expect( screen.queryByText( message ) ).not.toBeNull();
		const notice = container.firstElementChild as HTMLElement | null;
		expect( notice?.style.left ).toBe( '120px' );
		expect( notice?.style.top ).toBe( '240px' );
	} );

	/**
	 * 一時通知の表示終了後にメッセージを残さないことを確認する。
	 *
	 * 期待結果:
	 * - WordPressの一時通知部品から終了すると表示が除かれる。
	 */
	it( 'when the temporary notice is removed, should hide the rejection message', () => {
		const noticeRef = createRef< RowStartRejectionNoticeHandle >();
		render( <RowStartRejectionNotice ref={ noticeRef } /> );
		act( () => noticeRef.current?.show( request ) );

		fireEvent.click( screen.getByRole( 'button', { name: 'Dismiss this notice' } ) );

		expect( screen.queryByText( message ) ).toBeNull();
	} );

	/**
	 * 表示中に新しい開始拒否が発生した場合、先の通知終了で新しい通知を消さないことを確認する。
	 *
	 * 操作:
	 * - 新しい開始拒否を表示した後、先の通知に対応する表示終了を通知する。
	 *
	 * 期待結果:
	 * - 先のメッセージは除かれ、新しい開始拒否メッセージは表示されたままになる。
	 */
	it( 'when a newer rejection is shown before the previous notice is removed, should keep the newer notice visible', () => {
		const noticeRef = createRef< RowStartRejectionNoticeHandle >();
		render( <RowStartRejectionNotice ref={ noticeRef } /> );
		act( () => noticeRef.current?.show( request ) );
		const removePreviousNotice = snackbarRemove;

		act(
			() =>
				noticeRef.current?.show( {
					...request,
					blockingMergedRange: { ...request.blockingMergedRange, rowStart: 1, rowEnd: 2 },
				} )
		);
		/* keyによるSnackbar置換後の古いonRemoveは公開操作から決定的に再現できないため、この競合入力だけ保持したコールバックで発生させる。 */
		act( () => removePreviousNotice?.() );

		expect( screen.queryByText( message ) ).toBeNull();
		expect( screen.queryByText( newerMessage ) ).not.toBeNull();
	} );

	/**
	 * 連続した開始拒否では最新通知の表示時間を新しい要求から数え直すことを確認する。
	 *
	 * 期待結果:
	 * - 最新通知は自身の表示時間が経過した後だけ終了する。
	 */
	it( 'when a newer rejection arrives before the timeout, should restart the display duration for the latest notice', () => {
		jest.useFakeTimers();
		const noticeRef = createRef< RowStartRejectionNoticeHandle >();
		render( <RowStartRejectionNotice ref={ noticeRef } /> );

		act( () => {
			noticeRef.current?.show( request );
			jest.advanceTimersByTime( 1000 );

			noticeRef.current?.show( { ...request, clientX: 180 } );

			jest.advanceTimersByTime( DND_START_REJECTION_NOTICE_DURATION_MS - 1 );
		} );

		expect( screen.queryByText( message ) ).not.toBeNull();

		act( () => jest.advanceTimersByTime( 1 ) );

		expect( screen.queryByText( message ) ).toBeNull();
	} );
} );
