/**
 * 列DnD中の現在の物理入力位置を、DnD開始時のTable配置に対する論理列間境界へ変換する。
 *
 * DnD Engine固有の現在位置から論理的な移動先境界へ変換する責務をこの実装境界に閉じ込め、
 * 後続のDnD Interactionへは0-based移動先列間境界だけを渡す。
 * 列境界、移動対象列の物理横位置と幅はDnD開始時に固定し、Presentationの実DOMや表示状態は参照しない。
 * Table内外はnative pointer位置で判定し、論理列間境界の切り替えだけを移動方向側のOverlay相当端で判定する。
 * Table自体の現在位置は解決時に取得し直し、DnD中の横スクロールには追従する。
 */

import type { DragMoveEvent } from '@dnd-kit/dom';

import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
	type ColumnBoundaryGeometry,
	type ColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';

/** DnD中に利用する、対象Table、論理進行方向、開始時に確定した論理列境界と移動対象列配置。 */
// type ColumnDestinationLayout = {
// 	table: HTMLTableElement;
// 	inlineDirection: ColumnInlineDirection;
// 	boundaries: readonly ColumnBoundaryGeometry[];
// 	sourceLeft: number;
// 	sourceWidth: number;
// };

type ColumnDestinationLayout = {
	table: HTMLTableElement;
	tableRectangle: DOMRect;
	inlineDirection: ColumnInlineDirection;
	boundaries: readonly ColumnBoundaryGeometry[];
	sourceLeft: number;
	sourceWidth: number;
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
 * 列境界はTableの論理開始端からの相対位置として保持し、スクロールによる画面上の位置変化は固定しない。
 * 移動対象列の物理横位置と幅は、移動表示と同じ開始時配置を再現するためDnD開始時の値を保持する。
 * 対象Tableや開始時境界を安全に確認できない場合は、不完全なResolverを成立させない。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 対象Table、論理進行方向、開始時の論理列境界と移動対象列配置。Column Reorder対象として成立しない場合はnull。
 */
const resolveDestinationLayout = (
	sourceElement: Element | undefined
): ColumnDestinationLayout | null => {
	/* 移動対象DOM自体を確認できない場合は、別のTableを探索して配置を補完しない。 */
	if ( ! sourceElement ) {
		return null;
	}

	const sourceCell = sourceElement.closest( 'th, td' );

	/* 移動対象をTableセルとして確認できない場合は、列位置を推測してResolverを成立させない。 */
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

	// const typedTable = table as HTMLTableElement;
	// const boundaries = measureTableColumnBoundaryGeometry( typedTable );
	// const sourceRectangle = sourceCell.getBoundingClientRect();

	const typedTable = table as HTMLTableElement;
	const boundaries = measureTableColumnBoundaryGeometry( typedTable );
	const sourceRectangle = sourceCell.getBoundingClientRect();

	/* 物理位置を論理列間境界へ対応付ける基準がないTableでは、不完全なResolverを生成しない。 */
	if ( boundaries.length < 2 || sourceRectangle.width <= 0 ) {
		return null;
	}

	// A/B: dragmove中のgeometry readを止めるため、開始時Table矩形を固定する。
	const tableRectangle = typedTable.getBoundingClientRect();

	const inlineDirection = resolveTableColumnInlineDirection( typedTable );

	// return {
	// 	table: typedTable,
	// 	inlineDirection,
	// 	boundaries,
	// 	sourceLeft: sourceRectangle.left,
	// 	sourceWidth: sourceRectangle.width,
	// };

	return {
		table: typedTable,
		tableRectangle,
		inlineDirection,
		boundaries,
		sourceLeft: sourceRectangle.left,
		sourceWidth: sourceRectangle.width,
	};
};

/**
 * 開始時に観測した論理列境界のうち、現在の論理進行方向上の位置に最も対応する境界を解決する。
 *
 * 隣接する観測境界の中点を切り替え位置とし、論理列の前半では直前境界、後半では直後境界を返す。
 * 横結合内部などDOMから観測できない境界は推測せず、観測できた境界だけを候補とする。
 *
 * @param localInlineOffset 現在のTable論理開始端を基準とする判定位置。
 * @param boundaries        DnD開始時に観測した論理列境界。
 * @return 現在位置に対応する0-based論理列間境界。
 */
const resolveNearestBoundaryIndex = (
	localInlineOffset: number,
	boundaries: readonly ColumnBoundaryGeometry[]
): number | null => {
	let lower = 0;
	let upper = boundaries.length - 2;

	/* 大きなTableでも列数比例の探索を避け、開始時の境界配置から現在位置に対応する区間だけを特定する。 */
	while ( lower <= upper ) {
		const middle = Math.floor( ( lower + upper ) / 2 );
		const current = boundaries[ middle ];
		const next = boundaries[ middle + 1 ];

		/* 開始時境界の連続性が成立しない場合は、誤った論理境界を返さず利用不能として扱う。 */
		if ( current === undefined || next === undefined ) {
			return null;
		}

		const switchOffset = current.offset + ( next.offset - current.offset ) / 2;

		/* 現在区間の論理前半では直前境界を候補とし、それ以前の区間だけを探索対象に残す。 */
		if ( localInlineOffset < switchOffset ) {
			if ( middle === 0 ) {
				return current.index;
			}
			upper = middle - 1;
			continue;
		}

		const following = boundaries[ middle + 2 ];

		/* 現在区間が末尾区間なら、論理後半は末尾直後境界として確定する。 */
		if ( following === undefined ) {
			return next.index;
		}

		const nextSwitchOffset = next.offset + ( following.offset - next.offset ) / 2;

		/* 隣接区間の切り替え位置より前では、両区間に共通する現在境界を移動先として確定する。 */
		if ( localInlineOffset < nextSwitchOffset ) {
			return next.index;
		}

		lower = middle + 1;
	}

	return null;
};

/**
 * DnD開始位置に対する現在位置から、論理列間境界の切り替えに利用する物理横位置を解決する。
 *
 * 右方向では移動対象Overlay相当の右端、左方向では左端を利用する。
 * DnD Engineの物理横位置を取得できない場合や横移動がない場合は、native pointer位置を維持する。
 *
 * @param event    現在の物理DnD位置を示す移動イベント。
 * @param layout   DnD開始時に確定した移動対象列配置。
 * @param pointerX 現在のnative pointer横位置。
 * @return 論理列間境界の切り替えに利用する物理横位置。
 */
const resolveBoundaryDecisionX = (
	event: DragMoveEvent,
	layout: ColumnDestinationLayout,
	pointerX: number
): number => {
	const initialX = event.operation?.position.initial.x;
	const currentX = event.operation?.position.current.x;

	/* DnD Engineの開始時と現在の物理横位置を確認できない場合は、従来のpointer基準を維持する。 */
	if ( initialX === undefined || currentX === undefined ) {
		return pointerX;
	}

	const deltaX = currentX - initialX;

	/* 横移動がない時点ではOverlay端を先行させず、現在のpointer位置をそのまま利用する。 */
	if ( deltaX === 0 ) {
		return pointerX;
	}

	const overlayLeft = layout.sourceLeft + deltaX;
	const boundaryDecisionX = deltaX > 0 ? overlayLeft + layout.sourceWidth : overlayLeft;
	return boundaryDecisionX;
};

/**
 * 現在のpointer位置と移動対象Overlay相当端から、DnD開始時の論理列配置に対する0-based移動先列間境界を解決する。
 *
 * Table内外はnative pointer位置で判定し、Overlay相当端が先にTable外へ出てもpointerがTable内なら解決を継続する。
 * 論理列間境界の切り替えは、DnD開始位置に対する物理X方向から選んだOverlay相当端を利用する。
 * 選択した物理位置はLTR / RTLの論理進行方向へ正規化し、開始時に固定した論理列境界へ対応付ける。
 * DnD中の横スクロールではTable自体の現在位置だけを反映し、開始時の移動対象列配置と論理列境界は維持する。
 *
 * @param event  現在の物理DnD位置を示す移動イベント。
 * @param layout DnD開始時に確定した対象Table、論理進行方向、論理列境界と移動対象列配置。
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

	// const pointerEvent = nativeEvent as PointerEvent;
	// const tableRectangle = layout.table.getBoundingClientRect();
	// const pointerX = pointerEvent.clientX;
	// const pointerY = pointerEvent.clientY;

	const pointerEvent = nativeEvent as PointerEvent;

	// A/B: dragmove中はDOM geometryを読まず、DnD開始時の値を利用する。
	const tableRectangle = layout.tableRectangle;

	const pointerX = pointerEvent.clientX;
	const pointerY = pointerEvent.clientY;

	/* Table内外は従来どおりnative pointer位置で判定し、Overlay相当端だけがTable外へ出ても移動先を失わない。 */
	if (
		( tableRectangle.width > 0 &&
			( pointerX < tableRectangle.left || pointerX > tableRectangle.right ) ) ||
		( tableRectangle.height > 0 &&
			( pointerY < tableRectangle.top || pointerY > tableRectangle.bottom ) )
	) {
		return null;
	}

	const boundaryDecisionX = resolveBoundaryDecisionX( event, layout, pointerX );
	let localInlineOffset = boundaryDecisionX - tableRectangle.left;

	/* RTLでは現在のTable右端を論理開始位置として、開始時geometryと同じ論理進行方向へ物理位置を正規化する。 */
	if ( layout.inlineDirection === 'rtl' ) {
		localInlineOffset = tableRectangle.right - boundaryDecisionX;
	}

	const destinationBoundaryIndex = resolveNearestBoundaryIndex(
		localInlineOffset,
		layout.boundaries
	);
	return destinationBoundaryIndex;
};

/**
 * 1回の列DnDで利用する移動先解決境界を、移動対象セルの開始時Table配置から生成する。
 *
 * DnD開始時の論理列境界、論理進行方向、移動対象列の物理横位置と幅を固定し、
 * 押しのけ表示等による列の見かけ上の移動やPresentation DOMを移動先判定へ混入させない。
 * Resolverの生成、再試行、参照保持、破棄のLifecycleはDnD Engine Integrationが所有し、この境界は共有状態を持たない。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 当該DnDで利用できる移動先解決境界。Column Reorder対象として成立しない場合はnull。
 */
export const createColumnDestinationResolver = (
	sourceElement: Element | undefined
): ColumnDestinationResolver | null => {
	const layout = resolveDestinationLayout( sourceElement );

	/* 開始時Table配置を安全に確定できない場合は、部分的な情報を持つResolverを生成しない。 */
	if ( layout === null ) {
		return null;
	}

	return {
		resolve: ( event ) => resolveDestinationBoundaryIndex( event, layout ),
	};
};
