/**
 * Reorder Guidanceの初回案内表示を所有する。
 *
 * 表示成立条件や表示済み状態は所有せず、WordPressのTableツールバー付近へ公開中の並び替え案内文と閉じる入口を描画する。
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
 * 初回案内からfocusが外れても案内を終了しない。
 *
 * 通常のセル編集やTable内のfocus移動は表示済み条件ではないため、
 * Popover外へのfocus移動を閉じる操作として扱わない。
 */
const ignoreReorderGuidanceFocusOutside = () => undefined;

/**
 * Tableツールバーの下へ公開中の行並び替えの初回案内を表示する。
 *
 * 通常のセル編集を妨げないよう、表示時にfocusを移動しない。
 * また、通常のTable内focus移動では案内を終了せず、利用者が案内を閉じた場合だけ閉じる操作を通知する。
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
			onFocusOutside={ ignoreReorderGuidanceFocusOutside }
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
