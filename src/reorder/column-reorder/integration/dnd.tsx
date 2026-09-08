/**
 * 列並び替えにおけるdnd-kitとの物理DnD接続を所有する。
 *
 * Column Input Interactionを配下へ接続し、active DnD成立直前の第二段階Target Resolution、
 * DnD開始、移動先解決、complete / cancel変換をColumn DnD Interactionへ接続する。
 * Reorder PresentationはColumn Reorder有効中の現在操作対象Tableだけを同じDnD Engine境界へ接続し、表示Lifecycleと表示状態を自身で所有する。
 * 列DnDのAuto Scrollは横方向だけを許可し、Tableの縦位置を利用者の操作なく変更しない。
 * 列並び替えの無効化または境界終了時には、次の操作へ持ち越せない解決結果と物理DnD登録を破棄する。
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

import { columnDndInteraction } from '@/reorder/column-reorder/responsibilities/dnd-interaction';
import {
	createColumnDestinationResolver,
	type ColumnDestinationResolver,
} from '@/reorder/column-reorder/integration/destination-resolution';
import {
	ColumnInput,
	type ColumnDndPointerDownHandler,
} from '@/reorder/column-reorder/responsibilities/input';
import { ColumnPresentation } from '@/reorder/column-reorder/responsibilities/presentation/column-presentation';
import {
	columnReorderTargetResolution,
	type ColumnReorderTarget,
	type ColumnReorderTargetResolution,
} from '@/reorder/column-reorder/responsibilities/target-resolution';

/** 列DnDを既存DOMのポインター入力へ接続する開始処理型を、DnD接続境界から公開する。 */
export type { ColumnDndPointerDownHandler } from '@/reorder/column-reorder/responsibilities/input';

/**
 * 対象Tableへdnd-kitの物理DnD進行を接続する。
 *
 * 第一段階の開始候補登録はColumn Input Interactionへ委ね、active DnD成立直前に同じTargetを現在制約で再解決する。
 * 第二段階が成立した場合だけColumn DnD Sessionを開始し、moveではDestination Resolutionが返す論理列間境界だけを渡す。
 * Reorder PresentationはColumn Reorder有効中の現在操作対象Tableだけに接続し、通常編集時のレイアウト変更へDnD表示監視を残さない。
 * Auto ScrollはDnD Engineのactive drag lifecycleへ委ね、横方向だけを有効にする。
 * complete / cancel / 開始不成立 / 無効化 / unmountでは次の操作へ持ち越せない一時状態を破棄する。
 *
 * @param props                     列DnD接続に必要な値。
 * @param props.enabled             現在のTableで列並び替え開始入力を受け付ける場合はtrue。
 * @param props.presentationEnabled 現在の操作対象としてReorder Presentationを接続する場合はtrue。
 * @param props.tableIdentity       列並び替え対象のTable Identity。
 * @param props.children            既存DOMへポインター開始処理を接続する描画処理。
 * @return dnd-kitの列DnD進行と必要な表示境界へ接続された子要素。
 */
export const ColumnDnd = ( props: {
	enabled: boolean;
	presentationEnabled?: boolean;
	tableIdentity: string;
	children: ( onPointerDownCapture: ColumnDndPointerDownHandler ) => ReactNode;
} ) => {
	const { enabled, presentationEnabled = false, tableIdentity, children } = props;
	const activeDraggable = useRef< Draggable | null >( null );
	const destinationResolver = useRef< ColumnDestinationResolver | null >( null );
	const resolvedStart = useRef< Extract<
		ColumnReorderTargetResolution,
		{ status: 'resolved' }
	> | null >( null );
	const presentationActive = enabled && presentationEnabled;

	/** 次の開始入力や通常編集へ持ち越せないDnD接続境界の一時状態をまとめて破棄する。 */
	const clearTransientDndState = useCallback( (): void => {
		resolvedStart.current = null;
		destinationResolver.current = null;
		activeDraggable.current?.destroy();
		activeDraggable.current = null;
	}, [] );

	useEffect( () => {
		/* 列並び替えが無効になった時点で、通常編集や別モードへ一時状態を持ち越さない。 */
		if ( ! enabled ) {
			clearTransientDndState();
		}
	}, [ enabled, clearTransientDndState ] );

	useEffect( () => {
		/* TableのDnD接続終了時は、未使用の解決結果、移動先解決境界、物理DnD登録を残さない。 */
		return clearTransientDndState;
	}, [ clearTransientDndState ] );

	const onBeforeDragStart = ( event: BeforeDragStartEvent ) => {
		const target = event?.operation?.source?.data as ColumnReorderTarget;
		const resolution = columnReorderTargetResolution.resolve( target );

		/* 第一段階後のTable状態変化で開始対象が成立しなくなった場合は、Column DnD Sessionを開始しない。 */
		if ( resolution.status !== 'resolved' ) {
			event.preventDefault();
			clearTransientDndState();
			return;
		}

		resolvedStart.current = resolution;
	};

	const onDragStart = ( event?: DragStartEvent ) => {
		const resolution = resolvedStart.current;

		/* 第二段階の開始対象解決が成立していない物理DnD通知からは、Column DnD Sessionを開始しない。 */
		if ( resolution === null ) {
			return;
		}

		resolvedStart.current = null;
		destinationResolver.current = createColumnDestinationResolver(
			event?.operation.source?.element
		);
		columnDndInteraction.start( resolution.target, resolution.initialConstraints );
	};

	const onDragMove = ( event: DragMoveEvent ) => {
		/* 開始通知から移動先解決境界を生成できない場合は、最初の移動通知から一度だけ補完する。 */
		const resolver =
			destinationResolver.current ??
			createColumnDestinationResolver( event.operation.source?.element );
		destinationResolver.current = resolver;

		const destinationBoundaryIndex = resolver?.resolve( event ) ?? null;
		columnDndInteraction.updateDestination( destinationBoundaryIndex );
	};

	const onDragEnd = ( event: DragEndEvent ) => {
		/* 物理DnD終了時は、次回入力へ持ち越してはならない一時状態を破棄する。 */
		clearTransientDndState();

		/* 物理DnDが取消で終了した場合は、列並び替えを確定せずSessionを取消する。 */
		if ( event.canceled ) {
			columnDndInteraction.cancel();
			return;
		}

		columnDndInteraction.complete();
	};

	return (
		<DragDropProvider
			plugins={ ( defaults ) => [
				/* 列DnDは入力境界と独自Presentationで必要な操作・表示状態を管理し、Auto Scrollは横方向だけを許可する。 */
				...defaults.filter(
					( plugin ) =>
						plugin !== Cursor &&
						plugin !== PreventSelection &&
						plugin !== Feedback &&
						plugin !== AutoScroller
				),
				AutoScroller.configure( {
					threshold: { x: 0.2, y: 0 },
				} ),
			] }
			onBeforeDragStart={ onBeforeDragStart }
			onDragStart={ onDragStart }
			onDragMove={ onDragMove }
			onDragEnd={ onDragEnd }
		>
			{ presentationActive && <ColumnPresentation /> }
			<ColumnInput
				enabled={ enabled }
				tableIdentity={ tableIdentity }
				activeDraggable={ activeDraggable }
			>
				{ children }
			</ColumnInput>
		</DragDropProvider>
	);
};
