/**
 * Chat Reorderの1回分のAI request組み立てとtransport境界を所有する。
 *
 * AI provider固有の認証やAPI key管理は所有せず、外部から注入されたtransportへ最小promptを1回だけ渡す。
 */

import { applyFilters } from '@wordpress/hooks';

import { serializeChatReorderContext, type ChatReorderContext } from './context';

/** Chat ReorderがAI transportへ渡す1回分のrequest。 */
export type ChatAiRequest = {
	system: string;
	input: string;
	context: string;
	maxOutputTokens: number;
};

/** Chat Reorderが利用するprovider非依存AI transport。 */
export type ChatAiTransport = ( request: ChatAiRequest ) => Promise< string >;

const SYSTEM_INSTRUCTION =
	'Return exactly one line: row <n> <before|after> <n>, column <#n|"label"> <before|after> <#n|"label">, or ask "<short clarification>". Decide row/column, preserve column labels, use 1-based numbers, and return no explanation.';

/**
 * 利用者入力と現在Table contextから1回分の最小AI requestを組み立てる。
 *
 * @param input   今回の利用者入力。
 * @param context 現在Tableの最小context。
 * @return provider固有情報を含まないAI request。
 */
export const buildChatAiRequest = (
	input: string,
	context: ChatReorderContext
): ChatAiRequest => ( {
	system: SYSTEM_INSTRUCTION,
	input,
	context: serializeChatReorderContext( context ),
	maxOutputTokens: 48,
} );

/**
 * WordPress拡張境界から現在利用可能なAI transportを取得する。
 *
 * PoCではprovider/API key管理を製品コードへ埋め込まず、`yamabikoTableReorder.chatAiTransport` filterからtransportを注入する。
 *
 * @return 利用可能なtransport。未接続の場合はnull。
 */
export const getChatAiTransport = (): ChatAiTransport | null =>
	applyFilters( 'yamabikoTableReorder.chatAiTransport', null ) as ChatAiTransport | null;

/**
 * 分類とRF Command生成を分割せず、AIを1回だけ呼び出す。
 *
 * @param input     今回の利用者入力。
 * @param context   現在Tableの最小context。
 * @param transport AI providerへ接続するtransport。
 * @return AIが返した未信頼の1行Command Text。
 */
export const requestChatReorderCommand = async (
	input: string,
	context: ChatReorderContext,
	transport: ChatAiTransport
): Promise< string > => transport( buildChatAiRequest( input, context ) );
