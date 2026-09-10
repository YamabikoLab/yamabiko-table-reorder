/**
 * 確認付き大規模反映へ切り替える固定閾値と端末ローカル学習値の境界を確認する。
 */

import { learnFromDirectReorderApply } from './reorder-apply-performance';
import {
	REORDER_APPLY_CONFIRM_CELL_THRESHOLD,
	requiresLargeReorderApply,
} from './reorder-apply-policy';

class MemoryStorage implements Storage {
	private readonly values = new Map< string, string >();

	get length(): number {
		return this.values.size;
	}

	clear(): void {
		this.values.clear();
	}

	getItem( key: string ): string | null {
		return this.values.get( key ) ?? null;
	}

	key( index: number ): string | null {
		return Array.from( this.values.keys() )[ index ] ?? null;
	}

	removeItem( key: string ): void {
		this.values.delete( key );
	}

	setItem( key: string, value: string ): void {
		this.values.set( key, value );
	}
}

const NOW_MS = 1_800_000_000_000;

describe( 'Reorder apply policy', () => {
	/**
	 * 固定閾値と同じ更新対象セル数では、学習値がない限り直接反映を維持することを確認する。
	 *
	 * 操作:
	 * - 学習値がない状態で固定閾値と同じ更新対象セル数を判定する。
	 *
	 * 期待結果:
	 * - 確認付き大規模反映を要求しない。
	 */
	it( 'when affected cells equal the default threshold without learning, should keep the direct apply path', () => {
		const storage = new MemoryStorage();

		expect(
			requiresLargeReorderApply(
				REORDER_APPLY_CONFIRM_CELL_THRESHOLD,
				'row',
				storage,
				NOW_MS
			)
		).toBe( false );
	} );

	/**
	 * 固定閾値を超える更新対象セル数では、学習値に依存せず確認付き反映へ切り替えることを確認する。
	 *
	 * 操作:
	 * - 固定閾値を1セル超える更新対象セル数を判定する。
	 *
	 * 期待結果:
	 * - 確認付き大規模反映を要求する。
	 */
	it( 'when affected cells exceed the default threshold, should require the confirmed large apply path', () => {
		const storage = new MemoryStorage();

		expect(
			requiresLargeReorderApply(
				REORDER_APPLY_CONFIRM_CELL_THRESHOLD + 1,
				'row',
				storage,
				NOW_MS
			)
		).toBe( true );
	} );

	/**
	 * 過去に遅い直接反映を観測したセル数では、固定閾値以下でも確認付き反映へ切り替えることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えで320セルの直接反映が1秒以上かかったことを学習済みである。
	 *
	 * 操作:
	 * - 320セルと319セルの行並び替えを判定する。
	 *
	 * 期待結果:
	 * - 320セルは確認付き反映を要求する。
	 * - 319セルは直接反映を維持する。
	 */
	it( 'when a learned threshold is below the default threshold, should use it as the safer boundary', () => {
		const storage = new MemoryStorage();
		learnFromDirectReorderApply( 'row', 320, 1000, storage, NOW_MS );

		expect( requiresLargeReorderApply( 320, 'row', storage, NOW_MS ) ).toBe( true );
		expect( requiresLargeReorderApply( 319, 'row', storage, NOW_MS ) ).toBe( false );
	} );

	/**
	 * 学習値を利用できない環境では固定閾値へフォールバックすることを確認する。
	 *
	 * 操作:
	 * - Storageを利用できない状態で固定閾値以下の更新対象セル数を判定する。
	 *
	 * 期待結果:
	 * - 固定閾値を超えないため直接反映を維持する。
	 */
	it( 'when storage is unavailable, should fall back to the default threshold', () => {
		expect(
			requiresLargeReorderApply(
				REORDER_APPLY_CONFIRM_CELL_THRESHOLD,
				'column',
				null,
				NOW_MS
			)
		).toBe( false );
	} );
} );
