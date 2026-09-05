/**
 * 行並び替えのポインター入力開始条件とDnD開始対象の接続を所有する。
 *
 * PCとタッチ端末の主ポインター入力から現在Tableのtbody直下行を開始候補として解決し、
 * 行並び替えが有効な間だけ、その行をdnd-kitのDraggableへ必要時に登録する。
 * DnD開始後の進行、移動先候補、確定、取消はDnD境界へ委ねる。
 */

import { Draggable, Feedback, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import type { PointerEvent, ReactNode } from 'react';

import type { RowDndSource } from './dnd-interaction';

/**
 * 行DnDが既存DOMのポインター入力へ接続する開始処理。
 *
 * @param event 行DnD開始候補を判定する現在のポインター入力。
 */
export type RowDndPointerDownHandler = ( event: PointerEvent< Element > ) => void;

/**
 * ポインター入力から行DnD開始候補を解決し、現在の入力で必要な行だけをDraggableへ登録する。
 *
 * PCとタッチ端末の主ポインター入力を共通のPointerSensor経路へ接続し、行並び替えが有効な入力で成立した開始候補だけをDnD境界へ接続する。
 * 入力ごとに登録したDraggableは次の開始候補へ持ち越さず、常に現在の開始候補だけを有効にする。
 *
 * @param props                         ポインター入力接続に必要な値。
 * @param props.enabled                 現在のTableで行並び替え開始入力を受け付ける場合はtrue。
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
		/* 行並び替えが無効、または物理DnD接続を利用できない場合は開始候補を受け付けない。 */
		if ( ! enabled || ! manager ) {
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

		/* 開始候補は現在のポインター入力だけに対応させ、前回入力の一時登録を残さない。 */
		activeDraggable.current?.destroy();

		const source: RowDndSource = {
			tableIdentity,
			sourceRowIndex: row.sectionRowIndex,
		};

		activeDraggable.current = new Draggable(
			{
				id: `ytr-row:${ tableIdentity }:${ row.sectionRowIndex }`,
				element: row,
				data: source,
				/* 行DnD中の視覚表現はReorder Presentationが所有するため、dnd-kit標準表示は利用しない。 */
				plugins: [
					Feedback.configure( {
						feedback: 'none',
					} ),
				],
				sensors: [
					PointerSensor.configure( {
						/* Tableセル内部からのポインター入力もDnD開始対象として扱う。 */
						preventActivation: () => false,
					} ),
				],
			},
			manager
		);
	};

	return children( onPointerDownCapture );
};
