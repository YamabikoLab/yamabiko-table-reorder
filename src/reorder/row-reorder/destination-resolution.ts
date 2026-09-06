/**
 * 行DnD中の現在の物理入力位置を、DnD開始時のTable配置に対する論理的な移動先境界へ変換する。
 *
 * DnD Engine固有の現在位置から論理的な移動先境界へ変換する責務をこの実装境界に閉じ込め、DnD Interactionへは0-based移動先境界だけを渡す。
 * 行境界はDnD開始時のtbody相対位置として固定し、Presentationによる表示位置の変化を移動先判定へ反映しない。
 * 一方でtbody自体の現在位置は解決時に取得し直し、DnD中のスクロールには追従する。
 */

import type { DragMoveEvent } from '@dnd-kit/dom';

import { measureTableBodyRowGeometry } from './row-geometry';

/** DnD開始時のTable配置を基準として移動先判定に利用する、tbody内の論理的な行境界。 */
type RowDestinationBoundary = {
	index: number;
	top: number;
	bottom: number;
};

/** DnD中に維持する、対象tbodyと開始時に確定した論理的な行境界。 */
type RowDestinationLayout = {
	tableBody: HTMLTableSectionElement;
	boundaries: RowDestinationBoundary[];
};

/**
 * 1回の行DnDに対して、現在の物理入力位置から論理的な移動先境界を解決する境界。
 */
export type RowDestinationResolver = {
	/**
	 * 現在の物理入力位置をDnD開始時のTable配置に対する0-based移動先境界へ変換する。
	 *
	 * @param event 現在の物理DnD位置を示す移動イベント。
	 * @return 現在の移動先境界。対象Table内の移動先行がない場合はnull。
	 */
	resolve: ( event: DragMoveEvent ) => number | null;
};

/**
 * 移動対象行から、DnD中の移動先判定に利用する論理配置を取得する。
 *
 * 行境界はtbodyからの相対位置として保持し、スクロールによる画面上の位置変化は固定しない。
 * DnD中に実Tableの表示位置が変化しても、移動先候補は開始時の行配置を基準として解決する。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 対象tbodyと論理的な行境界。Row Reorder対象として成立しない場合はnull。
 */
const resolveDestinationLayout = (
	sourceElement: Element | undefined
): RowDestinationLayout | null => {
	/* Row Reorderの移動対象としてtbody直下行を確認できない場合は、移動先判定用の配置を成立させない。 */
	if ( ! sourceElement || sourceElement.tagName !== 'TR' ) {
		return null;
	}

	const sourceRow = sourceElement as HTMLTableRowElement;
	const tableBody = sourceRow.parentElement;

	/* 行DnDの対象範囲であるtbodyを確認できない場合は、別のDOM階層から移動先を推測しない。 */
	if ( ! tableBody || tableBody.tagName !== 'TBODY' ) {
		return null;
	}

	const typedTableBody = tableBody as HTMLTableSectionElement;
	const rowGeometry = measureTableBodyRowGeometry( typedTableBody );
	const boundaries = rowGeometry.map( ( geometry, index ) => ( {
		index,
		top: geometry.top,
		bottom: geometry.bottom,
	} ) );

	return {
		tableBody: typedTableBody,
		boundaries,
	};
};

/**
 * 現在のポインター位置から、DnD開始時の論理的な行配置に対する0-based移動先境界を解決する。
 *
 * DnD中の表示上の位置変化は移動先判定へ反映せず、スクロール等によるtbody自体の現在位置だけを反映する。
 * 行の上半分ではその行の直前、下半分ではその行の直後を移動先とする。
 *
 * @param event  現在の物理DnD位置を示す移動イベント。
 * @param layout DnD中に維持する対象tbodyと論理的な行境界。
 * @return 現在の移動先境界。対象Table内の移動先行がない場合はnull。
 */
const resolveDestinationBoundaryIndex = (
	event: DragMoveEvent,
	layout: RowDestinationLayout
): number | null => {
	const nativeEvent = event.nativeEvent;

	/* 移動先判定は現在のポインター入力にだけ成立し、別入力方式の座標を推測して補完しない。 */
	if ( ! nativeEvent || ! ( 'clientX' in nativeEvent ) || ! ( 'clientY' in nativeEvent ) ) {
		return null;
	}

	const pointerEvent = nativeEvent as PointerEvent;
	const bodyRectangle = layout.tableBody.getBoundingClientRect();
	const x = pointerEvent.clientX;
	const y = pointerEvent.clientY;

	/* 実ブラウザーでtbodyの横幅を取得できる場合は、対象Tableの横方向外側を移動先として扱わない。 */
	if ( bodyRectangle.width > 0 && ( x < bodyRectangle.left || x > bodyRectangle.right ) ) {
		return null;
	}

	const localY = y - bodyRectangle.top;
	let lower = 0;
	let upper = layout.boundaries.length - 1;

	/* 大きなTableでも行数比例のDOM探索を行わず、DnD開始時の論理境界から現在位置に対応する行だけを特定する。 */
	while ( lower <= upper ) {
		const middle = Math.floor( ( lower + upper ) / 2 );
		const boundary = layout.boundaries[ middle ];

		if ( boundary === undefined ) {
			return null;
		}

		if ( localY < boundary.top ) {
			upper = middle - 1;
			continue;
		}

		if ( localY > boundary.bottom ) {
			lower = middle + 1;
			continue;
		}

		const middleY = boundary.top + ( boundary.bottom - boundary.top ) / 2;
		const destinationBoundaryIndex = localY < middleY ? boundary.index : boundary.index + 1;
		return destinationBoundaryIndex;
	}

	return null;
};

/**
 * 1回の行DnDで利用する移動先解決境界を、移動対象行の開始時配置から生成する。
 *
 * DnD開始時の行境界を固定することで、押しのけ表示等による行の見かけ上の移動を移動先判定へ混入させない。
 * sourceElementから対象tbodyを確認できない場合は解決境界を成立させず、呼び出し側が後続の移動通知から再試行できるようにする。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 当該DnDで利用する移動先解決境界。Row Reorder対象として成立しない場合はnull。
 */
export const createRowDestinationResolver = (
	sourceElement: Element | undefined
): RowDestinationResolver | null => {
	const layout = resolveDestinationLayout( sourceElement );

	/* DnD開始時点で対象Table配置を確定できない場合は、不完全な解決境界を生成しない。 */
	if ( layout === null ) {
		return null;
	}

	return {
		resolve: ( event ) => resolveDestinationBoundaryIndex( event, layout ),
	};
};
