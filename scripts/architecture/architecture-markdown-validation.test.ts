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

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_INPUT | EXT_EDITOR | 編集環境を必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_INPUT | Input | EXT_EDITOR RESP_INPUT |

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

test( 'Dependency Views がない文書も受理する', () => {
	const markdown = validMarkdown.replace(
		'### Dependency Views\n\n| ID | Name | Includes |\n| --- | --- | --- |\n| DV_INPUT | Input | EXT_EDITOR RESP_INPUT |\n\n',
		''
	);

	assert.doesNotThrow( () => validateArchitectureMarkdownStructure( markdown ) );
} );

test( '必須見出しの欠落を拒否する', () => {
	const markdown = validMarkdown.replace( '## 3. Context and Scope', '## Context' );

	assert.throws(
		() => validateArchitectureMarkdownStructure( markdown ),
		/required heading "3\. Context and Scope" is missing/u
	);
} );

test( 'Dependencies 表の列違いを拒否する', () => {
	const markdown = validMarkdown.replace(
		'| Dependent | Depends on | Reason |',
		'| Source | Destination | Description |'
	);

	assert.throws(
		() => validateArchitectureMarkdownStructure( markdown ),
		/Dependencies table columns must be exactly: Dependent, Depends on, Reason/u
	);
} );

test( 'Dependency Views 表の列違いを拒否する', () => {
	const markdown = validMarkdown.replace( '| ID | Name | Includes |', '| ID | Name | Members |' );

	assert.throws(
		() => validateArchitectureMarkdownStructure( markdown ),
		/Dependency Views table columns must be exactly: ID, Name, Includes/u
	);
} );

test( 'Dependency Views の重複見出しを拒否する', () => {
	const duplicate = `\n### Dependency Views\n\n| ID | Name | Includes |\n| --- | --- | --- |\n| DV_OTHER | Other | RESP_INPUT |\n`;
	const markdown = validMarkdown.replace(
		'### Responsibility Details',
		`${ duplicate }\n### Responsibility Details`
	);

	assert.throws(
		() => validateArchitectureMarkdownStructure( markdown ),
		/Dependency Views heading may appear at most once/u
	);
} );

test( 'Dependency Views が Dependencies 直後でない場合を拒否する', () => {
	const markdown = validMarkdown.replace(
		'### Dependency Views',
		'### Other\n\n説明。\n\n### Dependency Views'
	);

	assert.throws(
		() => validateArchitectureMarkdownStructure( markdown ),
		/Dependency Views must appear immediately after Dependencies/u
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

test( 'Runtime View Step の正の整数以外を拒否する', () => {
	for ( const step of [ '1abc', '1.5', '0', '-1' ] ) {
		const markdown = validMarkdown.replace(
			'| 1 | EXT_EDITOR | RESP_INPUT | 入力を渡す。 |',
			`| ${ step } | EXT_EDITOR | RESP_INPUT | 入力を渡す。 |`
		);

		assert.throws(
			() => validateArchitectureMarkdownStructure( markdown ),
			new RegExp(
				`Runtime View RV_INPUT Step "${ step.replace( '.', '\\.' ) }" must be a positive integer`,
				'u'
			)
		);
	}
} );
