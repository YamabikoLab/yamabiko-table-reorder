import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { parseArchitectureMarkdown } from './architecture-model';
import { generateStructurizrDsl } from './structurizr-generator';

const resolveOutputPath = ( inputPath: string, outputPath?: string ): string => {
	if ( outputPath !== undefined ) {
		return outputPath;
	}

	const extension = extname( inputPath );
	const inputWithoutExtension =
		extension.length === 0 ? inputPath : inputPath.slice( 0, -extension.length );
	return `${ inputWithoutExtension }.dsl`;
};

const generate = async (): Promise< void > => {
	const [ inputPath, requestedOutputPath ] = process.argv.slice( 2 );

	if ( inputPath === undefined ) {
		throw new Error( 'Input Markdown path is required.' );
	}

	const outputPath = resolveOutputPath( inputPath, requestedOutputPath );
	const source = await readFile( inputPath, 'utf8' );
	const model = parseArchitectureMarkdown( source );
	const dsl = generateStructurizrDsl( model );
	await writeFile( outputPath, dsl, 'utf8' );
};

void generate();
