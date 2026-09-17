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

	/** Row / Column / RFのApply Lifecycleが通常状態ならidleを公開することを確認する。 */
	it( 'when all apply lifecycles are idle, should expose the idle presentation', () => {
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		expect( result.current ).toEqual( { phase: 'idle' } );
	} );

	/** RF確認では1-basedの確認用Move summaryと操作を既存Presentationへ渡すことを確認する。 */
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

	/** RF反映中は現在Reorder Kindと反映操作を既存Presentationへ渡すことを確認する。 */
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
	 * RF成功表示復帰では確定Move summaryの1-based最終位置だけを既存0-based Presentation表現へ変換することを確認する。
	 */
	it( 'when an RF column move is restoring successfully, should derive the presentation destination from the confirmed move summary', () => {
		mockRfSnapshot = {
			phase: 'restoring',
			tableIdentity: 'table-a',
			applied: true,
			moveSummary: {
				kind: 'column',
				sourcePosition: 2,
				destinationPosition: 5,
			},
		};
		mockRfSummary = null;
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		const presentation = result.current;

		expect( presentation.phase ).toBe( 'restoring' );
		if ( presentation.phase !== 'restoring' ) {
			throw new Error( 'Expected restoration presentation.' );
		}
		expect( presentation.kind ).toBe( 'column' );
		expect( presentation.applied ).toBe( true );
		expect( presentation.destinationIndex ).toBe( 4 );

		act( () => {
			presentation.complete();
		} );
		expect( mockCompleteRfApplyRestoration ).toHaveBeenCalledTimes( 1 );
	} );

	/** RF失敗表示復帰ではMove summaryを要求せずdestinationIndexをnullで既存Presentationへ渡すことを確認する。 */
	it( 'when an RF apply fails, should expose restoration without inventing a destination', () => {
		mockRfSnapshot = {
			phase: 'restoring',
			tableIdentity: 'table-a',
			kind: 'row',
			applied: false,
		};
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

	/** 別TableのRF反映状態を現在Tableへ漏らさないことを確認する。 */
	it( 'when another table owns the RF apply lifecycle, should keep the current table idle', () => {
		mockRfSnapshot = { phase: 'confirming', tableIdentity: 'table-b', kind: 'row' };
		mockRfSummary = { kind: 'row', sourcePosition: 3, destinationPosition: 1 };
		const { result } = renderHook( () => useReorderApplyPresentationState( 'table-a' ) );
		expect( result.current ).toEqual( { phase: 'idle' } );
	} );

	/** 複数Apply Lifecycleの同時成立を表示側の選択順で吸収しないことを確認する。 */
	it( 'when multiple apply lifecycles are active, should throw instead of choosing one presentation', () => {
		mockRowState = {
			phase: 'applying',
			move: { tableIdentity: 'table-a', sourceRowIndex: 1, destinationBoundaryIndex: 2 },
			applied: false,
		};
		mockRfSnapshot = { phase: 'applying', tableIdentity: 'table-a', kind: 'row' };

		expect( () => renderHook( () => useReorderApplyPresentationState( 'table-a' ) ) ).toThrow(
			'Multiple reorder apply lifecycles cannot be active at the same time.'
		);
		expect( console ).toHaveErrored();
	} );

	/** RF確認中にsummaryが失われた場合を通常状態へ隠さないことを確認する。 */
	it( 'when RF confirmation has no summary, should throw instead of hiding it as idle', () => {
		mockRfSnapshot = { phase: 'confirming', tableIdentity: 'table-a', kind: 'row' };
		mockRfSummary = null;

		expect( () => renderHook( () => useReorderApplyPresentationState( 'table-a' ) ) ).toThrow(
			'RF apply summary is required while RF confirmation is active.'
		);
		expect( console ).toHaveErrored();
	} );
} );
