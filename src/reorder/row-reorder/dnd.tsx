/**
 * 行並び替えにおけるdnd-kitとの物理DnD接続を所有する。
 *
 * 行DnD境界はTableの描画中に安定して存在し、行並び替えが有効な期間だけ開始入力を受け付ける。
 * PCとタッチ端末の開始条件判定は入力境界へ委ね、dnd-kitが通知する物理DnDの進行を、
 * 移動先解決境界とDnD Interactionが扱う開始、移動先更新、確定、取消へ接続する。
 * Reorder Presentationは同じDnD Engine境界の配下へ独立して接続し、表示Lifecycleと表示状態を自身で所有する。
 * 行並び替えの無効化または境界の終了時には、次の通常編集や別モードへ持ち越せない開始準備と物理DnD登録を破棄する。
 */

import {
	Cursor,
	PreventSelection,
	Feedback,
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
import {
	createRowDestinationResolver,
	type RowDestinationResolver,
} from './destination-resolution';
import { RowInput, type RowDndPointerDownHandler } from './input';
import { RowPresentation } from './presentation/row-presentation';
import type { RowReorderConstraints } from './table-integration';

export type { RowDndPointerDownHandler } from './input';

/**
 * 対象Tableへdnd-kitの物理DnD進行を接続する。
 *
 * 接続自体はTableの描画中に安定して維持し、行並び替えが有効な期間だけ入力境界から開始対象を登録する。
 * DnD開始後は移動先解決境界を介して対象Table内の移動先境界を解決し、確定または取消までDnD Interactionへ接続する。
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
	const destinationResolver = useRef< RowDestinationResolver | null >( null );
	const preparedStart = useRef< {
		source: RowDndSource;
		constraints: RowReorderConstraints;
	} | null >( null );

	useEffect( () => {
		/* 行並び替えが無効になった時点で、通常編集や別モードへ開始準備と物理DnD登録を持ち越さない。 */
		if ( ! enabled ) {
			preparedStart.current = null;
			destinationResolver.current = null;
			activeDraggable.current?.destroy();
			activeDraggable.current = null;
		}
	}, [ enabled ] );

	useEffect( () => {
		return () => {
			/* TableのDnD接続終了時は、未完了の開始準備、移動先解決境界、物理DnD登録を残さない。 */
			preparedStart.current = null;
			destinationResolver.current = null;
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
		destinationResolver.current = createRowDestinationResolver(
			event?.operation.source?.element
		);
		rowDndInteraction.start( preparation.source, preparation.constraints );
	};

	const onDragMove = ( event: DragMoveEvent ) => {
		/* 開始通知から移動先解決境界を生成できない場合は、最初の移動通知から一度だけ補完する。 */
		const resolver =
			destinationResolver.current ??
			createRowDestinationResolver( event.operation.source?.element );
		destinationResolver.current = resolver;

		const destinationBoundaryIndex = resolver?.resolve( event ) ?? null;
		rowDndInteraction.updateDestination( destinationBoundaryIndex );
	};

	const onDragEnd = ( event: DragEndEvent ) => {
		/* 物理DnD終了時は、次回入力へ持ち越してはならない開始準備、移動先解決境界、一時登録を破棄する。 */
		preparedStart.current = null;
		destinationResolver.current = null;
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
			plugins={ ( defaults ) =>
				defaults.filter(
					( plugin ) => plugin !== Cursor && plugin !== PreventSelection && plugin !== Feedback
				)
			}
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
