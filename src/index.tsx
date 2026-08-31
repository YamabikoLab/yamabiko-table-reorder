/**
 * プラグイン全体のWordPress Editor接続を登録する薄い入口を所有する。
 *
 * 各機能の状態や処理は所有せず、定義済みの接続境界をWordPressへ登録することだけを担当する。
 */

import { addFilter } from '@wordpress/hooks';

import {
	withReorderMode,
	withReorderModeBlockListBlock,
} from '@/reorder/reorder-mode-integration';

addFilter( 'editor.BlockEdit', 'yamabiko-table-reorder/reorder-mode', withReorderMode );
addFilter(
	'editor.BlockListBlock',
	'yamabiko-table-reorder/reorder-mode-editing-guard',
	withReorderModeBlockListBlock
);
