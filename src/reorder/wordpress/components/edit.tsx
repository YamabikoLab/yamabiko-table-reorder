/**
 * 対応Tableの編集表示へReorder Mode / RF / ChatのLifecycle、Toolbar、確認付き大規模反映境界を接続するReact componentを所有する。
 *
 * Gutenberg本来のBlockEdit構造を維持し、選択中の対応Tableだけへ並び替えToolbarとChat Reorderを追加する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import type { ComponentType } from '@wordpress/element';

import { useRfInteractionStatus } from '@/reorder/reorder-form/responsibilities/interaction-react';
import { ReorderApplyTableBoundary } from '@/reorder/wordpress/components/reorder-apply';
import { ReorderChat } from '@/reorder/wordpress/components/reorder-chat';
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

/** RF Lifecycle同期componentへ渡すprops。 */
type RfTableLifecycleSyncProps = {
	tableIdentity: string;
	isSelected: boolean;
	getSelectedTableIdentity: GetSelectedTableIdentity;
	attributes: Record< string, unknown >;
};

/**
 * RF Sessionと対象Table Lifecycleの同期だけを所有する。
 *
 * RF状態購読をTable本体の編集表示から分離し、Session状態変更がBlockEditの再描画へ伝播しない境界を作る。
 *
 * @param componentProps 対象Table Identity、選択状態、現在Table解決境界、Table属性。
 * @return 表示要素は持たず、Lifecycle同期だけを行う。
 */
const RfTableLifecycleSync = ( componentProps: RfTableLifecycleSyncProps ) => {
	const { tableIdentity, isSelected, getSelectedTableIdentity, attributes } = componentProps;
	const rfStatus = useRfInteractionStatus( tableIdentity );

	useRfTableLifecycle( tableIdentity, isSelected, getSelectedTableIdentity, attributes, rfStatus );

	return null;
};

/**
 * 対応Tableの編集表示へReorder Mode / RF / Chat Lifecycle、Toolbar、確認付き大規模反映を接続する。
 *
 * @param componentProps 元のBlockEdit component、現在選択Tableの解決境界、Gutenbergから渡されるprops。
 * @return Gutenberg本来のTable編集表示とReorder用UI。
 */
export const ReorderModeEdit = ( componentProps: ReorderModeEditProps ) => {
	const { BlockEdit, getSelectedTableIdentity, props } = componentProps;
	const { attributes, clientId, isSelected } = props;

	useTableLifecycle( clientId, isSelected, getSelectedTableIdentity );

	return (
		<>
			<ReorderApplyTableBoundary clientId={ clientId }>
				<BlockEdit { ...props } />
				{ /* Toolbar入口とChat固有Lifecycleは現在選択中の対応Tableだけに接続する。 */ }
				{ isSelected && (
					<ReorderChat tableIdentity={ clientId }>
						{ ( chat ) => <ReorderModeToolbar chat={ chat } tableIdentity={ clientId } /> }
					</ReorderChat>
				) }
			</ReorderApplyTableBoundary>
			<RfTableLifecycleSync
				tableIdentity={ clientId }
				isSelected={ isSelected }
				getSelectedTableIdentity={ getSelectedTableIdentity }
				attributes={ attributes }
			/>
			{ /* RF完了通知はSession表示状態ではなく対象Tableの未消費Apply結果を購読する。 */ }
			<ReorderFormCompletion tableIdentity={ clientId } />
		</>
	);
};
