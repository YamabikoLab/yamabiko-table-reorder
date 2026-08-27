import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token';

export type ExternalContext = {
	id: string;
	name: string;
	type: string;
	summary: string;
};

export type Responsibility = {
	id: string;
	name: string;
	summary: string;
};

export type ArchitectureRelationship = {
	source: string;
	destination: string;
	description: string;
};

export type ResponsibilityDetail = {
	id: string | null;
	name: string;
};

export type RuntimeStep = {
	step: number;
	source: string;
	target: string;
	interaction: string;
};

export type RuntimeView = {
	id: string;
	name: string;
	steps: RuntimeStep[];
};

export type ArchitectureModel = {
	externalContexts: ExternalContext[];
	responsibilities: Responsibility[];
	relationships: ArchitectureRelationship[];
	responsibilityDetails: ResponsibilityDetail[];
	runtimeViews: RuntimeView[];
};

type ParsedHeading = {
	title: string;
	id: string | null;
};

type ParsedTable = {
	header: string[];
	bodyRows: string[][];
	endIndex: number;
};

const markdown = new MarkdownIt();
const headingIdPattern = /^(.*?)\s+\{#([A-Za-z][A-Za-z0-9_]*)\}\s*$/u;

const machineReadableTables = {
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

const parseHeading = ( inlineToken: Token ): ParsedHeading => {
	const text = inlineText( inlineToken );
	const match = text.match( headingIdPattern );

	if ( match === null ) {
		return { title: text, id: null };
	}

	return {
		title: match[ 1 ].trim(),
		id: match[ 2 ],
	};
};

const parseTable = ( tokens: Token[], tableStartIndex: number ): ParsedTable => {
	const rows: string[][] = [];
	let currentRow: string[] | null = null;
	let currentCell: string | null = null;
	let index = tableStartIndex + 1;

	for ( ; index < tokens.length; index++ ) {
		const token = tokens[ index ];

		if ( token.type === 'table_close' ) {
			break;
		}

		if ( token.type === 'tr_open' ) {
			currentRow = [];
			continue;
		}

		if ( token.type === 'tr_close' ) {
			if ( currentRow !== null ) {
				rows.push( currentRow );
			}
			currentRow = null;
			continue;
		}

		if ( token.type === 'th_open' || token.type === 'td_open' ) {
			currentCell = '';
			continue;
		}

		if ( token.type === 'inline' && currentCell !== null ) {
			currentCell += inlineText( token );
			continue;
		}

		if ( token.type === 'th_close' || token.type === 'td_close' ) {
			if ( currentRow !== null && currentCell !== null ) {
				currentRow.push( currentCell.trim() );
			}
			currentCell = null;
		}
	}

	const [ header = [], ...bodyRows ] = rows;
	return { header, bodyRows, endIndex: index };
};

const hasExactHeader = (
	table: ParsedTable,
	expectedHeader: readonly string[]
): boolean => {
	const sameLength = table.header.length === expectedHeader.length;
	const sameColumns = table.header.every(
		( column, index ) => column === expectedHeader[ index ]
	);
	return sameLength && sameColumns;
};

const rowsAsRecords = ( table: ParsedTable ): Array<Record<string, string>> =>
	table.bodyRows.map( ( row ) =>
		Object.fromEntries(
			table.header.map( ( column, index ) => [ column, row[ index ] ?? '' ] )
		)
	);

/**
 * 固定された機械可読 Markdown から、Structurizr 生成に必要な設計情報だけを抽出する。
 * 説明文や責務詳細本文は設計情報として解釈せず、定義済みの見出しと表だけを入力とする。
 *
 * @param source Architecture Markdown 全体。
 * @return Architecture Model。
 */
export const parseArchitectureMarkdown = ( source: string ): ArchitectureModel => {
	const tokens = markdown.parse( source, {} );
	const headings = new Map<number, ParsedHeading>();
	const model: ArchitectureModel = {
		externalContexts: [],
		responsibilities: [],
		relationships: [],
		responsibilityDetails: [],
		runtimeViews: [],
	};

	for ( let index = 0; index < tokens.length; index++ ) {
		const token = tokens[ index ];

		if ( token.type === 'heading_open' ) {
			const level = Number.parseInt( token.tag.slice( 1 ), 10 );
			const heading = parseHeading( tokens[ index + 1 ] );
			headings.set( level, heading );

			for ( let deeperLevel = level + 1; deeperLevel <= 6; deeperLevel++ ) {
				headings.delete( deeperLevel );
			}

			const buildingBlockSection = headings.get( 2 )?.title === '5. Building Block View';
			const responsibilityDetailsSection =
				headings.get( 3 )?.title === 'Responsibility Details';
			const isResponsibilityDetail =
				level === 4 && buildingBlockSection && responsibilityDetailsSection;

			if ( isResponsibilityDetail ) {
				model.responsibilityDetails.push( {
					id: heading.id,
					name: heading.title,
				} );
			}
			continue;
		}

		if ( token.type !== 'table_open' ) {
			continue;
		}

		const table = parseTable( tokens, index );
		index = table.endIndex;
		const level2 = headings.get( 2 )?.title;
		const level3 = headings.get( 3 );

		if (
			level2 === '3. Context and Scope' &&
			level3?.title === 'External Context' &&
			hasExactHeader( table, machineReadableTables.externalContext )
		) {
			model.externalContexts = rowsAsRecords( table ).map( ( row ) => ( {
				id: row.ID,
				name: row.Name,
				type: row.Type,
				summary: row.Summary,
			} ) );
			continue;
		}

		if (
			level2 === '5. Building Block View' &&
			level3?.title === 'Responsibility Inventory' &&
			hasExactHeader( table, machineReadableTables.responsibilityInventory )
		) {
			model.responsibilities = rowsAsRecords( table ).map( ( row ) => ( {
				id: row.ID,
				name: row.Responsibility,
				summary: row.Summary,
			} ) );
			continue;
		}

		if (
			level2 === '5. Building Block View' &&
			level3?.title === 'Relationships' &&
			hasExactHeader( table, machineReadableTables.relationships )
		) {
			model.relationships = rowsAsRecords( table ).map( ( row ) => ( {
				source: row.Source,
				destination: row.Destination,
				description: row.Description,
			} ) );
			continue;
		}

		if (
			level2 === '6. Runtime View' &&
			level3?.id !== null &&
			level3?.id !== undefined &&
			hasExactHeader( table, machineReadableTables.runtime )
		) {
			model.runtimeViews.push( {
				id: level3.id,
				name: level3.title,
				steps: rowsAsRecords( table )
					.map( ( row ) => ( {
						step: Number.parseInt( row.Step, 10 ),
						source: row.Source,
						target: row.Target,
						interaction: row.Interaction,
					} ) )
					.sort( ( first, second ) => first.step - second.step ),
			} );
		}
	}

	return model;
};
