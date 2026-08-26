/**
 * 現在のテーブル構造と移動候補から、実際に確定できる並び替え先だけを返す。
 *
 * 行・列に共通する妥当性を先に確認し、rowspanやcolspanに関する固有規則は対応する機能へ委ねる。
 * この責務ではテーブルデータを変更しない。
 */

import { resolveColumnDropTarget } from '@/column-reorder/drop-target-resolution';
import { resolveRowDropTarget } from '@/row-reorder/drop-target-resolution';
import type { ReorderDestination, ReorderTarget } from './dnd-interaction';
import type { ReorderKind } from './reorder-mode';
import { createTableStructure } from './table-structure';

/**
 * 値が、指定範囲内の有効な整数位置として利用できるかを判定する。
 *
 * @param value 判定対象の値。
 * @param min   許可する最小値。
 * @param max   許可する最大値。
 * @return 有効な整数位置であれば`true`。
 */
const isIntegerInRange = ( value: number, min: number, max: number ): boolean => {
	const isValidLogicalIndex = Number.isInteger( value ) && value >= min && value <= max;
	return isValidLogicalIndex;
};

/**
 * 候補境界へ移動しても、元の並び順が変化しないかを判定する。
 *
 * 対象の直前または直後は移動後の順序が変わらないため、並び替え先として確定しない。
 *
 * @param targetIndex      元の順序で移動対象を表す位置。
 * @param destinationIndex 元の順序に対する候補境界の位置。
 * @return 並び順が変化しない候補であれば`true`。
 */
const isNoopDestination = ( targetIndex: number, destinationIndex: number ): boolean => {
	const keepsCurrentOrder =
		destinationIndex === targetIndex || destinationIndex === targetIndex + 1;
	return keepsCurrentOrder;
};

/**
 * 1つの移動候補を判定するために必要な情報。
 *
 * 入力方式やDOM状態ではなく、現在のテーブル状態、並び替え種別、移動対象、候補境界だけで判定できる形にする。
 */
export type DropTargetResolutionRequest = {
	attributes: Readonly< Record< string, unknown > >;
	blockName: string;
	destinationIndex: number;
	kind: ReorderKind;
	target: ReorderTarget;
};

/**
 * 現在のテーブル構造を壊さず、実際に順序を変更できる候補だけを並び替え先として返す。
 *
 * 共通仕様でテーブル構造と並び替え先としての基本的な妥当性を確定し、rowspanやcolspanに関する規則は
 * 対応する機能へ委ねる。非対応または解釈不能なテーブルでは移動先を生成しない。
 *
 * @param request テーブルの状態、並び替え種別、対象、候補境界をまとめた判定要求。
 * @return 有効な並び替え先。候補を確定できない場合は`null`。
 */
export const resolveDropTarget = (
	request: DropTargetResolutionRequest
): ReorderDestination | null => {
	const { attributes, blockName, destinationIndex, kind, target } = request;
	const structure = createTableStructure( blockName, attributes );

	// 構造を一意に解釈できないテーブルでは、安全な移動先を判断できない。
	if ( structure === null ) {
		return null;
	}

	const itemCount = kind === 'row' ? structure.sections.body?.rows.length : structure.columnCount;

	// 対象と境界が現在のテーブル上で有効で、実際に順序が変わる候補だけを確定対象とする。
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
