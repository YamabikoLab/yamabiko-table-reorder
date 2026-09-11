/**
 * 対応Tableの既存Block wrapperへReorder Mode中の通常編集抑止、行・列DnD接続、Presentation対象識別を反映するReact componentを所有する。
 *
 * 新しいDOM階層は追加せず、Gutenberg既存のwrapper propsへ必要な入力抑止とRow / Column DnD開始入力を合成する。
 * dnd-kitの物理Lifecycleは方向固有DnD境界へ委譲し、この境界はReorder Modeを正本として有効な方向を切り替える。
 * 現在選択中のTableだけへ方向固有Reorder Presentationを接続する。
 */

import type { ComponentType } from '@wordpress/element';

import {
	ColumnDnd,
	type ColumnDndPointerDownHandler,
} from '@/reorder/column-reorder/integration/dnd';
import {
	ColumnHighlight,
	type ColumnHighlightPointerOutHandler,
	type ColumnHighlightPointerOverHandler,
} from '@/reorder/column-reorder/responsibilities/presentation/column-highlight';
import { RowDnd, type RowDndPointerDownHandler } from '@/reorder/row-reorder/integration/dnd';
import {
	RowHighlight,
	type RowHighlightPointerOverHandler,
} from '@/reorder/row-reorder/responsibilities/presentation/row-highlight';
import { useReorderMode } from '@/reorder/reorder-mode-react';
import {
	preserveEditingStartHandler,
	type EditingStartWrapperProps,
} from '@/reorder/wordpress/editing-start';

import './editing-guard.scss';

const REORDER_MODE_CLASS = 'yamabiko-table-reorder-mode';
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
 * Gutenberg既存のpointerdown処理を維持したまま、方向固有DnDの開始入力を追加する。
 *
 * Row / Column両DnD境界へ入力を通知し、Reorder Modeで有効な方向だけが開始候補を受理する。
 *
 * @param existingHandler  Gutenberg本体または他のfilterが設定した既存handler。
 * @param rowDndHandler    Row DnDが提供する開始入力handler。
 * @param columnDndHandler Column DnDが提供する開始入力handler。
 * @return 既存処理の後に方向固有DnDへ開始入力を通知するhandler。
 */
const preservePointerDownHandler = (
	existingHandler: EditingStartWrapperProps[ 'onPointerDownCapture' ],
	rowDndHandler: RowDndPointerDownHandler,
	columnDndHandler: ColumnDndPointerDownHandler
): RowDndPointerDownHandler => {
	const handler: RowDndPointerDownHandler = ( event ) => {
		existingHandler?.( event );
		rowDndHandler( event );
		columnDndHandler( event );
	};
	return handler;
};

/**
 * Gutenberg既存のpointerover処理を維持したまま、方向固有の操作可否表示へ現在位置を通知する。
 *
 * @param existingHandler        Gutenberg本体または他のfilterが設定した既存handler。
 * @param rowHighlightHandler    行ホバー表示が提供する判定handler。
 * @param columnHighlightHandler 列の開始前予告表示が提供する判定handler。
 * @return 既存処理の後に方向固有の操作可否表示へ入力を通知するhandler。
 */
const preservePointerOverHandler = (
	existingHandler: unknown,
	rowHighlightHandler: RowHighlightPointerOverHandler,
	columnHighlightHandler: ColumnHighlightPointerOverHandler
): RowHighlightPointerOverHandler => {
	const handler: RowHighlightPointerOverHandler = ( event ) => {
		if ( typeof existingHandler === 'function' ) {
			( existingHandler as RowHighlightPointerOverHandler )( event );
		}
		rowHighlightHandler( event );
		columnHighlightHandler( event );
	};
	return handler;
};

/**
 * Gutenberg既存のpointerout処理を維持したまま、Column Highlightへ現在セルを離れた入力を通知する。
 *
 * 物理イベントが現在セル内部の移動かセル外への移動かという判断はColumn Highlightへ委ね、この境界では既存handlerとの合成だけを行う。
 *
 * @param existingHandler        Gutenberg本体または他のfilterが設定した既存handler。
 * @param columnHighlightHandler 列の開始前予告表示が提供する終了判定handler。
 * @return 既存処理の後にColumn Highlightへ終了入力を通知するhandler。
 */
const preservePointerOutHandler = (
	existingHandler: unknown,
	columnHighlightHandler: ColumnHighlightPointerOutHandler
): ColumnHighlightPointerOutHandler => {
	const handler: ColumnHighlightPointerOutHandler = ( event ) => {
		if ( typeof existingHandler === 'function' ) {
			( existingHandler as ColumnHighlightPointerOutHandler )( event );
		}
		columnHighlightHandler( event );
	};
	return handler;
};

/**
 * Gutenberg既存のwrapper classを維持したまま、並び替えモード中の編集抑止対象と行固有Presentation対象を識別できるclassを追加する。
 *
 * @param existingClassName Gutenberg本体または他のfilterが設定した既存className。
 * @param rowReorderEnabled 現在のTableで行並び替えモードが有効な場合はtrue。
 * @return 既存class、共通Reorder Mode class、および必要な場合は行固有classを併記したclassName。
 */
const createReorderModeClassName = (
	existingClassName: unknown,
	rowReorderEnabled: boolean
): string => {
	const existing = typeof existingClassName === 'string' ? existingClassName : '';
	const rowClass = rowReorderEnabled ? ROW_REORDER_MODE_CLASS : '';
	const className = `${ existing } ${ REORDER_MODE_CLASS } ${ rowClass }`.trim();
	return className;
};

/**
 * 対応Tableの既存Block wrapperへReorder Modeの編集可否と方向固有DnD接続を反映する。
 *
 * このcomponentは対応Tableの生存期間中、選択状態にかかわらず同じ位置に維持され、Reorder Modeの購読を所有する。
 * Row / Column DnD境界はBlockListBlockを再mountしないよう常に同じ位置に維持し、Reorder Modeで選択中の方向だけ開始入力を有効化する。
 * 行・列いずれかの並び替えモード中は通常編集抑止用classを付与し、行並び替えモード中は行固有Presentation用classも付与する。
 * 現在選択中のTableだけへ方向固有Reorder Presentationを接続する。
 *
 * @param props                Gutenbergから渡されるBlockListBlock propsと元のcomponent。
 * @param props.BlockListBlock Gutenberg本来のBlock wrapperを描画するcomponent。
 * @param props.blockProps     現在Blockの識別・選択状態・属性・既存wrapper propsを含む値。
 * @return Gutenberg本来のBlock wrapper構造を維持したBlockListBlock。
 */
export const ReorderModeBlockListBlock = ( props: {
	BlockListBlock: ComponentType< ReorderModeBlockListBlockProps >;
	blockProps: ReorderModeBlockListBlockProps;
} ) => {
	const { BlockListBlock, blockProps } = props;
	const { clientId, isSelected, wrapperProps } = blockProps;
	const { selectedKind } = useReorderMode( clientId );
	const rowReorderEnabled = selectedKind === 'row';
	const columnReorderEnabled = selectedKind === 'column';
	const editingAllowed = selectedKind === null;

	/* いずれかの並び替えモード中は通常編集抑止対象を識別し、行モードでは行固有Presentation対象も併せて識別する。 */
	const reorderModeWrapperProps = ! editingAllowed
		? {
				...wrapperProps,
				className: createReorderModeClassName( wrapperProps?.className, rowReorderEnabled ),
		  }
		: wrapperProps;

	/* いずれかの並び替えモード中は通常編集開始を抑止し、モード解除後はGutenberg本来の入力処理へ戻す。 */
	const reorderWrapperProps = ! editingAllowed
		? {
				...reorderModeWrapperProps,
				onDoubleClickCapture: preserveEditingStartHandler( wrapperProps?.onDoubleClickCapture ),
				onMouseDownCapture: preserveEditingStartHandler( wrapperProps?.onMouseDownCapture ),
		  }
		: reorderModeWrapperProps;

	return (
		<RowHighlight enabled={ rowReorderEnabled } tableIdentity={ clientId }>
			{ ( rowHighlightPointerOverCapture ) => (
				<ColumnHighlight enabled={ columnReorderEnabled } tableIdentity={ clientId }>
					{ ( columnHighlightPointerOverCapture, columnHighlightPointerOutCapture ) => (
						<RowDnd
							enabled={ rowReorderEnabled }
							presentationEnabled={ isSelected }
							tableIdentity={ clientId }
						>
							{ ( rowDndPointerDownCapture ) => (
								<ColumnDnd
									enabled={ columnReorderEnabled }
									presentationEnabled={ isSelected }
									tableIdentity={ clientId }
								>
									{ ( columnDndPointerDownCapture ) => (
										<BlockListBlock
											{ ...blockProps }
											wrapperProps={ {
												...reorderWrapperProps,
												onPointerOverCapture: preservePointerOverHandler(
													wrapperProps?.onPointerOverCapture,
													rowHighlightPointerOverCapture,
													columnHighlightPointerOverCapture
												),
												onPointerOutCapture: preservePointerOutHandler(
													wrapperProps?.onPointerOutCapture,
													columnHighlightPointerOutCapture
												),
												onPointerDownCapture: preservePointerDownHandler(
													wrapperProps?.onPointerDownCapture,
													rowDndPointerDownCapture,
													columnDndPointerDownCapture
												),
											} }
										/>
									) }
								</ColumnDnd>
							) }
						</RowDnd>
					) }
				</ColumnHighlight>
			) }
		</RowHighlight>
	);
};
