/**
 * RF InteractionのReact接続境界が、対象Tableに必要な表示状態と未消費の反映結果だけを継続購読することを確認する。
 *
 * RF SessionとApply Outcomeの状態変更をReact外から行い、対象Table / 別Tableの見え方、Reorder Kind固有公開状態、
 * notifyTableChangedによる再評価結果への追従、再mount後の結果保持をHook境界から検証する。
 */

import { act, renderHook } from '@testing-library/react';

import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import { columnRfResolution } from './column-resolution';
import { useRfApplyOutcome, useRfInteraction } from './interaction-react';
import { rfInteraction, rfInteractionStore } from './interaction';
import { rowRfResolution } from './row-resolution';

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
const COLUMN_INPUT = {
	sourceColumnIndex: 0,
	targetColumnIndex: 2,
	position: 'right' as const,
};
const COLUMNS = [
	{ columnIndex: 0, columnNumber: 1, heading: 'A' },
	{ columnIndex: 1, columnNumber: 2, heading: 'B' },
	{ columnIndex: 2, columnNumber: 3, heading: 'C' },
];

const resetInteraction = () => {
	act( () => {
		rfInteractionStore.setState( {
			session: { status: 'closed' },
			applyOutcome: { status: 'idle' },
		} );
	} );
};

describe( 'RF Interaction React connection', () => {
	beforeEach( () => {
		resetInteraction();
		jest.spyOn( rowTableIntegration, 'getConstraints' ).mockReturnValue( {
			rowCount: 3,
			blockedBoundaries: [],
		} );
		jest.spyOn( columnTableIntegration, 'getColumnInputDescriptors' ).mockReturnValue( COLUMNS );
		jest.spyOn( rowRfResolution, 'resolve' ).mockReturnValue( {
			status: 'resolved',
			candidate: {
				clientId: 'table-a',
				sourceRowIndex: 0,
				destinationBoundaryIndex: 3,
			},
		} );
		jest.spyOn( columnRfResolution, 'resolve' ).mockReturnValue( {
			status: 'resolved',
			candidate: {
				clientId: 'table-a',
				sourceColumnIndex: 0,
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
			kind: 'row',
			input: ROW_INPUT,
			rowCount: 3,
			result: { status: 'resolved' },
			canApply: true,
		} );
		expect( tableB.result.current ).toEqual( { status: 'closed' } );
	} );

	/**
	 * 概要:
	 * - Table変更通知による現在Table基準の再評価を、入力問題を含めて同じHook購読から描画状態へ反映できることを確認する。
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
			kind: 'row',
			input: ROW_INPUT,
			rowCount: 1,
			result: {
				status: 'not-ready',
				inputProblems: [
					{
						target: 'target',
						correction: { kind: 'row-number-range', min: 1, max: 1 },
					},
				],
			},
			canApply: false,
		} );
	} );

	/**
	 * 概要:
	 * - Row指定がno-opまたは結合セル制約で拒否された場合にApply不可として公開することを確認する。
	 */
	it.each( [
		[ 'no-op', { status: 'no-op' } as const, { status: 'no-op' } as const ],
		[
			'rejected',
			{
				status: 'rejected',
				blockingMergedRange: {
					rowStart: 0,
					rowEnd: 2,
					columnStart: 1,
					columnEnd: 1,
				},
			} as const,
			{
				status: 'rejected',
				blockingMergedRange: {
					rowStart: 0,
					rowEnd: 2,
					columnStart: 1,
					columnEnd: 1,
				},
			} as const,
		],
	] )(
		'when row resolution is %s, should publish the result as not applicable',
		( _status, resolution, expectedResult ) => {
			jest.spyOn( rowRfResolution, 'resolve' ).mockReturnValue( resolution );
			const tableA = renderHook( () => useRfInteraction( 'table-a' ) );

			act( () => {
				rfInteraction.open( 'table-a' );
				rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
			} );

			expect( tableA.result.current ).toMatchObject( {
				status: 'open',
				kind: 'row',
				result: expectedResult,
				canApply: false,
			} );
		}
	);

	/**
	 * 概要:
	 * - 対象Tableの現在情報を取得できない場合に入力を推測せず利用不能として公開することを確認する。
	 */
	it( 'when the current row table is unavailable, should publish unavailable as not applicable', () => {
		jest.spyOn( rowTableIntegration, 'getConstraints' ).mockReturnValue( null );
		const tableA = renderHook( () => useRfInteraction( 'table-a' ) );

		act( () => {
			rfInteraction.open( 'table-a' );
		} );

		expect( tableA.result.current ).toMatchObject( {
			status: 'open',
			kind: 'row',
			rowCount: null,
			result: { status: 'unavailable' },
			canApply: false,
		} );
	} );

	/**
	 * 概要:
	 * - Column ReorderではColumn入力・現在列記述・Column結果だけを公開することを確認する。
	 */
	it( 'when column kind is active, should publish only the current column state', () => {
		const tableA = renderHook( () => useRfInteraction( 'table-a' ) );

		act( () => {
			rfInteraction.open( 'table-a' );
			rfInteraction.selectKind( 'table-a', 'column' );
			rfInteraction.updateColumnInput( 'table-a', COLUMN_INPUT );
		} );

		expect( tableA.result.current ).toEqual( {
			status: 'open',
			kind: 'column',
			input: COLUMN_INPUT,
			columns: COLUMNS,
			result: { status: 'resolved' },
			canApply: true,
		} );
	} );

	/**
	 * 概要:
	 * - Reactのunmount / remountを越えてRF Sessionが維持されることを確認する。
	 */
	it( 'when the React subscriber remounts, should preserve the RF session state', () => {
		const firstMount = renderHook( () => useRfInteraction( 'table-a' ) );
		act( () => {
			rfInteraction.open( 'table-a' );
			rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		} );
		firstMount.unmount();

		const remounted = renderHook( () => useRfInteraction( 'table-a' ) );

		expect( remounted.result.current ).toEqual( {
			status: 'open',
			kind: 'row',
			input: ROW_INPUT,
			rowCount: 3,
			result: { status: 'resolved' },
			canApply: true,
		} );
	} );

	/**
	 * 概要:
	 * - 未消費のRF反映結果を対象Tableだけへ公開し、React再mountでは失わないことを確認する。
	 */
	it( 'when an RF apply outcome remains unconsumed, should expose it only to the owning table across remounts', () => {
		act( () => {
			rfInteractionStore.setState( {
				applyOutcome: { status: 'failure', tableIdentity: 'table-a' },
			} );
		} );
		const tableA = renderHook( () => useRfApplyOutcome( 'table-a' ) );
		const tableB = renderHook( () => useRfApplyOutcome( 'table-b' ) );

		expect( tableA.result.current ).toEqual( {
			status: 'failure',
			tableIdentity: 'table-a',
		} );
		expect( tableB.result.current ).toEqual( { status: 'idle' } );

		tableA.unmount();
		const remounted = renderHook( () => useRfApplyOutcome( 'table-a' ) );
		expect( remounted.result.current ).toEqual( {
			status: 'failure',
			tableIdentity: 'table-a',
		} );
	} );
} );
