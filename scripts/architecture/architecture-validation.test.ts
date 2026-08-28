import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArchitectureModel } from './architecture-model';
import { validateArchitectureModel } from './architecture-validation';

const validModel = (): ArchitectureModel => ( {
	externalContexts: [ { id: 'EXT_EDITOR', name: 'Editor', type: 'External System', summary: '編集環境。' } ],
	responsibilities: [ { id: 'RESP_INPUT', name: 'Input Interaction', summary: '入力を扱う。' } ],
	dependencies: [ { dependent: 'RESP_INPUT', dependsOn: 'EXT_EDITOR', reason: '編集環境を必要とする。' } ],
	dependencyViews: [ { id: 'DV_INPUT', name: 'Input', includes: [ 'EXT_EDITOR', 'RESP_INPUT' ] } ],
	processFlowViews: [
		{
			id: 'PV_INPUT',
			name: 'Input flow',
			edges: [ { from: 'EXT_EDITOR', to: 'RESP_INPUT', meaning: '入力が処理へ進む。' } ],
		},
	],
	responsibilityDetails: [ { id: 'RESP_INPUT', name: 'Input Interaction' } ],
	runtimeViews: [
		{
			id: 'RV_INPUT',
			name: 'Input flow',
			steps: [ { step: 1, source: 'EXT_EDITOR', target: 'RESP_INPUT', interaction: '入力を渡す。' } ],
		},
	],
} );

test( '有効な Architecture Model を受理する', () => {
	assert.doesNotThrow( () => validateArchitectureModel( validModel() ) );
} );

test( 'Process Flow View ID の prefix が不正な場合を拒否する', () => {
	const model = validModel();
	model.processFlowViews[ 0 ].id = 'VIEW_INPUT';
	assert.throws( () => validateArchitectureModel( model ), /must use the PV_ prefix/u );
} );

test( 'Process Flow View の未解決 From を拒否する', () => {
	const model = validModel();
	model.processFlowViews[ 0 ].edges[ 0 ].from = 'RESP_UNKNOWN';
	assert.throws( () => validateArchitectureModel( model ), /From "RESP_UNKNOWN"/u );
} );

test( 'Process Flow View の未解決 To を拒否する', () => {
	const model = validModel();
	model.processFlowViews[ 0 ].edges[ 0 ].to = 'RESP_UNKNOWN';
	assert.throws( () => validateArchitectureModel( model ), /To "RESP_UNKNOWN"/u );
} );

test( 'Process Flow View の同一 From + To 重複を拒否する', () => {
	const model = validModel();
	model.processFlowViews[ 0 ].edges.push( { ...model.processFlowViews[ 0 ].edges[ 0 ] } );
	assert.throws(
		() => validateArchitectureModel( model ),
		/Process Flow View PV_INPUT contains duplicate edge EXT_EDITOR -> RESP_INPUT/u
	);
} );

test( 'Process Flow は Structural Dependency と逆方向でも受理する', () => {
	const model = validModel();
	model.processFlowViews[ 0 ].edges[ 0 ] = {
		from: 'RESP_INPUT',
		to: 'EXT_EDITOR',
		meaning: '処理が外部へ進む。',
	};
	assert.doesNotThrow( () => validateArchitectureModel( model ) );
} );

test( 'ID の重複を拒否する', () => {
	const model = validModel();
	model.processFlowViews[ 0 ].id = 'DV_INPUT';
	assert.throws( () => validateArchitectureModel( model ), /duplicate ID "DV_INPUT"/u );
} );

test( 'Dependency の未解決参照と重複を拒否する', () => {
	const model = validModel();
	model.dependencies[ 0 ].dependent = 'RESP_UNKNOWN';
	assert.throws( () => validateArchitectureModel( model ), /Dependency row 1 Dependent "RESP_UNKNOWN"/u );
} );

test( 'Runtime View の Step 欠番を拒否する', () => {
	const model = validModel();
	model.runtimeViews[ 0 ].steps[ 0 ].step = 2;
	assert.throws( () => validateArchitectureModel( model ), /Step must start at 1 and increase without gaps/u );
} );
