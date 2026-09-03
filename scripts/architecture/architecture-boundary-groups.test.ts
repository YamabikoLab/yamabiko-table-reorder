import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArchitectureMarkdown, type ArchitectureModel } from './architecture-model';
import { validateArchitectureModel } from './architecture-validation';
import { generateStructurizrDsl } from './structurizr-generator';

const validModel = (): ArchitectureModel => ( {
	externalContexts: [
		{ id: 'EXT_EDITOR', name: 'Editor', type: 'External System', summary: 'Editor.' },
	],
	responsibilities: [
		{ id: 'RESP_INPUT', name: 'Input', summary: 'Input.' },
	],
	boundaries: [
		{ id: 'BOUNDARY_EXTERNAL', name: 'External', includes: [ 'EXT_EDITOR' ] },
		{ id: 'BOUNDARY_INTERNAL', name: 'Row Reorder', includes: [ 'RESP_INPUT' ] },
	],
	dependencies: [
		{ dependent: 'RESP_INPUT', dependsOn: 'EXT_EDITOR', reason: 'Needs editor input.' },
	],
	dependencyViews: [],
	processFlowViews: [],
	responsibilityDetails: [ { id: 'RESP_INPUT', name: 'Input' } ],
	runtimeViews: [
		{
			id: 'RV_INPUT',
			name: 'Input runtime',
			steps: [ { step: 1, source: 'EXT_EDITOR', target: 'RESP_INPUT', interaction: 'Input.' } ],
		},
	],
} );

test( 'Ownership Boundaries表だけを機械可読な境界として解析する', () => {
	const source = `
## 5. Building Block View

### Ownership Boundaries

| ID | Name | Includes |
| --- | --- | --- |
| BOUNDARY_ROW | Row Reorder | RESP_INPUT RESP_DND |
`;
	const model = parseArchitectureMarkdown( source );

	assert.deepEqual( model.boundaries, [
		{ id: 'BOUNDARY_ROW', name: 'Row Reorder', includes: [ 'RESP_INPUT', 'RESP_DND' ] },
	] );
} );

test( '外部要素と内部責務を同じ所有境界へ混在させない', () => {
	const model = validModel();
	model.boundaries = [
		{
			id: 'BOUNDARY_MIXED',
			name: 'Mixed',
			includes: [ 'EXT_EDITOR', 'RESP_INPUT' ],
		},
	];

	assert.throws(
		() => validateArchitectureModel( model ),
		/must not mix External Context and Responsibility elements/u
	);
} );

test( '同じ要素を複数の所有境界へ所属させない', () => {
	const model = validModel();
	model.boundaries.push( {
		id: 'BOUNDARY_OTHER',
		name: 'Other',
		includes: [ 'RESP_INPUT' ],
	} );

	assert.throws(
		() => validateArchitectureModel( model ),
		/may belong to at most one Ownership Boundary/u
	);
} );

test( '明示された所有境界だけをStructurizr groupとして生成する', () => {
	const model = validModel();
	validateArchitectureModel( model );
	const dsl = generateStructurizrDsl( model );

	assert.match( dsl, /group "External" \{/u );
	assert.match( dsl, /group "Row Reorder" \{/u );
	assert.match( dsl, /\t\t\tEXT_EDITOR = element "Editor"/u );
	assert.match( dsl, /\t\t\tRESP_INPUT = element "Input"/u );
} );
