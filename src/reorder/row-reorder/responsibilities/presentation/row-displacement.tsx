/**
 * Row Reorderの移動先に応じて周囲行を押しのけ、ドロップ後の配置を実Table上で予告する表示を所有する。
 *
 * DnD中のDOM順は変更せず、DnD Engineから移動対象行とLifecycleを直接受け取り、DnD Interactionが示す
 * 現在の有効な移動先に応じて移動元行の高さ分だけ対象行の表示位置を上下へ移動する。
 * 有効drop後はTable更新が完了するまで最後の押しのけ配置を維持し、確定処理中も移動完了後の見た目を保つ。
 * 有効な移動先がない終了または表示境界の終了時には、このPresentationが追加した状態をすべて解除する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { useCallback, useEffect, useRef } from '@wordpress/element';

import {
	useRowDndDestinationBoundaryIndex,
	useRowDndPhase,
} from '@/reorder/row-reorder/integration/dnd-interaction-react';

import './row-displacement.scss';

const DISPLACED_ROW_CLASS = 'yamabiko-table-reorder-displaced-row';
const DISPLACEMENT_PROPERTY = '--yamabiko-table-reorder-row-displacement';

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
 * 必要な周囲行だけを移動する。有効dropでは確定完了まで最後の配置を維持する。
 *
 * @return DOM要素を追加せず、実Tableの行へ一時的な表示状態だけを適用するためnull。
 */
export const RowDisplacement = () => {
	const phase = useRowDndPhase();
	const destinationBoundaryIndex = useRowDndDestinationBoundaryIndex();
	const sourceRow = useRef< HTMLTableRowElement | null >( null );
	const touchedRows = useRef( new Set< HTMLTableRowElement >() );
	const currentRange = useRef< DisplacementRange | null >( null );
	const physicalDragEnded = useRef( false );

	const restoreRows = useCallback(
		( tableBody: HTMLTableSectionElement, firstIndex: number, lastIndex: number ): void => {
			for ( let index = firstIndex; index <= lastIndex; index++ ) {
				const row = tableBody.rows.item( index );
				if ( row !== null ) {
					row.style.setProperty( DISPLACEMENT_PROPERTY, '0px' );
				}
			}
		},
		[]
	);

	const displaceRows = useCallback(
		(
			tableBody: HTMLTableSectionElement,
			firstIndex: number,
			lastIndex: number,
			displacement: number
		): void => {
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
				restoreRows( previousRange.tableBody, previousRange.firstIndex, previousRange.lastIndex );
				currentRange.current = null;
				return;
			}

			const canUpdateByDifference =
				previousRange.tableBody === nextRange.tableBody &&
				previousRange.displacement === nextRange.displacement;
			if ( ! canUpdateByDifference ) {
				restoreRows( previousRange.tableBody, previousRange.firstIndex, previousRange.lastIndex );
				displaceRows(
					nextRange.tableBody,
					nextRange.firstIndex,
					nextRange.lastIndex,
					nextRange.displacement
				);
				currentRange.current = nextRange;
				return;
			}

			const sharedFirstIndex = Math.max( previousRange.firstIndex, nextRange.firstIndex );
			const sharedLastIndex = Math.min( previousRange.lastIndex, nextRange.lastIndex );
			if ( sharedFirstIndex > sharedLastIndex ) {
				restoreRows( previousRange.tableBody, previousRange.firstIndex, previousRange.lastIndex );
				displaceRows(
					nextRange.tableBody,
					nextRange.firstIndex,
					nextRange.lastIndex,
					nextRange.displacement
				);
				currentRange.current = nextRange;
				return;
			}

			restoreRows( previousRange.tableBody, previousRange.firstIndex, sharedFirstIndex - 1 );
			restoreRows( previousRange.tableBody, sharedLastIndex + 1, previousRange.lastIndex );
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
		touchedRows.current.forEach( ( row ) => {
			row.classList.remove( DISPLACED_ROW_CLASS );
			row.style.removeProperty( DISPLACEMENT_PROPERTY );
		} );
		touchedRows.current.clear();
		currentRange.current = null;
		sourceRow.current = null;
		physicalDragEnded.current = false;
	}, [] );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			clear();
			const sourceElement = event.operation.source?.element;
			if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
				return;
			}
			const candidate = sourceElement as HTMLTableRowElement;
			if ( candidate.parentElement?.tagName !== 'TBODY' ) {
				return;
			}
			sourceRow.current = candidate;
		},
		onDragEnd: () => {
			physicalDragEnded.current = true;
			if ( destinationBoundaryIndex === null ) {
				clear();
			}
		},
	} );

	useEffect( () => {
		if ( physicalDragEnded.current && phase === 'idle' ) {
			clear();
			return;
		}

		const currentSourceRow = sourceRow.current;
		if ( currentSourceRow === null || destinationBoundaryIndex === null ) {
			if ( ! physicalDragEnded.current ) {
				updateRange( null );
			}
			return;
		}

		if ( physicalDragEnded.current ) {
			return;
		}

		const tableBody = currentSourceRow.parentElement as HTMLTableSectionElement | null;
		if ( tableBody === null || tableBody.tagName !== 'TBODY' ) {
			clear();
			return;
		}

		const sourceRowIndex = currentSourceRow.sectionRowIndex;
		const sourceRowHeight = currentSourceRow.getBoundingClientRect().height;
		if ( sourceRowHeight <= 0 ) {
			updateRange( null );
			return;
		}

		let firstDisplacedIndex: number;
		let lastDisplacedIndex: number;
		let displacement: number;
		if ( destinationBoundaryIndex < sourceRowIndex ) {
			firstDisplacedIndex = destinationBoundaryIndex;
			lastDisplacedIndex = sourceRowIndex - 1;
			displacement = sourceRowHeight;
		} else {
			firstDisplacedIndex = sourceRowIndex + 1;
			lastDisplacedIndex = destinationBoundaryIndex - 1;
			displacement = -sourceRowHeight;
		}

		updateRange( {
			tableBody,
			firstIndex: firstDisplacedIndex,
			lastIndex: lastDisplacedIndex,
			displacement,
		} );
	}, [ clear, destinationBoundaryIndex, phase, updateRange ] );

	useEffect( () => clear, [ clear ] );

	return null;
};
