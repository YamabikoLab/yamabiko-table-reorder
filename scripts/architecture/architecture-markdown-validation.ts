import MarkdownIt, { type Token } from 'markdown-it';

const markdown = new MarkdownIt();
const headingIdPattern = /^(.*?)\s+\{#([A-Za-z][A-Za-z0-9_]*)\}\s*$/u;

const expectedHeaders = {
	externalContext: [ 'ID', 'Name', 'Type', 'Summary' ],
	responsibilityInventory: [ 'ID', 'Responsibility', 'Summary' ],
	relationships: [ 'Source', 'Destination', 'Description' ],
	runtime: [ 'Step', 'Source', 'Target', 'Interaction' ],
} as const;

const inlineText = ( token: Token ): string => {
	if ( token.children === null || token.children === undefined ) {
		return token.content.trim();
	}

	return token.children
		.map( ( child ) => {
			if ( child.type === 'softbreak' || child.type === 'hardbreak' ) {
				return ' ';
			}
			return child.content;
		} )
		.join( '' )
		.trim();
};

const parseTableHeader = ( tokens: Token[], tableStartIndex: number ): string[] => {
	const header: string[] = [];
	let inHeader = false;
	let inCell = false;

	for ( let index = tableStartIndex + 1; index < tokens.length; index++ ) {
		const token = tokens[ index ];
		if ( token.type === 'thead_open' ) {
			inHeader = true;
			continue;
		}
		if ( token.type === 'thead_close' || token.type === 'table_close' ) {
			break;
		}
		if ( ! inHeader ) {
			continue;
		}
		if ( token.type === 'th_open' ) {
			inCell = true;
			continue;
		}
		if ( token.type === 'inline' && inCell ) {
			header.push( inlineText( token ) );
			continue;
		}
		if ( token.type === 'th_close' ) {
			inCell = false;
		}
	}

	return header;
};

const requireExactHeader = (
	actual: string[],
	expected: readonly string[],
	item: string
): void => {
	const exact =
		actual.length === expected.length &&
		actual.every( ( column, index ) => column === expected[ index ] );
	if ( ! exact ) {
		throw new Error(
			`Architecture validation failed: ${ item } table columns must be exactly: ${ expected.join(
				', '
			) }.`
		);
	}
};

/**
 * 機械可読 Markdown に必要な見出しと表構造が存在し、定義済みの列を持つことを検証する。
 * 欠落または誤った構造を自然文から補完せず、Architecture Model を構築する前に処理を停止する。
 *
 * @param source Architecture Markdown 全体。
 */
export const validateArchitectureMarkdownStructure = ( source: string ): void => {
	const tokens = markdown.parse( source, {} );
	const headings = new Map< number, string >();
	const requiredHeadings = new Set< string >();
	let externalContextTable = false;
	let responsibilityInventoryTable = false;
	let relationshipsTable = false;
	let responsibilityDetailsHeading = false;
	const runtimeScenarioHeadings = new Set< string >();
	const runtimeScenarioTables = new Set< string >();

	for ( let index = 0; index < tokens.length; index++ ) {
		const token = tokens[ index ];

		if ( token.type === 'heading_open' ) {
			const level = Number.parseInt( token.tag.slice( 1 ), 10 );
			const headingText = inlineText( tokens[ index + 1 ] );
			headings.set( level, headingText );
			for ( let deeper = level + 1; deeper <= 6; deeper++ ) {
				headings.delete( deeper );
			}

			if (
				level === 2 &&
				[ '3. Context and Scope', '5. Building Block View', '6. Runtime View' ].includes(
					headingText
				)
			) {
				requiredHeadings.add( headingText );
			}
			if (
				level === 3 &&
				headings.get( 2 ) === '5. Building Block View' &&
				headingText === 'Responsibility Details'
			) {
				responsibilityDetailsHeading = true;
			}
			if ( level === 3 && headings.get( 2 ) === '6. Runtime View' ) {
				const match = headingText.match( headingIdPattern );
				if ( match === null ) {
					throw new Error(
						`Architecture validation failed: Runtime View heading "${ headingText }" requires an embedded runtime ID.`
					);
				}
				runtimeScenarioHeadings.add( match[ 2 ] );
			}
			continue;
		}

		if ( token.type !== 'table_open' ) {
			continue;
		}

		const level2 = headings.get( 2 );
		const level3 = headings.get( 3 );
		const header = parseTableHeader( tokens, index );

		if ( level2 === '3. Context and Scope' && level3 === 'External Context' ) {
			requireExactHeader( header, expectedHeaders.externalContext, 'External Context' );
			externalContextTable = true;
			continue;
		}
		if ( level2 === '5. Building Block View' && level3 === 'Responsibility Inventory' ) {
			requireExactHeader(
				header,
				expectedHeaders.responsibilityInventory,
				'Responsibility Inventory'
			);
			responsibilityInventoryTable = true;
			continue;
		}
		if ( level2 === '5. Building Block View' && level3 === 'Relationships' ) {
			requireExactHeader( header, expectedHeaders.relationships, 'Relationships' );
			relationshipsTable = true;
			continue;
		}
		if ( level2 === '6. Runtime View' && level3 !== undefined ) {
			const match = level3.match( headingIdPattern );
			if ( match !== null ) {
				requireExactHeader( header, expectedHeaders.runtime, `Runtime View ${ match[ 2 ] }` );
				runtimeScenarioTables.add( match[ 2 ] );
			}
		}
	}

	[ '3. Context and Scope', '5. Building Block View', '6. Runtime View' ].forEach( ( heading ) => {
		if ( ! requiredHeadings.has( heading ) ) {
			throw new Error( `Architecture validation failed: required heading "${ heading }" is missing.` );
		}
	} );
	if ( ! externalContextTable ) {
		throw new Error( 'Architecture validation failed: External Context table is missing.' );
	}
	if ( ! responsibilityInventoryTable ) {
		throw new Error( 'Architecture validation failed: Responsibility Inventory table is missing.' );
	}
	if ( ! relationshipsTable ) {
		throw new Error( 'Architecture validation failed: Relationships table is missing.' );
	}
	if ( ! responsibilityDetailsHeading ) {
		throw new Error( 'Architecture validation failed: Responsibility Details heading is missing.' );
	}
	if ( runtimeScenarioHeadings.size === 0 ) {
		throw new Error( 'Architecture validation failed: Runtime View requires at least one scenario.' );
	}
	runtimeScenarioHeadings.forEach( ( id ) => {
		if ( ! runtimeScenarioTables.has( id ) ) {
			throw new Error( `Architecture validation failed: Runtime View ${ id } table is missing.` );
		}
	} );
};
