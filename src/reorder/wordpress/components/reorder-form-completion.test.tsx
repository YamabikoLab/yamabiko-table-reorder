/**
 * Reorder Form（RF）の結果通知がRF Interactionの未消費Apply結果から成功・失敗を一度だけ通知することを確認する。
 */

import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { rfInteraction } from '@/reorder/reorder-form/responsibilities/interaction';
import { useRfApplyOutcome } from '@/reorder/reorder-form/responsibilities/interaction-react';

import { ReorderFormCompletion } from './reorder-form-completion';

jest.mock( '@wordpress/components', () => ( {
	Snackbar: ( props: { children: ReactNode } ) => <div role="status">{ props.children }</div>,
} ) );

jest.mock( '@/messages', () => ( {
	getLargeReorderCompletionMessage: () => 'Reordering complete.',
	getRfApplyFailureMessage: () => 'Reordering failed. The table has not been changed.',
} ) );

jest.mock( '@/reorder/reorder-form/responsibilities/interaction', () => ( {
	rfInteraction: {
		consumeApplyOutcome: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/reorder-form/responsibilities/interaction-react', () => ( {
	useRfApplyOutcome: jest.fn(),
} ) );

const mockedUseRfApplyOutcome = jest.mocked( useRfApplyOutcome );
const mockedConsumeApplyOutcome = jest.mocked( rfInteraction.consumeApplyOutcome );

describe( 'Reorder Form completion presentation', () => {
	beforeEach( () => {
		jest.useFakeTimers();
		mockedUseRfApplyOutcome.mockReset();
		mockedConsumeApplyOutcome.mockReset();
		mockedUseRfApplyOutcome.mockReturnValue( { status: 'idle' } );
	} );

	afterEach( () => {
		act( () => {
			jest.runOnlyPendingTimers();
		} );
		jest.useRealTimers();
	} );

	/**
	 * 概要:
	 * - RF反映成功がReact描画前に完了していても完了通知を一度だけ表示できることを確認する。
	 *
	 * 事前条件:
	 * - Table Aの正常反映結果がRF Interactionから未消費結果として公開されている。
	 *
	 * 操作:
	 * - Table Aの完了通知をmountし、成功結果の消費後に再mountする。
	 *
	 * 期待結果:
	 * - 最初のmountでは完了通知が表示され、Table Aの成功結果が消費される。
	 * - 消費後の再mountでは同じ完了を重複通知しない。
	 */
	it( 'when a successful RF outcome exists before mount, should notify once and consume it', () => {
		mockedUseRfApplyOutcome.mockReturnValue( {
			status: 'success',
			tableIdentity: 'table-a',
		} );

		const view = render( <ReorderFormCompletion tableIdentity="table-a" /> );
		expect( screen.getByRole( 'status' ) ).not.toBeNull();
		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();
		expect( mockedConsumeApplyOutcome ).toHaveBeenCalledTimes( 1 );
		expect( mockedConsumeApplyOutcome ).toHaveBeenCalledWith( 'table-a' );

		view.unmount();
		mockedUseRfApplyOutcome.mockReturnValue( { status: 'idle' } );
		render( <ReorderFormCompletion tableIdentity="table-a" /> );
		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 対象Tableに未消費のRF結果がない場合は通知も消費も行わないことを確認する。
	 *
	 * 事前条件:
	 * - Table Bから見たRF Apply Outcomeはidleである。
	 *
	 * 操作:
	 * - Table Bの結果通知を表示する。
	 *
	 * 期待結果:
	 * - 結果通知を表示しない。
	 * - Apply Outcomeを消費しない。
	 */
	it( 'when the target table has no RF outcome, should not show or consume a notice', () => {
		render( <ReorderFormCompletion tableIdentity="table-b" /> );

		expect( screen.queryByRole( 'status' ) ).toBeNull();
		expect( mockedConsumeApplyOutcome ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - RF反映失敗を成功と区別した結果通知として表示できることを確認する。
	 *
	 * 事前条件:
	 * - Table Aの反映失敗結果がRF Interactionから未消費結果として公開されている。
	 *
	 * 操作:
	 * - Table Aの結果通知を表示する。
	 *
	 * 期待結果:
	 * - Tableが変更されていないことを含む失敗通知が表示される。
	 * - Table Aの失敗結果が消費される。
	 */
	it( 'when RF apply fails, should show a failure notice and consume the outcome', () => {
		mockedUseRfApplyOutcome.mockReturnValue( {
			status: 'failure',
			tableIdentity: 'table-a',
		} );

		render( <ReorderFormCompletion tableIdentity="table-a" /> );

		expect(
			screen.getByText( 'Reordering failed. The table has not been changed.' )
		).not.toBeNull();
		expect( mockedConsumeApplyOutcome ).toHaveBeenCalledTimes( 1 );
		expect( mockedConsumeApplyOutcome ).toHaveBeenCalledWith( 'table-a' );
	} );

	/**
	 * 概要:
	 * - 結果通知の表示中に次のRF反映結果が届いた場合、最新結果を利用者が確認できることを確認する。
	 *
	 * 事前条件:
	 * - Table Aの成功通知が表示中である。
	 *
	 * 操作:
	 * - 成功通知の表示開始から1秒後にTable Aのfailure Outcomeを受け取る。
	 *
	 * 期待結果:
	 * - 表示内容は失敗通知へ切り替わる。
	 * - 前回通知の残り時間では終了せず、失敗通知を受け取ってから2秒間表示される。
	 * - success / failureの各Outcomeが一度ずつ消費される。
	 */
	it( 'when another RF outcome arrives while a notice is visible, should show the latest result for a full notice duration', () => {
		mockedUseRfApplyOutcome.mockReturnValue( {
			status: 'success',
			tableIdentity: 'table-a',
		} );
		const view = render( <ReorderFormCompletion tableIdentity="table-a" /> );

		act( () => {
			jest.advanceTimersByTime( 1000 );
		} );
		mockedUseRfApplyOutcome.mockReturnValue( {
			status: 'failure',
			tableIdentity: 'table-a',
		} );
		view.rerender( <ReorderFormCompletion tableIdentity="table-a" /> );

		expect(
			screen.getByText( 'Reordering failed. The table has not been changed.' )
		).not.toBeNull();
		expect( mockedConsumeApplyOutcome ).toHaveBeenCalledTimes( 2 );
		expect( mockedConsumeApplyOutcome ).toHaveBeenNthCalledWith( 1, 'table-a' );
		expect( mockedConsumeApplyOutcome ).toHaveBeenNthCalledWith( 2, 'table-a' );

		act( () => {
			jest.advanceTimersByTime( 1000 );
		} );
		expect( screen.getByRole( 'status' ) ).not.toBeNull();

		act( () => {
			jest.advanceTimersByTime( 1000 );
		} );
		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - RF結果通知が利用者に認識できる時間だけ表示されることを確認する。
	 *
	 * 事前条件:
	 * - Table Aの正常反映結果がRF Interactionから未消費結果として公開されている。
	 *
	 * 操作:
	 * - 結果通知の表示開始から2秒経過させる。
	 *
	 * 期待結果:
	 * - 2秒経過前は通知が表示され、2秒経過後は終了する。
	 */
	it( 'when a completion notice has been visible for two seconds, should remove it', () => {
		mockedUseRfApplyOutcome.mockReturnValue( {
			status: 'success',
			tableIdentity: 'table-a',
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
