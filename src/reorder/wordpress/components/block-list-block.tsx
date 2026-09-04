/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Mode中の通常編集抑止を接続するReact componentを所有する。
 *
 * 新しいDOM階層は追加せず、Gutenberg既存のwrapper propsへ必要な入力抑止だけを合成する。
 * DnD開始に必要なpointer入力は変更せず、通常編集の開始だけを成立させない。
 */

import { useRef, type ComponentType } from '@wordpress/element';

import { useEditingAllowed } from '@/reorder/reorder-mode-react';
import {
	preserveEditingStartHandler,
	type EditingStartWrapperProps,
} from '@/reorder/wordpress/editing-start';
import { DragDropProvider } from '@dnd-kit/react';
import type {
	BeforeDragStartEvent,
	DragDropManager,
	DragEndEvent,
	DragMoveEvent,
	DragOverEvent,
	DragStartEvent,
} from '@dnd-kit/dom';
import { rowDndInteraction, type RowDndSource } from '@/reorder/row-reorder/dnd-interaction';
import type { RowReorderConstraints } from '@/reorder/row-reorder/table-integration';

/** BlockListBlock HOCが利用するprops。 */
export type ReorderModeBlockListBlockProps = {
	clientId: string;
	isSelected: boolean;
	name: string;
	wrapperProps?: EditingStartWrapperProps;
	[ key: string ]: unknown;
};

/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Modeの編集可否を反映する。
 *
 * このcomponentは現在選択中の対応Tableに対してだけ生成され、Reorder Modeの購読を所有する。
 * Reorder Mode中もpointerdownは既存propsのままDnD開始へ渡し、通常編集開始につながる入力だけを抑止する。
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
	const editingAllowed = useEditingAllowed( clientId );
	const reorderWrapperProps = ! editingAllowed
		? {
				...wrapperProps,
				onDoubleClickCapture: preserveEditingStartHandler( wrapperProps?.onDoubleClickCapture ),
				onMouseDownCapture: preserveEditingStartHandler( wrapperProps?.onMouseDownCapture ),
		  }
		: wrapperProps;

	const preparedStart = useRef< {
		source: RowDndSource;
		constraints: RowReorderConstraints;
	} | null >( null );

	const onBeforeDragStart = ( event: BeforeDragStartEvent, manager: DragDropManager ) => {
		void manager;

		const source = event.operation?.source?.data as RowDndSource;
		const constraints = rowDndInteraction.prepareStart( source );

		if ( constraints === null ) {
			event.preventDefault();
			return;
		}

		preparedStart.current = {
			source,
			constraints,
		};
	};

	const onDragStart = ( event: DragStartEvent, manager: DragDropManager ) => {
		void event;
		void manager;

		const preparation = preparedStart.current;

		if ( preparation === null ) {
			return;
		}

		preparedStart.current = null;

		rowDndInteraction.start( preparation.source, preparation.constraints );
	};

	const onDragMove = ( event: DragMoveEvent, manager: DragDropManager ) => {
		// dragmove fires frequently, so keep the UI quiet and just expose it in DevTools.
	};

	const onDragOver = ( event: DragOverEvent, manager: DragDropManager ) => {
		void manager;
	};

	const onDragEnd = ( event: DragEndEvent, manager: DragDropManager ) => {
		void manager;
	};
	return (
		<>
			<DragDropProvider
				onBeforeDragStart={ onBeforeDragStart }
				onDragStart={ onDragStart }
				onDragMove={ onDragMove }
				onDragOver={ onDragOver }
				onDragEnd={ onDragEnd }
			>
				<BlockListBlock { ...blockProps } wrapperProps={ reorderWrapperProps } />
			</DragDropProvider>
		</>
	);
};
