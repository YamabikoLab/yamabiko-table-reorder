/**
 * RF InteractionのSession状態専用React接続境界が、Lifecycle同期に必要な状態変更だけを再描画へ伝えることを確認する。
 *
 * RF Sessionの状態正本をReact外から変更し、同一状態内の入力変更とSession Lifecycle遷移に対するHookの更新範囲を検証する。
 */

import { act, renderHook } from '@testing-library/react';

import { useRfInteractionStatus } from './interaction-react';
import { rfInteractionStore } from './interaction';

jest.mock( '@/reorder/row-reorder/responsibilities/table-integration', () => ( {
	rowTableIntegration: {
		getConstraints: jest.fn(),
	},
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/table-integration', () => ( {
	columnTableIntegration: {
		getColumnInputDescriptors: jest.fn(),
	},
} ) );

const ROW_INPUT = {
	sourceRowNumber: '1',
	targetRowNumber: '3',
	position: 'below' as const,
};

const UPDATED_ROW_INPUT = {
	sourceRowNumber: '2',
	targetRowNumber: '3',
	position: 'below' as const,
};

const COLUMN_INPUT = {
	sourceColumnIndex: null,
	targetColumnIndex: null,
	position: null,
};

const resetInteraction = () => {
	act( () => {
		rfInteractionStore.setState( {
			session: { status: 'closed' },
			applyOutcome: { status: 'idle' },
		} );
	} );
};

describe( 'RF Interaction session status React connection', () => {
	beforeEach( () => {
		resetInteraction();
	} );

	afterEach( () => {
		resetInteraction();
	} );

	/**
	 * 概要:
	 * - open中のRF入力変更がLifecycle同期用購読を再描画しないことを確認する。
	 *
	 * 事前条件:
	 * - Table AのSession状態はopenである。
	 *
	 * 操作:
	 * - Session状態をopenのままRow入力だけ変更する。
	 *
	 * 期待結果:
	 * - Hookの返却状態はopenを維持する。
	 * - 入力変更だけではHook consumerは再描画されない。
	 */
	it( 'when RF input changes within the open session, should not rerender the status subscriber', () => {
		act( () => {
			rfInteractionStore.setState( {
				session: {
					status: 'open',
					tableIdentity: 'table-a',
					kind: 'row',
					rowInput: ROW_INPUT,
					columnInput: COLUMN_INPUT,
					evaluation: {
						kind: 'row',
						rowCount: 3,
						result: { status: 'resolved' },
					},
				},
			} );
		} );

		let renderCount = 0;
		const status = renderHook( () => {
			renderCount += 1;
			return useRfInteractionStatus( 'table-a' );
		} );
		const initialRenderCount = renderCount;

		act( () => {
			rfInteractionStore.setState( ( store ) => {
				if ( store.session.status !== 'open' ) {
					return store;
				}

				return {
					session: {
						...store.session,
						rowInput: UPDATED_ROW_INPUT,
					},
				};
			} );
		} );

		expect( status.result.current ).toBe( 'open' );
		expect( renderCount ).toBe( initialRenderCount );
	} );

	/**
	 * 概要:
	 * - RF Session Lifecycleの状態遷移はLifecycle同期用購読へ反映されることを確認する。
	 *
	 * 操作:
	 * - Table AのSessionをclosedからopen、applyingへ遷移させる。
	 *
	 * 期待結果:
	 * - Hookは各Session状態を順に返す。
	 */
	it( 'when the RF session status changes, should publish the lifecycle transition', () => {
		const status = renderHook( () => useRfInteractionStatus( 'table-a' ) );
		expect( status.result.current ).toBe( 'closed' );

		act( () => {
			rfInteractionStore.setState( {
				session: {
					status: 'open',
					tableIdentity: 'table-a',
					kind: 'row',
					rowInput: ROW_INPUT,
					columnInput: COLUMN_INPUT,
					evaluation: {
						kind: 'row',
						rowCount: 3,
						result: { status: 'resolved' },
					},
				},
			} );
		} );
		expect( status.result.current ).toBe( 'open' );

		act( () => {
			rfInteractionStore.setState( {
				session: {
					status: 'applying',
					tableIdentity: 'table-a',
					kind: 'row',
					rowInput: ROW_INPUT,
					columnInput: COLUMN_INPUT,
				},
			} );
		} );
		expect( status.result.current ).toBe( 'applying' );
	} );
} );
