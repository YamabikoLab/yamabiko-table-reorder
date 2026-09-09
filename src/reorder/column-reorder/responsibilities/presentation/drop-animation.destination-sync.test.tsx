/**
 * Column Reorderの終了アニメーションが、移動先変更直後の古いInsertion Gapを新しい着地点として扱わないことを確認する。
 *
 * DnD Interactionの意味状態とPresentation表示の更新に一時的な時間差が生じても、保存時点で移動先と対応付いた
 * Insertion Gapだけを成功着地へ利用し、Tableの確定位置と終了表示が食い違わないことを検証する。
 */

import { act, render } from '@testing-library/react';

import { ColumnDropAnimation } from './drop-animation';

let mockColumnDndPhase: 'idle' | 'active' = 'idle';
let mockDestinationBoundaryIndex: number | null = null;
let mockColumnDndStateListener: ( () => void ) | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragEnd?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/column-reorder/responsibilities/dnd-interaction', () => ( {
	getColumnDndPhase: () => mockColumnDndPhase,
	getColumnDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
	subscribeColumnDndState: ( listener: () => void ) => {
		mockColumnDndStateListener = listener;
		return () => {
			mockColumnDndStateListener = null;
		};
	},
	subscribeColumnDndTerminationNotice: () => () => {},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

/**
 * テスト条件に必要な表示矩形を作成する。
 *
 * @param values 上書きする位置と寸法。
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

describe( 'Column drop animation destination synchronization', () => {
	let animationFrameCallbacks: FrameRequestCallback[];
	let animationFrameId: number;
	let animateMock: jest.Mock;
	let originalAnimate: typeof HTMLElement.prototype.animate | undefined;
	let originalMatchMedia: typeof window.matchMedia | undefined;

	beforeEach( () => {
		mockColumnDndPhase = 'idle';
		mockDestinationBoundaryIndex = null;
		mockColumnDndStateListener = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		animationFrameCallbacks = [];
		animationFrameId = 0;

		jest
			.spyOn( window, 'requestAnimationFrame' )
			.mockImplementation( ( callback: FrameRequestCallback ) => {
				animationFrameCallbacks.push( callback );
				animationFrameId += 1;
				return animationFrameId;
			} );
		jest.spyOn( window, 'cancelAnimationFrame' ).mockImplementation( ( requestId: number ) => {
			const callbackIndex = requestId - 1;
			animationFrameCallbacks[ callbackIndex ] = () => {};
		} );

		animateMock = jest.fn( () => ( {
			cancel: jest.fn(),
			onfinish: null,
			oncancel: null,
		} ) );
		originalAnimate = HTMLElement.prototype.animate;
		Object.defineProperty( HTMLElement.prototype, 'animate', {
			configurable: true,
			value: animateMock,
		} );

		originalMatchMedia = window.matchMedia;
		Object.defineProperty( window, 'matchMedia', {
			configurable: true,
			value: jest.fn( () => ( { matches: false } ) ),
		} );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		if ( originalAnimate === undefined ) {
			delete ( HTMLElement.prototype as Partial< HTMLElement > ).animate;
		} else {
			Object.defineProperty( HTMLElement.prototype, 'animate', {
				configurable: true,
				value: originalAnimate,
			} );
		}
		if ( originalMatchMedia === undefined ) {
			delete ( window as Partial< Window > ).matchMedia;
		} else {
			Object.defineProperty( window, 'matchMedia', {
				configurable: true,
				value: originalMatchMedia,
			} );
		}
	} );

	const flushAnimationFrame = (): void => {
		const callbacks = animationFrameCallbacks;
		animationFrameCallbacks = [];
		act( () => {
			callbacks.forEach( ( callback ) => callback( 0 ) );
		} );
	};

	/**
	 * 概要:
	 * - 移動先変更直後にDOMへ古いInsertion Gapが残っていても、それを新しい移動先の着地点として利用しないことを確認する。
	 *
	 * 事前条件:
	 * - 移動先3のMoving ColumnとInsertion Gapが同期済みで、終了表示用snapshotとして記録されている。
	 * - DnD Interactionの移動先だけが4へ更新され、DOMには移動先3のInsertion Gapが残っている。
	 *
	 * 操作:
	 * - 移動先4のPresentation同期を待たずに通常ドロップを通知する。
	 *
	 * 期待結果:
	 * - 移動先3のInsertion Gapを移動先4の着地点として使用せず、終了アニメーションを生成しない。
	 */
	it( 'when destination changes before the insertion gap catches up, should not land on the stale gap', () => {
		const table = document.createElement( 'table' );
		const tbody = document.createElement( 'tbody' );
		const row = document.createElement( 'tr' );
		const sourceCell = document.createElement( 'td' );
		row.appendChild( sourceCell );
		tbody.appendChild( row );
		table.appendChild( tbody );
		document.body.appendChild( table );

		jest.spyOn( sourceCell, 'getBoundingClientRect' ).mockReturnValue(
			rectangle( { top: 100, bottom: 140, left: 120, right: 220, width: 100, height: 40 } )
		);
		jest.spyOn( table, 'getBoundingClientRect' ).mockReturnValue(
			rectangle( { top: 100, bottom: 140, left: 120, right: 220, width: 100, height: 40 } )
		);
		Object.defineProperty( window, 'innerHeight', {
			configurable: true,
			value: 500,
		} );
		Object.defineProperty( document, 'elementFromPoint', {
			configurable: true,
			value: jest.fn( () => sourceCell ),
		} );

		const movingDisplay = document.createElement( 'div' );
		movingDisplay.className = 'yamabiko-table-reorder-moving-column';
		jest.spyOn( movingDisplay, 'getBoundingClientRect' ).mockReturnValue(
			rectangle( { top: 260, bottom: 300, left: 460, right: 560, width: 100, height: 40 } )
		);
		const insertionGap = document.createElement( 'div' );
		insertionGap.className = 'yamabiko-table-reorder-column-insertion-gap';
		jest.spyOn( insertionGap, 'getBoundingClientRect' ).mockReturnValue(
			rectangle( { top: 100, bottom: 140, left: 300, right: 400, width: 100, height: 40 } )
		);
		document.body.append( insertionGap, movingDisplay );

		render( <ColumnDropAnimation /> );
		act( () => {
			mockDragDropMonitor.onDragStart?.( {
				operation: {
					source: { element: sourceCell },
					position: { initial: { x: 170, y: 120 } },
				},
			} );
		} );
		mockColumnDndPhase = 'active';
		mockDestinationBoundaryIndex = 3;
		act( () => {
			mockColumnDndStateListener?.();
		} );
		flushAnimationFrame();
		flushAnimationFrame();

		mockDestinationBoundaryIndex = 4;
		act( () => {
			mockColumnDndStateListener?.();
		} );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		expect( animateMock ).not.toHaveBeenCalled();
	} );
} );