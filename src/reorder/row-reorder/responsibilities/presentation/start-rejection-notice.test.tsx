/**
 * 結合セルにより行DnDを開始できない場合の利用者向け通知表示を検証する。
 *
 * 原因となる結合セル位置と操作位置の表示要求から、表示開始、更新、終了までのPresentation Lifecycleに限定する。
 */

import { act, render, screen } from '@testing-library/react';
import { createRef } from '@wordpress/element';

import {
	RowStartRejectionNotice,
	type RowStartRejectionNoticeHandle,
} from './start-rejection-notice';

let snackbarRemove: ( () => void ) | undefined;

jest.mock( '@/messages', () => ( {
	getRowMergedRangeMessage: (
		rowStart: number,
		rowEnd: number,
		columnStart: number,
		columnEnd: number
	) => `row:${ rowStart }-${ rowEnd }:${ columnStart }-${ columnEnd }`,
} ) );

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: React.ReactNode; onRemove?: () => void } ) => {
		snackbarRemove = props.onRemove;
		return <div>{ props.children }</div>;
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

		expect( screen.queryByText( 'row:1-2:3-4' ) ).toBeNull();
		act( () => noticeRef.current?.show( request ) );

		expect( screen.queryByText( 'row:1-2:3-4' ) ).not.toBeNull();
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

		act( () => snackbarRemove?.() );

		expect( screen.queryByText( 'row:1-2:3-4' ) ).toBeNull();
	} );

	/**
	 * 表示中に新しい開始拒否が発生した場合、先の通知終了で新しい通知を消さないことを確認する。
	 *
	 * 期待結果:
	 * - 新しい開始拒否メッセージは表示されたままになる。
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
		act( () => removePreviousNotice?.() );

		expect( screen.queryByText( 'row:2-3:3-4' ) ).not.toBeNull();
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
			jest.advanceTimersByTime( 500 );
		} );
		expect( screen.queryByText( 'row:1-2:3-4' ) ).not.toBeNull();

		act( () => jest.advanceTimersByTime( 1000 ) );
		expect( screen.queryByText( 'row:1-2:3-4' ) ).toBeNull();
	} );
} );
