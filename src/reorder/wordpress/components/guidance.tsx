/**
 * Reorder Guidanceの初回案内表示を所有する。
 *
 * 表示成立条件や表示済み状態は所有せず、WordPressのTableツールバー付近へ操作環境に応じた案内文と閉じる入口を描画する。
 */

import { Button, Popover } from '@wordpress/components';

import {
	getCloseReorderGuidanceLabel,
	getPcReorderGuidanceMessage,
	getTouchReorderGuidanceMessage,
} from '@/messages';
import type { ReorderGuidanceEnvironment } from '@/reorder/reorder-guidance';

import './guidance.scss';

/** 初回案内Popoverの表示に必要な情報と閉じる操作を表す。 */
type ReorderGuidanceProps = {
	anchor: HTMLElement | null;
	environment: ReorderGuidanceEnvironment;
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
 * Tableツールバーの下へ操作環境に応じた行・列並び替えの初回案内を表示する。
 *
 * 通常のセル編集を妨げないよう、表示時にfocusを移動しない。
 * また、通常のTable内focus移動では案内を終了せず、利用者が案内を閉じた場合だけ閉じる操作を通知する。
 *
 * @param props             初回案内の操作環境、配置基準、閉じる操作。
 * @param props.anchor      初回案内を配置するツールバー上の基準要素。
 * @param props.environment 初回案内の文言を選択する操作環境。
 * @param props.onDismiss   初回案内を閉じる操作。
 * @return 配置基準を取得できている場合は初回案内Popover。それ以外はnull。
 */
export const ReorderGuidance = ( props: ReorderGuidanceProps ) => {
	const { anchor, environment, onDismiss } = props;

	/* 配置基準を取得できない間はPopoverを表示しない。 */
	if ( anchor === null ) {
		return null;
	}

	/* 初回案内文は、現在の操作環境で必要となる操作だけを案内する。 */
	const guidanceMessage =
		environment === 'touch'
			? getTouchReorderGuidanceMessage()
			: getPcReorderGuidanceMessage();

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
				<p>{ guidanceMessage }</p>
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
