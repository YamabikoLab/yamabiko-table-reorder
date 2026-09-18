/**
 * Chat ReorderからWordPress 7.0のserver-side Abilityを1回実行する境界を所有する。
 *
 * AI provider固有の通信や認証は所有せず、自然言語入力とcompact Table contextだけを正規化Abilityへ渡す。
 */

import { serializeChatReorderContext, type ChatReorderContext } from './context';

const NORMALIZE_REORDER_COMMAND_ABILITY = 'yamabiko-table-reorder/normalize-reorder-command';

/** server-side Abilityが返す正規化結果。 */
type NormalizeReorderCommandResult = {
	command: string;
};

/**
 * Chat Reorder PoCのAbility入出力をブラウザConsoleへ記録する。
 *
 * 利用者入力とcompact Table contextを含むため、PoCの調査用途に限定し、外部送信や永続化は行わない。
 *
 * @param phase API境界で記録するrequest / response / error種別。
 * @param value 記録対象の未加工値。
 */
const logChatAiExchange = ( phase: 'request' | 'response' | 'error', value: unknown ): void => {
	// Chat Reorder PoCのAPI境界をブラウザ上で追跡できるよう、意図した診断ログだけを許可する。
	// eslint-disable-next-line no-console
	console.info( `[YTR Chat Reorder API] ${ phase }`, value );
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
		! ( 'command' in result ) ||
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
	const [ abilities, coreAbilities ] = await Promise.all( [
		import( /* webpackIgnore: true */ '@wordpress/abilities' ),
		import( /* webpackIgnore: true */ '@wordpress/core-abilities' ),
	] );

	await coreAbilities.ready;
	const request = {
		input,
		context: serializeChatReorderContext( context ),
	};
	logChatAiExchange( 'request', request );

	try {
		const result = await abilities.executeAbility( NORMALIZE_REORDER_COMMAND_ABILITY, request );
		logChatAiExchange( 'response', result );
		return getCommandText( result );
	} catch ( error ) {
		logChatAiExchange( 'error', error );
		throw error;
	}
};
