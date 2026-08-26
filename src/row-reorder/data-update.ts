/**
 * 確定済みの行並び替えを、Tableのbody row順へ反映するData Updateを提供する。
 *
 * 行の位置だけを変更し、row・cell・body以外のattributesをそのまま保持することで、並び替えによって
 * Table内容やblock固有情報を失わないことを保証する。
 */

import { moveArrayItem } from '../reorder/data-update-rules';
import type { TableBlockAttributes } from '../reorder/table-structure';

/**
 * body内の1行を確定したReorder Destinationへ移動した新しいattributesを生成する。
 *
 * bodyを有効なrow列として扱えない場合や移動要求が成立しない場合は更新結果を生成せず、入力attributesを変更しない。
 *
 * @param attributes       並び替え前のTable block attributes。
 * @param targetIndex      元のbody順序で移動対象rowを指すLogical Index。
 * @param destinationIndex 元のbody順序に対して確定したReorder Destinationの境界index。
 * @return 行順だけを変更した新しいattributes。Data Updateを成立させられない場合は`null`。
 */
export const applyRowReorder = (
	attributes: TableBlockAttributes,
	targetIndex: number,
	destinationIndex: number
): Record< string, unknown > | null => {
	const body = attributes.body;

	// 並び替え対象となるbody row列を確定できないTableでは、部分的なData Updateを行わない。
	if ( ! Array.isArray( body ) || body.length === 0 ) {
		return null;
	}

	const reorderedBody = moveArrayItem( body, targetIndex, destinationIndex );
	return reorderedBody === null
		? null
		: {
				...attributes,
				body: reorderedBody,
		  };
};
