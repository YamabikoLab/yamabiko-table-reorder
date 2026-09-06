/**
 * Reorder GuidanceとWordPress Editor接続境界の初回案内Lifecycleを確認する。
 *
 * WordPress preferences、操作環境、Reorder Modeを接続した結果として、
 * 初回案内の表示、表示済み保存、入口選択による終了が成立することを検証する。
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { reorderGuidance } from '@/reorder/reorder-guidance';
import { reorderMode } from '@/reorder/reorder-mode';
import { useReorderGuidance } from '@/reorder/wordpress/hooks/use-reorder-guidance';

const mockPreferences = new Map< string, unknown >();
let mockTouchEnvironment = false;

jest.mock( '@wordpress/preferences', () => ( {
	store: 'preferences-store',
} ) );

jest.mock( '@wordpress/data', () => ( {
	select: ( store: string ) => {
		if ( store !== 'preferences-store' ) {
			throw new Error( 'Unexpected store selection.' );
		}
		return {
			get: ( scope: string, key: string ) => mockPreferences.get( `${ scope }:${ key }` ),
		};
	},
	dispatch: ( store: string ) => {
		if ( store !== 'preferences-store' ) {
			throw new Error( 'Unexpected store dispatch.' );
		}
		return {
			set: ( scope: string, key: string, value: unknown ) => {
				mockPreferences.set( `${ scope }:${ key }`, value );
			},
		};
	},
} ) );

const RESET_TABLE_IDENTITY = '__reorder-guidance-test-reset__';
const PC_PREFERENCE = 'yamabiko-table-reorder:initialGuidanceAcknowledgedPc';
const TOUCH_PREFERENCE = 'yamabiko-table-reorder:initialGuidanceAcknowledgedTouch';

const resetState = () => {
	mockPreferences.clear();
	mockTouchEnvironment = false;
	reorderGuidance.show( RESET_TABLE_IDENTITY, 'pc' );
	reorderGuidance.hide( RESET_TABLE_IDENTITY );
	reorderMode.observeTable( RESET_TABLE_IDENTITY );
	reorderMode.notifyTableInactive( RESET_TABLE_IDENTITY );
};

const createReferenceElement = () => {
	const element = document.createElement( 'button' );
	const editorWindow = element.ownerDocument.defaultView;
	if ( editorWindow === null ) {
		throw new Error( 'Expected test document to have a window.' );
	}

	Object.defineProperty( editorWindow, 'matchMedia', {
		configurable: true,
		value: jest.fn().mockImplementation( () => ( {
			matches: mockTouchEnvironment,
		} ) ),
	} );
	return element;
};

describe( 'Reorder Guidance WordPress integration', () => {
	beforeEach( () => {
		resetState();
	} );

	afterEach( () => {
		act( () => {
			resetState();
		} );
	} );

	/**
	 * 概要:
	 * - PC環境で初回案内が未表示の場合に案内を開始することを確認する。
	 *
	 * 事前条件:
	 * - PCの表示済み状態は保存されていない。
	 * - Reorder Modeは通常編集である。
	 *
	 * 操作:
	 * - Table ToolbarをReorder Guidanceへ接続する。
	 *
	 * 期待結果:
	 * - 対象Tableの初回案内が表示される。
	 */
	it( 'when PC guidance has not been acknowledged, should show initial guidance for the table', async () => {
		const referenceElement = createReferenceElement();
		const { result } = renderHook( () => useReorderGuidance( 'table-a', referenceElement ) );

		await waitFor( () => {
			expect( result.current.isVisible ).toBe( true );
		} );
	} );

	/**
	 * 概要:
	 * - 初回案内を閉じた操作環境だけを表示済みとして保存することを確認する。
	 *
	 * 事前条件:
	 * - PC環境で初回案内を表示している。
	 * - タッチ環境の表示済み状態は保存されていない。
	 *
	 * 操作:
	 * - 初回案内を閉じる。
	 *
	 * 期待結果:
	 * - PCだけが表示済みになり、案内は終了する。
	 */
	it( 'when PC guidance is dismissed, should acknowledge only PC and hide the guidance', async () => {
		const referenceElement = createReferenceElement();
		const { result } = renderHook( () => useReorderGuidance( 'table-a', referenceElement ) );
		await waitFor( () => {
			expect( result.current.isVisible ).toBe( true );
		} );

		act( () => {
			result.current.dismiss();
		} );

		expect( mockPreferences.get( PC_PREFERENCE ) ).toBe( true );
		expect( mockPreferences.has( TOUCH_PREFERENCE ) ).toBe( false );
		expect( result.current.isVisible ).toBe( false );
	} );

	/**
	 * 概要:
	 * - PCで表示済みでもタッチ環境では独立して初回案内を表示することを確認する。
	 *
	 * 事前条件:
	 * - PCだけ初回案内を表示済みである。
	 * - 現在はタッチ環境である。
	 *
	 * 操作:
	 * - Table ToolbarをReorder Guidanceへ接続する。
	 *
	 * 期待結果:
	 * - タッチ環境の初回案内が表示される。
	 */
	it( 'when only PC guidance is acknowledged in a touch environment, should still show initial guidance', async () => {
		mockPreferences.set( PC_PREFERENCE, true );
		mockTouchEnvironment = true;
		const referenceElement = createReferenceElement();
		const { result } = renderHook( () => useReorderGuidance( 'table-a', referenceElement ) );

		await waitFor( () => {
			expect( result.current.isVisible ).toBe( true );
		} );
	} );

	/**
	 * 概要:
	 * - 初回案内中に並び替え入口が選択された場合、Reorder Modeの状態変化から案内を完了することを確認する。
	 *
	 * 事前条件:
	 * - PC環境で初回案内を表示している。
	 * - Reorder Modeは通常編集である。
	 *
	 * 操作:
	 * - 対象Tableで行並び替えを選択する。
	 *
	 * 期待結果:
	 * - PCを表示済みとして保存し、初回案内を終了する。
	 */
	it( 'when a reorder mode is selected during guidance, should acknowledge and hide the guidance', async () => {
		const referenceElement = createReferenceElement();
		const { result } = renderHook( () => useReorderGuidance( 'table-a', referenceElement ) );
		await waitFor( () => {
			expect( result.current.isVisible ).toBe( true );
		} );

		act( () => {
			reorderMode.select( 'row', 'table-a' );
		} );

		await waitFor( () => {
			expect( result.current.isVisible ).toBe( false );
		} );
		expect( mockPreferences.get( PC_PREFERENCE ) ).toBe( true );
	} );
} );
