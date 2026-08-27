import assert from 'node:assert/strict';
import test from 'node:test';

import { generateStructurizrDsl } from './structurizr-generator.mjs';

const model = {
	externalContexts: [
		{
			id: 'EXT_EDITOR',
			name: 'Editor',
			type: 'External System',
			summary: 'Provides input.',
		},
	],
	responsibilities: [
		{
			id: 'RESP_INPUT',
			name: 'Input',
			summary: 'Normalizes input.',
		},
		{
			id: 'RESP_DND',
			name: 'DnD',
			summary: 'Coordinates drag and drop.',
		},
	],
	relationships: [
		{
			source: 'EXT_EDITOR',
			destination: 'RESP_INPUT',
			description: 'Provides input.',
		},
		{
			source: 'RESP_INPUT',
			destination: 'RESP_DND',
			description: 'Passes a start attempt.',
		},
	],
	responsibilityDetails: [],
	runtimeViews: [
		{
			id: 'RV_START',
			name: 'Start attempt',
			steps: [
				{
					step: 1,
					source: 'EXT_EDITOR',
					target: 'RESP_INPUT',
					interaction: 'Provides input.',
				},
				{
					step: 2,
					source: 'RESP_INPUT',
					target: 'RESP_DND',
					interaction: 'Passes a start attempt.',
				},
			],
		},
	],
};

test( 'generates deterministic DSL from explicit architecture data', () => {
	const first = generateStructurizrDsl( model );
	const second = generateStructurizrDsl( model );

	assert.equal( first, second );
	assert.match( first, /!impliedRelationships false/u );
	assert.match( first, /EXT_EDITOR = element "Editor"/u );
	assert.match( first, /RESP_INPUT = element "Input"/u );
	assert.match( first, /custom "ResponsibilityView"/u );
	assert.match( first, /custom "RV_START"/u );
	assert.match( first, /"runtime\.RV_START\.step\.1" "Provides input\."/u );
	assert.match( first, /"runtime\.steps" "1=REL_001;2=REL_002"/u );

	const generatedRelationshipCount = [ ...first.matchAll( / = [A-Z_]+ -> [A-Z_]+ /gu ) ].length;
	assert.equal( generatedRelationshipCount, model.relationships.length );
} );

test( 'does not invent a relationship for a runtime-only interaction', () => {
	const modelWithRuntimeOnlyInteraction = {
		...model,
		runtimeViews: [
			{
				id: 'RV_INVALID',
				name: 'Invalid runtime',
				steps: [
					{
						step: 1,
						source: 'EXT_EDITOR',
						target: 'RESP_DND',
						interaction: 'Must remain undefined.',
					},
				],
			},
		],
	};

	assert.throws(
		() => generateStructurizrDsl( modelWithRuntimeOnlyInteraction ),
		/Runtime step RV_INVALID#1 must resolve to exactly one explicit relationship\./u
	);
} );
