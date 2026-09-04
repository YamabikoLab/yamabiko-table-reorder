/**
 * 行並び替えで利用するdnd-kitの物理DnD接続を所有する。
 *
 * Row DnD境界はTable描画Lifecycleに対して安定して存在し、行並び替えが有効な期間だけ開始入力を受け付ける。
 * PC固有の開始入力はPC Inputへ委ね、dnd-kitの物理Lifecycleとpointer位置をDnD Interactionの開始、移動先更新、確定、取消へ変換する。
 */

import {
	Draggable,
	type BeforeDragStartEvent,
	type DragEndEvent,
	type DragMoveEvent,
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { useRef } from '@wordpress/element';
import type { ReactNode } from 'react';

import { rowDndInteraction, type RowDndSource } from './dnd-interaction';
import { RowPcInput, type RowDndPointerDownHandler } from './pc-input';
import type { RowReorderConstraints } from './table-integration';

export type { RowDndPointerDownHandler } from './pc-input';

/**
 * 現在のpointer位置から、Row Reorderの0-based移動先境界を解決する。
 *
 * 対象Tableのtbody直下行だけを移動先行として扱い、行の上半分ではその行の直前、下半分ではその行の直後を移動先とする。
 *
 * @param event 現在のdragmoveイベント。
 * @return 現在の移動先境界。対象Table内の移動先行がない場合はnull。
 */
const resolveDestinationBoundaryIndex = ( event: DragMoveEvent ): number | null => {
	const sourceElement = event.operation.source?.element;

	if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
		return null;
	}

	const sourceRow = sourceElement as HTMLTableRowElement;
	const tableBody = sourceRow.parentElement;

	if ( ! tableBody || tableBody.tagName !== 'TBODY' ) {
		return null;
	}

	const { x, y } = event.operation.position.current;
	const targetRow = sourceRow.ownerDocument
		.elementsFromPoint( x, y )
		.map( ( element ) => element.closest( 'tr' ) as HTMLTableRowElement | null )
		.find( ( row ) => row?.parentElement === tableBody );

	/* 対象Tableのtbody直下行を指していない位置は、有効な移動先として扱わない。 */
	if ( ! targetRow ) {
		return null;
	}

	const rectangle = targetRow.getBoundingClientRect();
	const middleY = rectangle.top + rectangle.height / 2;
	const destinationBoundaryIndex =
		y < middleY ? targetRow.sectionRowIndex : targetRow.sectionRowIndex + 1;

	return destinationBoundaryIndex;
};

/**
 * 対象Tableへdnd-kitの物理DnD Lifecycleを接続する。
 *
 * Provider自体はTable描画Lifecycleに対して安定して維持し、行並び替えが有効な期間だけPC Inputから開始対象を登録する。
 * DnD開始後はpointer位置から対象Table内の移動先境界を解決し、確定または取消まで共通のRow DnD Lifecycleへ接続する。
 *
 * @param props               行DnD接続に必要な値。
 * @param props.enabled       現在のTableで行並び替え開始入力を受け付ける場合はtrue。
 * @param props.tableIdentity 行並び替え対象のTable Identity。
 * @param props.children      既存DOMへpointer handlerを接続する描画処理。
 * @return dnd-kitのRow DnD Lifecycleへ接続された子要素。
 */
export const RowDnd = ( props: {
	enabled: boolean;
	tableIdentity: string;
	children: ( onPointerDownCapture: RowDndPointerDownHandler ) => ReactNode;
} ) => {
	const { enabled, tableIdentity, children } = props;
	const activeDraggable = useRef< Draggable | null >( null );
	const preparedStart = useRef< {
		source: RowDndSource;
		constraints: RowReorderConstraints;
	} | null >( null );

	const onBeforeDragStart = ( event: BeforeDragStartEvent ) => {
		const source = event?.operation?.source?.data as RowDndSource;
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

	const onDragStart = () => {
		const preparation = preparedStart.current;

		if ( preparation === null ) {
			return;
		}

		preparedStart.current = null;
		rowDndInteraction.start( preparation.source, preparation.constraints );
	};

	const onDragMove = ( event: DragMoveEvent ) => {
		rowDndInteraction.updateDestination( resolveDestinationBoundaryIndex( event ) );
	};

	const onDragEnd = ( event: DragEndEvent ) => {
		preparedStart.current = null;
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
			onDragEnd={ onDragEnd }
		>
			<RowPcInput
				enabled={ enabled }
				tableIdentity={ tableIdentity }
				activeDraggable={ activeDraggable }
			>
				{ children }
			</RowPcInput>
		</DragDropProvider>
	);
};
