/**
 * Reorder Form（RF）の完了通知がRF Interactionの未消費Apply結果から正常完了だけを一度通知することを確認する。
 */

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { rfInteractionStore } from '@/reorder/reorder-form/responsibilities/interaction';

import { ReorderFormCompletion } from './reorder-form-completion';

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode } ) => <div role="status">{ props.children }</div>,
} ) );

jest.mock( '@/messages', () => ( {
	getLargeReorderCompletionMessage: () => 'Reordering complete.',
} ) );

const resetInteractionOutcome = () => {
	rfInteractionStore.setState( {
		session: { status: 'closed' },
		applyOutcome: { status: 'idle' },
	} );
};

describe( 'Reorder Form completion presentation', () => {
	beforeEach( () => {
		jest.useFakeTimers();
		resetInteractionOutcome();
	} );

	afterEach( () => {
		act( () => {
			jest.runOnlyPendingTimers();
		} );
		jest.useRealTimers();
		resetInteractionOutcome();
	} );

	/**
	 * 概要:
	 * - RF反映成功がReact描画前に完了していても完了通知を一度だけ表示できることを確認する。
	 *
	 * 事前条件:
	 * - Table Aの正常反映結果がRF Interactionに未消費で保持されている。
	 *
	 * 操作:
	 * - Table Aの完了通知をmountし、その後いったんunmountして再mountする。
	 *
	 * 期待結果:
	 * - 最初のmountでは完了通知が表示される。
	 * - 成功結果は消費され、再mountでは同じ完了を重複通知しない。
	 */
	it( 'when a successful RF outcome exists before mount, should notify once and consume it', () => {
		rfInteractionStore.setState( {
			applyOutcome: { status: 'success', tableIdentity: 'table-a' },
		} );

		const view = render( <ReorderFormCompletion tableIdentity="table-a" /> );
		expect( screen.getByRole( 'status' ) ).not.toBeNull();
		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( { status: 'idle' } );

		view.unmount();
		render( <ReorderFormCompletion tableIdentity="table-a" /> );
		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 別TableのRF成功結果を誤って通知しないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aの正常反映結果が未消費で保持されている。
	 *
	 * 操作:
	 * - Table Bの完了通知を表示する。
	 *
	 * 期待結果:
	 * - Table Bには完了通知を表示しない。
	 * - Table Aの未消費結果は保持される。
	 */
	it( 'when another table owns the successful RF outcome, should not show or consume it', () => {
		rfInteractionStore.setState( {
			applyOutcome: { status: 'success', tableIdentity: 'table-a' },
		} );

		render( <ReorderFormCompletion tableIdentity="table-b" /> );

		expect( screen.queryByRole( 'status' ) ).toBeNull();
		expect( rfInteractionStore.getState().applyOutcome ).toEqual( {
			status: 'success',
			tableIdentity: 'table-a',
		} );
	} );

	/**
	 * 概要:
	 * - RF反映失敗では成功通知を表示しないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aの反映失敗結果がRF Interactionに保持されている。
	 *
	 * 操作:
	 * - Table Aの完了通知を表示する。
	 *
	 * 期待結果:
	 * - 成功通知は表示されない。
	 */
	it( 'when RF apply fails, should not show a completion notice', () => {
		rfInteractionStore.setState( {
			applyOutcome: { status: 'failure', tableIdentity: 'table-a' },
		} );

		render( <ReorderFormCompletion tableIdentity="table-a" /> );

		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 正常完了通知が利用者に認識できる時間だけ表示されることを確認する。
	 *
	 * 事前条件:
	 * - Table Aの正常反映結果が未消費で保持されている。
	 *
	 * 操作:
	 * - 完了通知の表示開始から2秒経過させる。
	 *
	 * 期待結果:
	 * - 2秒経過前は通知が表示され、2秒経過後は終了する。
	 */
	it( 'when a completion notice has been visible for two seconds, should remove it', () => {
		rfInteractionStore.setState( {
			applyOutcome: { status: 'success', tableIdentity: 'table-a' },
		} );
		render( <ReorderFormCompletion tableIdentity="table-a" /> );

		act( () => {
			jest.advanceTimersByTime( 1999 );
		} );
		expect( screen.getByRole( 'status' ) ).not.toBeNull();

		act( () => {
			jest.advanceTimersByTime( 1 );
		} );
		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );
} );
