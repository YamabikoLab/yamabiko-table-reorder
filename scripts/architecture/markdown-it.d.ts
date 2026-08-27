declare module 'markdown-it' {
	export type Token = {
		type: string;
		tag: string;
		content: string;
		children: Token[] | null;
	};

	export default class MarkdownIt {
		parse( source: string, env: Record< string, unknown > ): Token[];
	}
}
