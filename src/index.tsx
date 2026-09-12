/**
 * プラグイン全体のWordPress Editor接続を登録する薄い入口を所有する。
 *
 * 各機能の状態や処理は所有せず、定義済みの接続境界をWordPressへ登録することだけを担当する。
 */

import { addFilter } from '@wordpress/hooks';

import { receiveRfApplyRequest } from '@/reorder/reorder-form/responsibilities/apply-coordination';
import { connectRfApplyCoordination } from '@/reorder/reorder-form/responsibilities/interaction';
import { withReorderMode, withReorderModeBlockListBlock } from '@/reorder/wordpress/integration';

/* RF通常反映も同じReceiverを必要とするため、React mountから独立したプラグイン初期化時に一度接続する。 */
connectRfApplyCoordination( receiveRfApplyRequest );

addFilter( 'editor.BlockEdit', 'yamabiko-table-reorder/reorder-mode', withReorderMode );
addFilter(
	'editor.BlockListBlock',
	'yamabiko-table-reorder/reorder-mode-editing-guard',
	withReorderModeBlockListBlock
);
