import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArchitectureModel } from './architecture-model';
import { generateStructurizrDsl } from './structurizr-generator';

const model: ArchitectureModel = {
	externalContexts: [
		{
			id: 'EXT_EDITOR',
			name: 'Editor',
			type: 'External System',
			summary: '編集環境。',
		},
	],
	responsibilities: [
		{ id: 'RESP_INPUT', name: 'Input Interaction', summary: '入力を扱う。' },
		{ id: 'RESP_DND', name: 'DnD Interaction', summary: 'DnD を扱う。' },
	],
	dependencies: [
		{
			dependent: 'RESP_INPUT',
			dependsOn: 'EXT_EDITOR',
			reason: '編集環境を必要とする。',
		},
		{
			dependent: 'RESP_DND',
			dependsOn: 'RESP_INPUT',
			reason: '入力境界を必要とする。',
		},
	],
	dependencyViews: [
		{
			id: 'DV_INPUT',
			name: 'Input',
			includes: [ 'EXT_EDITOR', 'RESP_INPUT' ],
		},
	],
	responsibilityDetails: [],
	runtimeViews: [
		{
			id: 'RV_DND_START',
			name: 'DnD start',
			steps: [
				{
					step: 1,
					source: 'EXT_EDITOR',
					target: 'RESP_INPUT',
					interaction: '入力する。',
				},
				{
					step: 2,
					source: 'RESP_INPUT',
					target: 'RESP_DND',
					interaction: '開始試行を渡す。',
				},
			],
		},
	],
};

test( '同一 Architecture Model から同一 DSL を生成する', () => {
	const first = generateStructurizrDsl( model );
	const second = generateStructurizrDsl( model );

	assert.equal( first, second );
	assert.match( first, /!impliedRelationships false/u );
	assert.match( first, /custom "DV_INPUT"/u );
	assert.match( first, /custom "RV_DND_START"/u );
	assert.match( first, /"runtime\.steps" "1=RT_RV_DND_START_001;2=RT_RV_DND_START_002"/u );
	assert.match( first, /RESP_INPUT -> EXT_EDITOR "編集環境を必要とする。"/u );
	assert.match( first, /tags "Structural Dependency"/u );
	assert.match( first, /EXT_EDITOR -> RESP_INPUT "入力する。"/u );
	assert.match( first, /tags "Runtime Interaction,Runtime_RV_DND_START"/u );
	assert.match( first, /EXT_EDITOR = element "Editor" "External System" "編集環境。"/u );
} );

test( 'Dependency View は Includes の要素だけを明示して Structural Dependency に限定する', () => {
	const dsl = generateStructurizrDsl( model );
	const view = dsl.slice( dsl.indexOf( 'custom "DV_INPUT"' ), dsl.indexOf( 'custom "RV_DND_START"' ) );

	assert.match( view, /include EXT_EDITOR RESP_INPUT/u );
	assert.match( view, /exclude "relationship\.tag!=Structural Dependency"/u );
	assert.doesNotMatch( view, /RESP_DND/u );
} );

test( 'Runtime Interaction は Structural Dependency と独立して生成する', () => {
	const reverseRuntimeModel: ArchitectureModel = {
		...model,
		runtimeViews: [
			{
				id: 'RV_REVERSE',
				name: 'Reverse runtime',
				steps: [
					{
						step: 1,
						source: 'EXT_EDITOR',
						target: 'RESP_INPUT',
						interaction: '依存方向とは逆向きに通知する。',
					},
				],
			},
		],
	};

	const dsl = generateStructurizrDsl( reverseRuntimeModel );
	assert.match( dsl, /RESP_INPUT -> EXT_EDITOR "編集環境を必要とする。"/u );
	assert.match( dsl, /EXT_EDITOR -> RESP_INPUT "依存方向とは逆向きに通知する。"/u );
} );
