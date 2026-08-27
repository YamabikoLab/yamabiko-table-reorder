import assert from 'node:assert/strict';
import test from 'node:test';

import { validateArchitectureMarkdownStructure } from './architecture-markdown-validation';

const validMarkdown = `
## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_EDITOR | Editor | External System | 編集環境。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_INPUT | Input Interaction | 入力を扱う。 |

### Relationships

| Source | Destination | Description |
| --- | --- | --- |
| EXT_EDITOR | RESP_INPUT | 入力を提供する。 |

### Responsibility Details

#### Input Interaction {#RESP_INPUT}

## 6. Runtime View

### Input flow {#RV_INPUT}

シナリオ説明。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_EDITOR | RESP_INPUT | 入力を渡す。 |
`;

test( '必須見出しと表構造を受理する', () => {
	assert.doesNotThrow( () => validateArchitectureMarkdownStructure( validMarkdown ) );
} );

test( '必須見出しの欠落を拒否する', () => {
	const markdown = validMarkdown.replace( '## 3. Context and Scope', '## Context' );

	assert.throws(
		() => validateArchitectureMarkdownStructure( markdown ),
		/required heading "3\. Context and Scope" is missing/u
	);
} );

test( '機械可読表の列違いを項目名付きで拒否する', () => {
	const markdown = validMarkdown.replace(
		'| ID | Name | Type | Summary |',
		'| ID | Name | Summary |'
	);

	assert.throws(
		() => validateArchitectureMarkdownStructure( markdown ),
		/External Context table columns must be exactly: ID, Name, Type, Summary/u
	);
} );

test( 'Runtime View heading の ID 欠落を拒否する', () => {
	const markdown = validMarkdown.replace( '### Input flow {#RV_INPUT}', '### Input flow' );

	assert.throws(
		() => validateArchitectureMarkdownStructure( markdown ),
		/Runtime View heading "Input flow" requires an embedded runtime ID/u
	);
} );

test( 'Runtime View table の欠落を scenario ID 付きで拒否する', () => {
	const markdown = validMarkdown.replace(
		'| Step | Source | Target | Interaction |\n| ---: | --- | --- | --- |\n| 1 | EXT_EDITOR | RESP_INPUT | 入力を渡す。 |',
		'Runtime table is missing.'
	);

	assert.throws(
		() => validateArchitectureMarkdownStructure( markdown ),
		/Runtime View RV_INPUT table is missing/u
	);
} );
