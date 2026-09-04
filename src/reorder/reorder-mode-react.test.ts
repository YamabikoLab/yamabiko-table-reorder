/**
 * Reorder ModeのReact接続境界が、共有状態の変更を対象Tableの表示状態へ反映することを確認する。
 *
 * WordPress固有コンポーネントを介さず、React接続境界そのものがReorder Modeの状態変更を購読し、
 * 対象Tableごとの選択状態と編集可否を提供する責務だけを検証する。
 */

import { act, renderHook } from '@testing-library/react';

import { useEditingAllowed, useReorderMode } from '@/reorder/reorder-mode-react';
import { reorderMode, rowReorderMode } from '@/reorder/reorder-mode';

const RESET_TABLE_IDENTITY = '__reorder-mode-react-test-reset__';

const resetReorderMode = () => {
	reorderMode.observeTable( RESET_TABLE_IDENTITY );
	reorderMode.notifyTableInactive( RESET_TABLE_IDENTITY );
};

describe( 'Reorder Mode React connection', () => {
	beforeEach( () => {
		resetReorderMode();
	} );

	afterEach( () => {
		resetReorderMode();
	} );

	/**
	 * 概要:
	 * - React外でReorder Modeが変更された場合も、対象Tableの選択状態と編集可否へ変更が反映されることを確認する。
	 *
	 * 事前条件:
	 * - Table Aは通常編集状態である。
	 * - React側はTable Aの並び替え状態と編集可否を購読している。
	 *
	 * 操作:
	 * - React外のReorder Mode内部仕様からTable Aの行並び替えを選択する。
	 *
	 * 期待結果:
	 * - Table Aの選択状態は行並び替えとなる。
	 * - Table Aの通常編集は許可されない。
	 */
	it( 'when reorder mode changes outside React, should update the selected kind and editing availability for the target table', () => {
		const reorderModeHook = renderHook( () => useReorderMode( 'table-a' ) );
		const editingAllowedHook = renderHook( () => useEditingAllowed( 'table-a' ) );

		expect( reorderModeHook.result.current.selectedKind ).toBeNull();
		expect( editingAllowedHook.result.current ).toBe( true );

		act( () => {
			reorderMode.select( 'row', 'table-a' );
		} );

		expect( reorderModeHook.result.current.selectedKind ).toBe( 'row' );
		expect( editingAllowedHook.result.current ).toBe( false );
	} );

	/**
	 * 概要:
	 * - Row Reorder側のDnD終了判定でReorder Modeが終了した場合に、React側も通常編集へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Table Aで行並び替えが有効であり、React側がTable Aの状態を購読している。
	 *
	 * 操作:
	 * - Row ReorderからDnD終了後の継続不可を通知する。
	 *
	 * 期待結果:
	 * - Table Aの選択状態は解除される。
	 * - Table Aの通常編集が再び許可される。
	 */
	it( 'when row reorder ends the active mode outside React, should restore edit state for the target table', () => {
		act( () => {
			reorderMode.select( 'row', 'table-a' );
		} );
		const reorderModeHook = renderHook( () => useReorderMode( 'table-a' ) );
		const editingAllowedHook = renderHook( () => useEditingAllowed( 'table-a' ) );

		expect( reorderModeHook.result.current.selectedKind ).toBe( 'row' );
		expect( editingAllowedHook.result.current ).toBe( false );

		act( () => {
			rowReorderMode.resolveAfterDnd( 'table-a', false );
		} );

		expect( reorderModeHook.result.current.selectedKind ).toBeNull();
		expect( editingAllowedHook.result.current ).toBe( true );
	} );
} );
