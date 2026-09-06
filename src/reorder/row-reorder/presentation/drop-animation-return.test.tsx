/**
 * Row Reorderの終了アニメーションが、有効な移動先のない通常ドロップでMoving Rowを元行へ戻すことを確認する。
 *
 * DnD InteractionやMoving Row本体の実装は重複して検証せず、Table外等で移動先が成立しない終了時の帰還表示だけを検証する。
 */

import { act, render } from '@testing-library/react';

import { RowDropAnimation } from './drop-animation';

let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragEnd?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/row-reorder/dnd-interaction', () => ( {
	getRowDndPhase: () => 'idle',
	getRowDndDestinationBoundaryIndex: () => null,
	subscribeRowDndState: () => () => {},
	subscribeRowDndTerminationNotice: () => () => {},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

/**
 * 帰還表示の配置条件を必要な値だけで表せるDOM矩形を作成する。
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

/**
 * 操作前後の参照差から、Presentationがbody直下へ一時追加した要素だけを取得する。
 *
 * @param existingChildren 操作前に存在していたbody直下要素。
 * @return 操作後に新しく追加されたbody直下要素。
 */
const getAddedBodyChildren = ( existingChildren: readonly Element[] ): Element[] => {
	const existingElements = new Set( existingChildren );
	return Array.from( document.body.children ).filter(
		( element ) => ! existingElements.has( element )
	);
};

describe( 'Row drop return animation', () => {
	let animateMock: jest.Mock;
	let currentAnimation: Animation & { cancel: jest.Mock };
	let originalAnimate: typeof HTMLElement.prototype.animate | undefined;
	let originalMatchMedia: typeof window.matchMedia | undefined;

	beforeEach( () => {
		mockDragDropMonitor = {};
		document.body.replaceChildren();

		currentAnimation = {
			cancel: jest.fn(),
			onfinish: null,
			oncancel: null,
		} as unknown as Animation & { cancel: jest.Mock };
		animateMock = jest.fn( () => currentAnimation );
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

	/**
	 * 概要:
	 * - Table外等で有効な移動先がないまま通常ドロップした場合、Moving Rowが元行の現在位置へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - Row DnDの元行は現在top=80px、left=100pxに存在する。
	 * - Moving Rowはtop=300px、left=450pxまで移動している。
	 * - DnD Interactionには有効な移動先がない。
	 *
	 * 操作:
	 * - 取消ではない物理DnD終了を通知する。
	 *
	 * 期待結果:
	 * - Moving Rowの複製が元行へ350msで移動する。
	 * - 帰還中は元行を半透明で維持し、アニメーション終了後に元の表示へ戻す。
	 */
	it( 'when a row is dropped without a valid destination, should animate the moving display back to the current source row position', () => {
		const table = document.createElement( 'table' );
		const tableBody = document.createElement( 'tbody' );
		const sourceRow = document.createElement( 'tr' );
		const cell = document.createElement( 'td' );
		cell.textContent = 'Source';
		sourceRow.appendChild( cell );
		tableBody.appendChild( sourceRow );
		table.appendChild( tableBody );
		document.body.appendChild( table );
		jest.spyOn( sourceRow, 'getBoundingClientRect' ).mockReturnValue(
			rectangle( {
				top: 80,
				left: 100,
				width: 400,
				height: 40,
			} )
		);

		const movingDisplay = document.createElement( 'div' );
		movingDisplay.className = 'yamabiko-table-reorder-moving-row';
		movingDisplay.textContent = 'Source';
		jest.spyOn( movingDisplay, 'getBoundingClientRect' ).mockReturnValue(
			rectangle( {
				top: 300,
				left: 450,
				width: 400,
				height: 40,
			} )
		);
		document.body.appendChild( movingDisplay );

		render( <RowDropAnimation /> );
		const existingBodyChildren = Array.from( document.body.children );
		act( () => {
			mockDragDropMonitor.onDragStart?.( {
				operation: {
					source: { element: sourceRow },
				},
			} );
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		const returnElements = getAddedBodyChildren( existingBodyChildren );
		expect( returnElements ).toHaveLength( 1 );
		expect( animateMock ).toHaveBeenCalledWith(
			[ { transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-350px, -220px, 0)' } ],
			{
				duration: 350,
				easing: 'ease-out',
				fill: 'forwards',
			}
		);
		expect( sourceRow.style.opacity ).toBe( '0.35' );

		act( () => {
			currentAnimation.onfinish?.( new Event( 'finish' ) as AnimationPlaybackEvent );
		} );
		expect( sourceRow.style.opacity ).toBe( '' );
		expect( returnElements[ 0 ]?.isConnected ).toBe( false );
		expect( document.body.contains( movingDisplay ) ).toBe( true );
	} );
} );