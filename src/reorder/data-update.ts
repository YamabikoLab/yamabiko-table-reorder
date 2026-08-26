import { applyColumnReorder } from '@/column-reorder/data-update';
import { applyRowReorder } from '@/row-reorder/data-update';
import type { CommittedReorder } from './dnd-interaction';
import { getTableBlockSupport, type TableBlockAttributes } from './table-structure';

/**
 * Data UpdateがWordPress側へ確定更新を渡すcallback。
 */
export type SetTableAttributes = ( attributes: Record< string, unknown > ) => void;

/**
 * Data Updateへ渡す確定更新要求。
 */
export type DataUpdateRequest = {
	attributes: TableBlockAttributes;
	blockName: string;
	committedReorder: CommittedReorder;
	setAttributes: SetTableAttributes;
};

/**
 * 確定済み並び替えを新しいTable block attributesへ変換する。
 *
 * Data Updateの共通Contract入口として`kind`に対応するfeature実装を選択する。
 * row / column固有の更新ロジックは各featureへ委譲し、この境界では混在させない。
 * @param blockName
 * @param attributes
 * @param committedReorder
 */
export const applyCommittedReorder = (
	blockName: string,
	attributes: TableBlockAttributes,
	committedReorder: CommittedReorder
): Record< string, unknown > | null => {
	if ( getTableBlockSupport( blockName ) === null ) {
		return null;
	}

	const { destination, kind, target } = committedReorder;
	return kind === 'row'
		? applyRowReorder( attributes, target.index, destination.index )
		: applyColumnReorder( blockName, attributes, target.index, destination.index );
};

/**
 * 確定済み並び替えを1回だけWordPress側のTableデータへ反映する。
 *
 * 変換が成立した場合だけ`setAttributes`を1回呼び出す。
 * @param request
 */
export const commitReorderData = ( request: DataUpdateRequest ): boolean => {
	const { attributes, blockName, committedReorder, setAttributes } = request;
	const nextAttributes = applyCommittedReorder( blockName, attributes, committedReorder );
	if ( nextAttributes === null ) {
		return false;
	}

	setAttributes( nextAttributes );
	return true;
};
