import { readFile, writeFile } from 'node:fs/promises';

import { parseArchitectureMarkdown } from './architecture-model';
import { generateStructurizrDsl } from './structurizr-generator';

const generate = async (): Promise<void> => {
	const [ inputPath, outputPath ] = process.argv.slice( 2 );

	if ( inputPath === undefined || outputPath === undefined ) {
		throw new Error( 'Input and output paths are required.' );
	}

	const source = await readFile( inputPath, 'utf8' );
	const model = parseArchitectureMarkdown( source );
	const dsl = generateStructurizrDsl( model );
	await writeFile( outputPath, dsl, 'utf8' );
};

void generate();
