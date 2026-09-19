/**
 * Chat ReorderからWordPress 7.0のserver-side Abilityを実行する境界を所有する。
 *
 * AI provider固有の通信や認証は所有せず、利用可能モデルの発見と自然言語入力の正規化をWordPress側へ委ねる。
 */

import { serializeChatReorderContext, type ChatReorderContext } from './context';

const CHAT_MODELS_ABILITY = 'yamabiko-table-reorder/get-chat-models';
const NORMALIZE_REORDER_COMMAND_ABILITY = 'yamabiko-table-reorder/normalize-reorder-command';

/** Chat Reorderで利用できるproviderとmodelの組み合わせ。 */
export type ChatModelOption = {
	provider: string;
	providerName: string;
	id: string;
	name: string;
};

/** Chat Reorderの1回の送信で明示するmodel identity。 */
export type ChatModelSelection = Pick< ChatModelOption, 'provider' | 'id' >;

/** server-side Abilityが返すモデル一覧。 */
type ChatModelsResult = {
	models: ChatModelOption[];
};

/** server-side Abilityが返す正規化結果。 */
type NormalizeReorderCommandResult = {
	command: string;
};

/** 正規化Abilityへ渡す入力。 */
type NormalizeReorderCommandRequest = {
	input: string;
	context: string;
	model?: ChatModelSelection;
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
 * WordPressのAbilities APIをChat Reorderから利用可能な状態で返す。
 *
 * @return 初期化済みのAbilities API module。
 */
const loadAbilities = async () => {
	const [ abilities, coreAbilities ] = await Promise.all( [
		import( /* webpackIgnore: true */ '@wordpress/abilities' ),
		import( /* webpackIgnore: true */ '@wordpress/core-abilities' ),
	] );
	await coreAbilities.ready;
	return abilities;
};

/**
 * Ability出力がChat Reorderのモデル選択肢契約を満たすか確認する。
 *
 * @param value 確認対象の未信頼値。
 * @return モデル選択肢として利用できる場合はtrue。
 */
const isChatModelOption = ( value: unknown ): value is ChatModelOption =>
	typeof value === 'object' &&
	value !== null &&
	'provider' in value &&
	typeof value.provider === 'string' &&
	'providerName' in value &&
	typeof value.providerName === 'string' &&
	'id' in value &&
	typeof value.id === 'string' &&
	'name' in value &&
	typeof value.name === 'string';

/**
 * Ability実行結果からChat Reorderで利用できるモデル一覧を取得する。
 *
 * @param result server-side Abilityの実行結果。
 * @return 現在のWordPress環境で利用できるモデル一覧。
 * @throws Ability出力が契約に一致しない場合。
 */
const getChatModels = ( result: unknown ): ChatModelOption[] => {
	if (
		typeof result !== 'object' ||
		result === null ||
		! ( 'models' in result ) ||
		! Array.isArray( ( result as ChatModelsResult ).models ) ||
		! ( result as ChatModelsResult ).models.every( isChatModelOption )
	) {
		throw new Error( 'Invalid chat models ability output.' );
	}

	return ( result as ChatModelsResult ).models;
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
 * 現在のWordPress環境でChat Reorderに利用できるAIモデルを取得する。
 *
 * @return WordPress AI Clientが利用可能と判定したモデル一覧。
 */
export const requestChatModels = async (): Promise< ChatModelOption[] > => {
	const abilities = await loadAbilities();
	const result = await abilities.executeAbility( CHAT_MODELS_ABILITY, {} );
	return getChatModels( result );
};

/**
 * 分類とRF Command生成を分割せず、WordPressのserver-side Abilityを1回だけ実行する。
 *
 * @param input   今回の利用者入力。
 * @param context 現在Tableの最小context。
 * @param model   利用者が明示したmodel。nullの場合はWordPress AI Clientの自動選択へ委ねる。
 * @return AIが返した未信頼の1行RF Command Text。
 */
export const requestChatReorderCommand = async (
	input: string,
	context: ChatReorderContext,
	model: ChatModelSelection | null = null
): Promise< string > => {
	const abilities = await loadAbilities();
	const request: NormalizeReorderCommandRequest = {
		input,
		context: serializeChatReorderContext( context ),
	};
	if ( model !== null ) {
		request.model = model;
	}
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
