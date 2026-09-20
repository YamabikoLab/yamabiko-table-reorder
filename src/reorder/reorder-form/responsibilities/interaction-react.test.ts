/**
 * RF InteractionのReact接続境界が、対象Tableに必要な表示状態と未消費の反映結果だけを継続購読することを確認する。
 *
 * RF SessionとApply Outcomeの状態変更をReact外から行い、対象Table / 別Tableの見え方、Reorder Kind固有公開状態、
 * notifyTableChangedによる再評価結果への追従、再mount後の結果保持をHook境界から検証する。
 */

import { act, renderHook } from '@testing-library/react';

import { useRfApplyOutcome, useRfInteraction } from './interaction-react';
import { rfInteraction, rfInteractionStore } from './interaction';
import {
	createTestTableBlock,
	createTestTableRow,
	installTestTableStore,
	resetRfInteractionTestState,
	setTestTableBlocks,
	updateTestTableAttributes,
} from './interaction.test-utils';

/* Jestで読み込めないBlock Editor Storeの環境境界だけをTest Doubleとし、YTRのProduction責務は実接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: Symbol( 'block-editor-store' ),
} ) );

jest.mock( '@wordpress/data', () => {
	const actualData = jest.requireActual( '@wordpress/data' );
	return Object.defineProperties( Object.create( actualData ), {
		dispatch: { enumerable: true, value: jest.fn() },
		select: { enumerable: true, value: jest.fn() },
	} );
} );

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

const createDefaultTable = ( clientId: string ) =>
	createTestTableBlock(
		clientId,
		[
			createTestTableRow( `${ clientId }-row-a` ),
			createTestTableRow( `${ clientId }-row-b` ),
			createTestTableRow( `${ clientId }-row-c` ),
		],
		[ { cells: [ { content: 'A' }, { content: 'B' }, { content: 'C' } ] } ]
	);

describe( 'RF Interaction React connection', () => {
	beforeEach( () => {
		installTestTableStore();
		resetRfInteractionTestState();
		setTestTableBlocks( [ createDefaultTable( 'table-a' ), createDefaultTable( 'table-b' ) ] );
	} );

	afterEach( () => {
		act( () => {
			resetRfInteractionTestState();
		} );
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
	 * - Input Interpretationが返したtargetの入力問題と現在有効な行番号範囲も同じ結果から取得できる。
	 */
	it( 'when the active table change is notified, should publish the re-evaluated row state', () => {
		const tableA = renderHook( () => useRfInteraction( 'table-a' ) );
		act( () => {
			rfInteraction.open( 'table-a' );
			rfInteraction.updateRowInput( 'table-a', ROW_INPUT );
		} );
		updateTestTableAttributes( 'table-a', {
			body: [ createTestTableRow( 'current-row' ) ],
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
	 *
	 * 事前条件:
	 * - Table AのRow入力はInput Interpretationを通過できる。
	 *
	 * 操作:
	 * - Row Resolutionがno-opまたはrejectedを返す状態で入力を更新する。
	 *
	 * 期待結果:
	 * - Reorder Kind固有結果がそのまま公開され、canApplyはfalseになる。
	 */
	it.each( [
		[
			'no-op',
			[
				createTestTableRow( 'row-a' ),
				createTestTableRow( 'row-b' ),
				createTestTableRow( 'row-c' ),
			],
			{
				sourceRowNumber: '1',
				targetRowNumber: '2',
				position: 'above' as const,
			},
			{ status: 'no-op' } as const,
		],
		[
			'rejected',
			[
				{ cells: [ { content: 'A', rowspan: 2 }, { content: 'B' } ] },
				{ cells: [ { content: 'B2' } ] },
				{ cells: [ { content: 'A3' }, { content: 'B3' } ] },
			],
			ROW_INPUT,
			{
				status: 'rejected',
				blockingMergedRange: {
					rowStart: 0,
					rowEnd: 1,
					columnStart: 0,
					columnEnd: 0,
				},
			} as const,
		],
	] )(
		'when row resolution is %s, should publish the result as not applicable',
		( _status, body, input, expectedResult ) => {
			setTestTableBlocks( [ createTestTableBlock( 'table-a', body ) ] );
			const tableA = renderHook( () => useRfInteraction( 'table-a' ) );

			act( () => {
				rfInteraction.open( 'table-a' );
				rfInteraction.updateRowInput( 'table-a', input );
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
	 *
	 * 操作:
	 * - Table AのRow情報を取得できない状態でRFを開始する。
	 *
	 * 期待結果:
	 * - rowCountはnull、resultはunavailable、canApplyはfalseになる。
	 */
	it( 'when the current row table is unavailable, should publish unavailable as not applicable', () => {
		setTestTableBlocks( [ createDefaultTable( 'table-b' ) ] );
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
	 *
	 * 操作:
	 * - Table AをColumn Reorderへ切り替え、Column入力を更新する。
	 *
	 * 期待結果:
	 * - Column Reorderのdiscriminated stateとして現在入力・列記述・resolved結果が公開される。
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
	 *
	 * 事前条件:
	 * - Table Aのfailure OutcomeがRF Interactionに保持されている。
	 *
	 * 操作:
	 * - Table A / BでOutcomeを購読し、Table Aの購読をunmountして再度mountする。
	 *
	 * 期待結果:
	 * - Table Aだけがfailureを受け取り、Table Bはidleとなる。
	 * - Table Aの再mount後も未消費failureを引き続き購読できる。
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
