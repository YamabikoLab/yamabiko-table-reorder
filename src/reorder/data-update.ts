/**
 * 確定済みの並び替えを、WordPressのテーブル属性へ安全に反映する共通の更新境界を提供する。
 *
 * 対応テーブルであることを確認したうえで行または列の更新処理へ委ね、変換が成立した場合だけ
 * WordPress側へ更新を渡す。行・列固有の更新規則やブロック固有の保存形式はここでは扱わない。
 */

import { applyColumnReorder } from '@/column-reorder/data-update';
import { applyRowReorder } from '@/row-reorder/data-update';
import type { CommittedReorder } from './dnd-interaction';
import { getTableBlockAdapter } from './table-block-adapter';
import type { TableBlockAttributes } from './table-structure';

/**
 * 確定したテーブル属性をWordPress側へ反映する処理。
 *
 * @param attributes 並び替え結果として確定したテーブル属性。
 */
export type SetTableAttributes = ( attributes: Record< string, unknown > ) => void;

/**
 * 1回の確定済み並び替えをWordPress側へ反映するために必要な情報。
 */
export type DataUpdateRequest = {
	attributes: TableBlockAttributes;
	blockName: string;
	committedReorder: CommittedReorder;
	setAttributes: SetTableAttributes;
};

/**
 * 確定済みの並び替えを、元のテーブルデータを保持した新しい属性へ変換する。
 *
 * 対応テーブルであることだけをこの境界で確認し、実際の行・列更新は対応する処理へ委ねる。
 *
 * @param blockName 更新対象のGutenbergブロック名。
 * @param attributes 並び替え前のテーブル属性。入力値は変更しない。
 * @param committedReorder 妥当性確認を経て確定した1回の並び替え。
 * @return 並び替え後の属性。安全に更新できない場合は`null`。
 */
export const applyCommittedReorder = (
	blockName: string,
	attributes: TableBlockAttributes,
	committedReorder: CommittedReorder
): Record< string, unknown > | null => {
	// 明示的に対応しているテーブルだけを更新対象とする。
	if ( getTableBlockAdapter( blockName ) === null ) {
		return null;
	}

	const { destination, kind, target } = committedReorder;
	const nextAttributes =
		kind === 'row'
			? applyRowReorder( blockName, attributes, target.index, destination.index )
			: applyColumnReorder( blockName, attributes, target.index, destination.index );
	return nextAttributes;
};

/**
 * 1回の確定済み並び替えを、WordPress側へ1回の更新として反映する。
 *
 * 更新後のテーブル状態を完全に確定できない場合は更新処理を呼ばず、不完全な状態を外部へ公開しない。
 *
 * @param request 現在のテーブル状態、確定済み並び替え、WordPress側の更新処理をまとめた要求。
 * @return WordPress側へ更新を反映した場合は`true`、更新できなかった場合は`false`。
 */
export const commitReorderData = ( request: DataUpdateRequest ): boolean => {
	const { attributes, blockName, committedReorder, setAttributes } = request;
	const nextAttributes = applyCommittedReorder( blockName, attributes, committedReorder );

	// 完全な更新結果を生成できた場合だけWordPress側へ反映する。
	if ( nextAttributes === null ) {
		return false;
	}

	setAttributes( nextAttributes );
	return true;
};
