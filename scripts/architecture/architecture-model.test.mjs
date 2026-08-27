import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArchitectureMarkdown } from './architecture-model.mjs';

const architectureMarkdown = `# Architecture

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_EDITOR | Editor | External System | Provides input. |

This prose must not create architecture data.

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_INPUT | Input | Normalizes input. |
| RESP_DND | DnD | Coordinates drag and drop. |

### Relationships

| Source | Destination | Description |
| --- | --- | --- |
| EXT_EDITOR | RESP_INPUT | Provides input. |
| RESP_INPUT | RESP_DND | Passes a start attempt. |

### Responsibility Details

#### Input {#RESP_INPUT}

##### Dependencies

This prose mentions RESP_DND but must not create a relationship.

#### DnD {#RESP_DND}

## 6. Runtime View

### Start attempt {#RV_START}

Human-readable scenario description.

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_EDITOR | RESP_INPUT | Provides input. |
| 2 | RESP_INPUT | RESP_DND | Passes a start attempt. |
`;

test( 'builds an Architecture Model only from fixed machine-readable structures', () => {
	const model = parseArchitectureMarkdown( architectureMarkdown );

	assert.deepEqual( model.externalContexts, [
		{
			id: 'EXT_EDITOR',
			name: 'Editor',
			type: 'External System',
			summary: 'Provides input.',
		},
	] );
	assert.deepEqual( model.responsibilities, [
		{
			id: 'RESP_INPUT',
			name: 'Input',
			summary: 'Normalizes input.',
		},
		{
			id: 'RESP_DND',
			name: 'DnD',
			summary: 'Coordinates drag and drop.',
		},
	] );
	assert.deepEqual( model.relationships, [
		{
			source: 'EXT_EDITOR',
			destination: 'RESP_INPUT',
			description: 'Provides input.',
		},
		{
			source: 'RESP_INPUT',
			destination: 'RESP_DND',
			description: 'Passes a start attempt.',
		},
	] );
	assert.deepEqual( model.responsibilityDetails, [
		{ id: 'RESP_INPUT', name: 'Input' },
		{ id: 'RESP_DND', name: 'DnD' },
	] );
	assert.deepEqual( model.runtimeViews, [
		{
			id: 'RV_START',
			name: 'Start attempt',
			steps: [
				{
					step: 1,
					source: 'EXT_EDITOR',
					target: 'RESP_INPUT',
					interaction: 'Provides input.',
				},
				{
					step: 2,
					source: 'RESP_INPUT',
					target: 'RESP_DND',
					interaction: 'Passes a start attempt.',
				},
			],
		},
	] );
} );
