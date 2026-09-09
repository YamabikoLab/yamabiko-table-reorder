/**
 * Column Reorderの現在の有効な移動先に応じて周囲列を押しのけ、ドロップ後の配置を実Table上で予告する表示を所有する。
 *
 * 実Tableの列順やTableデータはDnD中に変更せず、DnD Interactionが所有する移動元論理列と現在の有効移動先を正本として、
 * その間にある論理列を移動対象列幅ぶん横方向へ移動する。DnD開始時にTable全体のセルと論理列の対応を一度だけ確定し、
 * 移動先変更時は前回範囲との差分論理列だけを更新する。結合セルが複数論理列を覆う場合も同じDOMセルへ重複した表示更新を行わない。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { useCallback, useEffect, useRef } from '@wordpress/element';

import {
	useColumnDndDestinationBoundaryIndex,
	useColumnDndSourceColumnIndex,
} from '@/reorder/column-reorder/integration/dnd-interaction-react';
import { createColumnSourceIndexResolver } from '@/reorder/column-reorder/integration/source-column-resolution';
import {
	resolveTableColumnInlineDirection,
	type ColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';

import './column-displacement.scss';

const DISPLACED_CELL_CLASS = 'yamabiko-table-reorder-displaced-column-cell';
const DISPLACEMENT_PROPERTY = '--yamabiko-table-reorder-column-displacement';

/** 1回のColumn DnD中に維持する、押しのけ対象セルと論理列の対応および移動量の基準。 */
type ColumnDisplacementSessionLayout = {
	table: HTMLTableElement;
	sourceColumnWidth: number;
	inlineDirection: ColumnInlineDirection;
	cellsByColumn: Map< number, Set< HTMLTableCellElement > >;
};

/** 現在の移動先に対して押しのけ表示が成立している連続論理列範囲。 */
type ColumnDisplacementRange = {
	firstIndex: number;
	lastIndex: number;
	displacement: number;
};

/**
 * DnD開始時の移動対象DOMから、そのSession中の押しのけ表示に必要なTable配置を確定する。
 *
 * DOMセルと論理列の対応は既存のColumn Source Resolutionを利用し、thead / tbody / tfootとrowspan / colspanを同じ規則で解釈する。
 * 同じ結合セルは占有する各論理列から参照されるが、表示更新時は参照数で一つのDOMセルとして扱う。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 1回のDnDで再利用する押しのけ配置。安全に確定できない場合はnull。
 */
const resolveDisplacementSessionLayout = (
	sourceElement: Element | undefined
): ColumnDisplacementSessionLayout | null => {
	if ( ! sourceElement ) {
		return null;
	}

	const sourceCell = sourceElement.closest( 'th, td' ) as HTMLTableCellElement | null;
	const table = sourceCell?.closest( 'table' ) as HTMLTableElement | null;

	/* Column Reorderの移動対象セルと対象Tableを確認できない場合は、別DOMから配置を推測しない。 */
	if ( sourceCell === null || table === null ) {
		return null;
	}

	const sourceColumnWidth = sourceCell.getBoundingClientRect().width;

	/* 移動対象列幅を確定できない状態では、推測した移動量で実Table表示を変化させない。 */
	if ( sourceColumnWidth <= 0 ) {
		return null;
	}

	const sourceIndexResolver = createColumnSourceIndexResolver( table );
	const cellsByColumn = new Map< number, Set< HTMLTableCellElement > >();

	/* Table全体を開始時に一度だけ論理列へ対応付け、以後の移動先変更でDOM全体を再走査しない。 */
	for ( const row of Array.from( table.rows ) ) {
		for ( const cell of Array.from( row.cells ) ) {
			const columnStart = sourceIndexResolver.resolve( cell );
			if ( columnStart === null ) {
				continue;
			}

			const columnSpan = Math.max( cell.colSpan, 1 );
			/* 結合セルを占有する各論理列へ対応付け、範囲差分を論理列単位で扱えるようにする。 */
			for ( let columnIndex = columnStart; columnIndex < columnStart + columnSpan; columnIndex++ ) {
				const cells = cellsByColumn.get( columnIndex ) ?? new Set< HTMLTableCellElement >();
				cells.add( cell );
				cellsByColumn.set( columnIndex, cells );
			}
		}
	}

	return {
		table,
		sourceColumnWidth,
		inlineDirection: resolveTableColumnInlineDirection( table ),
		cellsByColumn,
	};
};

/**
 * Column Reorderの押しのけ表示をDnD EngineとDnD Interactionへ接続する。
 *
 * 移動元論理列と移動先境界はDnD Interactionの共有状態を利用し、物理DnD開始時には表示に必要なTableと列幅だけを確定する。
 * LTR / RTLでは論理列方向を正規化し、同じ論理移動が画面上で正しい物理方向へ見えるよう変換する。
 *
 * @return 実Tableのセルへ一時的な表示状態だけを適用するためnull。
 */
export const ColumnDisplacement = () => {
	const sourceColumnIndex = useColumnDndSourceColumnIndex();
	const destinationBoundaryIndex = useColumnDndDestinationBoundaryIndex();
	const activeLayout = useRef< ColumnDisplacementSessionLayout | null >( null );
	const touchedCells = useRef( new Set< HTMLTableCellElement >() );
	const coverageCounts = useRef( new Map< HTMLTableCellElement, number >() );
	const currentRange = useRef< ColumnDisplacementRange | null >( null );

	/** 指定論理列を現在の押しのけ範囲へ加え、その列を覆うセルへ必要な表示だけを追加する。 */
	const addColumn = useCallback( ( columnIndex: number, displacement: number ): void => {
		const layout = activeLayout.current;
		if ( layout === null ) {
			return;
		}

		const cells = layout.cellsByColumn.get( columnIndex );
		if ( cells === undefined ) {
			return;
		}

		cells.forEach( ( cell ) => {
			const previousCount = coverageCounts.current.get( cell ) ?? 0;
			coverageCounts.current.set( cell, previousCount + 1 );

			/* 結合セルが複数対象列を覆う場合も、最初に範囲へ入った時だけ同じ移動量を一度適用する。 */
			if ( previousCount === 0 ) {
				cell.classList.add( DISPLACED_CELL_CLASS );
				cell.style.setProperty( DISPLACEMENT_PROPERTY, `${ displacement }px` );
				touchedCells.current.add( cell );
			}
		} );
	}, [] );

	/** 指定論理列を現在の押しのけ範囲から外し、その列以外にも覆われている結合セルは表示を維持する。 */
	const removeColumn = useCallback( ( columnIndex: number ): void => {
		const layout = activeLayout.current;
		if ( layout === null ) {
			return;
		}

		const cells = layout.cellsByColumn.get( columnIndex );
		if ( cells === undefined ) {
			return;
		}

		cells.forEach( ( cell ) => {
			const previousCount = coverageCounts.current.get( cell ) ?? 0;
			const nextCount = Math.max( previousCount - 1, 0 );

			if ( nextCount === 0 ) {
				coverageCounts.current.delete( cell );
				cell.style.setProperty( DISPLACEMENT_PROPERTY, '0px' );
				return;
			}

			coverageCounts.current.set( cell, nextCount );
		} );
	}, [] );

	/** 指定範囲の論理列を押しのけ表示へ加える。 */
	const addRange = useCallback(
		( range: ColumnDisplacementRange ): void => {
			/* 移動元と移動先の間に含まれる論理列だけを対象とし、無関係な列へDOM更新を広げない。 */
			for ( let index = range.firstIndex; index <= range.lastIndex; index++ ) {
				addColumn( index, range.displacement );
			}
		},
		[ addColumn ]
	);

	/** 指定範囲の論理列を押しのけ表示から外す。 */
	const removeRange = useCallback(
		( range: ColumnDisplacementRange ): void => {
			/* 現在の移動先から外れた論理列だけを元位置へ戻し、継続範囲の表示状態は変更しない。 */
			for ( let index = range.firstIndex; index <= range.lastIndex; index++ ) {
				removeColumn( index );
			}
		},
		[ removeColumn ]
	);

	/** 前回の押しのけ範囲を、現在の有効な移動先に必要な範囲へ差分更新する。 */
	const updateRange = useCallback(
		( nextRange: ColumnDisplacementRange | null ): void => {
			const previousRange = currentRange.current;

			if ( previousRange === null ) {
				if ( nextRange !== null ) {
					addRange( nextRange );
				}
				currentRange.current = nextRange;
				return;
			}

			if ( nextRange === null ) {
				removeRange( previousRange );
				currentRange.current = null;
				return;
			}

			/* 移動方向が変わる場合は同じセルへ異なる移動量が必要になるため、旧範囲を解除して新範囲を成立させる。 */
			if ( previousRange.displacement !== nextRange.displacement ) {
				removeRange( previousRange );
				addRange( nextRange );
				currentRange.current = nextRange;
				return;
			}

			const sharedFirstIndex = Math.max( previousRange.firstIndex, nextRange.firstIndex );
			const sharedLastIndex = Math.min( previousRange.lastIndex, nextRange.lastIndex );

			if ( sharedFirstIndex > sharedLastIndex ) {
				removeRange( previousRange );
				addRange( nextRange );
				currentRange.current = nextRange;
				return;
			}

			removeRange( {
				...previousRange,
				lastIndex: sharedFirstIndex - 1,
			} );
			removeRange( {
				...previousRange,
				firstIndex: sharedLastIndex + 1,
			} );
			addRange( {
				...nextRange,
				lastIndex: sharedFirstIndex - 1,
			} );
			addRange( {
				...nextRange,
				firstIndex: sharedLastIndex + 1,
			} );
			currentRange.current = nextRange;
		},
		[ addRange, removeRange ]
	);

	const clear = useCallback( (): void => {
		/* このPresentationが触れたセルだけを対象に、次のDnDへ一時表示を持ち越さないよう完全に解除する。 */
		touchedCells.current.forEach( ( cell ) => {
			cell.classList.remove( DISPLACED_CELL_CLASS );
			cell.style.removeProperty( DISPLACEMENT_PROPERTY );
		} );
		touchedCells.current.clear();
		coverageCounts.current.clear();
		currentRange.current = null;
		activeLayout.current = null;
	}, [] );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			clear();
			activeLayout.current = resolveDisplacementSessionLayout( event.operation.source?.element );
		},
		onDragEnd: clear,
	} );

	useEffect( () => {
		const layout = activeLayout.current;

		/* DnD Interactionが移動元または有効な移動先を持たない期間は、押しのけ表示を成立させない。 */
		if ( layout === null || sourceColumnIndex === null || destinationBoundaryIndex === null ) {
			updateRange( null );
			return;
		}

		const logicalEndDisplacement =
			layout.inlineDirection === 'ltr' ? layout.sourceColumnWidth : -layout.sourceColumnWidth;
		let nextRange: ColumnDisplacementRange | null = null;

		/* 論理開始側への移動では、移動先から移動元直前までを論理終了方向へ押しのける。 */
		if ( destinationBoundaryIndex < sourceColumnIndex ) {
			nextRange = {
				firstIndex: destinationBoundaryIndex,
				lastIndex: sourceColumnIndex - 1,
				displacement: logicalEndDisplacement,
			};
		}

		/* 論理終了側への移動では、移動元直後から移動先直前までを論理開始方向へ押しのける。 */
		if ( destinationBoundaryIndex > sourceColumnIndex + 1 ) {
			nextRange = {
				firstIndex: sourceColumnIndex + 1,
				lastIndex: destinationBoundaryIndex - 1,
				displacement: -logicalEndDisplacement,
			};
		}

		updateRange( nextRange );
	}, [ destinationBoundaryIndex, sourceColumnIndex, updateRange ] );

	useEffect( () => {
		return clear;
	}, [ clear ] );

	return null;
};
