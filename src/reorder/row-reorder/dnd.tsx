/**
 * 行並び替えで利用するdnd-kitの物理DnD接続を所有する。
 *
 * 行並び替えが有効なTableに対して、移動先候補を必要な期間だけdnd-kitへ接続する。
 * PC固有の開始入力はPC Inputへ委ね、dnd-kitの物理LifecycleをDnD Interactionの開始、移動先更新、確定、取消へ変換する。
 */

import {
	Draggable,
	Droppable,
	type BeforeDragStartEvent,
	type DragDropManager,
	type DragEndEvent,
	type DragMoveEvent,
	type DragOverEvent,
	type DragStartEvent,
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { useRef } from '@wordpress/element';
import type { ReactNode } from 'react';

import { rowDndInteraction, type RowDndSource } from './dnd-interaction';
import { ROW_DND_TYPE, RowPcInput, type RowDndPointerDownHandler } from './pc-input';
import type { RowReorderConstraints } from './table-integration';

export type { RowDndPointerDownHandler } from './pc-input';

/**
 * 現在の物理移動先行とpointer位置から、Row Reorderの0-based移動先境界を解決する。
 *
 * 行の上半分ではその行の直前、下半分ではその行の直後を移動先とする。
 *
 * @param event 現在のdragmoveまたはdragoverイベント。
 * @return 現在の移動先境界。移動先行がない場合はnull。
 */
const resolveDestinationBoundaryIndex = ( event: DragMoveEvent | DragOverEvent ): number | null => {
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
 * 行並び替えが有効なTableへdnd-kitの物理DnD Lifecycleを接続する。
 *
 * PC Inputが登録した開始対象を開始可否判定へ接続し、DnD開始後に現在のtbody直下行を移動先候補として登録する。
 * DnD Interactionが開始可能と判断した操作だけをSessionへ進め、物理移動先を行境界へ変換して確定または取消まで接続する。
 *
 * @param props               行DnD接続に必要な値。
 * @param props.tableIdentity 行並び替え対象のTable Identity。
 * @param props.children      既存DOMへpointer handlerを接続する描画処理。
 * @return dnd-kitのRow DnD Lifecycleへ接続された子要素。
 */
export const RowDnd = ( props: {
	tableIdentity: string;
	children: ( onPointerDownCapture: RowDndPointerDownHandler ) => ReactNode;
} ) => {
	const { tableIdentity, children } = props;
	const activeDraggable = useRef< Draggable | null >( null );
	const activeDroppables = useRef< Droppable[] >( [] );
	const preparedStart = useRef< {
		source: RowDndSource;
		constraints: RowReorderConstraints;
	} | null >( null );

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
							id: `ytr-row-target:${ tableIdentity }:${ rowIndex }`,
							element: row,
							data: {
								rowIndex,
								tableIdentity,
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

	return (
		<DragDropProvider
			onBeforeDragStart={ onBeforeDragStart }
			onDragStart={ onDragStart }
			onDragMove={ onDragMove }
			onDragOver={ onDragOver }
			onDragEnd={ onDragEnd }
		>
			<RowPcInput tableIdentity={ tableIdentity } activeDraggable={ activeDraggable }>
				{ children }
			</RowPcInput>
		</DragDropProvider>
	);
};
