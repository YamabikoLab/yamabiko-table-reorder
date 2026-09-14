/**
 * 列並び替えのポインター入力開始条件とDnD開始対象の接続を所有する。
 *
 * PCとタッチ端末の主ポインター入力から現在Table内のセルを移動元論理列へ解決し、
 * 第一段階のReorder Target Resolutionで開始可能な列だけをdnd-kitのDraggableへ一時登録する。
 * 結合範囲により開始できない列では物理DnDを登録せず、原因となるblocking merged cellを開始を試みた位置とともにPresentationへ通知する。
 * タッチ入力は通常スクロールと競合しない長押し条件で開始し、DnD開始後の進行、移動先解決、確定、取消はこの責務では扱わない。
 */

import { Draggable, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import type { PointerEvent, ReactNode } from 'react';

import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';

import { notifyColumnStartRejection } from './presentation/start-rejection-notice-event';
import { columnReorderTargetResolution, type ColumnReorderTarget } from './target-resolution';

/** 列DnDを既存DOMのポインター入力へ接続する開始処理。 */
export type ColumnDndPointerDownHandler = ( event: PointerEvent< Element > ) => void;

/** ポインター入力から列DnD開始候補を解決し、現在の入力で必要な列だけをDraggableへ登録する。 */
export const ColumnInput = ( props: {
	tableIdentity: string;
	activeDraggable: {
		current: Draggable | null;
	};
	children: ( onPointerDownCapture: ColumnDndPointerDownHandler ) => ReactNode;
} ) => {
	const { tableIdentity, activeDraggable, children } = props;
	const manager = useDragDropManager();

	const onPointerDownCapture: ColumnDndPointerDownHandler = ( event ) => {
		if ( ! manager ) {
			return;
		}
		if ( ! manager.dragOperation.status.idle ) {
			return;
		}

		activeDraggable.current?.destroy();
		activeDraggable.current = null;

		if ( event.pointerType !== 'mouse' && event.pointerType !== 'touch' ) {
			return;
		}
		if ( ! event.isPrimary || event.button !== 0 ) {
			return;
		}

		const target = event.target as Element | null;
		const currentTarget = event.currentTarget;
		if ( ! target || ! currentTarget ) {
			return;
		}

		const table = currentTarget.querySelector( 'table' );
		const cell = target.closest( 'th, td' ) as HTMLTableCellElement | null;
		if ( ! table || ! cell || cell.closest( 'table' ) !== table ) {
			return;
		}

		const sourceColumnIndex = resolveColumnSourceIndex( table, cell );
		if ( sourceColumnIndex === null ) {
			return;
		}

		if ( event.pointerType === 'mouse' ) {
			event.preventDefault();
		}

		const source: ColumnReorderTarget = {
			tableIdentity,
			sourceColumnIndex,
		};
		const resolution = columnReorderTargetResolution.resolve( source );

		if ( resolution.status !== 'resolved' ) {
			if ( resolution.status === 'rejected' ) {
				notifyColumnStartRejection( {
					blockingMergedCell: resolution.blockingMergedCell,
					clientX: event.clientX,
					clientY: event.clientY,
				} );
			}
			return;
		}

		activeDraggable.current = new Draggable(
			{
				id: `ytr-column:${ tableIdentity }:${ sourceColumnIndex }`,
				element: cell,
				data: resolution.target,
				sensors: [
					PointerSensor.configure( {
						activationConstraints: ( activationEvent ) => {
							if ( activationEvent.pointerType === 'mouse' ) {
								return [
									new PointerActivationConstraints.Distance( {
										value: 5,
									} ),
								];
							}

							return [
								new PointerActivationConstraints.Delay( {
									value: 250,
									tolerance: 5,
								} ),
							];
						},
						preventActivation: () => false,
					} ),
				],
			},
			manager
		);
	};

	return children( onPointerDownCapture );
};
