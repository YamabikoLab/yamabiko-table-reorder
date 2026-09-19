/**
 * Chat ReorderのAbility実行境界が分類とCommand生成を1回のserver-side実行へまとめることを確認する。
 */

import { executeAbility } from '@wordpress/abilities';

import { requestChatModels, requestChatReorderCommand } from './ai-request';

jest.mock( '@wordpress/abilities', () => ( {
	executeAbility: jest.fn(),
} ) );

jest.mock( '@wordpress/core-abilities', () => ( {
	ready: Promise.resolve(),
} ) );

const executeAbilityMock = executeAbility as jest.MockedFunction< typeof executeAbility >;

describe( 'Chat Reorder Ability request', () => {
	beforeEach( () => {
		executeAbilityMock.mockReset();
	} );

	/**
	 * 今回入力と最小Table contextを1回だけ正規化Abilityへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの行数と列番号・labelだけがcontextとして与えられている。
	 *
	 * 操作:
	 * - 自然言語の並び替え依頼を送信する。
	 *
	 * 期待結果:
	 * - server-side Abilityは1回だけ実行される。
	 * - 入力には今回の利用者入力とcompact contextが含まれ、分類専用の追加実行は発生しない。
	 * - Abilityが返したCommand Textを未信頼入力としてそのまま返す。
	 */
	it( 'when a reorder request is submitted, should execute one normalization ability call', async () => {
		executeAbilityMock.mockResolvedValue( { command: 'column "価格" before #1' } );

		const result = await requestChatReorderCommand( '価格を1列目の前に移動して', {
			rowCount: 12,
			columns: [
				{ columnNumber: 1, label: '商品名' },
				{ columnNumber: 2, label: '価格' },
			],
		} );

		expect( result ).toBe( 'column "価格" before #1' );
		expect( executeAbilityMock ).toHaveBeenCalledTimes( 1 );
		expect( executeAbilityMock ).toHaveBeenCalledWith(
			'yamabiko-table-reorder/normalize-reorder-command',
			{
				input: '価格を1列目の前に移動して',
				context: 'R=12\nC=1:商品名,2:価格',
			}
		);
	} );

	/**
	 * 利用者がモデルを明示した場合に、そのidentityを正規化Abilityへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - Chat Reorderで利用可能なproviderとmodelが選択されている。
	 *
	 * 操作:
	 * - 選択モデルを指定して自然言語の並び替え依頼を送信する。
	 *
	 * 期待結果:
	 * - 正規化Abilityへproviderとmodel IDが渡される。
	 * - 自動選択ではなく、利用者が明示したモデルを実行対象として指定できる。
	 */
	it( 'when a chat model is selected, should pass the model identity to the normalization ability', async () => {
		executeAbilityMock.mockResolvedValue( { command: 'row 2 before 1' } );

		await requestChatReorderCommand(
			'2行目を1行目の前へ',
			{
				rowCount: 12,
				columns: [],
			},
			{ provider: 'provider-a', id: 'model-a' }
		);

		expect( executeAbilityMock ).toHaveBeenCalledWith(
			'yamabiko-table-reorder/normalize-reorder-command',
			{
				input: '2行目を1行目の前へ',
				context: 'R=12\nC=',
				model: { provider: 'provider-a', id: 'model-a' },
			}
		);
	} );

	/**
	 * Chat Reorderで利用可能なモデル一覧をserver-side Abilityから取得できることを確認する。
	 *
	 * 事前条件:
	 * - WordPress側が複数providerの利用可能モデルを返す。
	 *
	 * 操作:
	 * - Chat Reorderのモデル一覧を要求する。
	 *
	 * 期待結果:
	 * - モデル一覧用Abilityが実行される。
	 * - provider identityと表示名、model identityと表示名を保持した一覧が返る。
	 */
	it( 'when chat models are requested, should return the available model options', async () => {
		const models = [
			{ provider: 'provider-a', providerName: 'Provider A', id: 'model-a', name: 'Model A' },
			{ provider: 'provider-b', providerName: 'Provider B', id: 'model-b', name: 'Model B' },
		];
		executeAbilityMock.mockResolvedValue( { models } );

		await expect( requestChatModels() ).resolves.toEqual( models );
		expect( executeAbilityMock ).toHaveBeenCalledWith( 'yamabiko-table-reorder/get-chat-models' );
	} );

	/**
	 * Ability出力がRF Command Text契約を満たさない場合に拒否することを確認する。
	 *
	 * 事前条件:
	 * - server-side Abilityがcommand文字列を含まない応答を返す。
	 *
	 * 操作:
	 * - Chat Reorderから正規化を要求する。
	 *
	 * 期待結果:
	 * - 不正なAbility出力はCommand Textとして扱われず、呼び出し元へ失敗として返される。
	 */
	it( 'when the normalization ability output has no command text, should reject the output', async () => {
		executeAbilityMock.mockResolvedValue( {} );

		await expect(
			requestChatReorderCommand( '2行目を1行目の前へ', {
				rowCount: 12,
				columns: [],
			} )
		).rejects.toThrow( 'Invalid normalize reorder command ability output.' );
	} );
} );
