import { readFile, writeFile } from 'node:fs/promises';

import { parseArchitectureMarkdown } from './architecture-model.mjs';
import { generateStructurizrDsl } from './structurizr-generator.mjs';

const [ sourcePath, destinationPath ] = process.argv.slice( 2 );

if ( sourcePath === undefined || destinationPath === undefined ) {
	throw new Error(
		'Usage: node scripts/architecture/generate-structurizr.mjs <source.md> <destination.dsl>'
	);
}

const source = await readFile( sourcePath, 'utf8' );
const model = parseArchitectureMarkdown( source );
const dsl = generateStructurizrDsl( model );
await writeFile( destinationPath, dsl, 'utf8' );
