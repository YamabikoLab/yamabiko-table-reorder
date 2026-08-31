/**
 * Reorder ModeをWordPress Editorへ接続し、対応TableのToolbar入口と通常編集との排他を所有する。
 *
 * Reorder Modeの状態はこの接続境界の外側に保持し、Toolbarの再生成では失わない。
 * Reactは状態の正本を持たず、購読結果から表示と編集可否を導出する。
 */

import { BlockControls } from '@wordpress/block-editor';
import type { BlockEditProps } from '@wordpress/blocks';
import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { useEffect, useSyncExternalStore, type ComponentType } from '@wordpress/element';
import { tableColumnAfter, tableRowAfter } from '@wordpress/icons';

import { getColumnReorderName, getRowReorderName } from '@/messages';

import { createReorderMode, type ReorderKind } from './reorder-mode';

/** Reorder Modeへ接続するTable Block名。 */
const SUPPORTED_TABLE_BLOCKS = new Set( [ 'core/table', 'flexible-table-block/table' ] );

/** Toolbarの再生成から独立して保持するReorder Modeの正本。 */
const reorderMode = createReorderMode();

/** HOCが利用するTable向けBlockEdit props。 */
type TableBlockEditProps = BlockEditProps< Record< string, unknown > > & {
	name: string;
};

/** 対応Table専用のReorder Mode接続componentへ渡すprops。 */
type ReorderModeEditProps = {
	BlockEdit: ComponentType< TableBlockEditProps >;
	props: TableBlockEditProps;
};

/**
 * Reorder ModeのrevisionをReactへ購読させる。
 *
 * React自身はReorder Modeの状態を所有せず、外部状態の変更通知だけを描画更新へ接続する。
 *
 * @return 現在のReorder Mode revision。
 */
const useReorderModeRevision = () =>
	useSyncExternalStore( reorderMode.subscribe, reorderMode.getRevision, reorderMode.getRevision );

/**
 * 対応TableのToolbar入口と編集可否をReorder Modeへ接続する。
 *
 * @param componentProps 元のBlockEdit componentとGutenbergから渡されるprops。
 * @return Reorder Modeの状態を反映した対応Tableの編集表示とToolbar入口。
 */
const ReorderModeEdit = ( componentProps: ReorderModeEditProps ) => {
	const { BlockEdit, props } = componentProps;
	const { clientId, isSelected } = props;

	useReorderModeRevision();

	useEffect( () => {
		/*
		 * 現在操作しているTableが変わった場合だけReorder Modeへ通知する。
		 * Toolbar componentの再生成そのものはモード終了条件にしない。
		 */
		if ( isSelected ) {
			reorderMode.observeTable( clientId );
		}
	}, [ clientId, isSelected ] );

	/**
	 * Toolbar入口の選択をReorder Modeの排他的な状態遷移へ渡す。
	 *
	 * @param kind 選択された並び替え方向。
	 */
	const selectReorderMode = ( kind: ReorderKind ) => {
		reorderMode.select( kind, clientId );
	};

	const editingAllowed = reorderMode.isEditingAllowed( clientId );
	const rowSelected = reorderMode.isSelected( 'row', clientId );
	const columnSelected = reorderMode.isSelected( 'column', clientId );

	return (
		<>
			<div
				onDoubleClickCapture={ editingAllowed ? undefined : ( event ) => event.preventDefault() }
				onMouseDownCapture={ editingAllowed ? undefined : ( event ) => event.preventDefault() }
				onPointerDownCapture={ editingAllowed ? undefined : ( event ) => event.preventDefault() }
			>
				<BlockEdit { ...props } />
			</div>
			{ /*
			 * Toolbar入口は現在選択中の対応Tableだけに表示し、他のTableへ操作対象を広げない。
			 */ }
			{ isSelected && (
				<BlockControls>
					<ToolbarGroup>
						<ToolbarButton
							icon={ tableRowAfter }
							isPressed={ rowSelected }
							label={ getRowReorderName() }
							onClick={ () => selectReorderMode( 'row' ) }
						/>
						<ToolbarButton
							icon={ tableColumnAfter }
							isPressed={ columnSelected }
							label={ getColumnReorderName() }
							onClick={ () => selectReorderMode( 'column' ) }
						/>
					</ToolbarGroup>
				</BlockControls>
			) }
		</>
	);
};

/**
 * BlockEditへReorder Modeの接続境界を追加するHOC。
 *
 * @param BlockEdit Gutenbergが提供する元のBlockEdit component。
 * @return 対応TableだけへReorder Modeを接続するBlockEdit component。
 */
export const withReorderMode = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	/**
	 * 対応TableだけをReorder Modeへ接続するBlockEdit component。
	 *
	 * @param props Gutenbergから渡されるBlockEdit props。
	 * @return 非対応Blockは元の編集表示、対応TableはReorder Mode接続済みの編集表示。
	 */
	function WithReorderMode( props: TableBlockEditProps ) {
		/*
		 * Reorder Modeの責務は対応Tableだけに限定し、その他のBlockの編集挙動には介入しない。
		 */
		if ( ! SUPPORTED_TABLE_BLOCKS.has( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		return <ReorderModeEdit BlockEdit={ BlockEdit } props={ props } />;
	};
