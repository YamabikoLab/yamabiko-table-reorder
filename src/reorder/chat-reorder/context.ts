/**
 * Chat ReorderがAIへ渡す最小contextの表現とserializationを所有する。
 *
 * Table IntegrationやEditor live stateへ依存せず、AI requestが扱う最小データContractだけを提供する。
 */

/** AIへ渡すChat Reorderの最小Table context。 */
export type ChatReorderContext = {
	rowCount: number | null;
	columns: readonly {
		columnNumber: number;
		label: string | null;
	}[];
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
