/**
 * Chat ReorderからWordPress 7.0のserver-side Abilityを1回実行する境界を所有する。
 *
 * AI provider固有の通信や認証は所有せず、自然言語入力とcompact Table contextだけを正規化Abilityへ渡す。
 */

import { executeAbility } from '@wordpress/abilities';
import { ready as coreAbilitiesReady } from '@wordpress/core-abilities';

import { serializeChatReorderContext, type ChatReorderContext } from './context';

const NORMALIZE_REORDER_COMMAND_ABILITY = 'yamabiko-table-reorder/normalize-reorder-command';

/** server-side Abilityが返す正規化結果。 */
type NormalizeReorderCommandResult = {
	command: string;
};

/**
 * Ability実行結果から未信頼のRF Command Textを取得する。
 *
 * @param result server-side Abilityの実行結果。
 * @return AIが返した未信頼のRF Command Text。
 * @throws Ability出力が契約に一致しない場合。
 */
const getCommandText = ( result: unknown ): string => {
	if (
		typeof result !== 'object' ||
		result === null ||
		!( 'command' in result ) ||
		typeof ( result as NormalizeReorderCommandResult ).command !== 'string'
	) {
		throw new Error( 'Invalid normalize reorder command ability output.' );
	}

	return ( result as NormalizeReorderCommandResult ).command;
};

/**
 * 分類とRF Command生成を分割せず、WordPressのserver-side Abilityを1回だけ実行する。
 *
 * @param input   今回の利用者入力。
 * @param context 現在Tableの最小context。
 * @return AIが返した未信頼の1行RF Command Text。
 */
export const requestChatReorderCommand = async (
	input: string,
	context: ChatReorderContext
): Promise< string > => {
	await coreAbilitiesReady;
	const result = await executeAbility( NORMALIZE_REORDER_COMMAND_ABILITY, {
		input,
		context: serializeChatReorderContext( context ),
	} );

	return getCommandText( result );
};
