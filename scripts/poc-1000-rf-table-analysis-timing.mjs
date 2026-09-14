#!/usr/bin/env node

/**
 * Issue #1000の判断材料として、RF評価中に重複しているRow / Column Table解析へ
 * User Timing計測を一時注入・除去するPoCスクリプト。
 *
 * Production sourceへ計測コードを恒久的に残さず、手動検証時だけ同一の解析境界を
 * performance.measure()で観測できる状態にする。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MODE_APPLY = 'apply';
const MODE_REMOVE = 'remove';

const ROW_MEASURE_NAME = 'YTR #1000 Row Table Parse';
const COLUMN_MEASURE_NAME = 'YTR #1000 Column Table Parse';

const changes = [
	{
		path: 'src/reorder/row-reorder/responsibilities/table-integration.ts',
		original: '\treturn parseRowTable( block.name, body );',
		instrumented: [
			'\tconst analysisStart = performance.now();',
			'\tconst parsedTable = parseRowTable( block.name, body );',
			`\tperformance.measure( '${ ROW_MEASURE_NAME }', {`,
			'\t\tstart: analysisStart,',
			'\t\tend: performance.now(),',
			'\t} );',
			'\treturn parsedTable;',
		].join( '\n' ),
	},
	{
		path: 'src/reorder/column-reorder/responsibilities/table-integration.ts',
		original: '\tconst parsedTable = parseTable( block.name, block.attributes );',
		instrumented: [
			'\tconst analysisStart = performance.now();',
			'\tconst parsedTable = parseTable( block.name, block.attributes );',
			`\tperformance.measure( '${ COLUMN_MEASURE_NAME }', {`,
			'\t\tstart: analysisStart,',
			'\t\tend: performance.now(),',
			'\t} );',
		].join( '\n' ),
	},
];

const fail = ( message ) => {
	process.stderr.write( `${ message }\n` );
	process.exitCode = 1;
};

const replaceExactlyOnce = ( content, before, after, filePath ) => {
	const first = content.indexOf( before );
	const last = content.lastIndexOf( before );
	if ( first === -1 || first !== last ) {
		throw new Error( `${ filePath }: expected exactly one target occurrence.` );
	}
	return content.replace( before, after );
};

const applyChange = ( change, mode ) => {
	const filePath = resolve( process.cwd(), change.path );
	const content = readFileSync( filePath, 'utf8' );
	const before = mode === MODE_APPLY ? change.original : change.instrumented;
	const after = mode === MODE_APPLY ? change.instrumented : change.original;

	if ( content.includes( after ) && ! content.includes( before ) ) {
		return `${ change.path }: already ${ mode === MODE_APPLY ? 'instrumented' : 'restored' }`;
	}

	const updated = replaceExactlyOnce( content, before, after, change.path );
	writeFileSync( filePath, updated, 'utf8' );
	return `${ change.path }: ${ mode === MODE_APPLY ? 'instrumented' : 'restored' }`;
};

const printUsage = () => {
	process.stdout.write(
		[
			'Usage:',
			'  node scripts/poc-1000-rf-table-analysis-timing.mjs apply',
			'  node scripts/poc-1000-rf-table-analysis-timing.mjs remove',
			'',
			'Run from the repository root.',
		].join( '\n' ) + '\n'
	);
};

const printMeasurementGuide = () => {
	process.stdout.write(
		[
			'',
			'Build/start the plugin, open the editor, then before ONE RF input operation run:',
			`performance.clearMeasures('${ ROW_MEASURE_NAME }');`,
			`performance.clearMeasures('${ COLUMN_MEASURE_NAME }');`,
			'',
			'After the operation, inspect count and duration:',
			`performance.getEntriesByName('${ ROW_MEASURE_NAME }').map(({ duration }) => duration);`,
			`performance.getEntriesByName('${ COLUMN_MEASURE_NAME }').map(({ duration }) => duration);`,
			'',
			'Each array element is one full Table parse in milliseconds.',
			'The array length is the number of parses caused during the observed operation.',
			'Use Chrome DevTools Performance recording as well when correlation with the input event is needed.',
			'',
			'Restore the source after measurement:',
			'node scripts/poc-1000-rf-table-analysis-timing.mjs remove',
		].join( '\n' ) + '\n'
	);
};

const mode = process.argv[ 2 ];
if ( mode !== MODE_APPLY && mode !== MODE_REMOVE ) {
	printUsage();
	process.exitCode = 1;
} else {
	try {
		for ( const change of changes ) {
			process.stdout.write( `${ applyChange( change, mode ) }\n` );
		}
		if ( mode === MODE_APPLY ) {
			printMeasurementGuide();
		}
	} catch ( error ) {
		const message = error instanceof Error ? error.message : String( error );
		fail( message );
	}
}
