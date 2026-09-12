/**
 * 確認付き大規模反映の確認Modalだけを表示する。
 *
 * 表示内容と利用者の続行・取消操作をWordPress UIへ接続し、方向固有状態やApply Lifecycleは所有しない。
 */

import { Button, Modal } from '@wordpress/components';

import {
	getLargeReorderApplyConfirmBody,
	getLargeReorderApplyConfirmTitle,
	getLargeReorderCancelLabel,
	getLargeReorderContinueLabel,
} from '@/messages';

/**
 * 大規模な並び替えを反映する前に、移動内容と続行可否を利用者へ確認する。
 *
 * @param props             確認Modalの表示内容と操作。
 * @param props.moveSummary 利用者向けの移動元・移動先概要。
 * @param props.onConfirm   続行を選択したときの操作。
 * @param props.onCancel    取消またはModalを閉じたときの操作。
 * @return 確認Modal。
 */
export const ReorderApplyConfirmation = ( props: {
	moveSummary: string;
	onConfirm: () => void;
	onCancel: () => void;
} ) => {
	const { moveSummary, onConfirm, onCancel } = props;
	return (
		<Modal title={ getLargeReorderApplyConfirmTitle() } onRequestClose={ onCancel }>
			<p>
				<strong>{ moveSummary }</strong>
			</p>
			<p>{ getLargeReorderApplyConfirmBody() }</p>
			<Button variant="primary" onClick={ onConfirm }>
				{ getLargeReorderContinueLabel() }
			</Button>
			<Button variant="tertiary" onClick={ onCancel }>
				{ getLargeReorderCancelLabel() }
			</Button>
		</Modal>
	);
};
