/**
 * 確認付き大規模反映へ切り替える共通閾値の境界を確認する。
 */

import {
	REORDER_APPLY_CONFIRM_CELL_THRESHOLD,
	requiresLargeReorderApply,
} from './reorder-apply-policy';

describe( 'Reorder apply policy', () => {
	it( 'when affected cells equal the threshold, should keep the direct apply path', () => {
		expect( requiresLargeReorderApply( REORDER_APPLY_CONFIRM_CELL_THRESHOLD ) ).toBe( false );
	} );

	it( 'when affected cells exceed the threshold, should require the confirmed large apply path', () => {
		expect( requiresLargeReorderApply( REORDER_APPLY_CONFIRM_CELL_THRESHOLD + 1 ) ).toBe( true );
	} );
} );
