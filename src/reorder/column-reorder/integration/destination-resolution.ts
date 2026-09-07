/**
 * 列DnD中の現在の物理入力位置を、DnD開始時のTable配置に対する論理列間境界へ変換する。
 *
 * DnD Engine固有の現在位置から論理的な移動先境界へ変換する責務をこの実装境界に閉じ込め、
 * 後続のDnD Interactionへは0-based移動先列間境界だけを渡す。
 * 列境界はDnD開始時のTable相対位置として固定し、Presentationによる表示位置の変化を移動先判定へ反映しない。
 * 一方でTable自体の現在位置は解決時に取得し直し、DnD中の横スクロールには追従する。
 */

import type { DragMoveEvent } from '@dnd-kit/dom';

import {
	measureTableColumnBoundaryGeometry,
	type ColumnBoundaryGeometry,
} from '@/reorder/column-reorder/infrastructure/column-geometry';

/** DnD中に利用する、対象Tableと開始時に確定した論理列境界。 */
type ColumnDestinationLayout = {
	table: HTMLTableElement;
	boundaries: readonly ColumnBoundaryGeometry[];
};

/**
 * 1回の列DnDに対して、現在の物理入力位置から論理列間境界を解決する境界。
 */
export type ColumnDestinationResolver = {
	/**
	 * 現在の物理入力位置をDnD開始時のTable配置に対する0-based移動先列間境界へ変換する。
	 *
	 * @param event 現在の物理DnD位置を示す移動イベント。
	 * @return 現在の移動先列間境界。対象Table内の移動先を解決できない場合はnull。
	 */
	resolve: ( event: DragMoveEvent ) => number | null;
};

/**
 * DnD Engineが示す移動対象から、列DnD中の移動先判定に利用するTable配置を取得する。
 *
 * 列境界はTableからの相対位置として保持し、スクロールによる画面上の位置変化は固定しない。
 * 対象Tableや開始時境界を安全に確認できない場合は、不完全なResolverを成立させない。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 対象Tableと開始時の論理列境界。Column Reorder対象として成立しない場合はnull。
 */
const resolveDestinationLayout = (
	sourceElement: Element | undefined
): ColumnDestinationLayout | null => {
	if ( ! sourceElement ) {
		return null;
	}

	const sourceCell = sourceElement.closest( 'th, td' );
	if ( ! sourceCell ) {
		return null;
	}

	const sourceRow = sourceCell.parentElement;
	const sourceSection = sourceRow?.parentElement;
	const table = sourceCell.closest( 'table' );

	/* 列並び替え対象としてTable直下sectionの行セルを確認できない場合は、別のDOM階層から配置を推測しない。 */
	if (
		! sourceRow ||
		sourceRow.tagName !== 'TR' ||
		! sourceSection ||
		! [ 'THEAD', 'TBODY', 'TFOOT' ].includes( sourceSection.tagName ) ||
		! table ||
		sourceSection.parentElement !== table
	) {
		return null;
	}

	const typedTable = table as HTMLTableElement;
	const boundaries = measureTableColumnBoundaryGeometry( typedTable );

	/* 物理位置を論理列間境界へ対応付ける基準がないTableでは、不完全なResolverを生成しない。 */
	if ( boundaries.length < 2 ) {
		return null;
	}

	return {
		table: typedTable,
		boundaries,
	};
};

/**
 * 開始時に観測した論理列境界のうち、現在の横位置に最も対応する境界を解決する。
 *
 * 隣接する観測境界の中点を切り替え位置とし、各論理列の左半分では直前境界、右半分では直後境界を返す。
 * 横結合内部などDOMから観測できない境界は推測せず、観測できた境界だけを候補とする。
 *
 * @param localX     現在のTable左端を基準とするポインター横位置。
 * @param boundaries DnD開始時に観測した論理列境界。
 * @return 現在位置に対応する0-based論理列間境界。
 */
const resolveNearestBoundaryIndex = (
	localX: number,
	boundaries: readonly ColumnBoundaryGeometry[]
): number | null => {
	let lower = 0;
	let upper = boundaries.length - 2;

	/* 大きなTableでも列数比例の探索を避け、開始時の境界配置から現在位置に対応する区間だけを特定する。 */
	while ( lower <= upper ) {
		const middle = Math.floor( ( lower + upper ) / 2 );
		const current = boundaries[ middle ];
		const next = boundaries[ middle + 1 ];

		if ( current === undefined || next === undefined ) {
			return null;
		}

		const switchOffset = current.offset + ( next.offset - current.offset ) / 2;

		if ( localX < switchOffset ) {
			if ( middle === 0 ) {
				return current.index;
			}
			upper = middle - 1;
			continue;
		}

		const following = boundaries[ middle + 2 ];
		if ( following === undefined ) {
			return next.index;
		}

		const nextSwitchOffset = next.offset + ( following.offset - next.offset ) / 2;
		if ( localX < nextSwitchOffset ) {
			return next.index;
		}

		lower = middle + 1;
	}

	return null;
};

/**
 * 現在のポインター位置から、DnD開始時の論理列配置に対する0-based移動先列間境界を解決する。
 *
 * DnD中の表示上の列位置変化は判定へ反映せず、スクロール等によるTable自体の現在位置だけを反映する。
 * Table外の物理位置やポインター座標を取得できない移動通知からは移動先を推測しない。
 *
 * @param event  現在の物理DnD位置を示す移動イベント。
 * @param layout DnD開始時に確定した対象Tableと論理列境界。
 * @return 現在の移動先列間境界。対象Table内の移動先を解決できない場合はnull。
 */
const resolveDestinationBoundaryIndex = (
	event: DragMoveEvent,
	layout: ColumnDestinationLayout
): number | null => {
	const nativeEvent = event.nativeEvent;

	/* 移動先判定は現在のポインター入力にだけ成立し、別入力方式の座標を推測して補完しない。 */
	if ( ! nativeEvent || ! ( 'clientX' in nativeEvent ) || ! ( 'clientY' in nativeEvent ) ) {
		return null;
	}

	const pointerEvent = nativeEvent as PointerEvent;
	const tableRectangle = layout.table.getBoundingClientRect();
	const x = pointerEvent.clientX;
	const y = pointerEvent.clientY;

	/* 実ブラウザーでTable範囲を取得できる場合は、Table外の物理位置を列間境界として扱わない。 */
	if (
		( tableRectangle.width > 0 && ( x < tableRectangle.left || x > tableRectangle.right ) ) ||
		( tableRectangle.height > 0 && ( y < tableRectangle.top || y > tableRectangle.bottom ) )
	) {
		return null;
	}

	const localX = x - tableRectangle.left;
	const destinationBoundaryIndex = resolveNearestBoundaryIndex( localX, layout.boundaries );
	return destinationBoundaryIndex;
};

/**
 * 1回の列DnDで利用する移動先解決境界を、移動対象セルの開始時Table配置から生成する。
 *
 * DnD開始時の列境界を固定することで、押しのけ表示等による列の見かけ上の移動を移動先判定へ混入させない。
 * Resolverの生成、再試行、参照保持、破棄のLifecycleはDnD Engine Integrationが所有し、この境界は共有状態を持たない。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 当該DnDで利用できる移動先解決境界。Column Reorder対象として成立しない場合はnull。
 */
export const createColumnDestinationResolver = (
	sourceElement: Element | undefined
): ColumnDestinationResolver | null => {
	const layout = resolveDestinationLayout( sourceElement );

	if ( layout === null ) {
		return null;
	}

	return {
		resolve: ( event ) => resolveDestinationBoundaryIndex( event, layout ),
	};
};
