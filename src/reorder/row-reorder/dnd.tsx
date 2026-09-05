/**
 * 行並び替えにおけるdnd-kitとの物理DnD接続を所有する。
 *
 * 行DnD境界はTableの描画中に安定して存在し、行並び替えが有効な期間だけ開始入力を受け付ける。
 * PCとタッチ端末の開始条件判定は入力境界へ委ね、dnd-kitが通知する物理DnDの進行と現在位置を、
 * DnD Interactionが扱う開始、移動先更新、確定、取消へ接続する。
 * Reorder Presentationは同じDnD Engine境界の配下へ独立して接続し、表示Lifecycleと表示状態を自身で所有する。
 * 行並び替えの無効化または境界の終了時には、次の通常編集や別モードへ持ち越せない開始準備と物理DnD登録を破棄する。
 */

import {
	Draggable,
	type BeforeDragStartEvent,
	type DragEndEvent,
	type DragMoveEvent,
	type DragStartEvent,
} from '@dnd-kit/dom';
import { DragDropProvider } from '@dnd-kit/react';
import { useEffect, useRef } from '@wordpress/element';
import type { ReactNode } from 'react';

import { rowDndInteraction, type RowDndSource } from './dnd-interaction';
import { RowInput, type RowDndPointerDownHandler } from './input';
import { RowPresentation } from './presentation/row-presentation';
import type { RowReorderConstraints } from './table-integration';

export type { RowDndPointerDownHandler } from './input';

/** DnD開始時のTable配置を基準として移動先判定に利用する、tbody内の論理的な行境界。 */
type RowDestinationBoundary = {
	index: number;
	top: number;
	bottom: number;
};

/** DnD中に維持する、対象tbodyと開始時に確定した論理的な行境界。 */
type RowDestinationLayout = {
	tableBody: HTMLTableSectionElement;
	boundaries: RowDestinationBoundary[];
};

/**
 * 移動対象行から、DnD中の移動先判定に利用する論理配置を取得する。
 *
 * 行境界はtbodyからの相対位置として保持し、スクロールによる画面上の位置変化は固定しない。
 * DnD中に実Tableの表示位置が変化しても、移動先候補は開始時の行配置を基準として解決する。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 対象tbodyと論理的な行境界。Row Reorder対象として成立しない場合はnull。
 */
const resolveDestinationLayout = (
	sourceElement: Element | undefined
): RowDestinationLayout | null => {
	/* Row Reorderの移動対象としてtbody直下行を確認できない場合は、移動先判定用の配置を成立させない。 */
	if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
		return null;
	}

	const sourceRow = sourceElement as HTMLTableRowElement;
	const tableBody = sourceRow.parentElement;

	/* 行DnDの対象範囲であるtbodyを確認できない場合は、別のDOM階層から移動先を推測しない。 */
	if ( ! tableBody || tableBody.tagName !== 'TBODY' ) {
		return null;
	}

	const typedTableBody = tableBody as HTMLTableSectionElement;
	const bodyRectangle = typedTableBody.getBoundingClientRect();
	const boundaries = Array.from( typedTableBody.rows, ( row, index ) => {
		const rectangle = row.getBoundingClientRect();
		return {
			index,
			top: rectangle.top - bodyRectangle.top,
			bottom: rectangle.bottom - bodyRectangle.top,
		};
	} );

	return {
		tableBody: typedTableBody,
		boundaries,
	};
};

/**
 * 現在のポインター位置から、DnD開始時の論理的な行配置に対する0-based移動先境界を解決する。
 *
 * DnD中の表示上の位置変化は移動先判定へ反映せず、スクロール等によるtbody自体の現在位置だけを反映する。
 * 行の上半分ではその行の直前、下半分ではその行の直後を移動先とする。
 *
 * @param event  現在の物理DnD位置を示す移動イベント。
 * @param layout DnD中に維持する対象tbodyと論理的な行境界。
 * @return 現在の移動先境界。対象Table内の移動先行がない場合はnull。
 */
const resolveDestinationBoundaryIndex = (
	event: DragMoveEvent,
	layout: RowDestinationLayout
): number | null => {
	const nativeEvent = event.nativeEvent;

	/* 移動先判定は現在のポインター入力にだけ成立し、別入力方式の座標を推測して補完しない。 */
	if ( ! nativeEvent || ! ( 'clientX' in nativeEvent ) || ! ( 'clientY' in nativeEvent ) ) {
		return null;
	}

	const pointerEvent = nativeEvent as PointerEvent;
	const bodyRectangle = layout.tableBody.getBoundingClientRect();
	const x = pointerEvent.clientX;
	const y = pointerEvent.clientY;

	/* 実ブラウザーでtbodyの横幅を取得できる場合は、対象Tableの横方向外側を移動先として扱わない。 */
	if ( bodyRectangle.width > 0 && ( x < bodyRectangle.left || x > bodyRectangle.right ) ) {
		return null;
	}

	const localY = y - bodyRectangle.top;
	let lower = 0;
	let upper = layout.boundaries.length - 1;

	/* 大きなTableでも行数比例のDOM探索を行わず、DnD開始時の論理境界から現在位置に対応する行だけを特定する。 */
	while ( lower <= upper ) {
		const middle = Math.floor( ( lower + upper ) / 2 );
		const boundary = layout.boundaries[ middle ];

		if ( boundary === undefined ) {
			return null;
		}

		if ( localY < boundary.top ) {
			upper = middle - 1;
			continue;
		}

		if ( localY > boundary.bottom ) {
			lower = middle + 1;
			continue;
		}

		const middleY = boundary.top + ( boundary.bottom - boundary.top ) / 2;
		const destinationBoundaryIndex = localY < middleY ? boundary.index : boundary.index + 1;
		return destinationBoundaryIndex;
	}

	return null;
};

/**
 * 対象Tableへdnd-kitの物理DnD進行を接続する。
 *
 * 接続自体はTableの描画中に安定して維持し、行並び替えが有効な期間だけ入力境界から開始対象を登録する。
 * DnD開始後はポインター位置から対象Table内の移動先境界を解決し、確定または取消までDnD Interactionへ接続する。
 * Reorder Presentationは同じDnD Engine境界を利用する独立した表示境界として接続する。
 * 行並び替えが無効になった場合と接続自体が終了する場合は、未完了の開始準備とDraggable登録を破棄する。
 *
 * @param props               行DnD接続に必要な値。
 * @param props.enabled       現在のTableで行並び替え開始入力を受け付ける場合はtrue。
 * @param props.tableIdentity 行並び替え対象のTable Identity。
 * @param props.children      既存DOMへポインター開始処理を接続する描画処理。
 * @return dnd-kitの行DnD進行と表示境界へ接続された子要素。
 */
export const RowDnd = ( props: {
	enabled: boolean;
	tableIdentity: string;
	children: ( onPointerDownCapture: RowDndPointerDownHandler ) => ReactNode;
} ) => {
	const { enabled, tableIdentity, children } = props;
	const activeDraggable = useRef< Draggable | null >( null );
	const destinationLayout = useRef< RowDestinationLayout | null >( null );
	const preparedStart = useRef< {
		source: RowDndSource;
		constraints: RowReorderConstraints;
	} | null >( null );

	useEffect( () => {
		/* 行並び替えが無効になった時点で、通常編集や別モードへ開始準備と物理DnD登録を持ち越さない。 */
		if ( ! enabled ) {
			preparedStart.current = null;
			destinationLayout.current = null;
			activeDraggable.current?.destroy();
			activeDraggable.current = null;
		}
	}, [ enabled ] );

	useEffect( () => {
		return () => {
			/* TableのDnD接続終了時は、未完了の開始準備、移動先判定用配置、物理DnD登録を残さない。 */
			preparedStart.current = null;
			destinationLayout.current = null;
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

	const onDragStart = ( event?: DragStartEvent ) => {
		const preparation = preparedStart.current;

		/* 開始可否確認が成立していない物理DnD通知からは、行DnD Sessionを開始しない。 */
		if ( preparation === null ) {
			return;
		}

		preparedStart.current = null;
		destinationLayout.current = resolveDestinationLayout( event?.operation.source?.element );
		rowDndInteraction.start( preparation.source, preparation.constraints );
	};

	const onDragMove = ( event: DragMoveEvent ) => {
		/* 開始通知からDOM配置を取得できない場合は、最初の移動通知から移動先判定用配置を一度だけ補完する。 */
		const layout =
			destinationLayout.current ?? resolveDestinationLayout( event.operation.source?.element );
		destinationLayout.current = layout;

		const destinationBoundaryIndex =
			layout === null ? null : resolveDestinationBoundaryIndex( event, layout );
		rowDndInteraction.updateDestination( destinationBoundaryIndex );
	};

	const onDragEnd = ( event: DragEndEvent ) => {
		/* 物理DnD終了時は、次回入力へ持ち越してはならない開始準備、移動先判定用配置、一時登録を破棄する。 */
		preparedStart.current = null;
		destinationLayout.current = null;
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
			<RowPresentation />
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