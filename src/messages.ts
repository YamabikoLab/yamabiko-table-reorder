/**
 * plugin全体で共有するユーザー向けメッセージを、WordPressのi18n対象として提供する。
 *
 * 表示文言の定義場所を揃えることで、利用箇所ごとの表記揺れを防ぎ、翻訳対象を明確にする。
 */

import { __ } from '@wordpress/i18n';

/**
 * plugin名として表示する翻訳可能な名称。
 *
 * UIやplugin情報で同じ名称を利用できるよう、i18n pipelineを通る共通メッセージとして提供する。
 */
export const PLUGIN_NAME = __( 'Yamabiko Table Reorder', 'yamabiko-table-reorder' );
