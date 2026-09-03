import MarkdownIt, { type Token } from 'markdown-it';

const markdown = new MarkdownIt();
const headingIdPattern = /^(.*?)\s+\{#([A-Za-z][A-Za-z0-9_]*)\}\s*$/u;
const processFlowHeadingPattern =
	/^(.*?)\s+\{#([A-Za-z][A-Za-z0-9_]*)\s+kind=([A-Za-z][A-Za-z0-9_-]*)\}\s*$/u;
const positiveIntegerPattern = /^\d+$/u;

const expectedHeaders = {
	externalContext: [ 'ID', 'Name', 'Type', 'Summary' ],
	processFlow: [ 'From', 'To', 'Kind', 'Meaning' ],
	responsibilityInventory: [ 'ID', 'Responsibility', 'Summary' ],
	ownershipBoundaries: [ 'ID', 'Name', 'Includes' ],
	dependencies: [ 'Dependent', 'Depends on', 'Reason' ],
	dependencyViews: [ 'ID', 'Name', 'Includes' ],
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

const parseTableColumn = (
	tokens: Token[],
	tableStartIndex: number,
	columnIndex: number
): string[] => {
	const values: string[] = [];
	let inBody = false;
	let currentColumnIndex = -1;
	let inCell = false;
	for ( let index = tableStartIndex + 1; index < tokens.length; index++ ) {
		const token = tokens[ index ];
		if ( token.type === 'tbody_open' ) {
			inBody = true;
			continue;
		}
		if ( token.type === 'tbody_close' || token.type === 'table_close' ) {
			break;
		}
		if ( ! inBody ) {
			continue;
		}
		if ( token.type === 'tr_open' ) {
			currentColumnIndex = -1;
			continue;
		}
		if ( token.type === 'td_open' ) {
			currentColumnIndex++;
			inCell = currentColumnIndex === columnIndex;
			continue;
		}
		if ( token.type === 'inline' && inCell ) {
			values.push( inlineText( token ) );
			continue;
		}
		if ( token.type === 'td_close' ) {
			inCell = false;
		}
	}
	return values;
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

const requirePositiveIntegerRuntimeSteps = (
	tokens: Token[],
	tableStartIndex: number,
	runtimeScenarioId: string
): void => {
	parseTableColumn( tokens, tableStartIndex, 0 ).forEach( ( step ) => {
		const stepNumber = Number.parseInt( step, 10 );
		if ( ! positiveIntegerPattern.test( step ) || stepNumber <= 0 ) {
			throw new Error(
				`Architecture validation failed: Runtime View ${ runtimeScenarioId } Step "${ step }" must be a positive integer.`
			);
		}
	} );
};

/**
 * 機械可読 Markdown に必要な見出しと表構造を検証する。
 * @param source
 */
export const validateArchitectureMarkdownStructure = ( source: string ): void => {
	const tokens = markdown.parse( source, {} );
	const headings = new Map< number, string >();
	const requiredHeadings = new Set< string >();
	let externalContextTable = false;
	let responsibilityInventoryTable = false;
	let ownershipBoundariesTable = false;
	let dependenciesTable = false;
	let dependencyViewsHeadingCount = 0;
	let dependencyViewsTableCount = 0;
	let dependenciesHeadingTokenIndex: number | null = null;
	let dependencyViewsHeadingTokenIndex: number | null = null;
	let dependencyViewsInBuildingBlockView = false;
	let responsibilityDetailsHeading = false;
	let processFlowViewsHeadingCount = 0;
	let processFlowViewsInSolutionStrategy = false;
	const processFlowHeadings = new Set< string >();
	const processFlowTables = new Set< string >();
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
			if ( level === 3 && headingText === 'Process Flow Views' ) {
				processFlowViewsHeadingCount++;
				processFlowViewsInSolutionStrategy ||= headings.get( 2 ) === '4. Solution Strategy';
			}
			if (
				level === 4 &&
				headings.get( 2 ) === '4. Solution Strategy' &&
				headings.get( 3 ) === 'Process Flow Views'
			) {
				const match = headingText.match( processFlowHeadingPattern );
				if ( match === null ) {
					throw new Error(
						`Architecture validation failed: Process Flow View heading "${ headingText }" requires an embedded process flow ID and kind.`
					);
				}
				processFlowHeadings.add( match[ 2 ] );
			}
			if ( level === 3 && headingText === 'Dependency Views' ) {
				dependencyViewsHeadingCount++;
				dependencyViewsHeadingTokenIndex ??= index;
				dependencyViewsInBuildingBlockView ||= headings.get( 2 ) === '5. Building Block View';
			}
			if ( level === 3 && headings.get( 2 ) === '5. Building Block View' ) {
				if ( headingText === 'Dependencies' ) {
					dependenciesHeadingTokenIndex = index;
				}
				if ( headingText === 'Responsibility Details' ) {
					responsibilityDetailsHeading = true;
				}
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
		const level4 = headings.get( 4 );
		const header = parseTableHeader( tokens, index );

		if ( level2 === '3. Context and Scope' && level3 === 'External Context' ) {
			requireExactHeader( header, expectedHeaders.externalContext, 'External Context' );
			externalContextTable = true;
			continue;
		}
		if (
			level2 === '4. Solution Strategy' &&
			level3 === 'Process Flow Views' &&
			level4 !== undefined
		) {
			const match = level4.match( processFlowHeadingPattern );
			if ( match !== null ) {
				requireExactHeader(
					header,
					expectedHeaders.processFlow,
					`Process Flow View ${ match[ 2 ] }`
				);
				processFlowTables.add( match[ 2 ] );
			}
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
		if ( level2 === '5. Building Block View' && level3 === 'Ownership Boundaries' ) {
			requireExactHeader( header, expectedHeaders.ownershipBoundaries, 'Ownership Boundaries' );
			ownershipBoundariesTable = true;
			continue;
		}
		if ( level2 === '5. Building Block View' && level3 === 'Dependencies' ) {
			requireExactHeader( header, expectedHeaders.dependencies, 'Dependencies' );
			dependenciesTable = true;
			continue;
		}
		if ( level2 === '5. Building Block View' && level3 === 'Dependency Views' ) {
			requireExactHeader( header, expectedHeaders.dependencyViews, 'Dependency Views' );
			dependencyViewsTableCount++;
			continue;
		}
		if ( level2 === '6. Runtime View' && level3 !== undefined ) {
			const match = level3.match( headingIdPattern );
			if ( match !== null ) {
				requireExactHeader( header, expectedHeaders.runtime, `Runtime View ${ match[ 2 ] }` );
				requirePositiveIntegerRuntimeSteps( tokens, index, match[ 2 ] );
				runtimeScenarioTables.add( match[ 2 ] );
			}
		}
	}

	[ '3. Context and Scope', '5. Building Block View', '6. Runtime View' ].forEach( ( heading ) => {
		if ( ! requiredHeadings.has( heading ) ) {
			throw new Error(
				`Architecture validation failed: required heading "${ heading }" is missing.`
			);
		}
	} );
	if ( ! externalContextTable ) {
		throw new Error( 'Architecture validation failed: External Context table is missing.' );
	}
	if ( ! responsibilityInventoryTable ) {
		throw new Error( 'Architecture validation failed: Responsibility Inventory table is missing.' );
	}
	if ( ! ownershipBoundariesTable ) {
		throw new Error( 'Architecture validation failed: Ownership Boundaries table is missing.' );
	}
	if ( ! dependenciesTable ) {
		throw new Error( 'Architecture validation failed: Dependencies table is missing.' );
	}
	if ( processFlowViewsHeadingCount > 1 ) {
		throw new Error(
			'Architecture validation failed: Process Flow Views heading may appear at most once.'
		);
	}
	if ( processFlowViewsHeadingCount === 1 && ! processFlowViewsInSolutionStrategy ) {
		throw new Error(
			'Architecture validation failed: Process Flow Views must appear under 4. Solution Strategy.'
		);
	}
	processFlowHeadings.forEach( ( id ) => {
		if ( ! processFlowTables.has( id ) ) {
			throw new Error(
				`Architecture validation failed: Process Flow View ${ id } table is missing.`
			);
		}
	} );
	if ( dependencyViewsHeadingCount > 1 ) {
		throw new Error(
			'Architecture validation failed: Dependency Views heading may appear at most once.'
		);
	}
	if ( dependencyViewsHeadingCount === 1 && ! dependencyViewsInBuildingBlockView ) {
		throw new Error(
			'Architecture validation failed: Dependency Views must appear immediately after Dependencies.'
		);
	}
	if ( dependencyViewsHeadingCount === 1 && dependencyViewsTableCount !== 1 ) {
		throw new Error( 'Architecture validation failed: Dependency Views table is missing.' );
	}
	if ( dependencyViewsHeadingTokenIndex !== null ) {
		if (
			dependenciesHeadingTokenIndex === null ||
			dependencyViewsHeadingTokenIndex < dependenciesHeadingTokenIndex
		) {
			throw new Error(
				'Architecture validation failed: Dependency Views must appear immediately after Dependencies.'
			);
		}
		const interveningHeading = tokens
			.slice( dependenciesHeadingTokenIndex + 3, dependencyViewsHeadingTokenIndex )
			.some( ( item ) => item.type === 'heading_open' && item.tag === 'h3' );
		if ( interveningHeading ) {
			throw new Error(
				'Architecture validation failed: Dependency Views must appear immediately after Dependencies.'
			);
		}
	}
	if ( ! responsibilityDetailsHeading ) {
		throw new Error( 'Architecture validation failed: Responsibility Details heading is missing.' );
	}
	if ( runtimeScenarioHeadings.size === 0 ) {
		throw new Error(
			'Architecture validation failed: Runtime View requires at least one scenario.'
		);
	}
	runtimeScenarioHeadings.forEach( ( id ) => {
		if ( ! runtimeScenarioTables.has( id ) ) {
			throw new Error( `Architecture validation failed: Runtime View ${ id } table is missing.` );
		}
	} );
};
