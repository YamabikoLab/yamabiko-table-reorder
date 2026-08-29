import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArchitectureMarkdown } from './architecture-model';

const markdown = `
## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_EDITOR | Editor | External System | 編集環境。 |

## 4. Solution Strategy

### Process Flow Views

#### Reorder flow {#PV_REORDER kind=failure-recovery}

主要フロー。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_EDITOR | RESP_INPUT | failure | 入力が処理へ進む。 |
| RESP_INPUT | RESP_DND | recovery | 共通DnD処理へ進む。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_INPUT | Input Interaction | 入力を扱う。 |
| RESP_DND | DnD Interaction | DnDを扱う。 |

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_INPUT | EXT_EDITOR | 編集環境を必要とする。 |
| RESP_DND | RESP_INPUT | 入力境界を必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_INPUT | Input | EXT_EDITOR RESP_INPUT |
| DV_DND | DnD | RESP_INPUT RESP_DND |

### Responsibility Details

#### Input Interaction {#RESP_INPUT}

本文は読み取らない。

#### DnD Interaction {#RESP_DND}

本文は読み取らない。

## 6. Runtime View

### DnD start {#RV_DND_START}

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 2 | RESP_INPUT | RESP_DND | 開始試行を渡す。 |
| 1 | EXT_EDITOR | RESP_INPUT | 入力する。 |
`;

test( '固定見出しと表だけから Architecture Model を構築する', () => {
	const model = parseArchitectureMarkdown( markdown );

	assert.deepEqual( model.processFlowViews, [
		{
			id: 'PV_REORDER',
			name: 'Reorder flow',
			kind: 'failure-recovery',
			edges: [
				{
					from: 'EXT_EDITOR',
					to: 'RESP_INPUT',
					kind: 'failure',
					meaning: '入力が処理へ進む。',
				},
				{
					from: 'RESP_INPUT',
					to: 'RESP_DND',
					kind: 'recovery',
					meaning: '共通DnD処理へ進む。',
				},
			],
		},
	] );
	assert.deepEqual(
		model.externalContexts.map( ( item ) => item.id ),
		[ 'EXT_EDITOR' ]
	);
	assert.deepEqual(
		model.responsibilities.map( ( item ) => item.id ),
		[ 'RESP_INPUT', 'RESP_DND' ]
	);
	assert.deepEqual( model.dependencies, [
		{ dependent: 'RESP_INPUT', dependsOn: 'EXT_EDITOR', reason: '編集環境を必要とする。' },
		{ dependent: 'RESP_DND', dependsOn: 'RESP_INPUT', reason: '入力境界を必要とする。' },
	] );
	assert.deepEqual( model.dependencyViews, [
		{ id: 'DV_INPUT', name: 'Input', includes: [ 'EXT_EDITOR', 'RESP_INPUT' ] },
		{ id: 'DV_DND', name: 'DnD', includes: [ 'RESP_INPUT', 'RESP_DND' ] },
	] );
	assert.deepEqual( model.responsibilityDetails, [
		{ id: 'RESP_INPUT', name: 'Input Interaction' },
		{ id: 'RESP_DND', name: 'DnD Interaction' },
	] );
	assert.deepEqual(
		model.runtimeViews[ 0 ].steps.map( ( step ) => step.step ),
		[ 1, 2 ]
	);
} );

test( '説明文から Process Flow や Dependency を補完しない', () => {
	const model = parseArchitectureMarkdown(
		`${ markdown }\nRESP_DNDからEXT_EDITORへ処理が進み、RESP_DNDはEXT_EDITORに依存する。\n`
	);

	assert.equal( model.processFlowViews[ 0 ].edges.length, 2 );
	assert.equal( model.dependencies.length, 2 );
} );
