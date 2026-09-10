/**
 * 直接反映の実測値から端末ローカル閾値を学習し、安全に再利用・失効できることを確認する。
 */

import {
	getLearnedReorderApplyThreshold,
	learnFromDirectReorderApply,
	measureDirectReorderApplyAfterVisualPaint,
	SLOW_REORDER_APPLY_DURATION_MS,
	type ReorderApplyRuntime,
} from './reorder-apply-performance';

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
const ROW_STORAGE_KEY = 'yamabiko-table-reorder:reorder-apply-performance:row';

describe( 'Reorder apply performance learning', () => {
	/**
	 * 1秒未満で完了した直接反映は遅い操作として学習しないことを確認する。
	 *
	 * 操作:
	 * - 1秒未満で完了した行の直接反映結果を学習へ渡す。
	 *
	 * 期待結果:
	 * - 行の学習閾値は保存されない。
	 */
	it( 'when a direct apply completes below one second, should not learn a threshold', () => {
		const storage = new MemoryStorage();

		learnFromDirectReorderApply( 'row', 320, SLOW_REORDER_APPLY_DURATION_MS - 1, storage, NOW_MS );

		expect( getLearnedReorderApplyThreshold( 'row', storage, NOW_MS ) ).toBeNull();
	} );

	/**
	 * 1秒以上かかった直接反映の更新対象セル数を、その方向だけの学習閾値として保存することを確認する。
	 *
	 * 操作:
	 * - 320セルの行の直接反映が1秒かかった結果を学習へ渡す。
	 *
	 * 期待結果:
	 * - 行の学習閾値は320になる。
	 * - 列の学習閾値には影響しない。
	 */
	it( 'when a row direct apply takes one second, should learn only the row threshold', () => {
		const storage = new MemoryStorage();

		learnFromDirectReorderApply( 'row', 320, SLOW_REORDER_APPLY_DURATION_MS, storage, NOW_MS );

		expect( getLearnedReorderApplyThreshold( 'row', storage, NOW_MS ) ).toBe( 320 );
		expect( getLearnedReorderApplyThreshold( 'column', storage, NOW_MS ) ).toBeNull();
	} );

	/**
	 * 学習後は、より少ないセル数で遅い操作を観測した場合だけ閾値を引き下げることを確認する。
	 *
	 * 事前条件:
	 * - 行の学習閾値が400セルである。
	 *
	 * 操作:
	 * - 450セルの遅い操作を学習した後、300セルの遅い操作を学習する。
	 *
	 * 期待結果:
	 * - 450セルでは閾値を引き上げない。
	 * - 300セルでは閾値を300へ引き下げる。
	 */
	it( 'when later slow applies are observed, should only lower the learned threshold', () => {
		const storage = new MemoryStorage();
		learnFromDirectReorderApply( 'row', 400, 1200, storage, NOW_MS );

		learnFromDirectReorderApply( 'row', 450, 1400, storage, NOW_MS + 1000 );
		expect( getLearnedReorderApplyThreshold( 'row', storage, NOW_MS + 1000 ) ).toBe( 400 );

		learnFromDirectReorderApply( 'row', 300, 1100, storage, NOW_MS + 2000 );
		expect( getLearnedReorderApplyThreshold( 'row', storage, NOW_MS + 2000 ) ).toBe( 300 );
	} );

	/**
	 * 一時的な遅延で学習した値を永久値にせず、一定期間後は固定閾値から再評価できることを確認する。
	 *
	 * 事前条件:
	 * - 行の学習閾値が保存されている。
	 *
	 * 操作:
	 * - 学習から31日後に学習閾値を取得する。
	 *
	 * 期待結果:
	 * - 期限切れとして学習値を利用しない。
	 */
	it( 'when a learned threshold is older than thirty days, should treat it as expired', () => {
		const storage = new MemoryStorage();
		learnFromDirectReorderApply( 'row', 320, 1200, storage, NOW_MS );
		const thirtyOneDaysLater = NOW_MS + 31 * 24 * 60 * 60 * 1000;

		expect( getLearnedReorderApplyThreshold( 'row', storage, thirtyOneDaysLater ) ).toBeNull();
	} );

	/**
	 * 過去の保存形式や学習方針の値を、現在の性能判定へ流用しないことを確認する。
	 *
	 * 事前条件:
	 * - 現在と異なるpolicy versionの学習値が保存されている。
	 *
	 * 操作:
	 * - 行の学習閾値を取得する。
	 *
	 * 期待結果:
	 * - version不一致として学習値を利用しない。
	 */
	it( 'when a stored threshold has another policy version, should ignore it', () => {
		const storage = new MemoryStorage();
		storage.setItem(
			ROW_STORAGE_KEY,
			JSON.stringify( {
				threshold: 320,
				measuredAt: NOW_MS,
				policyVersion: 999,
			} )
		);

		expect( getLearnedReorderApplyThreshold( 'row', storage, NOW_MS ) ).toBeNull();
	} );

	/**
	 * 更新済みTableの表示完了を2描画周期後として扱い、その時点までの時間だけを学習へ渡すことを確認する。
	 *
	 * 事前条件:
	 * - 直接Table更新は時刻100から開始している。
	 * - 2描画周期後の時刻は1100である。
	 *
	 * 操作:
	 * - 表示完了計測を開始し、予約された2描画周期を進める。
	 *
	 * 期待結果:
	 * - 1描画周期目では学習しない。
	 * - 2描画周期目で1000msの直接反映として閾値を学習する。
	 */
	it( 'when two visual frames complete after a direct apply, should learn from the elapsed display time', () => {
		const storage = new MemoryStorage();
		const callbacks: FrameRequestCallback[] = [];
		const runtime: ReorderApplyRuntime = {
			storage,
			performanceNow: () => 1100,
			dateNow: () => NOW_MS,
			requestAnimationFrame: ( callback ) => {
				callbacks.push( callback );
				return callbacks.length;
			},
		};

		measureDirectReorderApplyAfterVisualPaint(
			'column',
			{ affectedCellCount: 280, startedAt: 100 },
			runtime
		);

		callbacks.shift()?.( 0 );
		expect( getLearnedReorderApplyThreshold( 'column', storage, NOW_MS ) ).toBeNull();

		callbacks.shift()?.( 0 );
		expect( getLearnedReorderApplyThreshold( 'column', storage, NOW_MS ) ).toBe( 280 );
	} );

	/**
	 * Storageの読み取りに失敗しても性能学習を通常のReorder失敗へ波及させないことを確認する。
	 *
	 * 操作:
	 * - 読み取り時に例外となるStorageから学習閾値を取得する。
	 *
	 * 期待結果:
	 * - 例外を外へ出さず、学習値なしとして扱う。
	 */
	it( 'when storage reading fails, should treat the learned threshold as unavailable', () => {
		const storage = new MemoryStorage();
		jest.spyOn( storage, 'getItem' ).mockImplementation( () => {
			throw new Error( 'storage unavailable' );
		} );

		expect( getLearnedReorderApplyThreshold( 'row', storage, NOW_MS ) ).toBeNull();
	} );
} );
