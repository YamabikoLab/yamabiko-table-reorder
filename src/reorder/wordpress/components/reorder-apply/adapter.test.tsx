/**
 * WordPress Reorder Apply Integrationのadapterが、Production Apply Lifecycleを既存Presentation契約へ変換することを確認する。
 */

import { act, renderHook } from '@testing-library/react';

import {
	applyLargeColumnReorder,
	cancelLargeColumnReorderApply,
	completeLargeColumnReorderApply,
	getLargeColumnReorderApplyState,
} from '@/reorder/column-reorder/responsibilities/reorder-apply';
import * as rfApplyCoordination from '@/reorder/reorder-form/responsibilities/apply-coordination';
import {
	createTestTableBlock,
	createTestTableRow,
	resetRfInteractionTestState,
	setTestTableBlocks,
} from '@/reorder/reorder-form/responsibilities/interaction.test-utils';
import {
	applyLargeRowReorder,
	cancelLargeRowReorderApply,
	completeLargeRowReorderApply,
	getLargeRowReorderApplyState,
	requestLargeRowReorderApply,
} from '@/reorder/row-reorder/responsibilities/reorder-apply';

import { useReorderApplyPresentationState } from './adapter';

/*
 * @wordpress/block-editorの公開入口はJest変換対象外のmarked ESMを経由するため直接読み込めない。
 * Table Integrationが必要とするStore境界だけを既存Test Storeへ置き換え、実@wordpress/data経路を利用する。
 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual(
		'@/reorder/reorder-form/responsibilities/block-editor-store.test-utils'
	).testBlockEditorStore,
} ) );

const rowMove = {
	tableIdentity: 'table-a',
	sourceRowIndex: 0,
	destinationBoundaryIndex: 4,
};

/**
 * 指定Table Identityの4行Tableを作成する。
 *
 * @param tableIdentity Table個体を識別するclientId。
 * @param columnCount   各行の物理セル数。
 */
const createRowTable = ( tableIdentity: string, columnCount: number ) =>
	createTestTableBlock(
		tableIdentity,
		Array.from( { length: 4 }, ( _value, rowIndex ) =>
			createTestTableRow( `row-${ rowIndex + 1 }`, columnCount )
		)
	);

/**
 * 指定Table Identityの4列Tableを作成する。
 *
 * @param tableIdentity Table個体を識別するclientId。
 * @param rowCount      Tableの行数。
 */
const createColumnTable = ( tableIdentity: string, rowCount: number ) =>
	createTestTableBlock(
		tableIdentity,
		Array.from( { length: rowCount }, ( _value, rowIndex ) =>
			createTestTableRow( `column-row-${ rowIndex + 1 }`, 4 )
		)
	);

/** Row / Column Apply Lifecycleを公開操作だけで通常状態へ戻す。 */
const restoreDirectionApplyLifecycles = (): void => {
	const rowState = getLargeRowReorderApplyState();
	if ( rowState.phase === 'confirming' ) {
		cancelLargeRowReorderApply();
	} else if ( rowState.phase === 'applying' ) {
		applyLargeRowReorder();
		completeLargeRowReorderApply();
	} else if ( rowState.phase === 'remounting' ) {
		completeLargeRowReorderApply();
	}

	const columnState = getLargeColumnReorderApplyState();
	if ( columnState.phase === 'confirming' ) {
		cancelLargeColumnReorderApply();
	} else if ( columnState.phase === 'applying' ) {
		applyLargeColumnReorder();
		completeLargeColumnReorderApply();
	} else if ( columnState.phase === 'remounting' ) {
		completeLargeColumnReorderApply();
	}
};

/**
 * RF確認待ちになる大規模な行移動をProduction Apply Coordinationへ要求する。
 *
 * @param tableIdentity 反映対象TableのIdentity。
 */
const requestLargeRfRowMove = ( tableIdentity = 'table-a' ): void => {
	setTestTableBlocks( [ createRowTable( tableIdentity, 167 ) ] );
	rfApplyCoordination.receiveRfApplyRequest(
		{
			kind: 'row',
			candidate: {
				clientId: tableIdentity,
				sourceRowIndex: 0,
				destinationBoundaryIndex: 4,
			},
		},
		jest.fn()
	);
};

/** RF確認待ちになる大規模な列移動をProduction Apply Coordinationへ要求する。 */
const requestLargeRfColumnMove = (): void => {
	setTestTableBlocks( [ createColumnTable( 'table-a', 167 ) ] );
	rfApplyCoordination.receiveRfApplyRequest(
		{
			kind: 'column',
			candidate: {
				clientId: 'table-a',
				sourceColumnIndex: 0,
				destinationBoundaryIndex: 4,
			},
		},
		jest.fn()
	);
};

describe( 'WordPress Reorder Apply Integration adapter', () => {
	beforeEach( () => {
		restoreDirectionApplyLifecycles();
		resetRfInteractionTestState();
	} );

	afterEach( () => {
		act( () => {
			restoreDirectionApplyLifecycles();
			resetRfInteractionTestState();
		} );
	} );

	/**
	 * Row / Column / RFのApply Lifecycleが通常状態ならidleを公開することを確認する。
	 *
	 * 事前条件:
	 * - すべてのProduction Apply Lifecycleが通常状態である。
	 *
	 * 操作:
	 * - 対象TableのPresentation状態を購読する。
	 *
	 * 期待結果:
	 * - idle状態が公開される。
	 */
	it( 'when all apply lifecycles are idle, should expose the idle presentation', () => {
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		expect( result.current ).toEqual( { phase: 'idle' } );
	} );

	/**
	 * RF確認では1-basedの確認用Move summaryとProduction操作を既存Presentationへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - 大規模なRF行移動が確認待ちである。
	 *
	 * 操作:
	 * - Presentationから取消し、同じ要求を再作成して続行する。
	 *
	 * 期待結果:
	 * - 行方向と「1行目から4行目」の概要が公開される。
	 * - 取消しではidle、続行ではapplyingへProduction Lifecycleが遷移する。
	 */
	it( 'when an RF row move awaits confirmation, should expose its kind, summary, continue, and cancel operations', () => {
		requestLargeRfRowMove();
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		const presentation = result.current;

		expect( presentation.phase ).toBe( 'confirming' );
		if ( presentation.phase !== 'confirming' ) {
			throw new Error( 'Expected confirming presentation.' );
		}
		expect( presentation.kind ).toBe( 'row' );
		expect( presentation.moveSummary ).toBe( 'Row 1 → 4' );

		act( () => {
			presentation.cancel();
		} );
		expect( rfApplyCoordination.getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'idle',
		} );

		act( () => {
			requestLargeRfRowMove();
		} );
		if ( result.current.phase !== 'confirming' ) {
			throw new Error( 'Expected recreated confirming presentation.' );
		}
		act( () => {
			if ( result.current.phase !== 'confirming' ) {
				throw new Error( 'Expected confirming presentation before continuation.' );
			}
			result.current.confirm();
		} );
		expect( rfApplyCoordination.getRfApplyCoordinationSnapshot() ).toMatchObject( {
			phase: 'applying',
			kind: 'row',
		} );
	} );

	/**
	 * RF反映中は現在Reorder KindとProduction反映操作を既存Presentationへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - 大規模なRF列移動を利用者が続行している。
	 *
	 * 操作:
	 * - Presentationから反映を開始する。
	 *
	 * 期待結果:
	 * - Column方向が公開され、Production Lifecycleは成功した表示復帰へ進む。
	 */
	it( 'when an RF column move is applying, should expose the RF apply operation with the column kind', () => {
		requestLargeRfColumnMove();
		rfApplyCoordination.continueRfApply();
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		const presentation = result.current;

		expect( presentation.phase ).toBe( 'applying' );
		if ( presentation.phase !== 'applying' ) {
			throw new Error( 'Expected applying presentation.' );
		}
		expect( presentation.kind ).toBe( 'column' );

		act( () => {
			presentation.apply();
		} );
		expect( rfApplyCoordination.getRfApplyCoordinationSnapshot() ).toMatchObject( {
			phase: 'restoring',
			applied: true,
		} );
	} );

	/**
	 * RF成功表示復帰では確定Move summaryの1-based最終位置だけを既存0-based Presentation表現へ変換することを確認する。
	 *
	 * 事前条件:
	 * - 通常規模のRF列移動がProduction Table Integrationで反映済みである。
	 *
	 * 操作:
	 * - 表示復帰Presentationを取得し、完了する。
	 *
	 * 期待結果:
	 * - Column方向と0-based最終位置3が公開される。
	 * - 完了後はProduction Lifecycleがidleへ戻る。
	 */
	it( 'when an RF column move is restoring successfully, should derive the presentation destination from the confirmed move summary', () => {
		setTestTableBlocks( [ createColumnTable( 'table-a', 1 ) ] );
		rfApplyCoordination.receiveRfApplyRequest(
			{
				kind: 'column',
				candidate: {
					clientId: 'table-a',
					sourceColumnIndex: 0,
					destinationBoundaryIndex: 4,
				},
			},
			jest.fn()
		);
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		const presentation = result.current;

		expect( presentation.phase ).toBe( 'restoring' );
		if ( presentation.phase !== 'restoring' ) {
			throw new Error( 'Expected restoration presentation.' );
		}
		expect( presentation.kind ).toBe( 'column' );
		expect( presentation.applied ).toBe( true );
		expect( presentation.destinationIndex ).toBe( 3 );

		act( () => {
			presentation.complete();
		} );
		expect( rfApplyCoordination.getRfApplyCoordinationSnapshot() ).toEqual( {
			phase: 'idle',
		} );
	} );

	/**
	 * RF失敗表示復帰ではMove summaryを要求せずdestinationIndexをnullで既存Presentationへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - 大規模なRF行移動の続行後に対象Tableが利用できなくなっている。
	 *
	 * 操作:
	 * - Production Applyを要求して失敗表示復帰へ進める。
	 *
	 * 期待結果:
	 * - Row方向の失敗とnullの復帰先が公開される。
	 */
	it( 'when an RF apply fails, should expose restoration without inventing a destination', () => {
		requestLargeRfRowMove();
		rfApplyCoordination.continueRfApply();
		setTestTableBlocks( [] );
		rfApplyCoordination.applyRfReorder();
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		const presentation = result.current;

		expect( presentation.phase ).toBe( 'restoring' );
		if ( presentation.phase !== 'restoring' ) {
			throw new Error( 'Expected restoration presentation.' );
		}
		expect( presentation.kind ).toBe( 'row' );
		expect( presentation.applied ).toBe( false );
		expect( presentation.destinationIndex ).toBeNull();
	} );

	/**
	 * 別TableのRF反映状態を現在Tableへ漏らさないことを確認する。
	 *
	 * 事前条件:
	 * - table-bのRF行移動が確認待ちである。
	 *
	 * 操作:
	 * - table-aのPresentation状態を購読する。
	 *
	 * 期待結果:
	 * - table-aにはidle状態が公開される。
	 */
	it( 'when another table owns the RF apply lifecycle, should keep the current table idle', () => {
		requestLargeRfRowMove( 'table-b' );
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		expect( result.current ).toEqual( { phase: 'idle' } );
	} );

	/**
	 * 複数Apply Lifecycleの同時成立を表示側の選択順で吸収しないことを確認する。
	 *
	 * 事前条件:
	 * - RowとRFのProduction Apply Lifecycleが同時に進行している。
	 *
	 * 操作:
	 * - 対象TableのPresentation状態を購読する。
	 *
	 * 期待結果:
	 * - 内部Invariant違反が通知される。
	 */
	it( 'when multiple apply lifecycles are active, should throw instead of choosing one presentation', () => {
		requestLargeRowReorderApply( rowMove );
		requestLargeRfRowMove();

		expect( () => renderHook( () => useReorderApplyPresentationState( 'table-a' ) ) ).toThrow(
			'Multiple reorder apply lifecycles cannot be active at the same time.'
		);
		expect( console ).toHaveErrored();
	} );

	/**
	 * RF確認中にsummaryが失われた内部Invariant違反を通常状態へ隠さないことを確認する。
	 *
	 * 事前条件:
	 * - Production RF Apply Lifecycleは確認待ちである。
	 * - 公開Production操作では作れないsummary欠損を、障害注入として再現する。
	 *
	 * 操作:
	 * - 対象TableのPresentation状態を購読する。
	 *
	 * 期待結果:
	 * - summary欠損を示す内部Invariant違反が通知される。
	 */
	it( 'when RF confirmation has no summary, should throw instead of hiding it as idle', () => {
		requestLargeRfRowMove();
		/*
		 * 確認待ちとsummaryはProduction Storeで不可分なため、公開境界から再現不能な欠損だけを注入する。
		 * Apply CoordinationのLifecycleと他の依存はProduction実装を維持する。
		 */
		const summaryFailure = jest
			.spyOn( rfApplyCoordination, 'getRfApplySummary' )
			.mockReturnValue( null );

		expect( () => renderHook( () => useReorderApplyPresentationState( 'table-a' ) ) ).toThrow(
			'RF apply summary is required while RF confirmation is active.'
		);
		expect( console ).toHaveErrored();
		summaryFailure.mockRestore();
	} );
} );
