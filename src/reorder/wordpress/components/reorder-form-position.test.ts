/**
 * RF入力Popoverの手動配置がviewport内へ制限され、RF Session中のReact再mountで維持されることを確認する。
 */

import { act, renderHook } from '@testing-library/react';

import {
	clampReorderFormPosition,
	reorderFormPosition,
	useReorderFormPosition,
} from './reorder-form-position';

describe( 'Reorder Form popover position', () => {
	/**
	 * 利用者がRF入力Popoverをviewport外へ移動しようとしても、操作可能な範囲へ留まることを確認する。
	 *
	 * 事前条件:
	 * - viewportより小さいRF入力Popoverが表示されている。
	 *
	 * 操作:
	 * - viewportの左上および右下を越える位置を指定する。
	 *
	 * 期待結果:
	 * - RF入力Popover全体がviewport内へ残る位置へ制限される。
	 */
	it( 'when a requested position exceeds the viewport, should keep the popover within the viewport', () => {
		expect(
			clampReorderFormPosition(
				{ x: -100, y: -50 },
				{ width: 300, height: 200 },
				{ width: 1000, height: 800 }
			)
		).toEqual( { x: 8, y: 8 } );

		expect(
			clampReorderFormPosition(
				{ x: 900, y: 700 },
				{ width: 300, height: 200 },
				{ width: 1000, height: 800 }
			)
		).toEqual( { x: 692, y: 592 } );
	} );

	/**
	 * 同じRF Session中にReactが再mountされても、利用者が移動した位置を維持することを確認する。
	 *
	 * 事前条件:
	 * - TableでRF Sessionを開始し、入力Popoverを手動で移動している。
	 *
	 * 操作:
	 * - RF Presentationをunmountして同じTableで再mountする。
	 *
	 * 期待結果:
	 * - 再mount後も同じ手動配置が公開される。
	 */
	it( 'when the presentation remounts during the same RF session, should preserve the moved position', () => {
		reorderFormPosition.beginSession( 'table-remount' );
		const firstRender = renderHook( () => useReorderFormPosition( 'table-remount' ) );

		act( () => {
			firstRender.result.current.setPosition( { x: 120, y: 160 } );
		} );
		expect( firstRender.result.current.position ).toEqual( { x: 120, y: 160 } );
		firstRender.unmount();

		const remounted = renderHook( () => useReorderFormPosition( 'table-remount' ) );
		expect( remounted.result.current.position ).toEqual( { x: 120, y: 160 } );
	} );

	/**
	 * RFを終了して新しく開始した場合は、前回の手動配置を引き継がないことを確認する。
	 *
	 * 事前条件:
	 * - 同じTableの前回RF Sessionで入力Popoverを手動移動している。
	 *
	 * 操作:
	 * - 同じTableで新しいRF Sessionを開始する。
	 *
	 * 期待結果:
	 * - 手動配置はなくなり、Toolbar基準の初期配置を使用する状態になる。
	 */
	it( 'when a new RF session starts for the same table, should reset the moved position', () => {
		reorderFormPosition.beginSession( 'table-reopen' );
		const positionHook = renderHook( () => useReorderFormPosition( 'table-reopen' ) );

		act( () => {
			positionHook.result.current.setPosition( { x: 80, y: 120 } );
		} );
		expect( positionHook.result.current.position ).toEqual( { x: 80, y: 120 } );

		act( () => {
			reorderFormPosition.beginSession( 'table-reopen' );
		} );
		expect( positionHook.result.current.position ).toBeNull();
	} );
} );
