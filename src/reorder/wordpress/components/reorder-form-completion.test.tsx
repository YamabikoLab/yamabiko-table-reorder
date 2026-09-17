/**
 * Reorder Form（RF）の結果通知入口がRF Interactionの未提示Apply Outcome全体を一度だけ確保して表示することを確認する。
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

const successOutcome = {
	status: 'success' as const,
	tableIdentity: 'table-a',
	moveSummary: {
		kind: 'row' as const,
		sourcePosition: 2,
		destinationPosition: 5,
	},
};

describe( 'Reorder Form completion entry', () => {
	beforeEach( () => {
		mockedUseRfApplyOutcome.mockReset();
		mockedConsumeApplyOutcome.mockReset();
		mockedUseRfApplyOutcome.mockReturnValue( { status: 'idle' } );
	} );

	/** RF成功Outcome全体を確保してからRF Interaction側を一度だけ提示済みにすることを確認する。 */
	it( 'when a successful RF outcome exists before mount, should present it once and mark it presented', () => {
		mockedUseRfApplyOutcome.mockReturnValue( successOutcome );

		const view = render( <ReorderFormCompletion tableIdentity="table-a" /> );
		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();
		expect( mockedConsumeApplyOutcome ).toHaveBeenCalledTimes( 1 );
		expect( mockedConsumeApplyOutcome ).toHaveBeenCalledWith( 'table-a' );

		view.unmount();
		mockedUseRfApplyOutcome.mockReturnValue( { status: 'idle' } );
		render( <ReorderFormCompletion tableIdentity="table-a" /> );
		expect( screen.queryByRole( 'status' ) ).toBeNull();
	} );

	/** 対象Tableに未提示RF結果がなければ通知も提示済み化も行わないことを確認する。 */
	it( 'when the target table has no RF outcome, should not show or consume a notice', () => {
		render( <ReorderFormCompletion tableIdentity="table-b" /> );
		expect( screen.queryByRole( 'status' ) ).toBeNull();
		expect( mockedConsumeApplyOutcome ).not.toHaveBeenCalled();
	} );

	/** failure OutcomeはMove summaryを要求せず同じ入口から失敗通知へ利用できることを確認する。 */
	it( 'when RF apply fails, should show a failure notice and mark the outcome presented', () => {
		mockedUseRfApplyOutcome.mockReturnValue( {
			status: 'failure',
			tableIdentity: 'table-a',
		} );

		render( <ReorderFormCompletion tableIdentity="table-a" /> );

		expect(
			screen.getByText( 'Reordering failed. The table has not been changed.' )
		).not.toBeNull();
		expect( mockedConsumeApplyOutcome ).toHaveBeenCalledTimes( 1 );
	} );

	/** 保持中の提示済みOutcomeによる再render自体を新しいOutcome取得として扱わないことを確認する。 */
	it( 'when a presented outcome remains during rerender, should not mark it presented again', () => {
		mockedUseRfApplyOutcome.mockReturnValue( successOutcome );
		const view = render( <ReorderFormCompletion tableIdentity="table-a" /> );
		expect( mockedConsumeApplyOutcome ).toHaveBeenCalledTimes( 1 );

		mockedUseRfApplyOutcome.mockReturnValue( { status: 'idle' } );
		view.rerender( <ReorderFormCompletion tableIdentity="table-a" /> );

		expect( screen.getByText( 'Reordering complete.' ) ).not.toBeNull();
		expect( mockedConsumeApplyOutcome ).toHaveBeenCalledTimes( 1 );
	} );
} );
