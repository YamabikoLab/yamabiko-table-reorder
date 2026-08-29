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
		{ id: 'RESP_DND', name: 'DnD Interaction', summary: 'DnDを扱う。' },
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
			kind: 'normal',
			edges: [
				{
					from: 'EXT_EDITOR',
					to: 'RESP_INPUT',
					kind: 'normal',
					meaning: '入力が処理へ進む。',
				},
				{
					from: 'RESP_INPUT',
					to: 'RESP_DND',
					kind: 'normal',
					meaning: '共通DnD処理へ進む。',
				},
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
	assert.match( first, /!impliedRelationships false/u );
	assert.match( first, /custom "DV_INPUT"/u );
	assert.match( first, /custom "PV_REORDER"/u );
	assert.match( first, /custom "RV_DND_START"/u );
	assert.match( first, /title "Structural Dependencies - Input"/u );
	assert.match( first, /title "Process Flow - Reorder"/u );
	assert.match( first, /title "Runtime - DnD start"/u );
	assert.match( first, /PF_001 = EXT_EDITOR -> RESP_INPUT "入力が処理へ進む。"/u );
	assert.match( first, /tags "Process Flow,ProcessFlow_PV_REORDER,normal"/u );
	assert.match( first, /relationship "normal" \{[\s\S]*style solid/u );
	assert.match( first, /"runtime\.steps" "1=RT_001;2=RT_002"/u );
	assert.match( first, /RESP_INPUT -> EXT_EDITOR "編集環境を必要とする。"/u );
	assert.match( first, /tags "Structural Dependency"/u );
	assert.match( first, /relationship "Structural Dependency" \{[\s\S]*style solid/u );
	assert.match( first, /EXT_EDITOR -> RESP_INPUT "入力する。"/u );
	assert.match( first, /tags "Runtime Interaction,Runtime_RV_DND_START"/u );
	assert.match( first, /relationship "Runtime Interaction" \{[\s\S]*style solid/u );
	assert.match( first, /EXT_EDITOR = element "Editor" "External System" "編集環境。"/u );
} );

test( 'Dependency View は Includes の要素だけを明示して Structural Dependency に限定する', () => {
	const dsl = generateStructurizrDsl( model );
	const view = dsl.slice(
		dsl.indexOf( 'custom "DV_INPUT"' ),
		dsl.indexOf( 'custom "PV_REORDER"' )
	);
	assert.match( view, /include EXT_EDITOR RESP_INPUT/u );
	assert.match( view, /exclude "relationship\.tag!=Structural Dependency"/u );
	assert.doesNotMatch( view, /RESP_DND/u );
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

test( 'Failure / Recovery Process Flow をタイトル・ラベル・線種で区別する', () => {
	const failureRecoveryModel: ArchitectureModel = {
		...model,
		processFlowViews: [
			{
				id: 'PV_FAILURE_RECOVERY',
				name: 'Failure and Recovery',
				kind: 'failure-recovery',
				edges: [
					{
						from: 'EXT_EDITOR',
						to: 'RESP_INPUT',
						kind: 'failure',
						meaning: '異常を合流させる。',
					},
					{
						from: 'RESP_INPUT',
						to: 'RESP_DND',
						kind: 'recovery',
						meaning: '一時状態を終了する。',
					},
				],
			},
		],
	};

	const dsl = generateStructurizrDsl( failureRecoveryModel );
	assert.match( dsl, /title "Process Flow \[Failure \/ Recovery\] - Failure and Recovery"/u );
	assert.match( dsl, /PF_001 = EXT_EDITOR -> RESP_INPUT "\[failure\] 異常を合流させる。"/u );
	assert.match( dsl, /PF_002 = RESP_INPUT -> RESP_DND "\[recovery\] 一時状態を終了する。"/u );
	assert.match( dsl, /tags "Process Flow,ProcessFlow_PV_FAILURE_RECOVERY,failure"/u );
	assert.match( dsl, /tags "Process Flow,ProcessFlow_PV_FAILURE_RECOVERY,recovery"/u );
	assert.match(
		dsl,
		/relationship "failure" \{[\s\S]*color #b42318[\s\S]*style dashed/u
	);
	assert.match(
		dsl,
		/relationship "recovery" \{[\s\S]*color #b54708[\s\S]*style dotted/u
	);
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

test( 'Process Flow Relationship は Structural Dependency と Runtime Interaction から独立して生成する', () => {
	const dsl = generateStructurizrDsl( model );
	assert.match( dsl, /RESP_INPUT -> EXT_EDITOR "編集環境を必要とする。"/u );
	assert.match( dsl, /EXT_EDITOR -> RESP_INPUT "入力が処理へ進む。"/u );
	assert.match( dsl, /EXT_EDITOR -> RESP_INPUT "入力する。"/u );
} );

test( '同一 Runtime Interaction を複数 View で共有する', () => {
	const sharedRuntimeModel: ArchitectureModel = {
		...model,
		runtimeViews: [
			{
				id: 'RV_FIRST',
				name: 'First',
				steps: [
					{
						step: 1,
						source: 'RESP_INPUT',
						target: 'RESP_DND',
						interaction: '開始試行を渡す。',
					},
				],
			},
			{
				id: 'RV_SECOND',
				name: 'Second',
				steps: [
					{
						step: 1,
						source: 'RESP_INPUT',
						target: 'RESP_DND',
						interaction: '開始試行を渡す。',
					},
				],
			},
		],
	};

	const dsl = generateStructurizrDsl( sharedRuntimeModel );
	assert.equal( dsl.match( /RESP_INPUT -> RESP_DND "開始試行を渡す。"/gu )?.length, 1 );
	assert.match( dsl, /tags "Runtime Interaction,Runtime_RV_FIRST,Runtime_RV_SECOND"/u );
	assert.match( dsl, /"runtime\.RV_FIRST\.step\.1" "開始試行を渡す。"/u );
	assert.match( dsl, /"runtime\.RV_SECOND\.step\.1" "開始試行を渡す。"/u );
	assert.match( dsl, /custom "RV_FIRST"[\s\S]*"runtime\.steps" "1=RT_001"/u );
	assert.match( dsl, /custom "RV_SECOND"[\s\S]*"runtime\.steps" "1=RT_001"/u );
} );

test( '同一 Process Flow Relationship を複数 View で共有する', () => {
	const sharedProcessFlowModel: ArchitectureModel = {
		...model,
		processFlowViews: [
			{
				id: 'PV_FIRST',
				name: 'First failure',
				kind: 'failure-recovery',
				edges: [
					{
						from: 'RESP_INPUT',
						to: 'RESP_DND',
						kind: 'recovery',
						meaning: '共通abortとして一時状態を終了する。',
					},
				],
			},
			{
				id: 'PV_SECOND',
				name: 'Second failure',
				kind: 'failure-recovery',
				edges: [
					{
						from: 'RESP_INPUT',
						to: 'RESP_DND',
						kind: 'recovery',
						meaning: '共通abortとして一時状態を終了する。',
					},
				],
			},
		],
	};

	const dsl = generateStructurizrDsl( sharedProcessFlowModel );
	assert.equal(
		dsl.match( /RESP_INPUT -> RESP_DND "\[recovery\] 共通abortとして一時状態を終了する。"/gu )
			?.length,
		1
	);
	assert.match(
		dsl,
		/tags "Process Flow,ProcessFlow_PV_FIRST,ProcessFlow_PV_SECOND,recovery"/u
	);
} );