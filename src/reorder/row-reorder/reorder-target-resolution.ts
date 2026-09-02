/**
 * 行専用Reorder Target Resolutionとして、対象Tableが現在も行DnD開始判定に利用可能かを確認する。
 *
 * Table Integrationが提供する現在の行構造だけを利用し、Tableデータや判定結果を保持しない。
 */

import { rowTableIntegration } from './table-integration';

/**
 * 対象Tableが要求時点でもReorder Target Resolutionから利用可能かを確認する。
 *
 * @param tableIdentity 対象Table個体を識別する値。
 * @return 現在の行構造を取得できる場合はtrue、取得できない場合はfalse。
 */
const isAvailable = ( tableIdentity: string ): boolean => {
	const structure = rowTableIntegration.getStructure( tableIdentity );
	return structure !== null;
};

/**
 * DnD Interactionへ提供する行専用Reorder Target Resolutionのインタフェース。
 */
export const rowReorderTargetResolution = {
	isAvailable,
};
