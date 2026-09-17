/**
 * Chat ReorderのAI Request境界が分類とCommand生成を1回のAI呼び出しへまとめることを確認する。
 */

import { requestChatReorderCommand } from './ai-request';

describe( 'Chat Reorder AI request', () => {
	/**
	 * 今回入力と最小Table contextを1回だけAI transportへ渡すことを確認する。
	 *
	 * 事前条件:
	 * - 対象Tableの行数と列番号・labelだけがcontextとして与えられている。
	 *
	 * 操作:
	 * - 自然言語の並び替え依頼を送信する。
	 *
	 * 期待結果:
	 * - AI transportは1回だけ呼ばれる。
	 * - requestには今回入力とcompact contextが含まれ、分類専用の追加呼び出しは発生しない。
	 */
	it( 'when a reorder request is submitted, should use one AI call for classification and command generation', async () => {
		const transport = jest.fn().mockResolvedValue( 'column "価格" before #1' );

		const result = await requestChatReorderCommand(
			'価格を1列目の前に移動して',
			{
				rowCount: 12,
				columns: [
					{ columnNumber: 1, label: '商品名' },
					{ columnNumber: 2, label: '価格' },
				],
			},
			transport
		);

		expect( result ).toBe( 'column "価格" before #1' );
		expect( transport ).toHaveBeenCalledTimes( 1 );
		expect( transport ).toHaveBeenCalledWith(
			expect.objectContaining( {
				input: '価格を1列目の前に移動して',
				context: 'R=12\nC=1:商品名,2:価格',
			} )
		);
	} );
} );
