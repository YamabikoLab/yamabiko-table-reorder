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
 * #718 FTB PoCの移動元入力名を取得する。
 *
 * @return 移動元Row indexの表示名。
 */
export const getFtbPreviewFromLabel = () => __( 'From', 'yamabiko-table-reorder' );

/**
 * #718 FTB PoCの移動先入力名を取得する。
 *
 * @return 移動先Row indexの表示名。
 */
export const getFtbPreviewToLabel = () => __( 'To', 'yamabiko-table-reorder' );

/**
 * #718 FTB PoCの表示上の行移動操作名を取得する。
 *
 * @return 複製表示だけを変更する操作名。
 */
export const getFtbPreviewMoveLabel = () => __( 'Move', 'yamabiko-table-reorder' );

/**
 * #718 FTB PoCの1回commit操作名を取得する。
 *
 * @return 最終Row順をFTBへ反映する操作名。
 */
export const getFtbPreviewCommitLabel = () => __( 'Commit once', 'yamabiko-table-reorder' );

/**
 * #718 FTB PoCのデータ反映中メッセージを取得する。
 *
 * @return FTBへの最終Row順の反映中であることを示す文言。
 */
export const getFtbPreviewApplyingMessage = () => __( 'Applying data…', 'yamabiko-table-reorder' );
