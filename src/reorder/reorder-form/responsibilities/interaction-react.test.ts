/**
 * RF InteractionのReact接続境界が、対象Tableに必要な表示状態だけを継続購読することを確認する。
 *
 * RF Sessionの状態変更をReact外から行い、対象Table / 別Tableの見え方、方向固有公開状態、
 * notifyTableChangedによる再評価結果への追従をHook境界から検証する。
 */

import { act, renderHook } from '@testing-library/react';

import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import { useRfInteraction } from './interaction-react';
import { rfInteraction, rfInteractionStore } from './interaction';
import { rowRfResolution } from './row-resolution';

const ROW_INPUT = {
	sourceRowNumber: '1',
	targetRowNumber: '3',
	position: 'below' as const,
};

const resetInteraction = () => {
	act( () => {
		rfInteractionStore.setState( { session: { status: 'closed' } } );
	} );
};

describe( 'RF Interaction React connection', () => {
	beforeEach( () => {
		resetInteraction();
		jest.spyOn( rowTableIntegration, 'getConstraints' ).mockReturnValue( {
			rowCount: 3,
			blockedBoundaries: [],
		} );
		jest.spyOn( rowRfResolution, 'resolve' ).mockReturnValue( {
			status: 'resolved',
			candidate: {
				clientId: 'table-a',
				sourceRowIndex: 0,
				destinationBoundaryIndex: 3,
			},
		} );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		resetInteraction();
	} );

	/**
	 * 概要:
	 * - 対象TableのRF状態変更をHookが継続購読し、別Tableには現在Sessionを漏らさないことを確認する。
	 *
	 * 事前条件:
	 * - Table A / BのHookはどちらもclosedを購読している。
	 *
	 * 操作:
	 * - React外からTable AのRFを開始し、Row入力を更新する。
	 *
	 * 期待結果:
	 * - Table AだけがRow open状態と現在結果を受け取り、Table Bはclosedのままとなる。
	 */
	it( 'when one table session changes outside React, should update only that table subscriber', () => {
		const tableA = renderHook( () => useRfInteraction( 'table-a' ) );
		const tableB = renderHook( () => useRfInteraction( 'table-b' ) );

		act( () => {
			rfInteraction.open( 'table-a' );
			rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		} );

		expect( tableA.result.current ).toEqual( {
			status: 'open',
			direction: 'row',
			input: ROW_INPUT,
			rowCount: 3,
			result: { status: 'resolved' },
			canApply: true,
		} );
		expect( tableB.result.current ).toEqual( { status: 'closed' } );
	} );

	/**
	 * 概要:
	 * - Table変更通知による現在Table基準の再評価を、同じHook購読から描画状態へ反映できることを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow入力は3行Tableに対してresolvedである。
	 *
	 * 操作:
	 * - Tableを1行へ変更した状態としてnotifyTableChangedを通知する。
	 *
	 * 期待結果:
	 * - Hookは入力を保持したままrowCount 1、not-ready、canApply falseへ更新される。
	 */
	it( 'when the active table change is notified, should publish the re-evaluated row state', () => {
		const tableA = renderHook( () => useRfInteraction( 'table-a' ) );
		act( () => {
			rfInteraction.open( 'table-a' );
			rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		} );
		jest.spyOn( rowTableIntegration, 'getConstraints' ).mockReturnValue( {
			rowCount: 1,
			blockedBoundaries: [],
		} );

		act( () => {
			rfInteraction.notifyTableChanged( 'table-a' );
		} );

		expect( tableA.result.current ).toEqual( {
			status: 'open',
			direction: 'row',
			input: ROW_INPUT,
			rowCount: 1,
			result: { status: 'not-ready' },
			canApply: false,
		} );
	} );
} );
