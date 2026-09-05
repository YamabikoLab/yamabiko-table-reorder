/**
 * Row Reorderの移動表示が、DnD Engineの横方向の物理移動にも追従することを確認する。
 */

import { act, render } from '@testing-library/react';

import { RowMovingDisplay } from './moving-row';

let mockRowDndPhase: 'idle' | 'active' = 'active';
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/row-reorder/dnd-interaction-react', () => ( {
	useRowDndPhase: () => mockRowDndPhase,
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

/**
 * 移動表示の配置条件を必要な値だけで表せるDOM矩形を作成する。
 *
 * @param values テスト条件として上書きする表示寸法と位置。
 * @return 指定値以外を0としたDOM矩形。
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

/** 横方向追従を確認できる1行Tableを作成する。 */
const createSourceRow = (): HTMLTableRowElement => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const row = document.createElement( 'tr' );
	const cell = document.createElement( 'td' );
	cell.textContent = 'Source';
	row.appendChild( cell );
	tbody.appendChild( row );
	table.appendChild( tbody );
	document.body.appendChild( table );

	jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			left: 100,
			right: 500,
			width: 400,
		} )
	);
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

	return row;
};

describe( 'Row moving display horizontal tracking', () => {
	beforeEach( () => {
		mockRowDndPhase = 'active';
		mockDragDropMonitor = {};
		document.body.replaceChildren();
	} );

	/**
	 * 概要:
	 * - 移動表示が横方向の物理移動へ追従し、Table内容から離して移動先を確認できることを確認する。
	 *
	 * 事前条件:
	 * - Row DnD Sessionがactiveである。
	 * - 移動表示はTable左端100pxから開始し、DnD Engineの開始横位置は150pxである。
	 *
	 * 操作:
	 * - DnD Engineから開始位置より60px右の現在位置を通知する。
	 *
	 * 期待結果:
	 * - 移動表示の左端が開始時より60px右へ移動し、縦位置は変化しない。
	 */
	it( 'when the physical drag moves horizontally, should move the overlay by the same horizontal distance', () => {
		const row = createSourceRow();
		render( <RowMovingDisplay /> );

		act( () => {
			mockDragDropMonitor.onDragStart?.( {
				operation: {
					source: { element: row },
					position: {
						initial: { x: 150, y: 100 },
						current: { x: 150, y: 100 },
					},
				},
			} );
		} );

		act( () => {
			mockDragDropMonitor.onDragMove?.( {
				operation: {
					position: {
						current: { x: 210, y: 100 },
					},
				},
			} );
		} );

		const overlay = document.querySelector(
			'.yamabiko-table-reorder-moving-row'
		) as HTMLElement | null;
		expect( overlay?.style.left ).toBe( '160px' );
		expect( overlay?.style.top ).toBe( '80px' );
	} );
} );
