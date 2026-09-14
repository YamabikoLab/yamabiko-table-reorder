/**
 * 結合セルにより行DnDを開始できない場合の利用者向け通知表示を検証する。
 *
 * Reorder Target Resolutionの開始可否判定は重複して検証せず、blocking merged cellと操作位置の通知から表示開始、
 * 表示更新、表示終了までのPresentationのLifecycleに限定する。
 */

import { act, render, screen } from '@testing-library/react';

import { notifyRowStartRejection } from './start-rejection-notice-event';
import { RowStartRejectionNotice } from './start-rejection-notice';

let snackbarRemove: ( () => void ) | undefined;

jest.mock( '@/blocking-merged-cell-message', () => ( {
	getBodyBlockingMergedCellMessage: ( location: {
		rowStart: number;
		rowEnd: number;
		columnStart: number;
		columnEnd: number;
	} ) =>
		`rows ${ location.rowStart }-${ location.rowEnd }, columns ${ location.columnStart }-${ location.columnEnd }`,
} ) );

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: React.ReactNode; onRemove?: () => void } ) => {
		snackbarRemove = props.onRemove;
		return <div>{ props.children }</div>;
	},
} ) );

const firstCell = {
	rowStart: 1,
	rowEnd: 3,
	columnStart: 1,
	columnEnd: 2,
};

const secondCell = {
	rowStart: 2,
	rowEnd: 4,
	columnStart: 3,
	columnEnd: 3,
};

describe( 'RowStartRejectionNotice', () => {
	beforeEach( () => {
		snackbarRemove = undefined;
	} );

	afterEach( () => {
		jest.useRealTimers();
	} );

	it( 'when a merged-cell start rejection is notified, should show the 1-based row and column location near the interaction position', () => {
		const { container } = render( <RowStartRejectionNotice /> );

		expect( screen.queryByText( 'rows 2-4, columns 2-3' ) ).toBeNull();

		act( () => {
			notifyRowStartRejection( {
				blockingMergedCell: firstCell,
				clientX: 120,
				clientY: 240,
			} );
		} );

		expect( screen.queryByText( 'rows 2-4, columns 2-3' ) ).not.toBeNull();
		const notice = container.firstElementChild as HTMLElement | null;
		expect( notice?.style.left ).toBe( '120px' );
		expect( notice?.style.top ).toBe( '240px' );
	} );

	it( 'when the temporary notice is removed, should hide the rejection message', () => {
		render( <RowStartRejectionNotice /> );

		act( () => {
			notifyRowStartRejection( {
				blockingMergedCell: firstCell,
				clientX: 120,
				clientY: 240,
			} );
		} );
		expect( screen.queryByText( 'rows 2-4, columns 2-3' ) ).not.toBeNull();

		act( () => {
			snackbarRemove?.();
		} );

		expect( screen.queryByText( 'rows 2-4, columns 2-3' ) ).toBeNull();
	} );

	it( 'when a newer rejection notice is shown before the previous notice is removed, should keep the newer notice visible', () => {
		render( <RowStartRejectionNotice /> );

		act( () => {
			notifyRowStartRejection( {
				blockingMergedCell: firstCell,
				clientX: 120,
				clientY: 240,
			} );
		} );
		const removePreviousNotice = snackbarRemove;

		act( () => {
			notifyRowStartRejection( {
				blockingMergedCell: secondCell,
				clientX: 180,
				clientY: 300,
			} );
		} );

		act( () => {
			removePreviousNotice?.();
		} );

		expect( screen.queryByText( 'rows 3-5, columns 4-4' ) ).not.toBeNull();
	} );

	it( 'when a newer rejection arrives before the timeout, should restart the display duration for the latest notice', () => {
		jest.useFakeTimers();
		render( <RowStartRejectionNotice /> );

		act( () => {
			notifyRowStartRejection( {
				blockingMergedCell: firstCell,
				clientX: 120,
				clientY: 240,
			} );
			jest.advanceTimersByTime( 1000 );
			notifyRowStartRejection( {
				blockingMergedCell: secondCell,
				clientX: 180,
				clientY: 300,
			} );
			jest.advanceTimersByTime( 500 );
		} );

		expect( screen.queryByText( 'rows 3-5, columns 4-4' ) ).not.toBeNull();

		act( () => {
			jest.advanceTimersByTime( 1000 );
		} );

		expect( screen.queryByText( 'rows 3-5, columns 4-4' ) ).toBeNull();
	} );
} );
