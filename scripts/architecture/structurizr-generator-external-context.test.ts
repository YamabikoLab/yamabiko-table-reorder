import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArchitectureModel } from './architecture-model';
import { generateStructurizrDsl } from './structurizr-generator';

const model: ArchitectureModel = {
	externalContexts: [
		{
			id: 'EXT_EDITOR',
			name: 'WordPress Editor',
			type: 'External System',
			summary: '編集環境。',
		},
		{
			id: 'EXT_BLOCK',
			name: 'Supported Table Block',
			type: 'External Block',
			summary: '対応Table Block。',
		},
		{
			id: 'EXT_UNDO',
			name: 'WordPress Undo',
			type: 'External Capability',
			summary: 'Undo能力。',
		},
		{
			id: 'EXT_SCROLL',
			name: 'Editor Scroll Area',
			type: 'External Environment',
			summary: 'スクロール領域。',
		},
	],
	responsibilities: [],
	dependencies: [],
	dependencyViews: [],
	processFlowViews: [],
	responsibilityDetails: [],
	runtimeViews: [],
};

test( 'External Context の Type を tag と視覚スタイルへ反映する', () => {
	const dsl = generateStructurizrDsl( model );

	assert.match( dsl, /tags "External Context,External System"/u );
	assert.match( dsl, /tags "External Context,External Block"/u );
	assert.match( dsl, /tags "External Context,External Capability"/u );
	assert.match( dsl, /tags "External Context,External Environment"/u );
	assert.match( dsl, /element "External System" \{[\s\S]*shape RoundedBox/u );
	assert.match( dsl, /element "External Block" \{[\s\S]*shape Component/u );
	assert.match( dsl, /element "External Capability" \{[\s\S]*shape Hexagon/u );
	assert.match(
		dsl,
		/element "External Environment" \{[\s\S]*shape Box[\s\S]*border dashed/u
	);
} );

test( 'Process Flow View がなくても External Context のスタイルを生成する', () => {
	const dsl = generateStructurizrDsl( model );

	assert.match( dsl, /styles \{/u );
	assert.match( dsl, /element "External Context"/u );
	assert.doesNotMatch( dsl, /ProcessFlowEdge_/u );
} );
