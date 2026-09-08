/**
 * 列並び替えのポインター入力開始条件とDnD開始対象の接続を所有する。
 *
 * PCとタッチ端末の主ポインター入力から現在Table内のセルを移動元論理列へ解決し、
 * 第一段階のReorder Target Resolutionで開始可能な列だけをdnd-kitのDraggableへ一時登録する。
 * 結合範囲により開始できない列では物理DnDを登録せず、利用者向け開始不可理由を開始を試みた位置とともにPresentationへ通知する。
 * タッチ入力は通常スクロールと競合しない長押し条件で開始し、DnD開始後の進行、移動先解決、確定、取消はこの責務では扱わない。
 */

import { Draggable, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import type { PointerEvent, ReactNode } from 'react';

import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';

import { notifyColumnStartRejection } from './presentation/start-rejection-notice-event';
import { columnReorderTargetResolution, type ColumnReorderTarget } from './target-resolution';

/**
 * 列DnDを既存DOMのポインター入力へ接続する開始処理。
 *
 * @param event 現在Table内で列DnD開始候補を判定するポインター入力。
 */
export type ColumnDndPointerDownHandler = ( event: PointerEvent< Element > ) => void;

/**
 * ポインター入力から列DnD開始候補を解決し、現在の入力で必要な列だけをDraggableへ登録する。
 *
 * PCとタッチ端末の主ポインター入力を共通の第一段階Reorder Target ResolutionとDraggable登録経路へ接続する。
 * マウスは短い移動距離、タッチは通常スクロールとの競合を避ける長押しを開始条件とする。
 * Design上の開始拒否理由がある場合はDraggableを登録せず、操作位置とともにPresentationへ通知する。
 * DnD Engineがidleで新しいポインター入力を受け付けられる場合は前回の開始候補を破棄し、現在入力だけを有効にする。
 * active DnD中は現在のDraggableを破棄せず、新しい開始候補も受け付けない。
 *
 * @param props                         ポインター入力接続に必要な値。
 * @param props.enabled                 現在のTableで列並び替え開始入力を受け付ける場合はtrue。
 * @param props.tableIdentity           列並び替え対象のTable Identity。
 * @param props.activeDraggable         現在のポインター入力で登録したDraggableを保持する参照。
 * @param props.activeDraggable.current 現在のポインター入力で登録したDraggable。未登録の場合はnull。
 * @param props.children                既存DOMへポインター開始処理を接続する描画処理。
 * @return ポインター入力による列DnD開始へ接続された子要素。
 */
export const ColumnInput = ( props: {
	enabled: boolean;
	tableIdentity: string;
	activeDraggable: {
		current: Draggable | null;
	};
	children: ( onPointerDownCapture: ColumnDndPointerDownHandler ) => ReactNode;
} ) => {
	const { enabled, tableIdentity, activeDraggable, children } = props;
	const manager = useDragDropManager();

	const onPointerDownCapture: ColumnDndPointerDownHandler = ( event ) => {
		/* 列並び替えが無効、または物理DnD接続を利用できない場合は開始入力を扱わない。 */
		if ( ! enabled || ! manager ) {
			return;
		}

		/* active DnD中は現在の物理DnD登録を維持し、新しい開始入力で置き換えない。 */
		if ( ! manager.dragOperation.status.idle ) {
			return;
		}

		/* idle中の新しいポインター入力は前回候補を失効させ、現在入力だけを開始候補として扱う。 */
		activeDraggable.current?.destroy();
		activeDraggable.current = null;

		/* 列DnDはPCマウスとタッチ端末の入力だけを開始候補として受け付ける。 */
		if ( event.pointerType !== 'mouse' && event.pointerType !== 'touch' ) {
			return;
		}

		/* 主ポインターの左ボタン相当入力だけを新しい列DnD開始試行として受け入れる。 */
		if ( ! event.isPrimary || event.button !== 0 ) {
			return;
		}

		const target = event.target as Element | null;
		const currentTarget = event.currentTarget;

		/* 開始位置または対象Tableの基準要素を確認できない入力は、開始候補として扱わない。 */
		if ( ! target || ! currentTarget ) {
			return;
		}

		const table = currentTarget.querySelector( 'table' );
		const cell = target.closest( 'th, td' ) as HTMLTableCellElement | null;

		/* 現在Tableに直接属するセルだけを開始対象とし、入れ子TableやTable外の入力は対象にしない。 */
		if ( ! table || ! cell || cell.closest( 'table' ) !== table ) {
			return;
		}

		const sourceColumnIndex = resolveColumnSourceIndex( table, cell );

		/* 論理列位置を安全に解釈できないセルからは、物理DnD開始候補を生成しない。 */
		if ( sourceColumnIndex === null ) {
			return;
		}

		/* マウスDnD開始時だけ既定の文字選択を抑止し、タッチでは通常スクロールを開始時点で妨げない。 */
		if ( event.pointerType === 'mouse' ) {
			event.preventDefault();
		}

		const source: ColumnReorderTarget = {
			tableIdentity,
			sourceColumnIndex,
		};
		const resolution = columnReorderTargetResolution.resolve( source );

		/* 現在のTable制約で開始対象が成立しない列は、物理DnDへ登録しない。 */
		if ( resolution.status !== 'resolved' ) {
			if ( resolution.status === 'rejected' ) {
				notifyColumnStartRejection( {
					reason: resolution.reason,
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
						/* Tableセル内部からのポインター入力を列DnD開始対象として扱う。 */
						preventActivation: () => false,
					} ),
				],
			},
			manager
		);
	};

	return children( onPointerDownCapture );
};
