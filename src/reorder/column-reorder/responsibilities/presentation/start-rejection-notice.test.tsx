/**
 * 結合セルにより列DnDを開始できない場合の利用者向け通知表示を検証する。
 *
 * 原因となる結合セル位置と操作位置の表示要求から、表示開始と終了までのPresentation Lifecycleに限定する。
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from '@wordpress/element';
import type { ReactNode } from 'react';

import {
	ColumnStartRejectionNotice,
	type ColumnStartRejectionNoticeHandle,
} from './start-rejection-notice';

/* @wordpress/componentsの公開入口はJest変換対象外のESM-only uuidを読み込むため、Snackbarの表示・dismiss境界だけを代替する。 */
jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode; onRemove?: () => void } ) => (
		<button type="button" aria-label="Dismiss this notice" onClick={ props.onRemove }>
			{ props.children }
		</button>
	),
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
const message = 'A merged cell in header row 1 spanning columns 2–3 prevents this move.';

describe( 'ColumnStartRejectionNotice', () => {
	/**
	 * 原因セル位置を利用者向け位置へ変換し、操作位置付近へ表示することを確認する。
	 *
	 * 操作:
	 * - 0-basedの結合セル範囲と操作位置をNoticeへ渡す。
	 *
	 * 期待結果:
	 * - sectionと1-based行・列位置を含む共通文言を、指定位置へ表示する。
	 */
	it( 'when a start rejection is shown, should display the one-based blocking range near the interaction position', () => {
		const noticeRef = createRef< ColumnStartRejectionNoticeHandle >();
		const { container } = render( <ColumnStartRejectionNotice ref={ noticeRef } /> );

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
	 * 事前条件:
	 * - 開始拒否通知によりメッセージが表示されている。
	 *
	 * 操作:
	 * - WordPressの一時通知部品から表示終了を通知する。
	 *
	 * 期待結果:
	 * - 開始拒否メッセージが表示から除かれる。
	 */
	it( 'when the temporary notice is removed, should hide the rejection message', () => {
		const noticeRef = createRef< ColumnStartRejectionNoticeHandle >();
		render( <ColumnStartRejectionNotice ref={ noticeRef } /> );
		act( () => noticeRef.current?.show( request ) );

		fireEvent.click( screen.getByRole( 'button', { name: 'Dismiss this notice' } ) );

		expect( screen.queryByText( message ) ).toBeNull();
	} );
} );
