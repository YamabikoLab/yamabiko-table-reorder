/**
 * Column Moving OverlayがFTBのTable内容だけを表示し、editor操作要素を複製表示へ持ち込まないことを確認する。
 */

import { act, render } from '@testing-library/react';

import { ColumnMovingDisplay } from './moving-column';

let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/column-reorder/integration/dnd-interaction-react', () => ( {
	useColumnDndPhase: () => 'active',
} ) );

jest.mock( '@dnd-kit/dom/utilities', () => ( {
	getFrameTransform: () => ( {
		x: 0,
		y: 0,
		scaleX: 1,
		scaleY: 1,
	} ),
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
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

/** 移動表示の成立条件を満たすDOM矩形を作成する。 */
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

/**
 * FTBのeditor操作要素を含む列でも、移動表示にはTable内容だけが残ることを確認する。
 *
 * 事前条件:
 * - 移動対象セルには通常のTable内容とFTBのeditor操作要素が共存している。
 *
 * 操作:
 * - activeなColumn DnDで移動表示を開始する。
 *
 * 期待結果:
 * - 通常のTable内容は移動表示に残る。
 * - FTBのeditor操作要素は移動表示から除去される。
 * - 元Tableのeditor操作要素は変更されない。
 */
it( 'when the source column contains FTB editor controls, should keep table content and exclude only the controls from the moving overlay', () => {
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

	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: 20,
			bottom: 60,
			left: 100,
			right: 200,
			width: 100,
			height: 40,
		} )
	);
	jest.spyOn( cell, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: 20,
			bottom: 60,
			left: 100,
			right: 200,
			width: 100,
			height: 40,
		} )
	);
	Object.defineProperty( window, 'innerHeight', {
		configurable: true,
		value: 100,
	} );
	Object.defineProperty( document, 'elementFromPoint', {
		configurable: true,
		value: jest.fn( ( _x: number, y: number ) => ( y >= 20 && y < 60 ? cell : null ) ),
	} );

	render( <ColumnMovingDisplay /> );
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: {
				source: { element: cell },
				position: {
					initial: { x: 150, y: 40 },
					current: { x: 150, y: 40 },
				},
			},
		} );
	} );

	const overlay = document.querySelector( '.yamabiko-table-reorder-moving-column' );
	expect( overlay?.textContent ).toContain( 'Mountain' );
	FTB_EDITOR_CONTROL_CLASSES.forEach( ( className ) => {
		expect( overlay?.querySelector( `.${ className }` ) ).toBeNull();
		expect( cell.querySelector( `.${ className }` ) ).not.toBeNull();
	} );
} );
