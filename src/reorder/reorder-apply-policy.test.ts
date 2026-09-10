/**
 * 確認付き大規模反映へ切り替える共通閾値の境界を確認する。
 */

import {
	REORDER_APPLY_CONFIRM_CELL_THRESHOLD,
	requiresLargeReorderApply,
} from './reorder-apply-policy';

describe( 'Reorder apply policy', () => {
	/**
	 * 更新対象セル数が閾値と同じ場合は直接反映を維持することを確認する。
	 *
	 * 操作:
	 * - 共通閾値と同じ更新対象セル数を判定する。
	 *
	 * 期待結果:
	 * - 確認付き大規模反映を要求しない。
	 */
	it( 'when affected cells equal the threshold, should keep the direct apply path', () => {
		expect( requiresLargeReorderApply( REORDER_APPLY_CONFIRM_CELL_THRESHOLD ) ).toBe( false );
	} );

	/**
	 * 更新対象セル数が閾値を超える場合は確認付き大規模反映へ切り替えることを確認する。
	 *
	 * 操作:
	 * - 共通閾値を1セル超える更新対象セル数を判定する。
	 *
	 * 期待結果:
	 * - 確認付き大規模反映を要求する。
	 */
	it( 'when affected cells exceed the threshold, should require the confirmed large apply path', () => {
		expect( requiresLargeReorderApply( REORDER_APPLY_CONFIRM_CELL_THRESHOLD + 1 ) ).toBe( true );
	} );
} );
