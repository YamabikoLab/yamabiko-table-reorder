/**
 * Reorder Form（RF）のApply確定結果を一度だけ通知し、通知開始時に消費することを確認する。
 */

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { RfApplyOutcome } from '@/reorder/reorder-form/responsibilities/interaction';

import { ReorderFormCompletion } from './reorder-form-completion';

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode } ) => <div role="status">{ props.children }</div>,
} ) );

jest.mock( '@/messages', () => ( {
	getLargeReorderCompletionMessage: () => 'Reordering complete.',
	getRfApplyFailureMessage: () => 'Reordering could not be applied. The Table was not changed.',
} ) );

describe( 'Reorder Form completion presentation', () => {
	beforeEach( () => {
		jest.useFakeTimers();
	} );

	afterEach( () => {
		act( () => {
			jest.runOnlyPendingTimers();
		} );
		jest.useRealTimers();
	} );

	/**
	 * 概要:
	 * - 同期反映でも確定済み成功結果から完了通知を開始し、その結果を一度だけ消費することを確認する。
	 *
	 * 事前条件:
	 * - RF Interactionから対象Tableの未消費成功結果が公開されている。
	 *
	 * 操作:
	 * - 完了通知を描画し、結果消費後の状態へ再描画する。
	 *
	 * 期待結果:
	 * - 成功通知が表示される。
	 * - 成功結果は通知開始時に一度だけ消費される。
	 */
	it( 'when a success outcome is published, should notify and consume it once', () => {
		const outcome: RfApplyOutcome = { tableIdentity: 'table-a', result: 'success' };
		const consumeApplyOutcome = jest.fn();
		const view = render(
			<ReorderFormCompletion applyOutcome={ outcome } consumeApplyOutcome={ consumeApplyOutcome } />
		);

		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();
		expect( consumeApplyOutcome ).toHaveBeenCalledTimes( 1 );
		expect( consumeApplyOutcome ).toHaveBeenCalledWith( outcome );

		view.rerender(
			<ReorderFormCompletion applyOutcome={ null } consumeApplyOutcome={ consumeApplyOutcome } />
		);
		expect( consumeApplyOutcome ).toHaveBeenCalledTimes( 1 );

		act( () => {
			jest.runAllTimers();
		} );
		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - Apply失敗では成功通知ではなくTable未変更を伝える失敗通知を表示することを確認する。
	 *
	 * 操作:
	 * - 未消費のfailure結果を通知へ渡す。
	 *
	 * 期待結果:
	 * - 失敗通知が表示され、結果が消費される。
	 */
	it( 'when a failure outcome is published, should show the failure notice and consume it', () => {
		const outcome: RfApplyOutcome = { tableIdentity: 'table-a', result: 'failure' };
		const consumeApplyOutcome = jest.fn();

		render(
			<ReorderFormCompletion applyOutcome={ outcome } consumeApplyOutcome={ consumeApplyOutcome } />
		);

		expect(
			screen.getByText( 'Reordering could not be applied. The Table was not changed.' )
		).not.toBeNull();
		expect( consumeApplyOutcome ).toHaveBeenCalledWith( outcome );
	} );

	/**
	 * 概要:
	 * - 消費済み結果でcomponentが再生成されても過去通知を再表示しないことを確認する。
	 *
	 * 操作:
	 * - 成功結果で一度通知したcomponentをunmountし、結果なしで新しくmountする。
	 *
	 * 期待結果:
	 * - 新しいcomponentでは過去の成功通知を表示しない。
	 */
	it( 'when the component remounts after an outcome was consumed, should not repeat the notice', () => {
		const outcome: RfApplyOutcome = { tableIdentity: 'table-a', result: 'success' };
		const consumeApplyOutcome = jest.fn();
		const first = render(
			<ReorderFormCompletion applyOutcome={ outcome } consumeApplyOutcome={ consumeApplyOutcome } />
		);
		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();
		first.unmount();

		render(
			<ReorderFormCompletion applyOutcome={ null } consumeApplyOutcome={ consumeApplyOutcome } />
		);

		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );
} );
