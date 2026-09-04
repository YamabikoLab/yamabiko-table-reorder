/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Mode中の通常編集抑止と行DnDを接続するReact componentを所有する。
 *
 * 新しいDOM階層は追加せず、Gutenberg既存のwrapper propsへ必要な入力抑止とRow DnD開始入力を合成する。
 * 行DnDではpointerdownされたtbody直下行だけをDraggableとして遅延登録し、DnD開始後に現在行をDroppableとして登録する。
 * dnd-kitの物理LifecycleをDnD Interactionの開始、移動先更新、確定、取消へ接続する。
 */

import {
	Draggable,
	Droppable,
	Feedback,
	PointerSensor,
	type BeforeDragStartEvent,
	type DragDropManager,
	type DragEndEvent,
	type DragMoveEvent,
	type DragOverEvent,
	type DragStartEvent,
} from '@dnd-kit/dom';
import { DragDropProvider, useDragDropManager } from '@dnd-kit/react';
import { useRef, type ComponentType } from '@wordpress/element';

import { rowDndInteraction, type RowDndSource } from '@/reorder/row-reorder/dnd-interaction';
import type { RowReorderConstraints } from '@/reorder/row-reorder/table-integration';
import { useReorderMode } from '@/reorder/reorder-mode-react';
import {
	preserveEditingStartHandler,
	type EditingStartWrapperProps,
} from '@/reorder/wordpress/editing-start';

/** 行DnDのDraggable / Droppable種別。 */
const ROW_DND_TYPE = 'ytr-row';

/** BlockListBlock HOCが利用するprops。 */
export type ReorderModeBlockListBlockProps = {
	clientId: string;
	isSelected: boolean;
	name: string;
	wrapperProps?: EditingStartWrapperProps;
	[ key: string ]: unknown;
};

/**
 * DragDropProviderが所有するManagerを使い、pointerdownされた行だけをDraggableへ登録する。
 *
 * @param props                         BlockListBlock描画に必要な値。
 * @param props.BlockListBlock
 * @param props.blockProps
 * @param props.wrapperProps
 * @param props.activeDraggable         現在のpointer入力で登録したDraggable。
 * @param props.activeDraggable.current
 * @return Row DnD開始入力へ接続されたBlockListBlock。
 */
const RowDndBlockListBlock = ( props: {
	BlockListBlock: ComponentType< ReorderModeBlockListBlockProps >;
	blockProps: ReorderModeBlockListBlockProps;
	wrapperProps: EditingStartWrapperProps | undefined;
	activeDraggable: {
		current: Draggable | null;
	};
} ) => {
	const { BlockListBlock, blockProps, wrapperProps, activeDraggable } = props;
	const manager = useDragDropManager();

	const onPointerDownCapture = ( event: unknown ) => {
		wrapperProps?.onPointerDownCapture?.( event );

		if ( ! manager ) {
			return;
		}

		const pointerEvent = event as PointerEvent;

		if (
			! pointerEvent.isPrimary ||
			pointerEvent.button !== 0 ||
			pointerEvent.pointerType === 'touch' ||
			! manager.dragOperation.status.idle
		) {
			return;
		}

		const target = pointerEvent.target as Element | null;
		const currentTarget = pointerEvent.currentTarget as Element | null;

		if ( ! target || ! currentTarget ) {
			return;
		}

		const table = currentTarget.querySelector( 'table' );
		const tableBody = table?.tBodies.item( 0 ) ?? null;
		const row = target.closest( 'tr' ) as HTMLTableRowElement | null;

		/* 現在Blockのtbody直下行だけを開始対象とし、入れ子Tableの行は対象にしない。 */
		if ( ! tableBody || ! row || row.parentElement !== tableBody ) {
			return;
		}

		activeDraggable.current?.destroy();

		const source: RowDndSource = {
			tableIdentity: blockProps.clientId,
			sourceRowIndex: row.sectionRowIndex,
		};

		activeDraggable.current = new Draggable(
			{
				id: `ytr-row:${ blockProps.clientId }:${ row.sectionRowIndex }`,
				element: row,
				data: source,
				type: ROW_DND_TYPE,
				/* ドラッグ成立と確定を目視確認する間だけ標準Feedbackを利用する。 */
				plugins: [
					Feedback.configure( {
						feedback: 'default',
					} ),
				],
				sensors: [
					PointerSensor.configure( {
						/* Tableセル内部からのpointer入力もDnD開始対象として扱う。 */
						preventActivation: () => false,
					} ),
				],
			},
			manager
		);
	};

	return (
		<BlockListBlock
			{ ...blockProps }
			wrapperProps={ {
				...wrapperProps,
				onPointerDownCapture,
			} }
		/>
	);
};

/**
 * 現在の物理移動先行とpointer位置から、Row Reorderの0-based移動先境界を解決する。
 *
 * 行の上半分ではその行の直前、下半分ではその行の直後を移動先とする。
 *
 * @param event 現在のdragmoveまたはdragoverイベント。
 * @return 現在の移動先境界。移動先行がない場合はnull。
 */
const resolveDestinationBoundaryIndex = (
	event: DragMoveEvent | DragOverEvent
): number | null => {
	const targetElement = event.operation.target?.element;

	if ( ! targetElement || targetElement.tagName !== 'TR' ) {
		return null;
	}

	const row = targetElement as HTMLTableRowElement;
	const rectangle = row.getBoundingClientRect();
	const pointerY = event.operation.position.current.y;
	const middleY = rectangle.top + rectangle.height / 2;

	return pointerY < middleY ? row.sectionRowIndex : row.sectionRowIndex + 1;
};

/**
 * 現在操作中の対応Tableの既存Block wrapperへReorder Modeの編集可否とRow DnDを反映する。
 *
 * このcomponentは現在選択中の対応Tableに対してだけ生成され、Reorder Modeの購読を所有する。
 * 行並び替えモードではDragDropProviderを接続し、pointerdownされたtbody直下行だけをDnD開始対象とする。
 * DnD開始後は現在のtbody直下行を移動先として登録し、最終移動先をDnD Interactionへ渡して行移動を確定する。
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

	const activeDraggable = useRef< Draggable | null >( null );
	const activeDroppables = useRef< Droppable[] >( [] );

	const preparedStart = useRef< {
		source: RowDndSource;
		constraints: RowReorderConstraints;
	} | null >( null );

	const reorderWrapperProps = ! editingAllowed
		? {
				...wrapperProps,
				onDoubleClickCapture: preserveEditingStartHandler( wrapperProps?.onDoubleClickCapture ),
				onMouseDownCapture: preserveEditingStartHandler( wrapperProps?.onMouseDownCapture ),
		  }
		: wrapperProps;

	const destroyDroppables = () => {
		activeDroppables.current.forEach( ( droppable ) => droppable.destroy() );
		activeDroppables.current = [];
	};

	const onBeforeDragStart = ( event: BeforeDragStartEvent, manager: DragDropManager ) => {
		void manager;

		const source = event.operation.source.data as RowDndSource;
		const constraints = rowDndInteraction.prepareStart( source );

		if ( constraints === null ) {
			event.preventDefault();
			activeDraggable.current?.destroy();
			activeDraggable.current = null;
			return;
		}

		preparedStart.current = {
			source,
			constraints,
		};
	};

	const onDragStart = ( event: DragStartEvent, manager: DragDropManager ) => {
		const preparation = preparedStart.current;

		if ( preparation === null ) {
			return;
		}

		preparedStart.current = null;
		rowDndInteraction.start( preparation.source, preparation.constraints );

		const sourceRow = event.operation.source.element as HTMLTableRowElement | undefined;
		const tableBody = sourceRow?.parentElement as HTMLTableSectionElement | null;

		if ( ! sourceRow || ! tableBody || tableBody.tagName !== 'TBODY' ) {
			return;
		}

		destroyDroppables();

		/* DnD開始後だけ現在のtbody直下行を移動先候補として登録する。 */
		Array.from( tableBody.rows )
			.filter( ( row ) => row.parentElement === tableBody )
			.forEach( ( row, rowIndex ) => {
				activeDroppables.current.push(
					new Droppable(
						{
							id: `ytr-row-target:${ clientId }:${ rowIndex }`,
							element: row,
							data: {
								rowIndex,
								tableIdentity: clientId,
							},
							accept: ROW_DND_TYPE,
						},
						manager
					)
				);
			} );
	};

	const updateDestination = ( event: DragMoveEvent | DragOverEvent ) => {
		rowDndInteraction.updateDestination( resolveDestinationBoundaryIndex( event ) );
	};

	const onDragMove = ( event: DragMoveEvent, manager: DragDropManager ) => {
		void manager;
		updateDestination( event );
	};

	const onDragOver = ( event: DragOverEvent, manager: DragDropManager ) => {
		void manager;
		updateDestination( event );
	};

	const onDragEnd = ( event: DragEndEvent, manager: DragDropManager ) => {
		void manager;

		preparedStart.current = null;
		destroyDroppables();
		activeDraggable.current?.destroy();
		activeDraggable.current = null;

		if ( event.canceled ) {
			rowDndInteraction.cancel();
			return;
		}

		rowDndInteraction.complete();
	};

	/* 行並び替えモード以外ではRow DnD Providerを生成せず、列モードでは編集抑止だけを維持する。 */
	if ( selectedKind !== 'row' ) {
		return <BlockListBlock { ...blockProps } wrapperProps={ reorderWrapperProps } />;
	}

	return (
		<DragDropProvider
			onBeforeDragStart={ onBeforeDragStart }
			onDragStart={ onDragStart }
			onDragMove={ onDragMove }
			onDragOver={ onDragOver }
			onDragEnd={ onDragEnd }
		>
			<RowDndBlockListBlock
				BlockListBlock={ BlockListBlock }
				blockProps={ blockProps }
				wrapperProps={ reorderWrapperProps }
				activeDraggable={ activeDraggable }
			/>
		</DragDropProvider>
	);
};
