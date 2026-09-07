/**
 * Row Reorderの有効drop後、実Table上の移動元行を表示上の最終位置へ移動し、Table更新中の確定表示を所有する。
 *
 * Core Tableが所有するDOM順は変更せず、最後のInsertion Gapと移動元行の表示位置から確定位置を解決する。
 * 確定中は移動元行をその位置へ一時的に移動し、Tableと同じスクロール文脈のまま移動完了後の配置を維持する。
 * DnD Interactionがidleへ戻った時点で、このPresentationが追加した表示指定を解除する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { useCallback, useEffect, useRef } from '@wordpress/element';

import { useRowDndPhase } from '@/reorder/row-reorder/integration/dnd-interaction-react';
import { getRowDndDestinationBoundaryIndex } from '@/reorder/row-reorder/responsibilities/dnd-interaction';

const INSERTION_GAP_SELECTOR = '.yamabiko-table-reorder-insertion-gap';

/** 確定中だけ移動元行へ追加する表示指定と、解除時に戻す元のinline指定。 */
type ActiveSourceRowCommitPresentation = {
	row: HTMLTableRowElement;
	transform: string;
	transition: string;
	opacity: string;
};

/**
 * 有効drop後の移動元行を、Core Table更新中だけ最終位置へ表示する。
 *
 * @return DOM要素を追加せず、実Table上の移動元行へ一時的な表示指定だけを適用するためnull。
 */
export const RowSourceCommitPresentation = () => {
	const phase = useRowDndPhase();
	const activePresentation = useRef< ActiveSourceRowCommitPresentation | null >( null );

	const clear = useCallback( (): void => {
		const current = activePresentation.current;
		activePresentation.current = null;
		if ( current === null || ! current.row.isConnected ) {
			return;
		}

		current.row.style.transform = current.transform;
		current.row.style.transition = current.transition;
		current.row.style.opacity = current.opacity;
	}, [] );

	useDragDropMonitor( {
		onDragStart: clear,
		onDragEnd: ( event ) => {
			/* 取消または実際に行順が変わらない終了では、確定済みの位置を示す表示を生成しない。 */
			if ( event.canceled || getRowDndDestinationBoundaryIndex() === null ) {
				return;
			}

			const sourceElement = event.operation.source?.element;
			if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
				return;
			}

			const sourceRow = sourceElement as HTMLTableRowElement;
			if ( sourceRow.parentElement?.tagName !== 'TBODY' ) {
				return;
			}

			const insertionGap = sourceRow.ownerDocument.querySelector< HTMLElement >(
				INSERTION_GAP_SELECTOR
			);
			if ( insertionGap === null ) {
				return;
			}

			const sourceRectangle = sourceRow.getBoundingClientRect();
			const gapRectangle = insertionGap.getBoundingClientRect();
			/* 表示位置を確定できない場合は、推測した移動量で確定済みの表示を作らない。 */
			if ( sourceRectangle.height <= 0 || gapRectangle.height <= 0 ) {
				return;
			}

			clear();
			activePresentation.current = {
				row: sourceRow,
				transform: sourceRow.style.transform,
				transition: sourceRow.style.transition,
				opacity: sourceRow.style.opacity,
			};

			/* 実Table内の行を最終位置へ表示するため、Tableと同じスクロール文脈を維持したまま縦位置だけを移動する。 */
			sourceRow.style.transform = `translate3d(0, ${ gapRectangle.top - sourceRectangle.top }px, 0)`;
			sourceRow.style.transition = 'none';
			sourceRow.style.opacity = '1';
		},
	} );

	useEffect( () => {
		/* Table更新が完了してidleへ戻ったら、確定表示を実Tableの新しい並びへ引き継ぐ。 */
		if ( phase === 'idle' && activePresentation.current !== null ) {
			clear();
		}
	}, [ phase, clear ] );

	useEffect( () => clear, [ clear ] );

	return null;
};
