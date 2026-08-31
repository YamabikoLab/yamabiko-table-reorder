/**
 * 利用者向け文言をWordPressの翻訳境界へ集約する。
 */

import { __ } from '@wordpress/i18n';

/** プラグイン名を返す。 */
export const PLUGIN_NAME = __( 'Yamabiko Table Reorder', 'yamabiko-table-reorder' );

/** 行並び替え入口の表示名を返す。 */
export const getRowReorderName = () => __( 'Reorder rows', 'yamabiko-table-reorder' );

/** 列並び替え入口の表示名を返す。 */
export const getColumnReorderName = () => __( 'Reorder columns', 'yamabiko-table-reorder' );
