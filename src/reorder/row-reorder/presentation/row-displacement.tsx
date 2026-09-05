/**
 * Row Reorderの移動先に応じて周囲行を押しのけ、ドロップ後の配置を実Table上で予告する表示を所有する。
 *
 * DnD中のDOM順は変更せず、DnD Engineから移動対象行とLifecycleを直接受け取り、DnD Interactionが示す
 * 現在の有効な移動先に応じて移動元行の高さ分だけ対象行の表示位置を上下へ移動する。
 * DnD終了時または表示境界の終了時には、このPresentationが追加した状態をすべて解除する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { useCallback, useEffect, useRef } from '@wordpress/element';

import { useRowDndDestinationBoundaryIndex } from '@/reorder/row-reorder/dnd-interaction-react';

import './row-displacement.scss';

const DISPLACED_ROW_CLASS = 'yamabiko-table-reorder-displaced-row';
const DISPLACEMENT_PROPERTY = '--yamabiko-table-reorder-row-displacement';

/**
 * Row Reorderの押しのけ表示をDnD EngineとDnD Interactionへ直接接続する。
 *
 * 物理DnD開始時の移動対象行だけをそのDnD中の表示対象として保持し、現在の有効な移動先が変わるたびに
 * 必要な周囲行だけを移動する。表示固有状態はこのPresentation内だけで所有する。
 *
 * @return DOM要素を追加せず、実Tableの行へ一時的な表示状態だけを適用するためnull。
 */
export const RowDisplacement = () => {
	const destinationBoundaryIndex = useRowDndDestinationBoundaryIndex();
	const sourceRow = useRef< HTMLTableRowElement | null >( null );
	const touchedRows = useRef( new Set< HTMLTableRowElement >() );
	const displacedRows = useRef( new Set< HTMLTableRowElement >() );

	const restoreDisplacedRows = useCallback( (): void => {
		/* 直前の移動先で押しのけた行を元位置へ戻し、次の有効な移動先だけを表示できる状態にする。 */
		displacedRows.current.forEach( ( row ) => {
			row.style.setProperty( DISPLACEMENT_PROPERTY, '0px' );
		} );
		displacedRows.current.clear();
	}, [] );

	const clear = useCallback( (): void => {
		/* このPresentationが触れた行だけを対象に、次のDnDへ表示状態を持ち越さないよう完全に解除する。 */
		touchedRows.current.forEach( ( row ) => {
			row.classList.remove( DISPLACED_ROW_CLASS );
			row.style.removeProperty( DISPLACEMENT_PROPERTY );
		} );
		touchedRows.current.clear();
		displacedRows.current.clear();
		sourceRow.current = null;
	}, [] );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			clear();
			const sourceElement = event.operation.source?.element;

			/* Row Reorderの移動対象として行要素を確認できない場合は、押しのけ表示を開始しない。 */
			if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
				return;
			}

			const candidate = sourceElement as HTMLTableRowElement;
			/* 対象Tableのtbody直下行だけを押しのけ表示の基準とし、別のTable構造から表示対象を推測しない。 */
			if ( candidate.parentElement?.tagName !== 'TBODY' ) {
				return;
			}

			sourceRow.current = candidate;
		},
		onDragEnd: clear,
	} );

	useEffect( () => {
		restoreDisplacedRows();

		const currentSourceRow = sourceRow.current;
		/* 移動対象行または有効な移動先がない期間は、押しのけ表示を成立させない。 */
		if ( currentSourceRow === null || destinationBoundaryIndex === null ) {
			return;
		}

		const tableBody = currentSourceRow.parentElement as HTMLTableSectionElement | null;
		/* DnD中に対象行がRow Reorderのtbody直下行でなくなった場合は、残っている表示状態を解除する。 */
		if ( tableBody === null || tableBody.tagName !== 'TBODY' ) {
			clear();
			return;
		}

		const sourceRowIndex = currentSourceRow.sectionRowIndex;
		const sourceRowHeight = currentSourceRow.getBoundingClientRect().height;

		/* 表示寸法を確定できない場合は、推測した移動量でTable表示を変化させない。 */
		if ( sourceRowHeight <= 0 ) {
			return;
		}

		let firstDisplacedIndex: number;
		let lastDisplacedIndex: number;
		let displacement: number;

		/* 上方向では移動先から移動元直前までを下げ、下方向では移動元直後から移動先直前までを上げる。 */
		if ( destinationBoundaryIndex < sourceRowIndex ) {
			firstDisplacedIndex = destinationBoundaryIndex;
			lastDisplacedIndex = sourceRowIndex - 1;
			displacement = sourceRowHeight;
		} else if ( destinationBoundaryIndex > sourceRowIndex + 1 ) {
			firstDisplacedIndex = sourceRowIndex + 1;
			lastDisplacedIndex = destinationBoundaryIndex - 1;
			displacement = -sourceRowHeight;
		} else {
			/* 移動元の直前または直後は順序が変わらないため、挿入空間を作らない。 */
			return;
		}

		/* 移動元から現在の移動先までに含まれる行だけを移動し、他のTable表示へ影響させない。 */
		for ( let index = firstDisplacedIndex; index <= lastDisplacedIndex; index++ ) {
			const row = tableBody.rows.item( index );
			if ( row === null || row === currentSourceRow ) {
				continue;
			}

			row.classList.add( DISPLACED_ROW_CLASS );
			row.style.setProperty( DISPLACEMENT_PROPERTY, `${ displacement }px` );
			touchedRows.current.add( row );
			displacedRows.current.add( row );
		}
	}, [ clear, destinationBoundaryIndex, restoreDisplacedRows ] );

	useEffect( () => {
		return clear;
	}, [ clear ] );

	return null;
};
