/**
 * 確定済みの並び替えをTable block attributesへ反映するData Updateの共通Contractを提供する。
 *
 * 対応Tableであることを確認したうえで行・列のfeature実装を選択し、変換が成立した場合だけ
 * WordPress側へ更新を渡す。行・列固有のデータ操作はこの境界では所有しない。
 */

import { applyColumnReorder } from '@/column-reorder/data-update';
import { applyRowReorder } from '@/row-reorder/data-update';
import type { CommittedReorder } from './dnd-interaction';
import { getTableBlockSupport, type TableBlockAttributes } from './table-structure';

/**
 * Data Updateが確定したTable attributesをWordPress側へ反映するcallbackのContract。
 *
 * @param attributes 並び替え結果として確定したTable attributes。
 */
export type SetTableAttributes = ( attributes: Record< string, unknown > ) => void;

/**
 * 1回の確定済み並び替えをWordPress側へ反映するためにData Updateが必要とする情報。
 *
 * Tableの現在状態、block種別、確定結果、更新先callbackを1つの要求として扱い、更新境界を明確にする。
 */
export type DataUpdateRequest = {
	attributes: TableBlockAttributes;
	blockName: string;
	committedReorder: CommittedReorder;
	setAttributes: SetTableAttributes;
};

/**
 * Committed Reorderを、元のTableデータを保持した新しいattributesへ変換する。
 *
 * 共通Contractでは並び替え種別に対応するfeatureだけを選択し、row / column固有の更新規則は
 * 各featureへ委譲する。対応Tableとして解釈できない場合は更新結果を生成しない。
 *
 * @param blockName        Data Updateの対象となるGutenberg block名。
 * @param attributes       並び替え前のTable block attributes。入力状態として変更しない。
 * @param committedReorder Drop Target Resolutionを経て確定した1回の並び替え。
 * @return 並び替え後のattributes。Data Updateを成立させられない場合は`null`。
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
 * 1回のCommitted Reorderを、WordPress側のTableデータへ1回の確定更新として渡す。
 *
 * Data Updateが成立しない場合は更新callbackを呼ばないため、不完全なTable状態を外部へ公開しない。
 *
 * @param request 現在のTable状態と確定済み並び替え、およびWordPress側の更新先をまとめた要求。
 * @return WordPress側へ更新を渡した場合は`true`、更新を成立させられなかった場合は`false`。
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
