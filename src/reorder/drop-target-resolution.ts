/**
 * 現在のTable構造と移動候補から、確定可能なReorder Destinationだけを返す共通Contractを提供する。
 *
 * Table全体に共通する対象・境界・no-opの妥当性を先に確認し、その後の結合セル固有判定だけを
 * row / columnのfeatureへ委譲する。判定責務ではTableデータを変更しない。
 */

import { resolveColumnDropTarget } from '@/column-reorder/drop-target-resolution';
import { resolveRowDropTarget } from '@/row-reorder/drop-target-resolution';
import type { ReorderDestination, ReorderTarget } from './dnd-interaction';
import type { ReorderKind } from './reorder-mode';
import { createTableStructure } from './table-structure';

/**
 * Table上のindexとして扱う値が、指定したLogical Index範囲に収まる有効な整数か判定する。
 *
 * @param value 判定するindex。
 * @param min   仕様上許可する最小index。
 * @param max   仕様上許可する最大index。
 * @return Logical Indexとして利用できる場合は`true`。
 */
const isIntegerInRange = ( value: number, min: number, max: number ): boolean =>
	Number.isInteger( value ) && value >= min && value <= max;

/**
 * 候補境界へ移動しても元の並び順が変化しないか判定する。
 *
 * Reorder Destinationは実際に順序を変更する境界だけを表すため、対象の直前・直後は確定候補にしない。
 *
 * @param targetIndex      元の順序で移動対象を指すLogical Index。
 * @param destinationIndex 元の順序に対する候補境界index。
 * @return 並び順が変化しない候補であれば`true`。
 */
const isNoopDestination = ( targetIndex: number, destinationIndex: number ): boolean =>
	destinationIndex === targetIndex || destinationIndex === targetIndex + 1;

/**
 * Drop Target Resolutionが1つの移動候補を判定するために必要とする情報。
 *
 * 入力方式やDOM状態ではなく、Tableデータ、並び替え種別、Logical Indexだけで判定できる境界を保つ。
 */
export type DropTargetResolutionRequest = {
	attributes: Readonly< Record< string, unknown > >;
	blockName: string;
	destinationIndex: number;
	kind: ReorderKind;
	target: ReorderTarget;
};

/**
 * 現在のTable構造を壊さず、実際に順序を変更できる候補だけをReorder Destinationとして返す。
 *
 * 共通ContractでTable構造と基本的な候補妥当性を確定し、rowspan / colspanに関する規則は
 * 対応するfeatureへ委譲する。非対応または解釈不能なTableでは移動先を生成しない。
 *
 * @param request Table状態、並び替え種別、対象、候補境界をまとめた判定要求。
 * @return 有効なReorder Destination。候補を確定できない場合は`null`。
 */
export const resolveDropTarget = (
	request: DropTargetResolutionRequest
): ReorderDestination | null => {
	const { attributes, blockName, destinationIndex, kind, target } = request;
	const structure = createTableStructure( blockName, attributes );
	if ( structure === null ) {
		return null;
	}

	const itemCount = kind === 'row' ? structure.sections.body?.rows.length : structure.columnCount;

	// Table上の有効な並び替え候補として成立しない要求は、feature固有判定へ渡さない。
	if (
		itemCount === undefined ||
		! isIntegerInRange( target.index, 0, itemCount - 1 ) ||
		! isIntegerInRange( destinationIndex, 0, itemCount ) ||
		isNoopDestination( target.index, destinationIndex )
	) {
		return null;
	}

	return kind === 'row'
		? resolveRowDropTarget( structure, target, destinationIndex )
		: resolveColumnDropTarget( structure, target, destinationIndex );
};
