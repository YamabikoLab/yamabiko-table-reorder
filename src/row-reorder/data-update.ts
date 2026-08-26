import { moveArrayItem } from '../reorder/data-update-rules';
import type { TableBlockAttributes } from '../reorder/table-structure';

/**
 * 行並び替え固有のData Updateを行う。
 *
 * @param attributes       テーブルブロックの属性。
 * @param targetIndex      移動対象行のインデックス。
 * @param destinationIndex 移動先のインデックス。
 */
export const applyRowReorder = (
	attributes: TableBlockAttributes,
	targetIndex: number,
	destinationIndex: number
): Record< string, unknown > | null => {
	const body = attributes.body;
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
