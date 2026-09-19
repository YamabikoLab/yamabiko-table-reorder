/**
 * Chat ReorderのAI出力として許可する1行Command Textの型とstrict parseを所有する。
 *
 * この責務は構文だけを判定し、現在Tableに対する成立性、並び替え制約、no-op、Apply可否は判定しない。
 */

/** Column Commandで利用できる列指定。 */
export type ChatColumnSelector =
	| { kind: 'number'; columnNumber: number }
	| { kind: 'label'; label: string };

/** Strict parserが受理するChat Reorder Command。 */
export type ChatReorderCommand =
	| {
			kind: 'row';
			sourceRowNumber: number;
			position: 'before' | 'after';
			targetRowNumber: number;
	  }
	| {
			kind: 'column';
			source: ChatColumnSelector;
			position: 'before' | 'after';
			target: ChatColumnSelector;
	  }
	| { kind: 'ask'; message: string };

/** Command Textが許可grammarに一致しないことを表す。 */
export type ChatReorderCommandParseResult =
	| { status: 'parsed'; command: ChatReorderCommand }
	| { status: 'invalid' };

const POSITIVE_INTEGER_PATTERN = '[1-9]\\d*';
const QUOTED_TEXT_PATTERN = '"(?:[^"\\\\]|\\\\.)+"';
const COLUMN_SELECTOR_PATTERN = `(?:#${ POSITIVE_INTEGER_PATTERN }|${ QUOTED_TEXT_PATTERN })`;
const ROW_COMMAND_PATTERN = new RegExp(
	`^row (${ POSITIVE_INTEGER_PATTERN }) (before|after) (${ POSITIVE_INTEGER_PATTERN })$`
);
const COLUMN_COMMAND_PATTERN = new RegExp(
	`^column (${ COLUMN_SELECTOR_PATTERN }) (before|after) (${ COLUMN_SELECTOR_PATTERN })$`
);
const ASK_COMMAND_PATTERN = new RegExp( `^ask (${ QUOTED_TEXT_PATTERN })$` );

/**
 * 引用済みCommand文字列を通常文字列へ変換する。
 *
 * @param value JSON文字列と同じ引用規則を使うCommand token。
 * @return 復号できた文字列。復号不能または空文字列の場合はnull。
 */
const parseQuotedText = ( value: string ): string | null => {
	try {
		const parsed = JSON.parse( value ) as unknown;
		if ( typeof parsed !== 'string' || parsed.trim() === '' || /[\r\n]/.test( parsed ) ) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
};

/**
 * Column selector tokenを列番号または列labelへ変換する。
 *
 * @param value Column Command内のselector token。
 * @return 構文上成立するselector。成立しない場合はnull。
 */
const parseColumnSelector = ( value: string ): ChatColumnSelector | null => {
	if ( value.startsWith( '#' ) ) {
		const columnNumber = Number( value.slice( 1 ) );
		if ( ! Number.isSafeInteger( columnNumber ) || columnNumber < 1 ) {
			return null;
		}
		return { kind: 'number', columnNumber };
	}

	const label = parseQuotedText( value );
	if ( label === null ) {
		return null;
	}
	return { kind: 'label', label };
};

/**
 * AIが返した1行Command Textを許可grammarへstrictに照合する。
 *
 * 前後空白、複数行、説明文、複数Command、未知Commandは受理しない。
 *
 * @param text AIから受け取った未信頼Command Text。
 * @return 構文上成立するCommand、またはinvalid。
 */
export const parseChatReorderCommand = ( text: string ): ChatReorderCommandParseResult => {
	if ( text === '' || text.trim() !== text || /[\r\n]/.test( text ) ) {
		return { status: 'invalid' };
	}

	const rowMatch = ROW_COMMAND_PATTERN.exec( text );
	if ( rowMatch !== null ) {
		const sourceRowNumber = Number( rowMatch[ 1 ] );
		const targetRowNumber = Number( rowMatch[ 3 ] );
		if ( ! Number.isSafeInteger( sourceRowNumber ) || ! Number.isSafeInteger( targetRowNumber ) ) {
			return { status: 'invalid' };
		}
		return {
			status: 'parsed',
			command: {
				kind: 'row',
				sourceRowNumber,
				position: rowMatch[ 2 ] as 'before' | 'after',
				targetRowNumber,
			},
		};
	}

	const columnMatch = COLUMN_COMMAND_PATTERN.exec( text );
	if ( columnMatch !== null ) {
		const source = parseColumnSelector( columnMatch[ 1 ] );
		const target = parseColumnSelector( columnMatch[ 3 ] );
		if ( source === null || target === null ) {
			return { status: 'invalid' };
		}
		return {
			status: 'parsed',
			command: {
				kind: 'column',
				source,
				position: columnMatch[ 2 ] as 'before' | 'after',
				target,
			},
		};
	}

	const askMatch = ASK_COMMAND_PATTERN.exec( text );
	if ( askMatch !== null ) {
		const message = parseQuotedText( askMatch[ 1 ] );
		if ( message !== null ) {
			return { status: 'parsed', command: { kind: 'ask', message } };
		}
	}

	return { status: 'invalid' };
};
