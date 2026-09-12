/**
 * RF InteractionのReact接続境界が、対象Tableに必要な表示状態だけを継続購読することを確認する。
 *
 * RF Sessionの状態変更をReact外から行い、対象Table / 別Tableの見え方、方向固有公開状態、
 * notifyTableChangedによる再評価結果への追従をHook境界から検証する。
 */

import { act, renderHook } from '@testing-library/react';

import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import { columnRfResolution } from './column-resolution';
import { useRfInteraction } from './interaction-react';
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

	/**
	 * 概要:
	 * - Row指定がno-opまたは結合セル制約で拒否された場合にApply不可として公開することを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow入力はInput Interpretationを通過できる。
	 *
	 * 操作:
	 * - Row Resolutionがno-opまたはrejectedを返す状態で入力を更新する。
	 *
	 * 期待結果:
	 * - 方向固有結果がそのまま公開され、canApplyはfalseになる。
	 */
	it.each( [
		[ 'no-op', { status: 'no-op' } as const, { status: 'no-op' } as const ],
		[
			'rejected',
			{ status: 'rejected', blockingMergedRange: { rowStart: 0, rowEnd: 2 } } as const,
			{ status: 'rejected', blockingMergedRange: { rowStart: 0, rowEnd: 2 } } as const,
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
				direction: 'row',
				result: expectedResult,
				canApply: false,
			} );
		}
	);

	/**
	 * 概要:
	 * - 対象Tableの現在情報を取得できない場合に入力を推測せず利用不能として公開することを確認する。
	 *
	 * 操作:
	 * - Table AのRow情報を取得できない状態でRFを開始する。
	 *
	 * 期待結果:
	 * - rowCountはnull、resultはunavailable、canApplyはfalseになる。
	 */
	it( 'when the current row table is unavailable, should publish unavailable as not applicable', () => {
		jest.spyOn( rowTableIntegration, 'getConstraints' ).mockReturnValue( null );
		const tableA = renderHook( () => useRfInteraction( 'table-a' ) );

		act( () => {
			rfInteraction.open( 'table-a' );
		} );

		expect( tableA.result.current ).toMatchObject( {
			status: 'open',
			direction: 'row',
			rowCount: null,
			result: { status: 'unavailable' },
			canApply: false,
		} );
	} );

	/**
	 * 概要:
	 * - Column方向ではColumn入力・現在列記述・Column結果だけを公開することを確認する。
	 *
	 * 操作:
	 * - Table AをColumn方向へ切り替え、Column入力を更新する。
	 *
	 * 期待結果:
	 * - Column方向のdiscriminated stateとして現在入力・列記述・resolved結果が公開される。
	 */
	it( 'when column direction is active, should publish only the current column state', () => {
		const tableA = renderHook( () => useRfInteraction( 'table-a' ) );

		act( () => {
			rfInteraction.open( 'table-a' );
			rfInteraction.selectDirection( 'table-a', 'column' );
			rfInteraction.updateColumnInput( 'table-a', COLUMN_INPUT );
		} );

		expect( tableA.result.current ).toEqual( {
			status: 'open',
			direction: 'column',
			input: COLUMN_INPUT,
			columns: COLUMNS,
			result: { status: 'resolved' },
			canApply: true,
		} );
	} );

	/**
	 * 概要:
	 * - Reactのunmount / remountを越えてRF Sessionが維持されることを確認する。
	 *
	 * 事前条件:
	 * - Table AのRow入力がresolvedになっている。
	 *
	 * 操作:
	 * - Table AのHookをunmountし、同じTable Identityで再度mountする。
	 *
	 * 期待結果:
	 * - 再mount後も同じRow入力と現在結果を購読できる。
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
			direction: 'row',
			input: ROW_INPUT,
			rowCount: 3,
			result: { status: 'resolved' },
			canApply: true,
		} );
	} );
} );
