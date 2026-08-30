/**
 * 行並び替えに固有のTableデータ更新規則を提供する。
 *
 * 行更新では`body`区画の行全体だけを移動対象とし、各行が保持するセル内容、属性、装飾を変更しない。
 * 対応Table Block固有の属性構造はTable Integrationが共通更新用データへ変換するため、この責務では解釈しない。
 */
import type {
	ConcreteTableReorderUpdate,
	TableUpdateChanges,
	TableUpdateData,
} from '@/reorder/foundation/table-update';

/**
 * 確定済み行並び替えを`body`区画だけのTableデータ変更へ変換する。
 *
 * @param table  Table Integrationが要求時点の対応Tableから作成した共通更新用データ。
 * @param update `body`区画内の移動元・移動後位置を持つ確定済み行更新。
 * @return `body`だけを含む変更。現在状態で安全に適用できない場合は`null`。
 */
export const resolveRowTableUpdateChanges = (
	table: TableUpdateData,
	update: ConcreteTableReorderUpdate< 'row' >
): TableUpdateChanges | null => {
	// 行並び替えの対象範囲である`body`区画が現在Tableに存在しない場合は更新を開始しない。
	if ( ! table.body.exists ) {
		return null;
	}

	const { sourceIndex, destinationIndex } = update;
	const isPositionAvailable =
		Number.isInteger( sourceIndex ) &&
		Number.isInteger( destinationIndex ) &&
		sourceIndex >= 0 &&
		destinationIndex >= 0 &&
		sourceIndex < table.body.rows.length &&
		destinationIndex < table.body.rows.length;

	// DnD確定後に外部Tableが変化して対象位置が成立しなくなった場合は更新を開始しない。
	if ( ! isPositionAvailable ) {
		return null;
	}

	const reorderedRows = [ ...table.body.rows ];
	const [ movedRow ] = reorderedRows.splice( sourceIndex, 1 );
	reorderedRows.splice( destinationIndex, 0, movedRow );

	return { body: reorderedRows };
};
