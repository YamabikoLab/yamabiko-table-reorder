import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArchitectureModel } from './architecture-model';
import { validateArchitectureModel } from './architecture-validation';

const validModel = (): ArchitectureModel => ( {
	externalContexts: [
		{
			id: 'EXT_EDITOR',
			name: 'Editor',
			type: 'External System',
			summary: '編集環境。',
		},
	],
	responsibilities: [
		{
			id: 'RESP_INPUT',
			name: 'Input Interaction',
			summary: '入力を扱う。',
		},
	],
	dependencies: [
		{
			dependent: 'RESP_INPUT',
			dependsOn: 'EXT_EDITOR',
			reason: '編集環境を必要とする。',
		},
	],
	dependencyViews: [
		{
			id: 'DV_INPUT',
			name: 'Input',
			includes: [ 'EXT_EDITOR', 'RESP_INPUT' ],
		},
	],
	responsibilityDetails: [ { id: 'RESP_INPUT', name: 'Input Interaction' } ],
	runtimeViews: [
		{
			id: 'RV_INPUT',
			name: 'Input flow',
			steps: [
				{
					step: 1,
					source: 'EXT_EDITOR',
					target: 'RESP_INPUT',
					interaction: '入力を渡す。',
				},
			],
		},
	],
} );

test( '有効な Architecture Model を受理する', () => {
	assert.doesNotThrow( () => validateArchitectureModel( validModel() ) );
} );

test( 'ID の重複を ID が分かるエラーとして拒否する', () => {
	const model = validModel();
	model.runtimeViews[ 0 ].id = 'DV_INPUT';

	assert.throws( () => validateArchitectureModel( model ), /duplicate ID "DV_INPUT"/u );
} );

test( 'ID の種別 prefix が不正な場合を拒否する', () => {
	const model = validModel();
	model.responsibilities[ 0 ].id = 'EXT_INPUT';
	model.responsibilityDetails[ 0 ].id = 'EXT_INPUT';
	model.dependencies[ 0 ].dependent = 'EXT_INPUT';
	model.dependencyViews[ 0 ].includes[ 1 ] = 'EXT_INPUT';
	model.runtimeViews[ 0 ].steps[ 0 ].target = 'EXT_INPUT';

	assert.throws( () => validateArchitectureModel( model ), /must use the RESP_ prefix/u );
} );

test( 'Dependency の未解決 Dependent を項目名付きで拒否する', () => {
	const model = validModel();
	model.dependencies[ 0 ].dependent = 'RESP_UNKNOWN';

	assert.throws(
		() => validateArchitectureModel( model ),
		/Dependency row 1 Dependent "RESP_UNKNOWN"/u
	);
} );

test( 'Dependency の未解決 Depends on を項目名付きで拒否する', () => {
	const model = validModel();
	model.dependencies[ 0 ].dependsOn = 'RESP_UNKNOWN';

	assert.throws(
		() => validateArchitectureModel( model ),
		/Dependency row 1 Depends on "RESP_UNKNOWN"/u
	);
} );

test( 'Dependency の同一方向重複を拒否する', () => {
	const model = validModel();
	model.dependencies.push( { ...model.dependencies[ 0 ] } );

	assert.throws(
		() => validateArchitectureModel( model ),
		/duplicate Dependency RESP_INPUT -> EXT_EDITOR/u
	);
} );

test( 'Dependency View ID の prefix が不正な場合を拒否する', () => {
	const model = validModel();
	model.dependencyViews[ 0 ].id = 'VIEW_INPUT';

	assert.throws( () => validateArchitectureModel( model ), /must use the DV_ prefix/u );
} );

test( 'Dependency View ID の stable ID 形式が不正な場合を拒否する', () => {
	const model = validModel();
	model.dependencyViews[ 0 ].id = 'DV_INPUT-VIEW';

	assert.throws(
		() => validateArchitectureModel( model ),
		/must start with an ASCII letter and contain only ASCII letters, digits, and _/u
	);
} );

test( 'Dependency View ID の重複を拒否する', () => {
	const model = validModel();
	model.dependencyViews.push( {
		...model.dependencyViews[ 0 ],
		includes: [ ...model.dependencyViews[ 0 ].includes ],
	} );

	assert.throws( () => validateArchitectureModel( model ), /duplicate ID "DV_INPUT"/u );
} );

test( 'Dependency View Includes の未解決参照を拒否する', () => {
	const model = validModel();
	model.dependencyViews[ 0 ].includes.push( 'RESP_UNKNOWN' );

	assert.throws(
		() => validateArchitectureModel( model ),
		/Dependency View DV_INPUT Includes "RESP_UNKNOWN"/u
	);
} );

test( 'Responsibility Inventory に対応する責務詳細の欠落を拒否する', () => {
	const model = validModel();
	model.responsibilityDetails = [];

	assert.throws(
		() => validateArchitectureModel( model ),
		/Responsibility Details requires at least one responsibility/u
	);
} );

test( 'Runtime View の Step 欠番を scenario ID 付きで拒否する', () => {
	const model = validModel();
	model.runtimeViews[ 0 ].steps[ 0 ].step = 2;

	assert.throws(
		() => validateArchitectureModel( model ),
		/Runtime View RV_INPUT Step must start at 1 and increase without gaps/u
	);
} );

test( 'Runtime Step は Structural Dependency と逆方向でも受理する', () => {
	const model = validModel();
	model.runtimeViews[ 0 ].steps[ 0 ] = {
		step: 1,
		source: 'RESP_INPUT',
		target: 'EXT_EDITOR',
		interaction: '結果を通知する。',
	};

	assert.doesNotThrow( () => validateArchitectureModel( model ) );
} );
