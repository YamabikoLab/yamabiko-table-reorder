/**
 * Chat ReorderのAbility実行境界が分類とCommand生成を1回のserver-side実行へまとめることを確認する。
 */

import { executeAbility } from '@wordpress/abilities';

import { requestChatReorderCommand } from './ai-request';

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
