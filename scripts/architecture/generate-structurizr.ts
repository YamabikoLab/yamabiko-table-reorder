import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { validateArchitectureMarkdownStructure } from './architecture-markdown-validation';
import { parseArchitectureMarkdown } from './architecture-model';
import { validateArchitectureModel } from './architecture-validation';
import { generateStructurizrDsl } from './structurizr-generator';
import { validateStructurizrWorkspace } from './validate-structurizr';

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
	const validationOutputPath = `${ outputPath }.validation.dsl`;
	const source = await readFile( inputPath, 'utf8' );
	validateArchitectureMarkdownStructure( source );
	const model = parseArchitectureMarkdown( source );
	validateArchitectureModel( model );
	const dsl = generateStructurizrDsl( model );

	await writeFile( validationOutputPath, dsl, 'utf8' );
	try {
		validateStructurizrWorkspace( validationOutputPath );
		await rename( validationOutputPath, outputPath );
	} catch ( error ) {
		await rm( validationOutputPath, { force: true } );
		throw error;
	}
};

void generate();
