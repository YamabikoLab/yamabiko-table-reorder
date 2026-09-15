/**
 * 列並び替えにおけるdnd-kitとの物理DnD接続を所有する。
 *
 * Column Input Interactionを配下へ接続し、active DnD成立直前の第二段階Target Resolution、
 * Column DnD Layout Availability、DnD開始、移動先解決、complete / cancel変換をColumn DnD Interactionへ接続する。
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
import { useCallback, useEffect, useMemo, useRef } from '@wordpress/element';
import type { ReactNode } from 'react';

import {
	createColumnDestinationResolver,
	type ColumnDestinationResolver,
} from '@/reorder/column-reorder/integration/destination-resolution';
import {
	createColumnHorizontalAutoScroll,
	type ColumnPointerPosition,
} from '@/reorder/column-reorder/integration/horizontal-auto-scroll';
import { columnDndInteraction } from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import { resolveColumnDndLayoutAvailability } from '@/reorder/column-reorder/responsibilities/layout-availability';
import {
	ColumnInput,
	type ColumnDndPointerDownHandler,
} from '@/reorder/column-reorder/responsibilities/input';
import { ColumnPresentation } from '@/reorder/column-reorder/responsibilities/presentation/column-presentation';
import type {
	ColumnStartRejectionNoticeHandle,
	ColumnStartRejectionNoticeRequest,
} from '@/reorder/column-reorder/responsibilities/presentation/start-rejection-notice';
import {
	resolveColumnReorderTarget,
	type ColumnReorderTarget,
	type ColumnReorderTargetResolution,
} from '@/reorder/column-reorder/responsibilities/target-resolution';
import { columnReorderMode } from '@/reorder/reorder-mode';
import { subscribeReorderMode } from '@/reorder/reorder-mode-subscription';

/** 列DnDを既存DOMのポインター入力へ接続する開始処理型を、DnD接続境界から公開する。 */
export type { ColumnDndPointerDownHandler } from '@/reorder/column-reorder/responsibilities/input';

/** 一回の物理DnD試行が、対応する列DnD Sessionを開始できたかを表す接続状態。 */
type ColumnPhysicalDragAttempt = {
	phase: 'awaiting-session-start' | 'session-started';
};

/**
 * DnD移動通知からeditor document基準のnative pointer位置を取得する。
 *
 * @param event 現在の物理DnD位置を示す移動イベント。
 * @return native pointer位置。pointer座標を取得できない入力ではnull。
 */
const resolveNativePointerPosition = ( event: DragMoveEvent ): ColumnPointerPosition | null => {
	const nativeEvent = event.nativeEvent;

	if ( ! nativeEvent || ! ( 'clientX' in nativeEvent ) || ! ( 'clientY' in nativeEvent ) ) {
		return null;
	}

	return {
		clientX: Number( nativeEvent.clientX ),
		clientY: Number( nativeEvent.clientY ),
	};
};

/**
 * 対象Tableへdnd-kitの物理DnD進行を接続する。
 *
 * Reorder Modeの有効判定は方向固有APIから入力時に直接参照し、mode変更をReact props更新として要求しない。
 * mode離脱時は非React購読から解決結果、Auto Scroll、物理DnD登録を即時破棄する。
 *
 * @param props                     列DnD接続に必要な値。
 * @param props.presentationEnabled 現在の操作対象としてReorder Presentationを接続する場合はtrue。
 * @param props.tableIdentity       列並び替え対象のTable Identity。
 * @param props.children            既存DOMへポインター開始処理を接続する描画処理。
 * @return dnd-kitの列DnD進行と必要な表示境界へ接続された子要素。
 */
export const ColumnDnd = ( props: {
	presentationEnabled?: boolean;
	tableIdentity: string;
	children: ( onPointerDownCapture: ColumnDndPointerDownHandler ) => ReactNode;
} ) => {
	const { presentationEnabled = false, tableIdentity, children } = props;
	const activeDraggable = useRef< Draggable | null >( null );
	const destinationResolver = useRef< ColumnDestinationResolver | null >( null );
	const startRejectionNotice = useRef< ColumnStartRejectionNoticeHandle | null >( null );
	const latestDragMoveEvent = useRef< DragMoveEvent | null >( null );
	const physicalDragAttempt = useRef< ColumnPhysicalDragAttempt | null >( null );
	const resolvedStart = useRef< Extract<
		ColumnReorderTargetResolution,
		{ status: 'resolved' }
	> | null >( null );
	const horizontalAutoScroll = useMemo(
		() =>
			createColumnHorizontalAutoScroll( () => {
				const resolver = destinationResolver.current;
				const moveEvent = latestDragMoveEvent.current;

				if ( resolver === null || moveEvent === null ) {
					return;
				}

				const destinationBoundaryIndex = resolver.resolve( moveEvent );
				columnDndInteraction.updateDestination( destinationBoundaryIndex );
			} ),
		[]
	);

	/** 次の開始入力や通常編集へ持ち越せないDnD接続境界の一時状態をまとめて破棄する。 */
	const clearTransientDndState = useCallback( (): void => {
		resolvedStart.current = null;
		destinationResolver.current = null;
		latestDragMoveEvent.current = null;
		horizontalAutoScroll.stop();
		activeDraggable.current?.destroy();
		activeDraggable.current = null;
	}, [ horizontalAutoScroll ] );

	/** 開始拒否表示の更新をTable subtreeへ伝播させず、所有するNoticeへ直接渡す。 */
	const onStartRejection = useCallback( ( request: ColumnStartRejectionNoticeRequest ): void => {
		startRejectionNotice.current?.show( request );
	}, [] );

	useEffect( () => {
		const unsubscribe = subscribeReorderMode( tableIdentity, () => {
			/* Column Reorder Modeから離脱した時点で、React renderを待たず一時状態を破棄する。 */
			if ( ! columnReorderMode.isActive( tableIdentity ) ) {
				clearTransientDndState();
			}
		} );

		return unsubscribe;
	}, [ tableIdentity, clearTransientDndState ] );

	useEffect( () => {
		return clearTransientDndState;
	}, [ clearTransientDndState ] );

	const onBeforeDragStart = ( event: BeforeDragStartEvent ) => {
		physicalDragAttempt.current = { phase: 'awaiting-session-start' };
		const target = event?.operation?.source?.data as ColumnReorderTarget;
		const resolution = resolveColumnReorderTarget( target );

		if ( resolution.status !== 'resolved' ) {
			event.preventDefault();
			physicalDragAttempt.current = null;
			clearTransientDndState();
			return;
		}

		const sourceElement = event?.operation?.source?.element;
		const sourceTable =
			( sourceElement?.closest( 'table' ) as HTMLTableElement | null | undefined ) ?? null;
		const layoutAvailability = resolveColumnDndLayoutAvailability( sourceTable );

		/* Toolbar用snapshotには依存せず、active DnD成立直前の現在DOMで物理列配置が成立しない試行を拒否する。 */
		if ( layoutAvailability === 'unavailable' ) {
			event.preventDefault();
			physicalDragAttempt.current = null;
			clearTransientDndState();
			return;
		}

		resolvedStart.current = resolution;
	};

	const onDragStart = ( event?: DragStartEvent ) => {
		const resolution = resolvedStart.current;

		if ( resolution === null ) {
			return;
		}

		const sourceElement = event?.operation.source?.element;
		resolvedStart.current = null;
		destinationResolver.current = createColumnDestinationResolver( sourceElement );
		horizontalAutoScroll.start( sourceElement );
		columnDndInteraction.start( resolution.target, resolution.initialConstraints );
		physicalDragAttempt.current = { phase: 'session-started' };
	};

	const onDragMove = ( event: DragMoveEvent ) => {
		latestDragMoveEvent.current = event;
		const pointerPosition = resolveNativePointerPosition( event );

		if ( pointerPosition !== null ) {
			horizontalAutoScroll.updatePointer( pointerPosition );
		}

		const resolver =
			destinationResolver.current ??
			createColumnDestinationResolver( event.operation.source?.element );
		destinationResolver.current = resolver;

		const destinationBoundaryIndex = resolver?.resolve( event ) ?? null;
		columnDndInteraction.updateDestination( destinationBoundaryIndex );
	};

	const onDragEnd = ( event: DragEndEvent ) => {
		const sessionStarted = physicalDragAttempt.current?.phase === 'session-started';
		physicalDragAttempt.current = null;
		clearTransientDndState();

		/* Session開始前に終わった物理DnD試行は、意味的な終了処理へ接続しない。 */
		if ( ! sessionStarted ) {
			return;
		}

		if ( event.canceled ) {
			columnDndInteraction.cancel();
			return;
		}

		columnDndInteraction.complete();
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
			] }
			onBeforeDragStart={ onBeforeDragStart }
			onDragStart={ onDragStart }
			onDragMove={ onDragMove }
			onDragEnd={ onDragEnd }
		>
			{ presentationEnabled && (
				<ColumnPresentation startRejectionNoticeRef={ startRejectionNotice } />
			) }
			<ColumnInput
				tableIdentity={ tableIdentity }
				activeDraggable={ activeDraggable }
				onStartRejection={ onStartRejection }
			>
				{ ( onPointerDownCapture ) =>
					children( ( event ) => {
						/* 現在modeが列でない入力は、安定した接続を維持したままColumn Inputへ渡さない。 */
						if ( columnReorderMode.isActive( tableIdentity ) ) {
							onPointerDownCapture( event );
						}
					} )
				}
			</ColumnInput>
		</DragDropProvider>
	);
};
