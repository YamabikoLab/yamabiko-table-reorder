/**
 * 行並び替えにおけるdnd-kitとの物理DnD接続を所有する。
 *
 * 行DnD境界はTableの描画中に安定して存在し、行並び替えが有効な期間だけ開始入力を受け付ける。
 * PCとタッチ端末の開始条件判定は入力境界へ委ね、dnd-kitが通知する物理DnDの進行を、
 * Reorder Target Resolution、移動先解決境界、DnD Interactionへ接続する。
 * Reorder Mode離脱は非React購読で受け取り、React renderを要求せず一時DnD状態を破棄する。
 */

import {
	AutoScroller,
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
import { useCallback, useEffect, useRef } from '@wordpress/element';
import type { ReactNode } from 'react';

import { rowReorderMode } from '@/reorder/reorder-mode';
import { subscribeReorderMode } from '@/reorder/reorder-mode-subscription';
import { ROW_AUTO_SCROLL_EDGE_THRESHOLD_RATIO } from '@/reorder/reorder-tuning';
import {
	createRowDestinationResolver,
	type RowDestinationResolver,
} from '@/reorder/row-reorder/integration/destination-resolution';
import { rowDndInteraction } from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import {
	RowInput,
	type RowDndPointerDownHandler,
} from '@/reorder/row-reorder/responsibilities/input';
import { RowPresentation } from '@/reorder/row-reorder/responsibilities/presentation/row-presentation';
import type {
	RowStartRejectionNoticeHandle,
	RowStartRejectionNoticeRequest,
} from '@/reorder/row-reorder/responsibilities/presentation/start-rejection-notice';
import {
	resolveRowReorderTarget,
	type RowReorderTarget,
	type RowReorderTargetResolution,
} from '@/reorder/row-reorder/responsibilities/target-resolution';

/** 行DnDを既存DOMのポインター入力へ接続する開始処理型を、DnD接続境界から公開する。 */
export type { RowDndPointerDownHandler } from '@/reorder/row-reorder/responsibilities/input';

/**
 * 対象Tableへdnd-kitの物理DnD進行を接続する。
 *
 * 接続自体はTableの描画中に安定して維持し、行並び替えが有効な期間だけ入力境界へ開始入力を渡す。
 * Reorder Modeの有効判定は方向固有APIから入力時に直接参照し、mode変更をReact props更新として要求しない。
 * mode離脱時は非React購読から未使用の解決結果、移動先解決境界、物理DnD登録を即時破棄する。
 *
 * @param props                     行DnD接続に必要な値。
 * @param props.presentationEnabled 現在の操作対象としてReorder Presentationを接続する場合はtrue。
 * @param props.tableIdentity       行並び替え対象のTable Identity。
 * @param props.children            既存DOMへポインター開始処理を接続する描画処理。
 * @return dnd-kitの行DnD進行と必要な表示境界へ接続された子要素。
 */
export const RowDnd = ( props: {
	presentationEnabled?: boolean;
	tableIdentity: string;
	children: ( onPointerDownCapture: RowDndPointerDownHandler ) => ReactNode;
} ) => {
	const { presentationEnabled = true, tableIdentity, children } = props;
	const activeDraggable = useRef< Draggable | null >( null );
	const destinationResolver = useRef< RowDestinationResolver | null >( null );
	const startRejectionNotice = useRef< RowStartRejectionNoticeHandle | null >( null );
	const resolvedStart = useRef< Extract<
		RowReorderTargetResolution,
		{ status: 'resolved' }
	> | null >( null );

	/** 次の開始入力や通常編集へ持ち越せないDnD接続境界の一時状態をまとめて破棄する。 */
	const clearTransientDndState = useCallback( (): void => {
		resolvedStart.current = null;
		destinationResolver.current = null;
		activeDraggable.current?.destroy();
		activeDraggable.current = null;
	}, [] );

	/** 開始拒否表示の更新をTable subtreeへ伝播させず、所有するNoticeへ直接渡す。 */
	const onStartRejection = useCallback( ( request: RowStartRejectionNoticeRequest ): void => {
		startRejectionNotice.current?.show( request );
	}, [] );

	useEffect( () => {
		const unsubscribe = subscribeReorderMode( tableIdentity, () => {
			/* 行Reorder Modeから離脱した時点で、React renderを待たず開始候補とResolverを破棄する。 */
			if ( ! rowReorderMode.isActive( tableIdentity ) ) {
				clearTransientDndState();
			}
		} );

		return unsubscribe;
	}, [ tableIdentity, clearTransientDndState ] );

	useEffect( () => {
		/* TableのDnD接続終了時は、未使用の解決結果、移動先解決境界、物理DnD登録を残さない。 */
		return clearTransientDndState;
	}, [ clearTransientDndState ] );

	const onBeforeDragStart = ( event: BeforeDragStartEvent ) => {
		const target = event?.operation?.source?.data as RowReorderTarget;
		const resolution = resolveRowReorderTarget( target );

		/* 開始入力後のTable状態変化で開始対象が成立しなくなった場合は、利用者向け通知を重複させず物理DnDだけを開始しない。 */
		if ( resolution.status !== 'resolved' ) {
			event.preventDefault();
			clearTransientDndState();
			return;
		}

		resolvedStart.current = resolution;
	};

	const onDragStart = ( event?: DragStartEvent ) => {
		const resolution = resolvedStart.current;

		/* 開始対象の解決が成立していない物理DnD通知からは、行DnD Sessionを開始しない。 */
		if ( resolution === null ) {
			return;
		}

		resolvedStart.current = null;
		destinationResolver.current = createRowDestinationResolver( event?.operation.source?.element );
		rowDndInteraction.start( resolution.target, resolution.initialConstraints );
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
		clearTransientDndState();

		if ( event.canceled ) {
			rowDndInteraction.cancel();
			return;
		}

		rowDndInteraction.complete();
	};

	return (
		<DragDropProvider
			plugins={ ( defaults ) => [
				...defaults.filter(
					( plugin ) =>
						plugin !== Cursor &&
						plugin !== PreventSelection &&
						plugin !== Feedback &&
						plugin !== AutoScroller
				),
				AutoScroller.configure( {
					threshold: { x: 0, y: ROW_AUTO_SCROLL_EDGE_THRESHOLD_RATIO },
				} ),
			] }
			onBeforeDragStart={ onBeforeDragStart }
			onDragStart={ onDragStart }
			onDragMove={ onDragMove }
			onDragEnd={ onDragEnd }
		>
			{ presentationEnabled && (
				<RowPresentation startRejectionNoticeRef={ startRejectionNotice } />
			) }
			<RowInput
				tableIdentity={ tableIdentity }
				activeDraggable={ activeDraggable }
				onStartRejection={ onStartRejection }
			>
				{ ( onPointerDownCapture ) =>
					children( ( event ) => {
						/* 現在modeが行でない入力は、安定した接続を維持したままRow Inputへ渡さない。 */
						if ( rowReorderMode.isActive( tableIdentity ) ) {
							onPointerDownCapture( event );
						}
					} )
				}
			</RowInput>
		</DragDropProvider>
	);
};
