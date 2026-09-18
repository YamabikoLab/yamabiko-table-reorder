import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArchitectureModel } from './architecture-model';
import { allowedExternalContextTypes } from './architecture-validation';
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
		{
			id: 'EXT_DND_ENGINE',
			name: 'DnD Engine',
			type: 'External Library',
			summary: 'DnD実行環境。',
		},
	],
	responsibilities: [
		{
			id: 'RESP_INPUT',
			name: 'Input Interaction',
			summary: '入力を扱う。',
		},
	],
	boundaries: [],
	dependencies: [],
	dependencyViews: [],
	processFlowViews: [],
	responsibilityDetails: [],
	runtimeViews: [],
};

test( 'Architecture 要素の5分類を tag と視覚スタイルへ反映する', () => {
	const dsl = generateStructurizrDsl( model );

	assert.match( dsl, /tags "Responsibility"/u );
	assert.match( dsl, /tags "External Context,External System"/u );
	assert.match( dsl, /tags "External Context,External Block"/u );
	assert.match( dsl, /tags "External Context,External Capability"/u );
	assert.match( dsl, /tags "External Context,External Environment"/u );
	assert.match( dsl, /tags "External Context,External Library"/u );
	assert.match( dsl, /element "Responsibility" \{[^}]*shape Box/u );
	assert.match( dsl, /element "External System" \{[^}]*shape RoundedBox/u );
	assert.match( dsl, /element "External Block" \{[^}]*shape Component/u );
	assert.match( dsl, /element "External Capability" \{[^}]*shape Hexagon/u );
	assert.match( dsl, /element "External Environment" \{[^}]*shape Box[^}]*border dashed/u );
	assert.match( dsl, /element "External Library" \{[^}]*shape Box[^}]*border dashed/u );
	assert.doesNotMatch( dsl, /element "External Context"/u );

	const generatedExternalTypes = [
		...dsl.matchAll( /element "(External (?:System|Block|Capability|Environment|Library))" \{/gu ),
	].map( ( match ) => match[ 1 ] );
	assert.deepEqual(
		new Set( generatedExternalTypes ),
		new Set( allowedExternalContextTypes )
	);
} );

test( 'Process Flow View がなくても Architecture 要素のスタイルを生成する', () => {
	const dsl = generateStructurizrDsl( model );

	assert.match( dsl, /styles \{/u );
	assert.match( dsl, /element "Responsibility"/u );
	assert.match( dsl, /element "External System"/u );
	assert.doesNotMatch( dsl, /relationship "normal" \{/u );
	assert.doesNotMatch( dsl, /relationship "failure" \{/u );
	assert.doesNotMatch( dsl, /relationship "recovery" \{/u );
} );
