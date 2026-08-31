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

import { reorderModeIntegration, type ReorderKind } from './reorder-mode';

/** Reorder Modeへ接続するTable Block名。 */
const SUPPORTED_TABLE_BLOCKS = new Set( [ 'core/table', 'flexible-table-block/table' ] );

/** HOCが利用するTable向けBlockEdit props。 */
type TableBlockEditProps = BlockEditProps< Record< string, unknown > > & {
	name: string;
};

/** 対応Table専用のReorder Mode接続componentへ渡すprops。 */
type ReorderModeEditProps = {
	BlockEdit: ComponentType< TableBlockEditProps >;
	props: TableBlockEditProps;
};

/** Table内容への編集開始につながる入力イベント。 */
type EditingStartEvent = {
	currentTarget: HTMLElement;
	target: EventTarget | null;
	preventDefault: () => void;
};

/**
 * Reorder ModeのrevisionをReactへ購読させる。
 *
 * React自身はReorder Modeの状態を所有せず、外部状態の変更通知だけを描画更新へ接続する。
 *
 * @return 現在のReorder Mode revision。
 */
const useReorderModeRevision = () =>
	useSyncExternalStore(
		reorderModeIntegration.subscribe,
		reorderModeIntegration.getRevision,
		reorderModeIntegration.getRevision
	);

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
		 * 選択中の対応Tableを現在操作しているTableとして通知する。
		 * activeなTableが非選択になった場合は、操作対象がTable外へ移ったものとして通常編集へ戻す。
		 */
		if ( isSelected ) {
			reorderModeIntegration.observeTable( clientId );
			return;
		}

		/*
		 * 並び替えモードの対象Tableだけを終了契機とし、他の非選択Tableは現在状態へ介入させない。
		 */
		if ( ! reorderModeIntegration.isEditingAllowed( clientId ) ) {
			reorderModeIntegration.exit();
		}
	}, [ clientId, isSelected ] );

	/**
	 * Toolbar入口の選択をReorder Modeの排他的な状態遷移へ渡す。
	 *
	 * @param kind 選択された並び替え方向。
	 */
	const selectReorderMode = ( kind: ReorderKind ) => {
		reorderModeIntegration.select( kind, clientId );
	};

	/**
	 * 並び替えモード中の選択Tableで、通常の内容編集だけを開始させない。
	 *
	 * @param event Table内容への編集開始につながる入力イベント。
	 */
	const preventEditingStart = ( event: EditingStartEvent ) => {
		/*
		 * 実DOM上のTable編集領域外から届いたReactイベントには介入せず、
		 * WordPress標準Toolbarなどの操作を通常どおり成立させる。
		 */
		if ( ! event.currentTarget.contains( event.target as Node | null ) ) {
			return;
		}

		event.preventDefault();
	};

	const editingAllowed = reorderModeIntegration.isEditingAllowed( clientId );
	const editingStartHandler = isSelected && ! editingAllowed ? preventEditingStart : undefined;
	const rowSelected = reorderModeIntegration.isSelected( 'row', clientId );
	const columnSelected = reorderModeIntegration.isSelected( 'column', clientId );

	return (
		<>
			<div
				onDoubleClickCapture={ editingStartHandler }
				onMouseDownCapture={ editingStartHandler }
				onPointerDownCapture={ editingStartHandler }
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
