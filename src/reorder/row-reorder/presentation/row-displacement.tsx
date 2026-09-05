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
 * 現在の移動先に対して押しのけ表示が成立している連続行範囲を表す。
 *
 * 移動先が隣接境界へ変わる通常のドラッグでは、前回範囲との差分行だけを更新できるよう、表示中の範囲と
 * 移動方向をPresentation固有状態として保持する。
 */
type DisplacementRange = {
	tableBody: HTMLTableSectionElement;
	firstIndex: number;
	lastIndex: number;
	displacement: number;
};

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
	const currentRange = useRef< DisplacementRange | null >( null );

	/**
	 * 指定範囲の行を元位置へ戻す。
	 *
	 * @param tableBody  対象Tableのtbody。
	 * @param firstIndex 元位置へ戻す先頭行位置。
	 * @param lastIndex  元位置へ戻す末尾行位置。
	 */
	const restoreRows = useCallback(
		(
			tableBody: HTMLTableSectionElement,
			firstIndex: number,
			lastIndex: number
		): void => {
			/* 現在の移動先から外れた行だけを元位置へ戻し、継続して押しのける行の表示指定は変更しない。 */
			for ( let index = firstIndex; index <= lastIndex; index++ ) {
				const row = tableBody.rows.item( index );
				if ( row === null ) {
					continue;
				}

				row.style.setProperty( DISPLACEMENT_PROPERTY, '0px' );
			}
		},
		[]
	);

	/**
	 * 指定範囲の行へ押しのけ表示を適用する。
	 *
	 * @param tableBody     対象Tableのtbody。
	 * @param firstIndex    押しのける先頭行位置。
	 * @param lastIndex     押しのける末尾行位置。
	 * @param displacement 移動元行1行分の表示移動量。
	 */
	const displaceRows = useCallback(
		(
			tableBody: HTMLTableSectionElement,
			firstIndex: number,
			lastIndex: number,
			displacement: number
		): void => {
			/* 新しく現在の移動先までに含まれた行だけを移動し、既に同じ位置へ移動済みの行は更新しない。 */
			for ( let index = firstIndex; index <= lastIndex; index++ ) {
				const row = tableBody.rows.item( index );
				if ( row === null || row === sourceRow.current ) {
					continue;
				}

				row.classList.add( DISPLACED_ROW_CLASS );
				row.style.setProperty( DISPLACEMENT_PROPERTY, `${ displacement }px` );
				touchedRows.current.add( row );
			}
		},
		[]
	);

	/**
	 * 現在の押しのけ範囲を次の移動先の範囲へ更新する。
	 *
	 * 同じTableかつ同じ移動方向で範囲が連続して変化する場合は、前回範囲と次回範囲で重複する行を変更せず、
	 * 差分に含まれる行だけを更新する。これにより大規模Tableでも移動先境界ごとのDOM更新量を移動距離へ比例させない。
	 *
	 * @param nextRange 次の有効な移動先に必要な押しのけ範囲。押しのけ不要時はnull。
	 */
	const updateRange = useCallback(
		( nextRange: DisplacementRange | null ): void => {
			const previousRange = currentRange.current;

			if ( previousRange === null ) {
				if ( nextRange !== null ) {
					displaceRows(
						nextRange.tableBody,
						nextRange.firstIndex,
						nextRange.lastIndex,
						nextRange.displacement
					);
				}
				currentRange.current = nextRange;
				return;
			}

			if ( nextRange === null ) {
				restoreRows(
					previousRange.tableBody,
					previousRange.firstIndex,
					previousRange.lastIndex
				);
				currentRange.current = null;
				return;
			}

			const canUpdateByDifference =
				previousRange.tableBody === nextRange.tableBody &&
				previousRange.displacement === nextRange.displacement;

			/* Tableまたは押しのけ方向が変わる場合は範囲の連続性を保証できないため、旧表示を解除して新表示を成立させる。 */
			if ( ! canUpdateByDifference ) {
				restoreRows(
					previousRange.tableBody,
					previousRange.firstIndex,
					previousRange.lastIndex
				);
				displaceRows(
					nextRange.tableBody,
					nextRange.firstIndex,
					nextRange.lastIndex,
					nextRange.displacement
				);
				currentRange.current = nextRange;
				return;
			}

			const sharedFirstIndex = Math.max(
				previousRange.firstIndex,
				nextRange.firstIndex
			);
			const sharedLastIndex = Math.min(
				previousRange.lastIndex,
				nextRange.lastIndex
			);

			/* 前回範囲と次回範囲が重ならない場合は、差分として共有できる表示状態がないため両範囲を個別に更新する。 */
			if ( sharedFirstIndex > sharedLastIndex ) {
				restoreRows(
					previousRange.tableBody,
					previousRange.firstIndex,
					previousRange.lastIndex
				);
				displaceRows(
					nextRange.tableBody,
					nextRange.firstIndex,
					nextRange.lastIndex,
					nextRange.displacement
				);
				currentRange.current = nextRange;
				return;
			}

			restoreRows(
				previousRange.tableBody,
				previousRange.firstIndex,
				sharedFirstIndex - 1
			);
			restoreRows(
				previousRange.tableBody,
				sharedLastIndex + 1,
				previousRange.lastIndex
			);
			displaceRows(
				nextRange.tableBody,
				nextRange.firstIndex,
				sharedFirstIndex - 1,
				nextRange.displacement
			);
			displaceRows(
				nextRange.tableBody,
				sharedLastIndex + 1,
				nextRange.lastIndex,
				nextRange.displacement
			);
			currentRange.current = nextRange;
		},
		[ displaceRows, restoreRows ]
	);

	const clear = useCallback( (): void => {
		/* このPresentationが触れた行だけを対象に、次のDnDへ表示状態を持ち越さないよう完全に解除する。 */
		touchedRows.current.forEach( ( row ) => {
			row.classList.remove( DISPLACED_ROW_CLASS );
			row.style.removeProperty( DISPLACEMENT_PROPERTY );
		} );
		touchedRows.current.clear();
		currentRange.current = null;
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
		const currentSourceRow = sourceRow.current;
		/* 移動対象行または有効な移動先がない期間は、押しのけ表示を成立させない。 */
		if ( currentSourceRow === null || destinationBoundaryIndex === null ) {
			updateRange( null );
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
			updateRange( null );
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
			updateRange( null );
			return;
		}

		updateRange( {
			tableBody,
			firstIndex: firstDisplacedIndex,
			lastIndex: lastDisplacedIndex,
			displacement,
		} );
	}, [ clear, destinationBoundaryIndex, updateRange ] );

	useEffect( () => {
		return clear;
	}, [ clear ] );

	return null;
};
