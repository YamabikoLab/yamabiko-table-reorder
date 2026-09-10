/**
 * Row / Column Reorderに共通する反映性能の実測値と端末ローカルな学習値を所有する。
 *
 * Table構造や移動可否は解釈せず、直接反映の表示完了時間と更新対象セル数から性能閾値を学習する。
 * 学習値は現在のEditor環境のlocalStorageへ保存し、期限切れ・方針変更・保存異常時は利用しない。
 */

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

/** 反映性能を方向別に保持するためのReorder方向。 */
export type ReorderApplyDirection = 'row' | 'column';

/**
 * 直接反映の開始時刻と、その操作で更新対象となった物理セル数。
 *
 * 正常に直接反映できた操作だけがこの値を生成する。
 */
export type DirectReorderApplyMeasurement = {
	affectedCellCount: number;
	startedAt: number;
};

/**
 * 現在のEditor表示環境で反映性能を計測・保存するためのWeb API境界。
 *
 * Editor contextが変わった後まで保持せず、物理DnD終了時の基準要素から毎回解決する。
 */
export type ReorderApplyRuntime = {
	storage: Storage | null;
	performanceNow: () => number;
	dateNow: () => number;
	requestAnimationFrame: ( callback: FrameRequestCallback ) => number;
};

type LearnedReorderApplyThreshold = {
	threshold: number;
	measuredAt: number;
	policyVersion: number;
};

const REORDER_APPLY_PERFORMANCE_POLICY_VERSION = 1;
const REORDER_APPLY_PERFORMANCE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** 直接反映を遅い操作として学習する表示完了時間。 */
export const SLOW_REORDER_APPLY_DURATION_MS = 1000;

const storageKeys: Record< ReorderApplyDirection, string > = {
	row: 'yamabiko-table-reorder:reorder-apply-performance:row',
	column: 'yamabiko-table-reorder:reorder-apply-performance:column',
};

/**
 * 保存値が現在の性能学習方針で利用できる学習値か判定する。
 *
 * @param value 解析済みの保存値。
 * @param nowMs 現在日時を表すUnix epochミリ秒。
 * @return 現在の方針で利用できる場合はtrue。
 */
const isValidLearnedThreshold = (
	value: unknown,
	nowMs: number
): value is LearnedReorderApplyThreshold => {
	if ( typeof value !== 'object' || value === null ) {
		return false;
	}

	const candidate = value as Record< string, unknown >;
	const thresholdValid =
		Number.isInteger( candidate.threshold ) && Number( candidate.threshold ) > 0;
	const measuredAt = Number( candidate.measuredAt );
	const measuredAtValid =
		Number.isFinite( measuredAt ) &&
		measuredAt >= 0 &&
		measuredAt <= nowMs &&
		nowMs - measuredAt <= REORDER_APPLY_PERFORMANCE_MAX_AGE_MS;
	const versionValid = candidate.policyVersion === REORDER_APPLY_PERFORMANCE_POLICY_VERSION;
	const valid = thresholdValid && measuredAtValid && versionValid;
	return valid;
};

/**
 * 現在のEditor表示環境から、反映性能を計測・保存するためのWeb API境界を解決する。
 *
 * localStorageを利用できない環境でも表示時間の計測は継続できるよう、Storageだけをnullとして扱う。
 * Editor context自体を解決できない場合は別のwindowを代用しない。
 *
 * @param referenceElement 物理DnD終了時に現在のEditor表示環境を特定できる基準要素。
 * @return 同じEditor環境の計測境界。解決できない場合はnull。
 */
export const resolveReorderApplyRuntime = (
	referenceElement: Element | null | undefined
): ReorderApplyRuntime | null => {
	if ( ! referenceElement ) {
		return null;
	}

	const editorContext = resolveEditorDomContext( referenceElement );
	if ( editorContext === null ) {
		return null;
	}

	let storage: Storage | null = null;
	try {
		storage = editorContext.window.localStorage;
	} catch {
		storage = null;
	}

	return {
		storage,
		performanceNow: () => editorContext.window.performance.now(),
		dateNow: () => editorContext.window.Date.now(),
		requestAnimationFrame: ( callback ) =>
			editorContext.window.requestAnimationFrame( callback ),
	};
};

/**
 * 指定方向で有効な端末ローカルの更新対象セル数閾値を取得する。
 *
 * 保存値が存在しない、壊れている、期限切れ、方針version不一致、またはStorageを利用できない場合はnullを返す。
 *
 * @param direction Row / Columnのどちらの学習値を取得するか。
 * @param storage   現在のEditor環境で利用するStorage。利用できない場合はnull。
 * @param nowMs     現在日時を表すUnix epochミリ秒。
 * @return 現在利用できる学習閾値。存在しない場合はnull。
 */
export const getLearnedReorderApplyThreshold = (
	direction: ReorderApplyDirection,
	storage: Storage | null,
	nowMs: number
): number | null => {
	if ( storage === null ) {
		return null;
	}

	try {
		const serialized = storage.getItem( storageKeys[ direction ] );
		if ( serialized === null ) {
			return null;
		}

		const parsed: unknown = JSON.parse( serialized );
		if ( ! isValidLearnedThreshold( parsed, nowMs ) ) {
			return null;
		}

		return parsed.threshold;
	} catch {
		return null;
	}
};

/**
 * 正常な直接反映の表示完了時間から、指定方向の端末ローカル閾値を安全側へ更新する。
 *
 * 1秒未満の操作では変更せず、既存の有効な学習値より少ない更新対象セル数で遅い操作を観測した場合だけ引き下げる。
 * Storageへ保存できない場合でもReorder自体には影響させない。
 *
 * @param direction         Row / Columnのどちらを学習するか。
 * @param affectedCellCount 正常に直接反映された操作の更新対象セル数。
 * @param durationMs        直接Table更新開始から表示完了確認までの実測時間。
 * @param storage           現在のEditor環境で利用するStorage。利用できない場合はnull。
 * @param nowMs             計測完了時のUnix epochミリ秒。
 */
export const learnFromDirectReorderApply = (
	direction: ReorderApplyDirection,
	affectedCellCount: number,
	durationMs: number,
	storage: Storage | null,
	nowMs: number
): void => {
	const slowApply = durationMs >= SLOW_REORDER_APPLY_DURATION_MS;
	const affectedCellCountValid =
		Number.isInteger( affectedCellCount ) && affectedCellCount > 0;
	if ( ! slowApply || ! affectedCellCountValid || storage === null ) {
		return;
	}

	const currentThreshold = getLearnedReorderApplyThreshold( direction, storage, nowMs );
	const shouldLowerThreshold =
		currentThreshold === null || affectedCellCount < currentThreshold;
	if ( ! shouldLowerThreshold ) {
		return;
	}

	const learnedValue: LearnedReorderApplyThreshold = {
		threshold: affectedCellCount,
		measuredAt: nowMs,
		policyVersion: REORDER_APPLY_PERFORMANCE_POLICY_VERSION,
	};

	try {
		storage.setItem( storageKeys[ direction ], JSON.stringify( learnedValue ) );
	} catch {
		// Storage障害は性能学習だけを無効にし、正常に完了したReorderへ影響させない。
	}
};

/**
 * 正常な直接反映後に2描画周期待ち、更新済みTableの表示完了時間を学習へ渡す。
 *
 * 物理DnD中の時間は含めず、直接Table更新開始時に作成された計測値から表示完了までを測る。
 * 同一描画周期で発生するDnD Presentationの終了処理は厳密に分離せず、現在の終了順序を変更しない。
 *
 * @param direction   Row / Columnのどちらの直接反映を計測するか。
 * @param measurement 正常な直接反映開始時に確定した計測値。
 * @param runtime     同じEditor表示環境の計測・保存境界。
 */
export const measureDirectReorderApplyAfterVisualPaint = (
	direction: ReorderApplyDirection,
	measurement: DirectReorderApplyMeasurement,
	runtime: ReorderApplyRuntime
): void => {
	runtime.requestAnimationFrame( () => {
		runtime.requestAnimationFrame( () => {
			const durationMs = runtime.performanceNow() - measurement.startedAt;
			learnFromDirectReorderApply(
				direction,
				measurement.affectedCellCount,
				durationMs,
				runtime.storage,
				runtime.dateNow()
			);
		} );
	} );
};
