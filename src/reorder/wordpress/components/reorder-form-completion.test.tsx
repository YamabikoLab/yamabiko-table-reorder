/**
 * Reorder Form（RF）の結果通知入口がRF Interactionの未消費Apply結果から成功・失敗を一度だけ通知することを確認する。
 */

import { render, screen } from '@testing-library/react';
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

describe( 'Reorder Form completion entry', () => {
	beforeEach( () => {
		mockedUseRfApplyOutcome.mockReset();
		mockedConsumeApplyOutcome.mockReset();
		mockedUseRfApplyOutcome.mockReturnValue( { status: 'idle' } );
	} );

	/**
	 * RF反映成功がReact描画前に完了していても完了通知を一度だけ開始できることを確認する。
	 *
	 * 事前条件:
	 * - Table Aの正常反映結果がRF Interactionから未消費結果として公開されている。
	 *
	 * 操作:
	 * - Table Aの完了通知をmountし、成功結果の消費後に再mountする。
	 *
	 * 期待結果:
	 * - 最初のmountでは成功通知が表示され、Table Aの成功結果が消費される。
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
	 * 対象Tableに未消費のRF結果がない場合は通知も消費も行わないことを確認する。
	 *
	 * 事前条件:
	 * - Table Bから見たRF Apply Outcomeはidleである。
	 *
	 * 操作:
	 * - Table Bの結果通知入口を表示する。
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
	 * RF反映失敗を成功と区別した結果通知として開始できることを確認する。
	 *
	 * 事前条件:
	 * - Table Aの反映失敗結果がRF Interactionから未消費結果として公開されている。
	 *
	 * 操作:
	 * - Table Aの結果通知入口を表示する。
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
} );
