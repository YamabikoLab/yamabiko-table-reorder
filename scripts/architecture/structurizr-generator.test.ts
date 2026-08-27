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
	relationships: [
		{
			source: 'EXT_EDITOR',
			destination: 'RESP_INPUT',
			description: '入力を提供する。',
		},
		{
			source: 'RESP_INPUT',
			destination: 'RESP_DND',
			description: '開始試行を渡す。',
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
	assert.match( first, /custom "ResponsibilityView"/u );
	assert.match( first, /custom "RV_DND_START"/u );
	assert.match( first, /"runtime\.steps" "1=REL_001;2=REL_002"/u );
	assert.match( first, /"runtime\.RV_DND_START\.step\.1" "入力する。"/u );
	assert.match(
		first,
		/EXT_EDITOR = element "Editor" "External System" "編集環境。"/u
	);
	assert.match(
		first,
		/RESP_INPUT = element "Input Interaction" "Responsibility" "入力を扱う。"/u
	);
} );

test( 'Runtime View だけに存在する Relationship を生成しない', () => {
	const invalidModel: ArchitectureModel = {
		...model,
		runtimeViews: [
			{
				id: 'RV_INVALID',
				name: 'Invalid runtime',
				steps: [
					{
						step: 1,
						source: 'RESP_DND',
						target: 'EXT_EDITOR',
						interaction: '未定義の関係。',
					},
				],
			},
		],
	};

	assert.throws(
		() => generateStructurizrDsl( invalidModel ),
		/resolve to exactly one explicit relationship/u
	);
} );
