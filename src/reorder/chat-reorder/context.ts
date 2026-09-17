/**
 * Chat ReorderがAIへ渡す現在Tableの最小contextを所有する。
 *
 * Table全体やCell本文は公開せず、Row番号解釈に必要な行数とColumn番号・label解釈に必要な列記述だけを要求時点で取得する。
 */

import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import { rowTableIntegration } from '@/reorder/row-reorder/responsibilities/table-integration';

/** AIへ渡すChat Reorderの最小Table context。 */
export type ChatReorderContext = {
	rowCount: number | null;
	columns: readonly {
		columnNumber: number;
		label: string | null;
	}[];
};

/**
 * 対象Tableの現在状態からAI入力に必要な最小contextだけを取得する。
 *
 * @param tableIdentity contextを取得するTable Identity。
 * @return 行数とcompactな列記述。取得不能な方向は推測せず空値で表す。
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

/**
 * AI requestへ埋め込むcompact context文字列を生成する。
 *
 * @param context 現在Tableの最小context。
 * @return 行数と列番号・labelだけを含む短い文字列。
 */
export const serializeChatReorderContext = ( context: ChatReorderContext ): string => {
	const rowPart = context.rowCount === null ? 'R=?' : `R=${ context.rowCount }`;
	const columnPart = context.columns
		.map( ( column ) => {
			const label = column.label?.trim();
			return label ? `${ column.columnNumber }:${ label }` : `${ column.columnNumber }`;
		} )
		.join( ',' );

	return `${ rowPart }\nC=${ columnPart }`;
};
