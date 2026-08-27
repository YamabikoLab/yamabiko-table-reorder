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
	relationships: [
		{
			source: 'EXT_EDITOR',
			destination: 'RESP_INPUT',
			description: '入力を提供する。',
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
	model.runtimeViews[ 0 ].id = 'RESP_INPUT';

	assert.throws( () => validateArchitectureModel( model ), /duplicate ID "RESP_INPUT"/u );
} );

test( 'ID の種別 prefix が不正な場合を拒否する', () => {
	const model = validModel();
	model.responsibilities[ 0 ].id = 'EXT_INPUT';
	model.responsibilityDetails[ 0 ].id = 'EXT_INPUT';
	model.relationships[ 0 ].destination = 'EXT_INPUT';
	model.runtimeViews[ 0 ].steps[ 0 ].target = 'EXT_INPUT';

	assert.throws( () => validateArchitectureModel( model ), /must use the RESP_ prefix/u );
} );

test( 'Relationship の未解決参照を項目名付きで拒否する', () => {
	const model = validModel();
	model.relationships[ 0 ].destination = 'RESP_UNKNOWN';

	assert.throws(
		() => validateArchitectureModel( model ),
		/Relationship row 1 Destination "RESP_UNKNOWN"/u
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

test( 'Runtime Step が明示的 Relationship を参照しない場合を拒否する', () => {
	const model = validModel();
	model.relationships[ 0 ] = {
		source: 'RESP_INPUT',
		destination: 'EXT_EDITOR',
		description: '逆方向。',
	};

	assert.throws(
		() => validateArchitectureModel( model ),
		/Runtime View RV_INPUT Step 1 must resolve to exactly one explicit Relationship/u
	);
} );
