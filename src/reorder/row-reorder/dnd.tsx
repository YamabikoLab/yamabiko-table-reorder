/**
 * 行並び替えにおけるdnd-kitとの物理DnD接続と、物理DnDに同期するPresentation接続を所有する。
 *
 * 行DnD境界はTableの描画中に安定して存在し、行並び替えが有効な期間だけ開始入力を受け付ける。
 * PCとタッチ端末の開始条件判定は入力境界へ委ね、dnd-kitが通知する物理DnDの進行と現在位置を、
 * DnD Interactionが扱う開始、移動先更新、確定、取消へ接続する。
 * Reorder Presentationは同じ物理DnD境界内でLifecycleと物理情報を受け取り、DnD Interactionの意味状態と組み合わせて移動対象行と有効な挿入位置を表示する。
 * 行並び替えの無効化または境界の終了時には、次の通常編集や別モードへ持ち越せない開始準備と物理DnD登録を破棄する。
 */

import {
	Draggable,
	type BeforeDragStartEvent,
	type DragEndEvent,
	type DragMoveEvent,
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { useEffect, useRef } from '@wordpress/element';
import type { ReactNode } from 'react';

import { rowDndInteraction, type RowDndSource } from './dnd-interaction';
import { RowInput, type RowDndPointerDownHandler } from './input';
import { RowInsertionLine } from './presentation/insertion-line';
import type { RowReorderConstraints } from './table-integration';

export type { RowDndPointerDownHandler } from './input';

/**
 * 現在のポインター位置から、行並び替えの0-based移動先境界を解決する。
 *
 * 対象Tableと同じ表示環境の座標を利用し、tbody直下行だけを移動先候補として扱う。
 * 行の上半分ではその行の直前、下半分ではその行の直後を移動先とする。
 *
 * @param event 現在の物理DnD位置を示す移動イベント。
 * @return 現在の移動先境界。対象Table内の移動先行がない場合はnull。
 */
const resolveDestinationBoundaryIndex = ( event: DragMoveEvent ): number | null => {
	const sourceElement = event.operation.source?.element;

	/* 行DnDの並び替え対象を確認できない場合は、移動先判定を成立させない。 */
	if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
		return null;
	}

	const sourceRow = sourceElement as HTMLTableRowElement;
	const tableBody = sourceRow.parentElement;

	/* 行DnDの対象範囲であるtbodyを確認できない場合は、移動先判定を成立させない。 */
	if ( ! tableBody || tableBody.tagName !== 'TBODY' ) {
		return null;
	}

	const nativeEvent = event.nativeEvent;

	/* 移動先判定は現在のポインター入力にだけ成立し、別入力方式の座標を推測して補完しない。 */
	if ( ! nativeEvent || ! ( 'clientX' in nativeEvent ) || ! ( 'clientY' in nativeEvent ) ) {
		return null;
	}

	const pointerEvent = nativeEvent as PointerEvent;
	const x = pointerEvent.clientX;
	const y = pointerEvent.clientY;

	/* ポインター位置に重なる要素から対象Tableのtbody直下行を解決し、入れ子Tableなどの行を候補から除外する。 */
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

	/* 指している行の中央を境界とし、上側は直前、下側は直後の挿入位置として扱う。 */
	const destinationBoundaryIndex =
		y < middleY ? targetRow.sectionRowIndex : targetRow.sectionRowIndex + 1;

	return destinationBoundaryIndex;
};

/**
 * 対象Tableへdnd-kitの物理DnD進行を接続する。
 *
 * 接続自体はTableの描画中に安定して維持し、行並び替えが有効な期間だけ入力境界から開始対象を登録する。
 * DnD開始後はポインター位置から対象Table内の移動先境界を解決し、確定または取消までDnD Interactionへ接続する。
 * Reorder Presentationも同じ物理DnD境界へ接続し、意味状態と必要な物理情報がそろった期間だけ移動対象行と有効な挿入位置を表示する。
 * 行並び替えが無効になった場合と接続自体が終了する場合は、未完了の開始準備とDraggable登録を破棄する。
 *
 * @param props               行DnD接続に必要な値。
 * @param props.enabled       現在のTableで行並び替え開始入力を受け付ける場合はtrue。
 * @param props.tableIdentity 行並び替え対象のTable Identity。
 * @param props.children      既存DOMへポインター開始処理を接続する描画処理。
 * @return dnd-kitの行DnD進行とReorder Presentationへ接続された子要素。
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

	useEffect( () => {
		/* 行並び替えが無効になった時点で、通常編集や別モードへ開始準備と物理DnD登録を持ち越さない。 */
		if ( ! enabled ) {
			preparedStart.current = null;
			activeDraggable.current?.destroy();
			activeDraggable.current = null;
		}
	}, [ enabled ] );

	useEffect( () => {
		return () => {
			/* TableのDnD接続終了時は、未完了の開始準備と物理DnD登録を残さない。 */
			preparedStart.current = null;
			activeDraggable.current?.destroy();
			activeDraggable.current = null;
		};
	}, [] );

	const onBeforeDragStart = ( event: BeforeDragStartEvent ) => {
		const source = event?.operation?.source?.data as RowDndSource;
		const constraints = rowDndInteraction.prepareStart( source );

		/* 開始時点のTable構造で並び替え対象が成立しない場合は、物理DnDを開始しない。 */
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

		/* 開始可否確認が成立していない物理DnD通知からは、行DnD Sessionを開始しない。 */
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
		/* 物理DnD終了時は、次回入力へ持ち越してはならない開始準備と一時登録を破棄する。 */
		preparedStart.current = null;
		activeDraggable.current?.destroy();
		activeDraggable.current = null;

		/* 物理DnDが取消で終了した場合は、行並び替えを確定せずSessionを取消する。 */
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
			<RowInsertionLine />
			<RowInput
				enabled={ enabled }
				tableIdentity={ tableIdentity }
				activeDraggable={ activeDraggable }
			>
				{ children }
			</RowInput>
		</DragDropProvider>
	);
};
