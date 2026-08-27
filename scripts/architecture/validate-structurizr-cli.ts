import { validateStructurizrWorkspace } from './validate-structurizr';

const workspacePath = process.argv[ 2 ];
if ( workspacePath === undefined ) {
	throw new Error( 'Structurizr DSL path is required.' );
}

validateStructurizrWorkspace( workspacePath );
