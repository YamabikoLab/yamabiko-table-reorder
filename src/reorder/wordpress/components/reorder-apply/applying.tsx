/**
 * 確認付き大規模反映の反映中UIだけを表示する。
 *
 * 利用者へ処理継続中であることを静的に伝え、現在のEditor DOM ContextをLifecycleが解決できるPresentationの基準要素を提供する。
 */

import type { RefObject } from 'react';

import { ReorderProgressModal } from '@/reorder/wordpress/components/reorder-progress-modal';

/**
 * 大規模反映中に、閉じられない処理状況と待機案内を表示する。
 *
 * @param props                     反映中UIへ接続する基準要素。
 * @param props.referenceElementRef 現在mountされている反映中要素をLifecycleへ渡すref。
 * @return 反映中Modal。
 */
export const ReorderApplying = ( props: { referenceElementRef: RefObject< HTMLDivElement > } ) => {
	const { referenceElementRef } = props;
	return (
		<div ref={ referenceElementRef }>
			<ReorderProgressModal />
		</div>
	);
};
