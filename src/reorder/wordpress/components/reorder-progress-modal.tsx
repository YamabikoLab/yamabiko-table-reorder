/**
 * 並び替えに関する処理完了待ちで共通利用するModal Presentationを提供する。
 *
 * 処理状態そのものは所有せず、呼び出し元が待機中と判断した期間だけ、閉じられない進行表示と待機案内を表示する。
 */

import { Dashicon, Modal } from '@wordpress/components';

import { getLargeReorderApplyingDetail, getLargeReorderApplyingMessage } from '@/messages';

/**
 * 並び替えに関する処理の完了待ちで、利用者へ処理継続中であることを表示する。
 *
 * @return 閉じる操作を持たない共通の処理中Modal。
 */
export const ReorderProgressModal = () => (
	<Modal
		title={ getLargeReorderApplyingMessage() }
		onRequestClose={ () => undefined }
		isDismissible={ false }
		focusOnMount="firstContentElement"
		size="small"
	>
		<div
			role="status"
			aria-live="polite"
			aria-busy="true"
			tabIndex={ 0 }
			style={ { textAlign: 'center' } }
		>
			<p aria-hidden="true">
				<Dashicon icon="clock" />
			</p>
			<p>{ getLargeReorderApplyingDetail() }</p>
		</div>
	</Modal>
);
