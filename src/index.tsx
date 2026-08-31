/**
 * プラグイン全体のWordPress Editor接続を登録する薄いentry point。
 */

import { addFilter } from '@wordpress/hooks';

import { withReorderMode } from '@/reorder/reorder-mode-integration';

addFilter( 'editor.BlockEdit', 'yamabiko-table-reorder/reorder-mode', withReorderMode );
