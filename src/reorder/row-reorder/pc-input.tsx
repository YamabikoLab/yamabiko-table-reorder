/**
 * 行並び替えのPC入力開始条件とDnD開始対象の接続を所有する。
 *
 * PCの主pointer入力から現在Tableのtbody直下行を開始候補として解決し、
 * 行並び替えが有効な間だけ、その行をdnd-kitのDraggableへ遅延登録する。
 * DnD開始後のLifecycle、移動先候補、確定、取消はDnD境界へ委ねる。
 */

import { Draggable, Feedback, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import type { ReactNode } from 'react';

import type { RowDndSource } from './dnd-interaction';

/** 行DnDのDraggable / Droppable種別。 */
export const ROW_DND_TYPE = 'ytr-row';

/** Row DnDが既存DOMのpointer入力へ接続するhandler。 */
export type RowDndPointerDownHandler = ( event: unknown ) => void;

/**
 * PC入力から行DnD開始候補を解決し、現在のpointer入力で必要な行だけをDraggableへ登録する。
 *
 * タッチ入力は対象外とし、行並び替えが有効なPC入力で成立した開始候補だけを共通のRow DnD Lifecycleへ接続する。
 *
 * @param props                         PC入力接続に必要な値。
 * @param props.enabled                 現在のTableで行並び替え開始入力を受け付ける場合はtrue。
 * @param props.tableIdentity           行並び替え対象のTable Identity。
 * @param props.activeDraggable         現在のpointer入力で登録したDraggable。
 * @param props.activeDraggable.current 現在のpointer入力で登録したDraggable。
 * @param props.children                既存DOMへpointer handlerを接続する描画処理。
 * @return PC入力によるRow DnD開始へ接続された子要素。
 */
export const RowPcInput = ( props: {
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
		/* 行並び替えが無効な間はPC入力をDnD開始へ接続しない。 */
		if ( ! enabled || ! manager ) {
			return;
		}

		const pointerEvent = event as PointerEvent;

		/* PCの主pointer入力だけを行DnD開始候補として受け入れる。 */
		if (
			! pointerEvent.isPrimary ||
			pointerEvent.button !== 0 ||
			pointerEvent.pointerType === 'touch' ||
			! manager.dragOperation.status.idle
		) {
			return;
		}

		const target = pointerEvent.target as Element | null;
		const currentTarget = pointerEvent.currentTarget as Element | null;

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
				type: ROW_DND_TYPE,
				/* ドラッグ成立と確定を目視確認する間だけ標準Feedbackを利用する。 */
				plugins: [
					Feedback.configure( {
						feedback: 'default',
					} ),
				],
				sensors: [
					PointerSensor.configure( {
						/* Tableセル内部からのpointer入力もDnD開始対象として扱う。 */
						preventActivation: () => false,
					} ),
				],
			},
			manager
		);
	};

	return children( onPointerDownCapture );
};
