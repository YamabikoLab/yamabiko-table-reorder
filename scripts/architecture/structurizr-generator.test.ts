import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArchitectureModel } from './architecture-model';
import { generateStructurizrDsl } from './structurizr-generator';

const model: ArchitectureModel = {
	externalContexts: [
		{ id: 'EXT_EDITOR', name: 'Editor', type: 'External System', summary: '編集環境。' },
	],
	responsibilities: [
		{ id: 'RESP_INPUT', name: 'Input Interaction', summary: '入力を扱う。' },
		{ id: 'RESP_DND', name: 'DnD Interaction', summary: 'DnD を扱う。' },
	],
	dependencies: [
		{ dependent: 'RESP_INPUT', dependsOn: 'EXT_EDITOR', reason: '編集環境を必要とする。' },
		{ dependent: 'RESP_DND', dependsOn: 'RESP_INPUT', reason: '入力境界を必要とする。' },
	],
	dependencyViews: [ { id: 'DV_INPUT', name: 'Input', includes: [ 'EXT_EDITOR', 'RESP_INPUT' ] } ],
	processFlowViews: [
		{
			id: 'PV_REORDER',
			name: 'Reorder',
			edges: [
				{ from: 'EXT_EDITOR', to: 'RESP_INPUT', meaning: '入力が処理へ進む。' },
				{ from: 'RESP_INPUT', to: 'RESP_DND', meaning: '共通 DnD 処理へ進む。' },
			],
		},
	],
	responsibilityDetails: [],
	runtimeViews: [
		{
			id: 'RV_DND_START',
			name: 'DnD start',
			steps: [
				{ step: 1, source: 'EXT_EDITOR', target: 'RESP_INPUT', interaction: '入力する。' },
				{ step: 2, source: 'RESP_INPUT', target: 'RESP_DND', interaction: '開始試行を渡す。' },
			],
		},
	],
};

test( '同一 Architecture Model から同一 DSL を生成する', () => {
	const first = generateStructurizrDsl( model );
	assert.equal( first, generateStructurizrDsl( model ) );
	assert.match( first, /custom "DV_INPUT"/u );
	assert.match( first, /custom "PV_REORDER"/u );
	assert.match( first, /custom "RV_DND_START"/u );
	assert.match( first, /title "Process Flow - Reorder"/u );
	assert.match( first, /PF_001 = EXT_EDITOR -> RESP_INPUT "入力が処理へ進む。"/u );
	assert.match( first, /tags "Process Flow,ProcessFlow_PV_REORDER"/u );
	assert.match( first, /"runtime\.steps" "1=RT_001;2=RT_002"/u );
} );

test( 'Process Flow View は Process Flow Relationship だけを表示する', () => {
	const dsl = generateStructurizrDsl( model );
	const view = dsl.slice(
		dsl.indexOf( 'custom "PV_REORDER"' ),
		dsl.indexOf( 'custom "RV_DND_START"' )
	);
	assert.match( view, /include EXT_EDITOR RESP_INPUT RESP_DND/u );
	assert.match( view, /exclude "relationship\.tag!=ProcessFlow_PV_REORDER"/u );
	assert.doesNotMatch( view, /Structural Dependency/u );
	assert.doesNotMatch( view, /Runtime Interaction/u );
} );

test( 'Process Flow Relationship は Structural Dependency と Runtime Interaction から独立して生成する', () => {
	const dsl = generateStructurizrDsl( model );
	assert.match( dsl, /RESP_INPUT -> EXT_EDITOR "編集環境を必要とする。"/u );
	assert.match( dsl, /EXT_EDITOR -> RESP_INPUT "入力が処理へ進む。"/u );
	assert.match( dsl, /EXT_EDITOR -> RESP_INPUT "入力する。"/u );
} );
