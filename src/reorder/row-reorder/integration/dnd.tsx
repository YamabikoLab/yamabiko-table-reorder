/**
 * 行並び替えにおけるdnd-kitとの物理DnD接続を所有する。
 *
 * 行DnD境界はTableの描画中に安定して存在し、行並び替えが有効な期間だけ開始入力を受け付ける。
 * PCとタッチ端末の開始条件判定は入力境界へ委ね、dnd-kitが通知する物理DnDの進行を、
 * Reorder Target Resolution、移動先解決境界、DnD Interactionへ接続する。
 * Reorder Presentationは現在操作中のTableだけを同じDnD Engine境界へ接続し、表示Lifecycleと表示状態を自身で所有する。
 * 行DnDのAuto Scrollは縦方向だけを許可し、Tableの横位置を利用者の操作なく変更しない。
 * 行並び替えの無効化または境界の終了時には、次の通常編集や別モードへ持ち越せない解決結果と物理DnD登録を破棄する。
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

import { resolveReorderApplyRuntime } from '@/reorder/reorder-apply-performance';
import { rowDndInteraction } from '@/reorder/row-reorder/responsibilities/dnd-interaction';
import {
	createRowDestinationResolver,
	type RowDestinationResolver,
} from '@/reorder/row-reorder/integration/destination-resolution';
import {
	RowInput,
	type RowDndPointerDownHandler,
} from '@/reorder/row-reorder/responsibilities/input';
import { RowPresentation } from '@/reorder/row-reorder/responsibilities/presentation/row-presentation';
import {
	rowReorderTargetResolution,
	type RowReorderTarget,
	type RowReorderTargetResolution,
} from '@/reorder/row-reorder/responsibilities/target-resolution';

/** 行DnDを既存DOMのポインター入力へ接続する開始処理型を、DnD接続境界から公開する。 */
export type { RowDndPointerDownHandler } from '@/reorder/row-reorder/responsibilities/input';

/**
 * 対象Tableへdnd-kitの物理DnD進行を接続する。
 *
 * 接続自体はTableの描画中に安定して維持し、行並び替えが有効な期間だけ入力境界から開始対象を登録する。
 * 物理DnD成立前にReorder Target Resolutionで開始対象を再確認し、成立後は解決済みのTargetと開始時制約だけをDnD Interactionへ渡す。
 * Reorder Presentationは現在操作中のTableだけに接続し、複数Tableが存在しても共有通知や共有状態へ複数のPresentationが反応しない状態を維持する。
 * Auto Scrollは縦方向だけを有効にし、行DnDによって横方向のスクロール位置を変更しない。
 * 行並び替えが無効になった場合と接続自体が終了する場合は、未使用の解決結果とDraggable登録を破棄する。
 *
 * @param props                     行DnD接続に必要な値。
 * @param props.enabled             現在のTableで行並び替え開始入力を受け付ける場合はtrue。
 * @param props.presentationEnabled 現在の操作対象としてReorder Presentationを接続する場合はtrue。
 * @param props.tableIdentity       行並び替え対象のTable Identity。
 * @param props.children            既存DOMへポインター開始処理を接続する描画処理。
 * @return dnd-kitの行DnD進行と必要な表示境界へ接続された子要素。
 */
export const RowDnd = ( props: {
	enabled: boolean;
	presentationEnabled?: boolean;
	tableIdentity: string;
	children: ( onPointerDownCapture: RowDndPointerDownHandler ) => ReactNode;
} ) => {
	const { enabled, presentationEnabled = true, tableIdentity, children } = props;
	const activeDraggable = useRef< Draggable | null >( null );
	const destinationResolver = useRef< RowDestinationResolver | null >( null );
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

	useEffect( () => {
		/* 行並び替えが無効になった時点で、通常編集や別モードへ一時状態を持ち越さない。 */
		if ( ! enabled ) {
			clearTransientDndState();
		}
	}, [ enabled, clearTransientDndState ] );

	useEffect( () => {
		/* TableのDnD接続終了時は、未使用の解決結果、移動先解決境界、物理DnD登録を残さない。 */
		return clearTransientDndState;
	}, [ clearTransientDndState ] );

	const onBeforeDragStart = ( event: BeforeDragStartEvent ) => {
		const target = event?.operation?.source?.data as RowReorderTarget;
		const resolution = rowReorderTargetResolution.resolve( target );

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
		/* 物理DnD終了時は、次回入力へ持ち越してはならない一時状態を破棄する。 */
		clearTransientDndState();

		/* 物理DnDが取消で終了した場合は、行並び替えを確定せずSessionを取消する。 */
		if ( event.canceled ) {
			rowDndInteraction.cancel();
			return;
		}

		const runtime = resolveReorderApplyRuntime( event.operation?.source?.element );
		rowDndInteraction.complete( runtime );
	};

	return (
		<DragDropProvider
			plugins={ ( defaults ) => [
				/* 行DnDは入力境界と独自Presentationで必要な操作・表示状態を管理し、Auto Scrollは縦方向だけを許可する。 */
				...defaults.filter(
					( plugin ) =>
						plugin !== Cursor &&
						plugin !== PreventSelection &&
						plugin !== Feedback &&
						plugin !== AutoScroller
				),
				AutoScroller.configure( {
					threshold: { x: 0, y: 0.2 },
				} ),
			] }
			onBeforeDragStart={ onBeforeDragStart }
			onDragStart={ onDragStart }
			onDragMove={ onDragMove }
			onDragEnd={ onDragEnd }
		>
			{ presentationEnabled && <RowPresentation /> }
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
