/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Mode中の通常編集抑止と行DnD接続を反映するReact componentを所有する。
 *
 * 新しいDOM階層は追加せず、Gutenberg既存のwrapper propsへ必要な入力抑止とRow DnD開始入力だけを合成する。
 * dnd-kitの物理LifecycleとRow DnD Sessionの接続はRow Reorder側へ委譲する。
 */

import type { ComponentType } from '@wordpress/element';

import { RowDnd, type RowDndPointerDownHandler } from '@/reorder/row-reorder/dnd';
import { useReorderMode } from '@/reorder/reorder-mode-react';
import {
	preserveEditingStartHandler,
	type EditingStartWrapperProps,
} from '@/reorder/wordpress/editing-start';

/** BlockListBlock HOCが利用するprops。 */
export type ReorderModeBlockListBlockProps = {
	clientId: string;
	isSelected: boolean;
	name: string;
	wrapperProps?: EditingStartWrapperProps;
	[ key: string ]: unknown;
};

/**
 * Gutenberg既存のpointerdown処理を維持したまま、Row DnD開始入力を追加する。
 *
 * @param existingHandler Gutenberg本体または他のfilterが設定した既存handler。
 * @param rowDndHandler   Row DnDが提供する開始入力handler。
 * @return 既存処理の後にRow DnD開始入力を通知するhandler。
 */
const preservePointerDownHandler = (
	existingHandler: EditingStartWrapperProps[ 'onPointerDownCapture' ],
	rowDndHandler: RowDndPointerDownHandler
): RowDndPointerDownHandler => {
	const handler: RowDndPointerDownHandler = ( event ) => {
		existingHandler?.( event );
		rowDndHandler( event );
	};
	return handler;
};

/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Modeの編集可否とRow DnD接続を反映する。
 *
 * このcomponentは現在選択中の対応Tableに対してだけ生成され、Reorder Modeの購読を所有する。
 * 行並び替えモードではRow Reorder側のDnD境界へ既存Block wrapperを接続し、列並び替えモードでは編集抑止だけを維持する。
 *
 * @param props                Gutenbergから渡されるBlockListBlock propsと元のcomponent。
 * @param props.BlockListBlock
 * @param props.blockProps
 * @return Gutenberg本来のBlock wrapper構造を維持したBlockListBlock。
 */
export const ReorderModeBlockListBlock = ( props: {
	BlockListBlock: ComponentType< ReorderModeBlockListBlockProps >;
	blockProps: ReorderModeBlockListBlockProps;
} ) => {
	const { BlockListBlock, blockProps } = props;
	const { clientId, wrapperProps } = blockProps;
	const { selectedKind } = useReorderMode( clientId );
	const editingAllowed = selectedKind === null;
	const reorderWrapperProps = ! editingAllowed
		? {
				...wrapperProps,
				onDoubleClickCapture: preserveEditingStartHandler( wrapperProps?.onDoubleClickCapture ),
				onMouseDownCapture: preserveEditingStartHandler( wrapperProps?.onMouseDownCapture ),
		  }
		: wrapperProps;

	/* 行並び替えモード以外ではRow DnDを接続せず、既存の編集抑止だけを維持する。 */
	if ( selectedKind !== 'row' ) {
		return <BlockListBlock { ...blockProps } wrapperProps={ reorderWrapperProps } />;
	}

	return (
		<RowDnd tableIdentity={ clientId }>
			{ ( rowDndPointerDownCapture ) => (
				<BlockListBlock
					{ ...blockProps }
					wrapperProps={ {
						...reorderWrapperProps,
						onPointerDownCapture: preservePointerDownHandler(
							wrapperProps?.onPointerDownCapture,
							rowDndPointerDownCapture
						),
					} }
				/>
			) }
		</RowDnd>
	);
};
