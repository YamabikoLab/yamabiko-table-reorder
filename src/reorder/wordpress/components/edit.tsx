/**
 * 対応Tableの編集表示へReorder ModeのLifecycleとToolbar配置を接続するReact componentを所有する。
 *
 * Gutenberg本来のBlockEdit構造を維持し、選択中の対応TableだけへReorder Mode Toolbarを追加する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import type { ComponentType } from '@wordpress/element';

import { ReorderModeToolbar } from '@/reorder/wordpress/components/toolbar';
import {
	useTableLifecycle,
	type GetSelectedTableIdentity,
} from '@/reorder/wordpress/hooks/use-table-lifecycle';

/** HOCが利用するTable向けBlockEdit props。 */
export type TableBlockEditProps = BlockEditProps< Record< string, unknown > > & {
	name: string;
};

/** 対応Table専用のReorder Mode接続componentへ渡すprops。 */
type ReorderModeEditProps = {
	BlockEdit: ComponentType< TableBlockEditProps >;
	getSelectedTableIdentity: GetSelectedTableIdentity;
	props: TableBlockEditProps;
};

/**
 * 対応Tableの編集表示へReorder ModeのLifecycleとToolbar配置を接続する。
 *
 * @param componentProps 元のBlockEdit component、現在選択Tableの解決境界、Gutenbergから渡されるprops。
 * @return Gutenberg本来のTable編集表示と、選択中だけ表示するReorder Mode Toolbar。
 */
export const ReorderModeEdit = ( componentProps: ReorderModeEditProps ) => {
	const { BlockEdit, getSelectedTableIdentity, props } = componentProps;
	const { clientId, isSelected } = props;

	useTableLifecycle( clientId, isSelected, getSelectedTableIdentity );

	return (
		<>
			<BlockEdit { ...props } />
			{ /* Toolbar入口は現在選択中の対応Tableだけに表示する。 */ }
			{ isSelected && <ReorderModeToolbar tableIdentity={ clientId } /> }
		</>
	);
};
