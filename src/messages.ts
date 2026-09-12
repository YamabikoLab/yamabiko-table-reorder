/**
 * 利用者向け文言をWordPressの翻訳境界へ集約する。
 *
 * 表示側は翻訳処理の詳細を持たず、この境界から現在の表示文言を取得する。
 */

import { __, sprintf } from '@wordpress/i18n';

/** プラグイン名として表示する翻訳済み文言。 */
export const PLUGIN_NAME = __( 'Yamabiko Table Reorder', 'yamabiko-table-reorder' );

/**
 * 行並び替え入口の表示名を取得する。
 *
 * @return 現在の言語に対応した行並び替え入口の表示名。
 */
export const getRowReorderName = () => __( 'Reorder rows', 'yamabiko-table-reorder' );

/**
 * 列並び替え入口の表示名を取得する。
 *
 * @return 現在の言語に対応した列並び替え入口の表示名。
 */
export const getColumnReorderName = () => __( 'Reorder columns', 'yamabiko-table-reorder' );

/**
 * 結合セルにより行DnDを開始できない理由を知らせる文言を取得する。
 *
 * @return 現在の言語に対応した行DnD開始拒否メッセージ。
 */
export const getRowDndStartRejectionMessage = () =>
	__( 'Cannot move because cells are merged.', 'yamabiko-table-reorder' );

/**
 * 結合セルにより列DnDを開始できない理由を知らせる文言を取得する。
 *
 * @return 現在の言語に対応した列DnD開始拒否メッセージ。
 */
export const getColumnDndStartRejectionMessage = () =>
	__( 'Cannot move because cells are merged.', 'yamabiko-table-reorder' );

/**
 * 行DnDを安全に継続できず終了したことを知らせる文言を取得する。
 *
 * @return 現在の言語に対応した行DnD異常終了メッセージ。
 */
export const getRowDndTerminationMessage = () =>
	__( 'Reordering could not continue, so the operation was ended.', 'yamabiko-table-reorder' );

/**
 * PC環境の初回案内に表示する行・列共通の説明文を取得する。
 *
 * @return 現在の言語に対応したPC向け初回案内文。
 */
export const getPcReorderGuidanceMessage = () =>
	__( 'Reorder rows and columns.', 'yamabiko-table-reorder' );

/**
 * タッチ環境の初回案内に表示する長押し操作を含む説明文を取得する。
 *
 * @return 現在の言語に対応したタッチ向け初回案内文。
 */
export const getTouchReorderGuidanceMessage = () =>
	__( 'Long press a cell, then drag to reorder rows and columns.', 'yamabiko-table-reorder' );

/**
 * 初回案内を閉じる入口の支援技術向け表示名を取得する。
 *
 * @return 現在の言語に対応した閉じる入口の表示名。
 */
export const getCloseReorderGuidanceLabel = () =>
	__( 'Close reorder guidance', 'yamabiko-table-reorder' );

/** 大規模反映前の確認ダイアログタイトルを取得する。 */
export const getLargeReorderApplyConfirmTitle = () =>
	__( 'Apply the new order?', 'yamabiko-table-reorder' );

/**
 * 大規模な行移動の確認対象を、利用者向けの1-based位置で示す。
 *
 * @param sourcePosition      移動元の行番号。
 * @param destinationPosition 反映後の移動先行番号。
 * @return 移動元と移動先を簡潔に示す文言。
 */
export const getLargeRowReorderMoveSummary = (
	sourcePosition: number,
	destinationPosition: number
) => {
	/* translators: 1: 移動元の行番号, 2: 移動先の行番号 */
	const message = __( 'Row %1$d → %2$d', 'yamabiko-table-reorder' );
	return sprintf( message, sourcePosition, destinationPosition );
};

/**
 * 大規模な列移動の確認対象を、利用者向けの1-based位置で示す。
 *
 * @param sourcePosition      移動元の列番号。
 * @param destinationPosition 反映後の移動先列番号。
 * @return 移動元と移動先を簡潔に示す文言。
 */
export const getLargeColumnReorderMoveSummary = (
	sourcePosition: number,
	destinationPosition: number
) => {
	/* translators: 1: 移動元の列番号, 2: 移動先の列番号 */
	const message = __( 'Column %1$d → %2$d', 'yamabiko-table-reorder' );
	return sprintf( message, sourcePosition, destinationPosition );
};

/** 大規模反映前の確認ダイアログ本文を取得する。 */
export const getLargeReorderApplyConfirmBody = () =>
	__( 'Applying this reorder may take some time.', 'yamabiko-table-reorder' );

/** 大規模反映を続行するボタン表示名を取得する。 */
export const getLargeReorderContinueLabel = () => __( 'Continue', 'yamabiko-table-reorder' );

/** 大規模反映を中止するボタン表示名を取得する。 */
export const getLargeReorderCancelLabel = () => __( 'Cancel', 'yamabiko-table-reorder' );

/** 大規模反映中であることを知らせる文言を取得する。 */
export const getLargeReorderApplyingMessage = () =>
	__( 'Applying the new order…', 'yamabiko-table-reorder' );

/** 大規模反映の完了を待つよう案内する補足文を取得する。 */
export const getLargeReorderApplyingDetail = () =>
	__( 'Please wait until the update is complete.', 'yamabiko-table-reorder' );

/** 大規模反映が完了したことを知らせる文言を取得する。 */
export const getLargeReorderCompletionMessage = () =>
	__( 'Reordering complete.', 'yamabiko-table-reorder' );
