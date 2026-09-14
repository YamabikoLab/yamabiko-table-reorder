/**
 * 結合セルにより列DnDを開始できない場合の利用者向け通知表示を検証する。
 *
 * Reorder Target Resolutionの開始可否判定は重複して検証せず、blocking merged cellと操作位置の通知から表示開始、
 * 表示終了までのPresentationのLifecycleに限定する。
 */

import { act, render, screen } from '@testing-library/react';

import { notifyColumnStartRejection } from './start-rejection-notice-event';
import { ColumnStartRejectionNotice } from './start-rejection-notice';

let snackbarRemove: ( () => void ) | undefined;

jest.mock( '@/blocking-merged-cell-message', () => ( {
	getBodyBlockingMergedCellMessage: ( location: {
		rowStart: number;
		rowEnd: number;
		columnStart: number;
		columnEnd: number;
	} ) =>
		`body rows ${ location.rowStart }-${ location.rowEnd }, columns ${ location.columnStart }-${ location.columnEnd }`,
	getSectionBlockingMergedCellMessage: (
		section: string,
		location: { rowStart: number; rowEnd: number; columnStart: number; columnEnd: number }
	) =>
		`${ section } rows ${ location.rowStart }-${ location.rowEnd }, columns ${ location.columnStart }-${ location.columnEnd }`,
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

	it( 'when a body merged-cell start rejection is notified, should show its 1-based row and column location near the interaction position', () => {
		const { container } = render( <ColumnStartRejectionNotice /> );

		act( () => {
			notifyColumnStartRejection( {
				blockingMergedCell: {
					section: 'body',
					rowStart: 2,
					rowEnd: 2,
					columnStart: 1,
					columnEnd: 2,
				},
				clientX: 120,
				clientY: 240,
			} );
		} );

		expect( screen.queryByText( 'body rows 3-3, columns 2-3' ) ).not.toBeNull();
		const notice = container.firstElementChild as HTMLElement | null;
		expect( notice?.style.left ).toBe( '120px' );
		expect( notice?.style.top ).toBe( '240px' );
	} );

	it( 'when a header merged cell blocks the column, should keep the section in the message', () => {
		render( <ColumnStartRejectionNotice /> );

		act( () => {
			notifyColumnStartRejection( {
				blockingMergedCell: {
					section: 'head',
					rowStart: 0,
					rowEnd: 1,
					columnStart: 1,
					columnEnd: 2,
				},
				clientX: 120,
				clientY: 240,
			} );
		} );

		expect( screen.queryByText( 'head rows 1-2, columns 2-3' ) ).not.toBeNull();
	} );

	it( 'when the temporary notice is removed, should hide the rejection message', () => {
		render( <ColumnStartRejectionNotice /> );

		act( () => {
			notifyColumnStartRejection( {
				blockingMergedCell: {
					section: 'body',
					rowStart: 2,
					rowEnd: 2,
					columnStart: 1,
					columnEnd: 2,
				},
				clientX: 120,
				clientY: 240,
			} );
		} );

		act( () => {
			snackbarRemove?.();
		} );

		expect( screen.queryByText( 'body rows 3-3, columns 2-3' ) ).toBeNull();
	} );
} );
