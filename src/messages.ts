/**
 * 利用者向け文言をWordPressの翻訳境界へ集約する。
 *
 * 表示側は翻訳処理の詳細を持たず、この境界から現在の表示文言を取得する。
 */

import { __ } from '@wordpress/i18n';

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
 * 行DnDを安全に継続できず終了したことを知らせる文言を取得する。
 *
 * @return 現在の言語に対応した行DnD異常終了メッセージ。
 */
export const getRowDndTerminationMessage = () =>
	__( 'Reordering could not continue, so the operation was ended.', 'yamabiko-table-reorder' );
