/**
 * Row Moving OverlayがFTBのTable内容だけを表示し、editor操作要素を複製表示へ持ち込まないことを確認する。
 */

import { act, render } from '@testing-library/react';

import { rowDndInteraction } from '@/reorder/row-reorder/responsibilities/dnd-interaction';

import { RowMovingDisplay } from './moving-row';

let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
} = {};

/* DnD Engineの物理monitorはJSDOMで実行できないため、その通知境界だけを決定的なTest Doubleとする。 */
jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

/* Jestで読み込めないBlock Editor Store境界だけを代替し、WordPress DataとDnD Interactionは実経路へ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual( '@/reorder/row-reorder/responsibilities/table-integration.test-utils' )
		.rowReorderTestBlockEditorStore,
} ) );

const FTB_EDITOR_CONTROL_CLASSES = [
	'ftb-table-cell-label',
	'ftb-row-selector',
	'ftb-column-selector',
	'ftb-row-before-inserter',
	'ftb-row-after-inserter',
	'ftb-column-before-inserter',
	'ftb-column-after-inserter',
	'ftb-row-remover',
	'ftb-column-remover',
];

/**
 * 移動表示の成立条件を満たすDOM矩形を作成する。
 * @param values
 */
const rectangle = ( values: Partial< DOMRect > ): DOMRect =>
	( {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		width: 0,
		height: 0,
		x: 0,
		y: 0,
		toJSON: () => ( {} ),
		...values,
	} ) as DOMRect;

beforeEach( () => {
	act( () => {
		rowDndInteraction.cancel();
	} );
	mockDragDropMonitor = {};
	document.body.replaceChildren();
} );

afterEach( () => {
	act( () => {
		rowDndInteraction.cancel();
	} );
} );

/**
 * FTBのeditor操作要素を含む行でも、移動表示にはTable内容だけが残ることを確認する。
 *
 * 事前条件:
 * - 移動対象行のセルには通常のTable内容とFTBのeditor操作要素が共存している。
 *
 * 操作:
 * - activeなRow DnDで移動表示を開始する。
 *
 * 期待結果:
 * - 通常のTable内容は移動表示に残る。
 * - FTBのeditor操作要素は移動表示から除去される。
 * - 元Tableのeditor操作要素は変更されない。
 */
it( 'when the source row contains FTB editor controls, should keep table content and exclude only the controls from the moving overlay', () => {
	act( () => {
		rowDndInteraction.start(
			{ tableIdentity: 'table-a', sourceRowIndex: 0 },
			{ rowCount: 2, blockedBoundaries: [] }
		);
	} );
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const cell = document.createElement( 'td' );
	const content = document.createElement( 'span' );
	content.textContent = 'Mountain';
	cell.appendChild( content );

	FTB_EDITOR_CONTROL_CLASSES.forEach( ( className ) => {
		const control = document.createElement( 'button' );
		control.className = className;
		control.textContent = className;
		cell.appendChild( control );
	} );

	row.appendChild( cell );
	tbody.appendChild( row );
	table.appendChild( tbody );
	document.body.appendChild( table );

	jest.spyOn( row, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: 80,
			bottom: 120,
			left: 100,
			right: 500,
			width: 400,
			height: 40,
		} )
	);
	jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue( rectangle( { width: 400 } ) );

	render( <RowMovingDisplay /> );
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: {
				source: { element: row },
				position: {
					initial: { x: 100, y: 100 },
					current: { x: 100, y: 100 },
				},
			},
		} );
	} );

	const overlay = document.querySelector( '.yamabiko-table-reorder-moving-row' );
	expect( overlay?.textContent ).toContain( 'Mountain' );
	FTB_EDITOR_CONTROL_CLASSES.forEach( ( className ) => {
		expect( overlay?.querySelector( `.${ className }` ) ).toBeNull();
		expect( cell.querySelector( `.${ className }` ) ).not.toBeNull();
	} );
} );
