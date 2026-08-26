/**
 * 確定済みの行並び替えを、Tableのbody row順へ反映するData Updateを提供する。
 *
 * block固有のbody保存形式はTable Block Adapterに委譲し、行の位置だけを変更する。row・cell・body以外の
 * attributesを保持することで、対応Tableが増えても行Data Updateへ保存形式の条件分岐を持ち込まない。
 */

import { moveArrayItem } from '@/reorder/data-update-rules';
import { getTableBlockAdapter } from '@/reorder/table-block-adapter';
import type { TableBlockAttributes } from '@/reorder/table-structure';

/**
 * body内の1行を確定したReorder Destinationへ移動した新しいattributesを生成する。
 *
 * block固有のbody読み書きはAdapterを通じて行い、共通のrow列として並び替えられない場合は更新を成立させない。
 *
 * @param blockName        行並び替え対象となるGutenberg block名。
 * @param attributes       並び替え前のTable block attributes。
 * @param targetIndex      元のbody順序で並び替え対象rowを表すLogical Index。
 * @param destinationIndex 元のbody順序に対して確定したReorder Destinationの境界index。
 * @return 行順だけを変更した新しいattributes。Data Updateを成立させられない場合は`null`。
 */
export const applyRowReorder = (
	blockName: string,
	attributes: TableBlockAttributes,
	targetIndex: number,
	destinationIndex: number
): Record< string, unknown > | null => {
	const adapter = getTableBlockAdapter( blockName );
	if ( adapter === null ) {
		return null;
	}

	const bodyRows = adapter.readSectionRows( attributes, 'body' );

	// 行Data Updateは、対象Tableのbodyを共通row Contractとして確定でき、並び替える行が存在する場合だけ実行する。
	if ( bodyRows === null || bodyRows.length === 0 ) {
		return null;
	}

	const reorderedBodyRows = moveArrayItem( bodyRows, targetIndex, destinationIndex );
	if ( reorderedBodyRows === null ) {
		return null;
	}

	// block固有形式へ完全に書き戻せる場合だけ、確定済みTable状態として公開する。
	const nextAttributes = adapter.writeSectionRows( attributes, 'body', reorderedBodyRows );
	return nextAttributes;
};
