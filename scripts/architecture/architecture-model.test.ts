import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArchitectureMarkdown } from './architecture-model';

const markdown = `
## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_EDITOR | Editor | External System | 編集環境。 |

説明文は機械可読情報として扱わない。

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_INPUT | Input Interaction | 入力を扱う。 |
| RESP_DND | DnD Interaction | DnD を扱う。 |

### Relationships

| Source | Destination | Description |
| --- | --- | --- |
| EXT_EDITOR | RESP_INPUT | 入力を提供する。 |
| RESP_INPUT | RESP_DND | 開始試行を渡す。 |

### Responsibility Details

#### Input Interaction {#RESP_INPUT}

本文は読み取らない。

#### DnD Interaction {#RESP_DND}

本文は読み取らない。

## 6. Runtime View

### DnD start {#RV_DND_START}

| Step | Source | Target | Interaction |
| --- | --- | --- | --- |
| 2 | RESP_INPUT | RESP_DND | 開始試行を渡す。 |
| 1 | EXT_EDITOR | RESP_INPUT | 入力する。 |
`;

test( '固定見出しと表だけから Architecture Model を構築する', () => {
	const model = parseArchitectureMarkdown( markdown );

	assert.deepEqual( model.externalContexts, [
		{
			id: 'EXT_EDITOR',
			name: 'Editor',
			type: 'External System',
			summary: '編集環境。',
		},
	] );
	assert.deepEqual(
		model.responsibilities.map( ( responsibility ) => responsibility.id ),
		[ 'RESP_INPUT', 'RESP_DND' ]
	);
	assert.deepEqual( model.responsibilityDetails, [
		{ id: 'RESP_INPUT', name: 'Input Interaction' },
		{ id: 'RESP_DND', name: 'DnD Interaction' },
	] );
	assert.deepEqual(
		model.runtimeViews[ 0 ].steps.map( ( step ) => step.step ),
		[ 1, 2 ]
	);
} );

test( '説明文から Relationship を補完しない', () => {
	const model = parseArchitectureMarkdown(
		`${ markdown }\nRESP_DND から EXT_EDITOR へ通知する。\n`
	);

	assert.equal( model.relationships.length, 2 );
	assert.equal(
		model.relationships.some(
			( relationship ) =>
				relationship.source === 'RESP_DND' &&
				relationship.destination === 'EXT_EDITOR'
		),
		false
	);
} );
