/**
 * RF InteractionのSession状態専用React接続境界が、Lifecycle同期に必要な状態変更だけを再描画へ伝えることを確認する。
 *
 * RF Sessionの状態正本をReact外から変更し、同一状態内の入力変更とSession Lifecycle遷移に対するHookの更新範囲を検証する。
 */

import { act, renderHook } from '@testing-library/react';

import { useRfInteractionStatus } from './interaction-react';
import { rfInteraction } from './interaction';
import {
	createTestTableBlock,
	createTestTableRow,
	resetRfInteractionTestState,
	setTestTableBlocks,
} from './interaction.test-utils';

/* Jestで読み込めないBlock Editor Storeの環境境界だけを代替し、WordPress Dataは実Storeへ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( './block-editor-store.test-utils' ).testBlockEditorStore,
} ) );

const ROW_INPUT = {
	sourceRowNumber: '1',
	targetRowNumber: '3',
	position: 'below' as const,
};

const UPDATED_ROW_INPUT = {
	sourceRowNumber: '2',
	targetRowNumber: '3',
	position: 'above' as const,
};

describe( 'RF Interaction session status React connection', () => {
	beforeEach( () => {
		resetRfInteractionTestState();
		setTestTableBlocks( [
			createTestTableBlock( 'table-a', [
				createTestTableRow( 'row-a' ),
				createTestTableRow( 'row-b' ),
				createTestTableRow( 'row-c' ),
			] ),
		] );
	} );

	afterEach( () => {
		act( () => {
			resetRfInteractionTestState();
		} );
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
			rfInteraction.open( 'table-a' );
			rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		} );

		let renderCount = 0;
		const status = renderHook( () => {
			renderCount += 1;
			return useRfInteractionStatus( 'table-a' );
		} );
		const initialRenderCount = renderCount;

		act( () => {
			rfInteraction.updateRowInput( 'table-a', UPDATED_ROW_INPUT );
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
			rfInteraction.open( 'table-a' );
		} );
		expect( status.result.current ).toBe( 'open' );

		act( () => {
			rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
			rfInteraction.requestApply( 'table-a' );
		} );
		expect( status.result.current ).toBe( 'applying' );
	} );
} );
