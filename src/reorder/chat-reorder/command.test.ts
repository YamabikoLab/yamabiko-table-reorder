/**
 * Chat ReorderのAI出力が許可された1行Command grammarだけを通過することを確認する。
 */

import { parseChatReorderCommand } from './command';

describe( 'Chat Reorder command grammar', () => {
	/**
	 * Row / Column / askの許可形式を構造化Commandへ変換できることを確認する。
	 *
	 * 操作:
	 * - 行番号、列番号、列label混在、clarificationをそれぞれparseする。
	 *
	 * 期待結果:
	 * - 1-based指定とbefore / afterが意味を変えずに保持される。
	 */
	it( 'when an allowed one-line command is provided, should parse only its declared meaning', () => {
		expect( parseChatReorderCommand( 'row 2 before 5' ) ).toEqual( {
			status: 'parsed',
			command: { kind: 'row', sourceRowNumber: 2, position: 'before', targetRowNumber: 5 },
		} );
		expect( parseChatReorderCommand( 'column #2 after "在庫"' ) ).toEqual( {
			status: 'parsed',
			command: {
				kind: 'column',
				source: { kind: 'number', columnNumber: 2 },
				position: 'after',
				target: { kind: 'label', label: '在庫' },
			},
		} );
		expect( parseChatReorderCommand( 'ask "行か列か指定してください。"' ) ).toEqual( {
			status: 'parsed',
			command: { kind: 'ask', message: '行か列か指定してください。' },
		} );
	} );

	/**
	 * 許可Commandへ説明文や追加Commandを混在できないことを確認する。
	 *
	 * 操作:
	 * - 前後空白、複数行、未知Command、0-based相当の0指定をparseする。
	 *
	 * 期待結果:
	 * - すべてinvalidとなりRF入力へ進めるCommandを生成しない。
	 */
	it( 'when extra text or an unsupported command is provided, should reject the whole AI output', () => {
		for ( const value of [
			' row 2 before 5',
			'row 2 before 5\nrow 3 after 1',
			'move row 2 before 5',
			'row 0 before 5',
			'column #2 before price',
		] ) {
			expect( parseChatReorderCommand( value ) ).toEqual( { status: 'invalid' } );
		}
	} );
} );
