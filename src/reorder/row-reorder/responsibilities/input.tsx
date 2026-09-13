/**
 * 行並び替えのポインター入力開始条件とDnD開始対象の接続を所有する。
 *
 * PCとタッチ端末の主ポインター入力から現在Tableのtbody直下行を開始候補として解決し、
 * Reorder Target Resolutionで開始可能な行だけをdnd-kitのDraggableへ必要時に登録する。
 * Reorder Modeは入力時に参照し、React renderを経由せず現在Tableで有効な方向だけを受け付ける。
 */

import { Draggable, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import type { PointerEvent, ReactNode } from 'react';

import { rowReorderMode } from '@/reorder/reorder-mode';

import { notifyRowStartRejection } from './presentation/start-rejection-notice-event';
import { rowReorderTargetResolution, type RowReorderTarget } from './target-resolution';

/**
 * 行DnDが既存DOMのポインター入力へ接続する開始処理。
 *
 * @param event 行DnD開始候補を判定する現在のポインター入力。
 */
export type RowDndPointerDownHandler = ( event: PointerEvent< Element > ) => void;

/**
 * ポインター入力から行DnD開始候補を解決し、現在の入力で必要な行だけをDraggableへ登録する。
 *
 * PCとタッチ端末の主ポインター入力を共通のPointerSensor経路へ接続し、
 * Reorder Target Resolutionで開始可能と解決された行だけをDnD境界へ接続する。
 * 開始可否は入力時点のReorder Modeを正本として判断し、mode変更をReact propsとして要求しない。
 *
 * @param props                         ポインター入力接続に必要な値。
 * @param props.enabled                 接続境界自体が開始入力を受け付けられる場合はtrue。
 * @param props.tableIdentity           行並び替え対象のTable Identity。
 * @param props.activeDraggable         現在のポインター入力で登録したDraggableを保持する参照。
 * @param props.activeDraggable.current 現在のポインター入力で登録したDraggable。未登録の場合はnull。
 * @param props.children                既存DOMへポインター開始処理を接続する描画処理。
 * @return ポインター入力による行DnD開始へ接続された子要素。
 */
export const RowInput = ( props: {
	enabled: boolean;
	tableIdentity: string;
	activeDraggable: {
		current: Draggable | null;
	};
	children: ( onPointerDownCapture: RowDndPointerDownHandler ) => ReactNode;
} ) => {
	const { enabled, tableIdentity, activeDraggable, children } = props;
	const manager = useDragDropManager();

	const onPointerDownCapture: RowDndPointerDownHandler = ( event ) => {
		/* 接続境界が無効、現在Tableの行並び替えモード外、または物理DnD接続を利用できない場合は開始候補を受け付けない。 */
		if ( ! enabled || ! rowReorderMode.isActive( tableIdentity ) || ! manager ) {
			return;
		}

		/* 主ポインターによる新しい開始入力だけを受け入れ、追加入力や副ボタン入力は対象外とする。 */
		if ( ! event.isPrimary || event.button !== 0 || ! manager.dragOperation.status.idle ) {
			return;
		}

		const target = event.target as Element | null;
		const currentTarget = event.currentTarget;

		/* 開始位置または対象Tableの基準要素を確認できない入力は、開始候補として扱わない。 */
		if ( ! target || ! currentTarget ) {
			return;
		}

		const table = currentTarget.querySelector( 'table' );
		const tableBody = table?.tBodies.item( 0 ) ?? null;
		const row = target.closest( 'tr' ) as HTMLTableRowElement | null;

		/* 現在Tableのtbody直下行だけを開始対象とし、入れ子Tableの行は対象にしない。 */
		if ( ! tableBody || ! row || row.parentElement !== tableBody ) {
			return;
		}

		/* マウスDnD開始時は既定の文字選択を抑止し、DnDと無関係なブラウザー処理を増やさない。 */
		if ( event.pointerType === 'mouse' ) {
			event.preventDefault();
		}

		/* 開始候補は現在のポインター入力だけに対応させ、前回入力の一時登録を残さない。 */
		activeDraggable.current?.destroy();
		activeDraggable.current = null;

		const source: RowReorderTarget = {
			tableIdentity,
			sourceRowIndex: row.sectionRowIndex,
		};
		const resolution = rowReorderTargetResolution.resolve( source );

		/* 現在のTable制約で開始対象が成立しない行は、物理DnDへ登録しない。 */
		if ( resolution.status !== 'resolved' ) {
			if ( resolution.status === 'rejected' ) {
				notifyRowStartRejection( {
					reason: resolution.reason,
					clientX: event.clientX,
					clientY: event.clientY,
				} );
			}
			return;
		}

		activeDraggable.current = new Draggable(
			{
				id: `ytr-row:${ tableIdentity }:${ row.sectionRowIndex }`,
				element: row,
				data: resolution.target,
				sensors: [
					PointerSensor.configure( {
						activationConstraints: ( activationEvent ) => {
							/* マウスは短い移動距離で開始し、タッチは通常操作との競合を避けるため長押しで開始する。 */
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
