/**
 * WordPress Reorder Apply Integrationのadapterが、RF Apply Coordinationを既存Presentation契約へ変換することを確認する。
 */

import { act, renderHook } from '@testing-library/react';

import { useReorderApplyPresentationState } from './adapter';

let mockRowState: any = { phase: 'idle', move: null, applied: false };
let mockColumnState: any = { phase: 'idle', move: null, applied: false };
let mockRfSnapshot: any = { phase: 'idle' };
let mockRfSummary: any = null;
const mockContinueRfApply = jest.fn();
const mockCancelRfApply = jest.fn();
const mockApplyRfReorder = jest.fn();
const mockCompleteRfApplyRestoration = jest.fn();

jest.mock( '@/messages', () => ( {
	getLargeColumnReorderMoveSummary: ( source: number, destination: number ) =>
		`Column ${ source } → ${ destination }`,
	getLargeRowReorderMoveSummary: ( source: number, destination: number ) =>
		`Row ${ source } → ${ destination }`,
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/reorder-apply', () => ( {
	applyLargeRowReorder: jest.fn(),
	cancelLargeRowReorderApply: jest.fn(),
	completeLargeRowReorderApply: jest.fn(),
	confirmLargeRowReorderApply: jest.fn(),
	getLargeRowReorderApplyState: () => mockRowState,
	getLargeRowReorderDestinationRowIndex: () => null,
	subscribeLargeRowReorderApply: () => () => undefined,
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/reorder-apply', () => ( {
	applyLargeColumnReorder: jest.fn(),
	cancelLargeColumnReorderApply: jest.fn(),
	completeLargeColumnReorderApply: jest.fn(),
	confirmLargeColumnReorderApply: jest.fn(),
	getLargeColumnReorderApplyState: () => mockColumnState,
	getLargeColumnReorderDestinationColumnIndex: () => null,
	subscribeLargeColumnReorderApply: () => () => undefined,
} ) );

jest.mock( '@/reorder/reorder-form/responsibilities/apply-coordination', () => ( {
	applyRfReorder: () => mockApplyRfReorder(),
	cancelRfApply: () => mockCancelRfApply(),
	completeRfApplyRestoration: () => mockCompleteRfApplyRestoration(),
	continueRfApply: () => mockContinueRfApply(),
	getRfApplyCoordinationSnapshot: () => mockRfSnapshot,
	getRfApplySummary: () => mockRfSummary,
	subscribeRfApplyCoordination: () => () => undefined,
} ) );

describe( 'WordPress Reorder Apply Integration adapter', () => {
	beforeEach( () => {
		mockRowState = { phase: 'idle', move: null, applied: false };
		mockColumnState = { phase: 'idle', move: null, applied: false };
		mockRfSnapshot = { phase: 'idle' };
		mockRfSummary = null;
		jest.clearAllMocks();
	} );

	/**
	 * RF大規模反映がない場合は通常表示を維持することを確認する。
	 *
	 * 事前条件:
	 * - Row / Column / RFのApply Lifecycleがすべて通常状態である。
	 *
	 * 操作:
	 * - 対象TableのPresentation状態を取得する。
	 *
	 * 期待結果:
	 * - idleが返される。
	 */
	it( 'when all apply lifecycles are idle, should expose the idle presentation', () => {
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );

		expect( result.current ).toEqual( { phase: 'idle' } );
	} );

	/**
	 * RFの行移動確認では、RFが公開する1-based位置を既存確認表示へ渡すことを確認する。
	 *
	 * 事前条件:
	 * - 対象TableのRF行移動が確認待ちである。
	 * - RF Apply Coordinationが移動元1000行目、移動先2行目を公開している。
	 *
	 * 操作:
	 * - 対象TableのPresentation状態を取得し、ContinueとCancelを実行する。
	 *
	 * 期待結果:
	 * - Reorder Kindはrowのまま渡される。
	 * - 既存確認表示向けに「1000行目から2行目」の概要が生成される。
	 * - ContinueとCancelはRF Apply Coordinationへ委譲される。
	 */
	it( 'when an RF row move awaits confirmation, should expose its kind, summary, continue, and cancel operations', () => {
		mockRfSnapshot = { phase: 'confirming', tableIdentity: 'table-a', kind: 'row' };
		mockRfSummary = { kind: 'row', sourcePosition: 1000, destinationPosition: 2 };
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		const presentation = result.current;

		expect( presentation.phase ).toBe( 'confirming' );
		if ( presentation.phase !== 'confirming' ) {
			throw new Error( 'Expected confirming presentation.' );
		}
		expect( presentation.kind ).toBe( 'row' );
		expect( presentation.moveSummary ).toBe( 'Row 1000 → 2' );

		act( () => {
			presentation.confirm();
			presentation.cancel();
		} );
		expect( mockContinueRfApply ).toHaveBeenCalledTimes( 1 );
		expect( mockCancelRfApply ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * RF反映中は、既存Lifecycleが描画後に実行できる反映操作を提供することを確認する。
	 *
	 * 事前条件:
	 * - 対象TableのRF列移動が反映中である。
	 *
	 * 操作:
	 * - Presentation状態から反映操作を実行する。
	 *
	 * 期待結果:
	 * - Reorder Kindはcolumnのまま渡される。
	 * - 反映操作はRF Apply Coordinationへ委譲される。
	 */
	it( 'when an RF column move is applying, should expose the RF apply operation with the column kind', () => {
		mockRfSnapshot = { phase: 'applying', tableIdentity: 'table-a', kind: 'column' };
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
		expect( mockApplyRfReorder ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * RF表示復帰では、1-based最終位置を既存restoration用0-based位置へ変換することを確認する。
	 *
	 * 事前条件:
	 * - 対象TableのRF列移動が正常反映後の表示復帰待ちである。
	 * - RF Apply Coordinationが最終位置5列目を公開している。
	 *
	 * 操作:
	 * - Presentation状態を取得し、表示復帰完了を通知する。
	 *
	 * 期待結果:
	 * - restoringは既存Presentationのremountingとして公開される。
	 * - restorationへ0-based位置4が渡される。
	 * - 完了操作はRF Apply Coordinationへ委譲される。
	 */
	it( 'when an RF column move is restoring, should expose remounting with a zero-based destination and RF completion', () => {
		mockRfSnapshot = {
			phase: 'restoring',
			tableIdentity: 'table-a',
			kind: 'column',
			applied: true,
		};
		mockRfSummary = { kind: 'column', sourcePosition: 2, destinationPosition: 5 };
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		const presentation = result.current;

		expect( presentation.phase ).toBe( 'remounting' );
		if ( presentation.phase !== 'remounting' ) {
			throw new Error( 'Expected remounting presentation.' );
		}
		expect( presentation.kind ).toBe( 'column' );
		expect( presentation.applied ).toBe( true );
		expect( presentation.destinationIndex ).toBe( 4 );

		act( () => {
			presentation.complete();
		} );
		expect( mockCompleteRfApplyRestoration ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 別TableのRF大規模反映状態を現在Tableへ漏らさないことを確認する。
	 *
	 * 事前条件:
	 * - table-bのRF行移動が確認待ちである。
	 *
	 * 操作:
	 * - table-aのPresentation状態を取得する。
	 *
	 * 期待結果:
	 * - table-aにはidleが返される。
	 */
	it( 'when another table owns the RF apply lifecycle, should keep the current table idle', () => {
		mockRfSnapshot = { phase: 'confirming', tableIdentity: 'table-b', kind: 'row' };
		mockRfSummary = { kind: 'row', sourcePosition: 3, destinationPosition: 1 };
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );

		expect( result.current ).toEqual( { phase: 'idle' } );
	} );
} );
