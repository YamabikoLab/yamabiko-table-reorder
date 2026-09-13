/**
 * 対応Tableの編集表示へReorder Mode / RFのLifecycle、Toolbar、確認付き大規模反映境界を接続するReact componentを所有する。
 *
 * Gutenberg本来のBlockEdit構造を維持し、選択中の対応Tableだけへ並び替えToolbarを追加する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import type { ComponentType } from '@wordpress/element';

import { useRfInteraction } from '@/reorder/reorder-form/responsibilities/interaction-react';
import { ReorderApplyTableBoundary } from '@/reorder/wordpress/components/reorder-apply';
import { ReorderFormCompletion } from '@/reorder/wordpress/components/reorder-form-completion';
import { ReorderModeToolbar } from '@/reorder/wordpress/components/toolbar';
import { useRfTableLifecycle } from '@/reorder/wordpress/hooks/use-rf-table-lifecycle';
import {
	useTableLifecycle,
	type GetSelectedTableIdentity,
} from '@/reorder/wordpress/hooks/use-table-lifecycle';

/** HOCが利用するTable向けBlockEdit props。 */
export type TableBlockEditProps = BlockEditProps< Record< string, unknown > > & {
	name: string;
};

/** 対応Table専用のReorder接続componentへ渡すprops。 */
type ReorderModeEditProps = {
	BlockEdit: ComponentType< TableBlockEditProps >;
	getSelectedTableIdentity: GetSelectedTableIdentity;
	props: TableBlockEditProps;
};

/**
 * 対応Tableの編集表示へReorder Mode / RF Lifecycle、Toolbar、確認付き大規模反映を接続する。
 *
 * @param componentProps 元のBlockEdit component、現在選択Tableの解決境界、Gutenbergから渡されるprops。
 * @return Gutenberg本来のTable編集表示とReorder用UI。
 */
export const ReorderModeEdit = ( componentProps: ReorderModeEditProps ) => {
	const { BlockEdit, getSelectedTableIdentity, props } = componentProps;
	const { attributes, clientId, isSelected } = props;
	const rfState = useRfInteraction( clientId );

	useTableLifecycle( clientId, isSelected, getSelectedTableIdentity );
	useRfTableLifecycle(
		clientId,
		isSelected,
		getSelectedTableIdentity,
		attributes,
		rfState.status
	);

	return (
		<>
			<ReorderApplyTableBoundary clientId={ clientId }>
				<BlockEdit { ...props } />
				{ /* Toolbar入口は現在選択中の対応Tableだけに表示する。 */ }
				{ isSelected && <ReorderModeToolbar tableIdentity={ clientId } /> }
			</ReorderApplyTableBoundary>
			{ /* RF完了通知は大規模反映Boundaryとは独立して通常 / 大規模の成功を一つの経路で扱う。 */ }
			<ReorderFormCompletion status={ rfState.status } />
		</>
	);
};
