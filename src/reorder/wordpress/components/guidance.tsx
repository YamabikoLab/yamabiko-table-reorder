/**
 * Reorder Guidanceの初回案内表示を所有する。
 *
 * 表示成立条件や表示済み状態は所有せず、WordPressのTableツールバー付近へ共通案内文と閉じる入口を描画する。
 */

import { Button, Popover } from '@wordpress/components';

import { getCloseReorderGuidanceLabel, getReorderGuidanceMessage } from '@/messages';

import './guidance.scss';

/** 初回案内Popoverの表示に必要な情報と閉じる操作を表す。 */
type ReorderGuidanceProps = {
	anchor: HTMLElement | null;
	isVisible: boolean;
	onDismiss: () => void;
};

/**
 * Tableツールバーの下へ行・列並び替えの初回案内を表示する。
 *
 * 通常のセル編集を妨げないよう、表示時にfocusを移動しない。
 *
 * @param props           初回案内の表示状態、配置基準、閉じる操作。
 * @param props.anchor    初回案内を配置するツールバー上の基準要素。
 * @param props.isVisible 初回案内を表示する場合はtrue。
 * @param props.onDismiss 初回案内を閉じる操作。
 * @return 表示条件が成立する場合は初回案内Popover。それ以外はnull。
 */
export const ReorderGuidance = ( props: ReorderGuidanceProps ) => {
	const { anchor, isVisible, onDismiss } = props;

	/* 案内表示中ではない場合、または配置基準を取得できない間はPopoverを表示しない。 */
	if ( ! isVisible || anchor === null ) {
		return null;
	}

	return (
		<Popover
			anchor={ anchor }
			className="yamabiko-table-reorder-guidance-popover"
			flip={ false }
			focusOnMount={ false }
			offset={ 4 }
			onClose={ onDismiss }
			placement="bottom"
			shift
			variant="unstyled"
		>
			<div className="yamabiko-table-reorder-guidance">
				<p>{ getReorderGuidanceMessage() }</p>
				<Button
					className="yamabiko-table-reorder-guidance__close"
					label={ getCloseReorderGuidanceLabel() }
					onClick={ onDismiss }
				>
					×
				</Button>
			</div>
		</Popover>
	);
};
