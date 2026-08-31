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
	preventDefault: () => void;
};

/** Block wrapperへ追加できる編集開始入力handler。 */
type EditingStartHandler = ( event: EditingStartEvent ) => void;

/** Block wrapperへ追加できる編集開始入力props。 */
type EditingStartWrapperProps = {
	onDoubleClickCapture?: EditingStartHandler;
	onMouseDownCapture?: EditingStartHandler;
	onPointerDownCapture?: EditingStartHandler;
	[ key: string ]: unknown;
};

/** BlockListBlock HOCが利用するprops。 */
type ReorderModeBlockListBlockProps = {
	clientId: string;
	name: string;
	wrapperProps?: EditingStartWrapperProps;
	[ key: string ]: unknown;
};

/**
 * 行並び替えToolbar入口に表示する専用アイコン。
 */
const rowReorderIcon = (
	<svg
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect height="4" rx="0.75" width="14" x="2.5" y="3.5" />
		<line x1="6" x2="6" y1="3.5" y2="7.5" />
		<line x1="8.25" x2="13.75" y1="5.5" y2="5.5" />
		<rect height="4" rx="0.75" width="14" x="2.5" y="10" />
		<line x1="6" x2="6" y1="10" y2="14" />
		<line x1="8.25" x2="13.75" y1="12" y2="12" />
		<rect height="4" rx="0.75" width="14" x="2.5" y="16.5" />
		<line x1="6" x2="6" y1="16.5" y2="20.5" />
		<line x1="8.25" x2="13.75" y1="18.5" y2="18.5" />
		<line x1="20" x2="20" y1="6.25" y2="17.75" />
		<polyline points="18,8.25 20,6.25 22,8.25" />
		<polyline points="18,15.75 20,17.75 22,15.75" />
	</svg>
);

/**
 * 列並び替えToolbar入口に表示する専用アイコン。
 */
const columnReorderIcon = (
	<svg
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect height="14" rx="0.75" width="4" x="3.5" y="2.5" />
		<line x1="3.5" x2="7.5" y1="6" y2="6" />
		<rect height="14" rx="0.75" width="4" x="10" y="2.5" />
		<line x1="10" x2="14" y1="6" y2="6" />
		<rect height="14" rx="0.75" width="4" x="16.5" y="2.5" />
		<line x1="16.5" x2="20.5" y1="6" y2="6" />
		<line x1="6.25" x2="17.75" y1="20" y2="20" />
		<polyline points="8.25,18 6.25,20 8.25,22" />
		<polyline points="15.75,18 17.75,20 15.75,22" />
	</svg>
);

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
 * 並び替えモード中の選択Tableで、通常の内容編集だけを開始させない。
 *
 * @param event Table内容への編集開始につながる入力イベント。
 */
const preventEditingStart = ( event: EditingStartEvent ) => {
	event.preventDefault();
};

/**
 * Gutenberg既存の編集開始入力handlerを維持したまま、Reorder Modeの編集開始抑止を追加する。
 *
 * 既存handlerへ先に入力を通知することで他のEditor拡張の処理を維持し、その後に通常編集の開始だけを抑止する。
 *
 * @param existingHandler Gutenberg本体または他のfilterが設定した既存handler。
 * @return 既存処理とReorder Modeの編集開始抑止を順に適用するhandler。
 */
const preserveEditingStartHandler =
	( existingHandler?: EditingStartHandler ): EditingStartHandler =>
	( event ) => {
		existingHandler?.( event );
		preventEditingStart( event );
	};

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

	const rowSelected = reorderModeIntegration.isSelected( 'row', clientId );
	const columnSelected = reorderModeIntegration.isSelected( 'column', clientId );

	return (
		<>
			<BlockEdit { ...props } />
			{ /*
			 * Toolbar入口は現在選択中の対応Tableだけに表示し、他のTableへ操作対象を広げない。
			 */ }
			{ isSelected && (
				<BlockControls>
					<ToolbarGroup>
						<ToolbarButton
							icon={ rowReorderIcon }
							isPressed={ rowSelected }
							label={ getRowReorderName() }
							onClick={ () => selectReorderMode( 'row' ) }
						/>
						<ToolbarButton
							icon={ columnReorderIcon }
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
 * BlockEditへReorder ModeのToolbar接続境界を追加するHOC。
 *
 * BlockEdit自体は独自DOM要素で囲まず、Gutenberg本来のBlock構造を維持する。
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

/**
 * Gutenberg既存のBlock wrapperへ、並び替えモード中の内容編集抑止だけを追加するHOC。
 *
 * 新しいDOM階層を追加せず、Block Toolbarや配置操作を既存のEditor構造のまま利用可能にする。
 *
 * @param BlockListBlock Gutenbergが提供する元のBlockListBlock component。
 * @return 対応Tableの既存Block wrapperだけへ編集開始抑止を追加するcomponent。
 */
export const withReorderModeBlockListBlock = (
	BlockListBlock: ComponentType< ReorderModeBlockListBlockProps >
) =>
	/**
	 * 対応Tableの既存Block wrapperへReorder Modeの編集可否を反映する。
	 *
	 * @param props Gutenbergから渡されるBlockListBlock props。
	 * @return Gutenberg本来のBlock wrapper構造を維持したBlockListBlock。
	 */
	function WithReorderModeBlockListBlock( props: ReorderModeBlockListBlockProps ) {
		useReorderModeRevision();

		const { clientId, name, wrapperProps } = props;
		const editingAllowed = reorderModeIntegration.isEditingAllowed( clientId );
		const shouldPreventEditing = SUPPORTED_TABLE_BLOCKS.has( name ) && ! editingAllowed;
		const reorderWrapperProps = shouldPreventEditing
			? {
					...wrapperProps,
					onDoubleClickCapture: preserveEditingStartHandler( wrapperProps?.onDoubleClickCapture ),
					onMouseDownCapture: preserveEditingStartHandler( wrapperProps?.onMouseDownCapture ),
					onPointerDownCapture: preserveEditingStartHandler( wrapperProps?.onPointerDownCapture ),
			  }
			: wrapperProps;

		return <BlockListBlock { ...props } wrapperProps={ reorderWrapperProps } />;
	};
