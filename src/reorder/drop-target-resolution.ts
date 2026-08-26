/**
 * 現在のTable構造と移動候補から、確定可能なReorder Destinationだけを返す共通Contractを提供する。
 *
 * Table全体に共通する対象・境界・no-opの妥当性を先に確認し、その後の結合セル固有規則だけを
 * row / columnのfeatureへ委譲する。判定責務ではTableデータを変更しない。
 */

import { resolveColumnDropTarget } from '@/column-reorder/drop-target-resolution';
import { resolveRowDropTarget } from '@/row-reorder/drop-target-resolution';
import type { ReorderDestination, ReorderTarget } from './dnd-interaction';
import type { ReorderKind } from './reorder-mode';
import { createTableStructure } from './table-structure';

/**
 * 値が、指定されたLogical Index範囲内でTable上の位置として利用できるか判定する。
 *
 * @param value 判定対象となるindex。
 * @param min   仕様上許可する最小Logical Index。
 * @param max   仕様上許可する最大Logical Index。
 * @return Table上の有効な位置として利用できる場合は`true`。
 */
const isIntegerInRange = ( value: number, min: number, max: number ): boolean => {
	// Logical Indexは、整数かつ対象Tableで許可される範囲内にある場合だけ有効である。
	const isValidLogicalIndex = Number.isInteger( value ) && value >= min && value <= max;
	return isValidLogicalIndex;
};

/**
 * 候補境界へ移動しても元の並び順が変化しないか判定する。
 *
 * Reorder Destinationは実際に順序を変更する境界だけを表すため、対象の直前・直後は確定候補にしない。
 *
 * @param targetIndex      元の順序で移動対象を表すLogical Index。
 * @param destinationIndex 元の順序に対する候補境界index。
 * @return 並び順が変化しない候補であれば`true`。
 */
const isNoopDestination = ( targetIndex: number, destinationIndex: number ): boolean => {
	// 対象の直前または直後への移動は、確定後の順序を変化させないためReorder Destinationとして扱わない。
	const keepsCurrentOrder =
		destinationIndex === targetIndex || destinationIndex === targetIndex + 1;
	return keepsCurrentOrder;
};

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

	// Reorder Destinationは、対応Tableの構造を一意に解釈できる場合だけ判定できる。
	if ( structure === null ) {
		return null;
	}

	const itemCount = kind === 'row' ? structure.sections.body?.rows.length : structure.columnCount;

	// 候補を確定できるのは、対象と境界が現在のTable上で有効で、かつ実際に順序が変化する場合だけである。
	if (
		itemCount === undefined ||
		! isIntegerInRange( target.index, 0, itemCount - 1 ) ||
		! isIntegerInRange( destinationIndex, 0, itemCount ) ||
		isNoopDestination( target.index, destinationIndex )
	) {
		return null;
	}

	const resolvedDestination =
		kind === 'row'
			? resolveRowDropTarget( structure, target, destinationIndex )
			: resolveColumnDropTarget( structure, target, destinationIndex );
	return resolvedDestination;
};
