/**
 * 結合セルにより列DnDを開始できない場合の利用者向け通知表示を検証する。
 *
 * 原因となる結合セル位置と操作位置の表示要求から、表示開始と終了までのPresentation Lifecycleに限定する。
 */

import { act, render, screen } from '@testing-library/react';
import { createRef } from '@wordpress/element';

import {
	ColumnStartRejectionNotice,
	type ColumnStartRejectionNoticeHandle,
} from './start-rejection-notice';

let snackbarRemove: ( () => void ) | undefined;

jest.mock( '@/messages', () => ( {
	getColumnMergedRangeMessage: (
		section: string,
		rowStart: number,
		rowEnd: number,
		columnStart: number,
		columnEnd: number
	) => `column:${ section }:${ rowStart }-${ rowEnd }:${ columnStart }-${ columnEnd }`,
} ) );

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: React.ReactNode; onRemove?: () => void } ) => {
		snackbarRemove = props.onRemove;
		return <div>{ props.children }</div>;
	},
} ) );

const request = {
	blockingMergedRange: {
		section: 'head' as const,
		rowStart: 0,
		rowEnd: 0,
		columnStart: 1,
		columnEnd: 2,
	},
	clientX: 120,
	clientY: 240,
};

describe( 'ColumnStartRejectionNotice', () => {
	beforeEach( () => {
		snackbarRemove = undefined;
	} );

	/**
	 * 原因セル位置を利用者向け位置へ変換し、操作位置付近へ表示することを確認する。
	 *
	 * 期待結果:
	 * - sectionと1-based行・列位置を共通文言へ渡し、指定位置へ表示する。
	 */
	it( 'when a start rejection is shown, should display the one-based blocking range near the interaction position', () => {
		const noticeRef = createRef< ColumnStartRejectionNoticeHandle >();
		const { container } = render( <ColumnStartRejectionNotice ref={ noticeRef } /> );

		act( () => noticeRef.current?.show( request ) );

		expect( screen.queryByText( 'column:head:1-1:2-3' ) ).not.toBeNull();
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
		const noticeRef = createRef< ColumnStartRejectionNoticeHandle >();
		render( <ColumnStartRejectionNotice ref={ noticeRef } /> );
		act( () => noticeRef.current?.show( request ) );

		act( () => snackbarRemove?.() );

		expect( screen.queryByText( 'column:head:1-1:2-3' ) ).toBeNull();
	} );
} );
