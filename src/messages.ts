/**
 * プラグイン全体で共有するユーザー向けメッセージを提供する。
 *
 * 表示文言を1か所に集約し、利用箇所ごとの表記揺れを防ぎながらWordPressの翻訳対象として管理する。
 */

import { __ } from '@wordpress/i18n';

/**
 * プラグイン名として表示する翻訳可能な名称。
 */
export const PLUGIN_NAME = __( 'Yamabiko Table Reorder', 'yamabiko-table-reorder' );
