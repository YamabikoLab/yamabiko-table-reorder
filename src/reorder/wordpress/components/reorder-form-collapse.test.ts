/**
 * Reorder Form（RF）の狭い表示における折りたたみ状態がRF Sessionの寿命で保持・初期化されることを確認する。
 */

import { act, renderHook } from '@testing-library/react';

import { reorderFormCollapse, useReorderFormCollapse } from './reorder-form-collapse';

describe( 'Reorder Form collapse presentation state', () => {
	/**
	 * 同じRF Session中にPresentationが再生成されても折りたたみ状態を維持することを確認する。
	 *
	 * 事前条件:
	 * - RF Sessionが開始されている。
	 * - 利用者が狭い表示のRFを折りたたんでいる。
	 *
	 * 操作:
	 * - RF Presentationをunmountして同じTableで再mountする。
	 *
	 * 期待結果:
	 * - 折りたたみ状態が維持される。
	 */
	it( 'when the presentation remounts during the same RF session, should preserve the collapsed state', () => {
		reorderFormCollapse.beginSession( 'table-remount' );
		const firstRender = renderHook( () => useReorderFormCollapse( 'table-remount' ) );

		act( () => {
			firstRender.result.current.setCollapsed( true );
		} );
		expect( firstRender.result.current.collapsed ).toBe( true );

		firstRender.unmount();
		const secondRender = renderHook( () => useReorderFormCollapse( 'table-remount' ) );

		expect( secondRender.result.current.collapsed ).toBe( true );
	} );

	/**
	 * 新しいRF Sessionでは前回の折りたたみ状態を引き継がないことを確認する。
	 *
	 * 事前条件:
	 * - 前回のRF Sessionで入力画面が折りたたまれている。
	 *
	 * 操作:
	 * - 同じTableで新しいRF Sessionを開始する。
	 *
	 * 期待結果:
	 * - 入力画面は展開状態から開始する。
	 */
	it( 'when a new RF session starts for the same table, should reset the collapsed state', () => {
		reorderFormCollapse.beginSession( 'table-reopen' );
		const collapseHook = renderHook( () => useReorderFormCollapse( 'table-reopen' ) );
		act( () => {
			collapseHook.result.current.setCollapsed( true );
		} );

		act( () => {
			reorderFormCollapse.beginSession( 'table-reopen' );
		} );

		expect( collapseHook.result.current.collapsed ).toBe( false );
	} );
} );
