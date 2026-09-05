/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Mode中の通常編集抑止、行DnD接続、Presentation対象識別を反映するReact componentを所有する。
 *
 * 新しいDOM階層は追加せず、Gutenberg既存のwrapper propsへ必要な入力抑止とRow DnD開始入力だけを合成する。
 * dnd-kitの物理LifecycleとRow DnD Sessionの接続はRow Reorder側へ委譲し、この境界はPresentationが行並び替えモード中の対象Tableを識別するためのclassだけを既存wrapperへ付与する。
 */

import type { ComponentType } from '@wordpress/element';

import { RowDnd, type RowDndPointerDownHandler } from '@/reorder/row-reorder/dnd';
import {
	RowHighlight,
	type RowHighlightPointerOverHandler,
} from '@/reorder/row-reorder/presentation/row-highlight';
import { useReorderMode } from '@/reorder/reorder-mode-react';
import {
	preserveEditingStartHandler,
	type EditingStartWrapperProps,
} from '@/reorder/wordpress/editing-start';

import '@/reorder/wordpress/editing-guard.scss';

const ROW_REORDER_MODE_CLASS = 'yamabiko-table-reorder-row-mode';

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
 * Gutenberg既存のpointerover処理を維持したまま、行ホバー表示へ現在位置を通知する。
 *
 * @param existingHandler     Gutenberg本体または他のfilterが設定した既存handler。
 * @param rowHighlightHandler 行ホバー表示が提供する判定handler。
 * @return 既存処理の後に行ホバー表示へ入力を通知するhandler。
 */
const preservePointerOverHandler = (
	existingHandler: unknown,
	rowHighlightHandler: RowHighlightPointerOverHandler
): RowHighlightPointerOverHandler => {
	const handler: RowHighlightPointerOverHandler = ( event ) => {
		if ( typeof existingHandler === 'function' ) {
			( existingHandler as RowHighlightPointerOverHandler )( event );
		}
		rowHighlightHandler( event );
	};
	return handler;
};

/**
 * Gutenberg既存のwrapper classを維持したまま、行並び替えモード中の表示対象を識別できるclassを追加する。
 *
 * @param existingClassName Gutenberg本体または他のfilterが設定した既存className。
 * @return 既存classと行並び替えモード用classを併記したclassName。
 */
const createRowReorderModeClassName = ( existingClassName: unknown ): string => {
	const existing = typeof existingClassName === 'string' ? existingClassName : '';
	const className = `${ existing } ${ ROW_REORDER_MODE_CLASS }`.trim();
	return className;
};

/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Modeの編集可否とRow DnD接続を反映する。
 *
 * このcomponentは現在選択中の対応Tableに対してだけ生成され、Reorder Modeの購読を所有する。
 * Row DnD境界はモード切替でBlockListBlockを再mountしないよう常に同じ位置に維持し、行並び替えモード中だけ開始入力を有効化する。
 * 行並び替えモード中は既存Block wrapperへ表示識別用classを付与し、Presentationが行単位の操作可能表示を提供できるようにする。
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
	const rowReorderEnabled = selectedKind === 'row';
	const editingAllowed = selectedKind === null;
	const rowReorderWrapperProps = rowReorderEnabled
		? {
				...wrapperProps,
				className: createRowReorderModeClassName( wrapperProps?.className ),
		  }
		: wrapperProps;
	const reorderWrapperProps = ! editingAllowed
		? {
				...rowReorderWrapperProps,
				onDoubleClickCapture: preserveEditingStartHandler( wrapperProps?.onDoubleClickCapture ),
				onMouseDownCapture: preserveEditingStartHandler( wrapperProps?.onMouseDownCapture ),
		  }
		: rowReorderWrapperProps;

	return (
		<RowHighlight enabled={ rowReorderEnabled } tableIdentity={ clientId }>
			{ ( rowHighlightPointerOverCapture ) => (
				<RowDnd enabled={ rowReorderEnabled } tableIdentity={ clientId }>
					{ ( rowDndPointerDownCapture ) => (
						<BlockListBlock
							{ ...blockProps }
							wrapperProps={ {
								...reorderWrapperProps,
								onPointerOverCapture: preservePointerOverHandler(
									wrapperProps?.onPointerOverCapture,
									rowHighlightPointerOverCapture
								),
								onPointerDownCapture: preservePointerDownHandler(
									wrapperProps?.onPointerDownCapture,
									rowDndPointerDownCapture
								),
							} }
						/>
					) }
				</RowDnd>
			) }
		</RowHighlight>
	);
};
