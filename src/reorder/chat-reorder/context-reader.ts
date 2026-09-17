/**
 * Chat ReorderがAIへ渡す現在Tableの最小contextをWordPress Reorder Integrationから取得する責務を所有する。
 *
 * AI request用の純粋なcontext表現とは分離し、Row / Column Table Integrationへの依存をこの境界へ閉じ込める。
 */

import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

import type { ChatReorderContext } from './context';

/**
 * 対象Tableの現在状態からAI入力に必要な最小contextだけを取得する。
 *
 * @param tableIdentity contextを取得するTable Identity。
 * @return 行数と最小列記述。取得不能な方向は推測せず空値で表す。
 */
export const getChatReorderContext = ( tableIdentity: string ): ChatReorderContext => {
	const rowConstraints = rowTableIntegration.getConstraints( tableIdentity );
	const columnDescriptors = columnTableIntegration.getColumnInputDescriptors( tableIdentity );
	const columns =
		columnDescriptors?.map( ( descriptor ) => ( {
			columnNumber: descriptor.columnNumber,
			label: descriptor.heading,
		} ) ) ?? [];

	return {
		rowCount: rowConstraints?.rowCount ?? null,
		columns,
	};
};
