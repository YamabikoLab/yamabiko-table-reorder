/**
 * Reorder GuidanceとWordPress Editor接続境界の初回案内ライフサイクルを確認する。
 *
 * WordPress preferences、操作環境、Reorder Modeを接続した結果として、
 * 初回案内の表示、表示済み保存、入口選択による終了が成立することを検証する。
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { dispatch, select } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

import { reorderGuidance } from '@/reorder/reorder-guidance';
import { reorderMode } from '@/reorder/reorder-mode';
import { useReorderGuidance } from '@/reorder/wordpress/hooks/use-reorder-guidance';

let mockTouchEnvironment = false;

/*
 * @wordpress/preferencesの公開入口はJest変換対象外のuuid ESMを経由するため、この環境では直接読み込めない。
 * preferences Store境界だけを同じset / get契約の最小Storeへ置き換え、@wordpress/dataの実Store登録・選択・更新経路を検証する。
 */
jest.mock( '@wordpress/preferences', () => {
	const { createReduxStore, register } = jest.requireActual( '@wordpress/data' );
	const store = createReduxStore( 'test/yamabiko-table-reorder-preferences', {
		reducer: (
			state: Record< string, Record< string, unknown > > = {},
			action: { type: string; scope?: string; key?: string; value?: unknown }
		) => {
			if ( action.type !== 'SET_PREFERENCE_VALUE' || ! action.scope || ! action.key ) {
				return state;
			}

			return {
				...state,
				[ action.scope ]: {
					...state[ action.scope ],
					[ action.key ]: action.value,
				},
			};
		},
		actions: {
			set: ( scope: string, key: string, value: unknown ) => ( {
				type: 'SET_PREFERENCE_VALUE',
				scope,
				key,
				value,
			} ),
		},
		selectors: {
			get: (
				state: Record< string, Record< string, unknown > >,
				scope: string,
				key: string
			) => state[ scope ]?.[ key ],
		},
	} );
	register( store );

	return { store };
} );

const RESET_TABLE_IDENTITY = '__reorder-guidance-test-reset__';
const PREFERENCE_SCOPE = 'yamabiko-table-reorder';
const PC_PREFERENCE_KEY = 'initialGuidanceAcknowledgedPc';
const TOUCH_PREFERENCE_KEY = 'initialGuidanceAcknowledgedTouch';

/** WordPress側の表示済み状態とReorderの一時状態を、各テスト開始前の状態へ戻す。 */
const resetState = () => {
	dispatch( preferencesStore ).set( PREFERENCE_SCOPE, PC_PREFERENCE_KEY, undefined );
	dispatch( preferencesStore ).set( PREFERENCE_SCOPE, TOUCH_PREFERENCE_KEY, undefined );
	mockTouchEnvironment = false;
	reorderGuidance.show( RESET_TABLE_IDENTITY, 'pc' );
	reorderGuidance.hide( RESET_TABLE_IDENTITY );
	reorderMode.observeTable( RESET_TABLE_IDENTITY );
	reorderMode.notifyTableInactive( RESET_TABLE_IDENTITY );
};

/**
 * 現在のEditor DOMを示し、PC／タッチの操作環境判定を切り替えられる基準要素を作成する。
 *
 * @return テスト用Editor DOMに属するツールバー相当の要素。
 */
const createReferenceElement = () => {
	const element = document.createElement( 'button' );
	const editorWindow = element.ownerDocument.defaultView;

	/* テスト用Editor DOMを解決できない状態では操作環境判定を検証できないため、テストを成立させない。 */
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
	 * - PC環境で初回案内が未表示の場合にPC向け案内対象を開始することを確認する。
	 *
	 * 事前条件:
	 * - PCの表示済み状態は保存されていない。
	 * - Reorder Modeは通常編集である。
	 *
	 * 操作:
	 * - TableツールバーをReorder Guidanceへ接続する。
	 *
	 * 期待結果:
	 * - 対象Tableの初回案内がPC環境として公開される。
	 */
	it( 'when PC guidance has not been acknowledged, should expose PC guidance for the table', async () => {
		const referenceElement = createReferenceElement();
		const { result } = renderHook( () => useReorderGuidance( 'table-a', referenceElement ) );

		await waitFor( () => {
			expect( result.current.guidance ).toEqual( { environment: 'pc' } );
		} );
	} );

	/**
	 * 概要:
	 * - タッチ環境の初回案内開始時にセル編集状態を残さず、タッチ向け案内対象を公開することを確認する。
	 *
	 * 事前条件:
	 * - タッチ環境の初回案内は未表示である。
	 * - Reorder Modeは通常編集である。
	 *
	 * 操作:
	 * - TableツールバーをReorder Guidanceへ接続する。
	 *
	 * 期待結果:
	 * - ツールバーへスクロールを発生させずにフォーカスを移す。
	 * - 対象Tableの初回案内がタッチ環境として公開される。
	 */
	it( 'when touch guidance has not been acknowledged, should focus the toolbar and expose touch guidance', async () => {
		mockTouchEnvironment = true;
		const referenceElement = createReferenceElement();
		const focusSpy = jest.spyOn( referenceElement, 'focus' );
		const { result } = renderHook( () => useReorderGuidance( 'table-a', referenceElement ) );

		await waitFor( () => {
			expect( result.current.guidance ).toEqual( { environment: 'touch' } );
		} );
		expect( focusSpy ).toHaveBeenCalledWith( { preventScroll: true } );
	} );

	/**
	 * 概要:
	 * - 現在の操作環境ですでに初回案内を表示済みの場合は再表示しないことを確認する。
	 *
	 * 事前条件:
	 * - PCの初回案内は表示済みとして保存されている。
	 * - 現在もPC環境である。
	 *
	 * 操作:
	 * - TableツールバーをReorder Guidanceへ接続する。
	 *
	 * 期待結果:
	 * - 対象Tableの初回案内対象は存在しない。
	 */
	it( 'when guidance is already acknowledged for the current environment, should not expose guidance', () => {
		dispatch( preferencesStore ).set( PREFERENCE_SCOPE, PC_PREFERENCE_KEY, true );
		const referenceElement = createReferenceElement();
		const { result } = renderHook( () => useReorderGuidance( 'table-a', referenceElement ) );

		expect( result.current.guidance ).toBeNull();
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
	 * - PCだけが表示済みになり、案内対象は存在しなくなる。
	 */
	it( 'when PC guidance is dismissed, should acknowledge only PC and clear the guidance', async () => {
		const referenceElement = createReferenceElement();
		const { result } = renderHook( () => useReorderGuidance( 'table-a', referenceElement ) );
		await waitFor( () => {
			expect( result.current.guidance ).toEqual( { environment: 'pc' } );
		} );

		act( () => {
			result.current.dismiss();
		} );

		expect( select( preferencesStore ).get( PREFERENCE_SCOPE, PC_PREFERENCE_KEY ) ).toBe( true );
		expect( select( preferencesStore ).get( PREFERENCE_SCOPE, TOUCH_PREFERENCE_KEY ) ).toBeUndefined();
		expect( result.current.guidance ).toBeNull();
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
	 * - TableツールバーをReorder Guidanceへ接続する。
	 *
	 * 期待結果:
	 * - タッチ環境の初回案内対象が公開される。
	 */
	it( 'when only PC guidance is acknowledged in a touch environment, should still expose touch guidance', async () => {
		dispatch( preferencesStore ).set( PREFERENCE_SCOPE, PC_PREFERENCE_KEY, true );
		mockTouchEnvironment = true;
		const referenceElement = createReferenceElement();
		const { result } = renderHook( () => useReorderGuidance( 'table-a', referenceElement ) );

		await waitFor( () => {
			expect( result.current.guidance ).toEqual( { environment: 'touch' } );
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
	 * - PCを表示済みとして保存し、初回案内対象は存在しなくなる。
	 */
	it( 'when a reorder mode is selected during guidance, should acknowledge and clear the guidance', async () => {
		const referenceElement = createReferenceElement();
		const { result } = renderHook( () => useReorderGuidance( 'table-a', referenceElement ) );
		await waitFor( () => {
			expect( result.current.guidance ).toEqual( { environment: 'pc' } );
		} );

		act( () => {
			reorderMode.select( 'row', 'table-a' );
		} );

		await waitFor( () => {
			expect( result.current.guidance ).toBeNull();
		} );
		expect( select( preferencesStore ).get( PREFERENCE_SCOPE, PC_PREFERENCE_KEY ) ).toBe( true );
	} );
} );
