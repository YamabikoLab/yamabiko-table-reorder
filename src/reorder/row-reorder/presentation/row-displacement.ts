/**
 * Row Reorderの移動先に応じて周囲行を押しのけ、ドロップ後の配置を実Table上で予告する表示を所有する。
 *
 * DnD中のDOM順は変更せず、移動元行の高さ分だけ対象行の表示位置を上下へ移動する。
 * 移動先が変わった場合は直前の押しのけを元位置へ戻し、DnD終了時にはこの表示が追加した状態をすべて解除する。
 */

import './row-displacement.scss';

const DISPLACED_ROW_CLASS = 'yamabiko-table-reorder-displaced-row';
const DISPLACEMENT_PROPERTY = '--yamabiko-table-reorder-row-displacement';

/**
 * 1回のRow DnDにおける周囲行の押しのけ表示Lifecycleを管理する。
 *
 * DnD Interactionが確定した有効な移動先だけを受け取り、移動先の意味状態を独自には所有しない。
 */
export type RowDisplacementPresentation = {
	/**
	 * 物理DnD開始時の移動対象行を、このDnD中の押しのけ表示対象として設定する。
	 *
	 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
	 */
	start: ( sourceElement: Element | undefined ) => void;
	/**
	 * 現在の有効な移動先に合わせて、挿入位置を空ける行だけを上下へ移動する。
	 *
	 * @param destinationBoundaryIndex DnD Interactionが有効とした0-based移動先境界。移動先がない場合はnull。
	 */
	update: ( destinationBoundaryIndex: number | null ) => void;
	/** DnD終了時に押しのけ表示が追加したclassと表示位置をすべて解除する。 */
	end: () => void;
};

/**
 * Row DnDごとの押しのけ表示Lifecycleを生成する。
 *
 * @return 物理DnDの開始、移動先更新、終了へ接続するPresentation境界。
 */
export const createRowDisplacementPresentation = (): RowDisplacementPresentation => {
	let sourceRow: HTMLTableRowElement | null = null;
	const touchedRows = new Set< HTMLTableRowElement >();
	const displacedRows = new Set< HTMLTableRowElement >();

	const restoreDisplacedRows = (): void => {
		/* 直前の移動先で押しのけた行を元位置へ戻し、次の有効な移動先だけを表示できる状態にする。 */
		displacedRows.forEach( ( row ) => {
			row.style.setProperty( DISPLACEMENT_PROPERTY, '0px' );
		} );
		displacedRows.clear();
	};

	const clear = (): void => {
		/* このPresentationが触れた行だけを対象に、次のDnDへ表示状態を持ち越さないよう完全に解除する。 */
		touchedRows.forEach( ( row ) => {
			row.classList.remove( DISPLACED_ROW_CLASS );
			row.style.removeProperty( DISPLACEMENT_PROPERTY );
		} );
		touchedRows.clear();
		displacedRows.clear();
		sourceRow = null;
	};

	return {
		start: ( sourceElement ) => {
			clear();

			/* Row Reorderの移動対象としてtbody直下行を確認できる場合だけ、押しのけ表示を開始する。 */
			if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
				return;
			}

			const candidate = sourceElement as HTMLTableRowElement;
			if ( candidate.parentElement?.tagName !== 'TBODY' ) {
				return;
			}

			sourceRow = candidate;
		},
		update: ( destinationBoundaryIndex ) => {
			restoreDisplacedRows();

			if ( sourceRow === null || destinationBoundaryIndex === null ) {
				return;
			}

			const tableBody = sourceRow.parentElement as HTMLTableSectionElement | null;
			if ( tableBody === null || tableBody.tagName !== 'TBODY' ) {
				clear();
				return;
			}

			const sourceRowIndex = sourceRow.sectionRowIndex;
			const sourceRowHeight = sourceRow.getBoundingClientRect().height;

			/* 表示寸法を確定できない場合は、推測した移動量でTable表示を変化させない。 */
			if ( sourceRowHeight <= 0 ) {
				return;
			}

			let firstDisplacedIndex: number;
			let lastDisplacedIndex: number;
			let displacement: number;

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
				if ( row === null || row === sourceRow ) {
					continue;
				}

				row.classList.add( DISPLACED_ROW_CLASS );
				row.style.setProperty( DISPLACEMENT_PROPERTY, `${ displacement }px` );
				touchedRows.add( row );
				displacedRows.add( row );
			}
		},
		end: clear,
	};
};
