/**
 * Row Reorderの着地アニメーションが、DnD確定後だけ移動表示を最後の挿入空間へ引き継ぎ、終了条件に応じて一時表示を破棄することを確認する。
 *
 * DnD Interactionや他のPresentation本体の実装は重複して検証せず、正常なドロップ、取消、異常終了、動き抑制設定、および境界終了時の表示Lifecycleを検証する。
 */

import { act, render } from '@testing-library/react';

import { RowDropAnimation } from './drop-animation';

let mockRowDndPhase: 'idle' | 'active' = 'idle';
let mockDestinationBoundaryIndex: number | null = null;
let mockRowDndStateListener: ( () => void ) | null = null;
let mockTerminationListener: ( () => void ) | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
	onDragEnd?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/row-reorder/dnd-interaction', () => ( {
	getRowDndPhase: () => mockRowDndPhase,
	getRowDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
	subscribeRowDndState: ( listener: () => void ) => {
		mockRowDndStateListener = listener;
		return () => {
			mockRowDndStateListener = null;
		};
	},
	subscribeRowDndTerminationNotice: ( listener: () => void ) => {
		mockTerminationListener = listener;
		return () => {
			mockTerminationListener = null;
		};
	},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

/**
 * 着地表示の配置条件を必要な値だけで表せるDOM矩形を作成する。
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

/** Row DnDの基準要素と、着地アニメーションが引き継ぐ2つのPresentation表示を用意する。 */
const createPresentation = () => {
	const table = document.createElement( 'table' );
	const tableBody = document.createElement( 'tbody' );
	const sourceRow = document.createElement( 'tr' );
	const cell = document.createElement( 'td' );
	cell.textContent = 'Moving';
	sourceRow.appendChild( cell );
	tableBody.appendChild( sourceRow );
	table.appendChild( tableBody );
	document.body.appendChild( table );

	const movingDisplay = document.createElement( 'div' );
	movingDisplay.className = 'yamabiko-table-reorder-moving-row';
	movingDisplay.textContent = 'Moving';
	jest.spyOn( movingDisplay, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: 300,
			left: 450,
			width: 400,
			height: 40,
		} )
	);

	const insertionGap = document.createElement( 'div' );
	insertionGap.className = 'yamabiko-table-reorder-insertion-gap';
	jest.spyOn( insertionGap, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: 100,
			left: 100,
			width: 400,
			height: 40,
		} )
	);

	document.body.append( insertionGap, movingDisplay );
	return { sourceRow, movingDisplay, insertionGap };
};

/**
 * DnD開始後に有効移動先が成立し、現在のPresentation表示が次の描画周期で記録された状態を作る。
 *
 * @param sourceRow           物理DnDの移動対象として通知する行。
 * @param flushAnimationFrame 予約されたeditor描画周期を進める処理。
 */
const captureValidDestination = (
	sourceRow: HTMLTableRowElement,
	flushAnimationFrame: () => void
): void => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: {
				source: { element: sourceRow },
			},
		} );
	} );

	mockRowDndPhase = 'active';
	mockDestinationBoundaryIndex = 1;
	act( () => {
		mockRowDndStateListener?.();
	} );
	flushAnimationFrame();
	flushAnimationFrame();
};

describe( 'Row drop animation', () => {
	let animationFrameCallbacks: FrameRequestCallback[];
	let animationFrameId: number;
	let animateMock: jest.Mock;
	let currentAnimation: Animation & { cancel: jest.Mock };
	let originalAnimate: typeof HTMLElement.prototype.animate | undefined;
	let originalMatchMedia: typeof window.matchMedia | undefined;

	beforeEach( () => {
		mockRowDndPhase = 'idle';
		mockDestinationBoundaryIndex = null;
		mockRowDndStateListener = null;
		mockTerminationListener = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		animationFrameCallbacks = [];
		animationFrameId = 0;

		jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation(
			( callback: FrameRequestCallback ) => {
				animationFrameCallbacks.push( callback );
				animationFrameId += 1;
				return animationFrameId;
			}
		);
		jest.spyOn( window, 'cancelAnimationFrame' ).mockImplementation( ( requestId: number ) => {
			const callbackIndex = requestId - 1;
			animationFrameCallbacks[ callbackIndex ] = () => {};
		} );

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
			value: jest.fn( () => ( {
				matches: false,
			} ) ),
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
	 * - 正常なドロップではドラッグ中の移動表示を最後の挿入空間へ滑らかに着地させることを確認する。
	 *
	 * 事前条件:
	 * - Row DnD Sessionがactiveで有効移動先が存在する。
	 * - 移動表示と挿入空間が同じeditor DOM環境に描画されている。
	 *
	 * 操作:
	 * - 現在表示を記録した後、取消ではないドロップを通知する。
	 *
	 * 期待結果:
	 * - 移動表示と挿入空間の複製が残り、移動表示が現在位置から挿入空間へ250msで移動する。
	 * - アニメーション終了後は複製だけが除去される。
	 */
	it( 'when a valid row drop completes, should animate the moving display to the gap', () => {
		const { sourceRow, movingDisplay, insertionGap } = createPresentation();
		render( <RowDropAnimation /> );
		captureValidDestination( sourceRow, flushAnimationFrame );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		const dropMovingDisplay = document.querySelector(
			'.yamabiko-table-reorder-drop-animation-moving-row'
		);
		const dropInsertionGap = document.querySelector(
			'.yamabiko-table-reorder-drop-animation-gap'
		);
		expect( dropMovingDisplay ).not.toBeNull();
		expect( dropInsertionGap ).not.toBeNull();
		expect( dropMovingDisplay ).not.toBe( movingDisplay );
		expect( dropInsertionGap ).not.toBe( insertionGap );
		expect( animateMock ).toHaveBeenCalledWith(
			[
				{ transform: 'translate3d(0, 0, 0)' },
				{ transform: 'translate3d(-350px, -200px, 0)' },
			],
			{
				duration: 250,
				easing: 'ease-out',
				fill: 'forwards',
			}
		);

		act( () => {
			currentAnimation.onfinish?.( new Event( 'finish' ) as AnimationPlaybackEvent );
		} );
		expect(
			document.querySelector( '.yamabiko-table-reorder-drop-animation-moving-row' )
		).toBeNull();
		expect( document.querySelector( '.yamabiko-table-reorder-drop-animation-gap' ) ).toBeNull();
		expect( document.body.contains( movingDisplay ) ).toBe( true );
		expect( document.body.contains( insertionGap ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - 取消されたDnDでは確定位置を示す着地アニメーションを生成しないことを確認する。
	 *
	 * 事前条件:
	 * - 有効移動先とPresentation表示は成立している。
	 *
	 * 操作:
	 * - DnD Engineから取消終了を通知する。
	 *
	 * 期待結果:
	 * - 移動表示と挿入空間を複製せず、着地アニメーションを開始しない。
	 */
	it( 'when the physical drag is canceled, should not create a landing animation', () => {
		const { sourceRow } = createPresentation();
		render( <RowDropAnimation /> );
		captureValidDestination( sourceRow, flushAnimationFrame );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: true } );
		} );

		expect( animateMock ).not.toHaveBeenCalled();
		expect(
			document.querySelector( '.yamabiko-table-reorder-drop-animation-moving-row' )
		).toBeNull();
	} );

	/**
	 * 概要:
	 * - Table更新を安全に確定できない異常終了では、開始済みの着地表示も利用者へ残さないことを確認する。
	 *
	 * 事前条件:
	 * - 正常なドロップとして着地アニメーションが開始されている。
	 *
	 * 操作:
	 * - DnD Interactionから異常終了通知を発行する。
	 *
	 * 期待結果:
	 * - 進行中のアニメーションを取消し、このPresentationが追加した複製を直ちに除去する。
	 */
	it( 'when row DnD terminates during landing, should remove the landing display', () => {
		const { sourceRow } = createPresentation();
		render( <RowDropAnimation /> );
		captureValidDestination( sourceRow, flushAnimationFrame );
		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );
		expect( animateMock ).toHaveBeenCalledTimes( 1 );

		act( () => {
			mockTerminationListener?.();
		} );

		expect( currentAnimation.cancel ).toHaveBeenCalledTimes( 1 );
		expect(
			document.querySelector( '.yamabiko-table-reorder-drop-animation-moving-row' )
		).toBeNull();
		expect( document.querySelector( '.yamabiko-table-reorder-drop-animation-gap' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 動きを抑制する利用者設定では、確定後のTable表示へ即時に切り替えることを確認する。
	 *
	 * 事前条件:
	 * - 有効移動先とPresentation表示は成立している。
	 * - editor表示環境でprefers-reduced-motionが有効である。
	 *
	 * 操作:
	 * - 正常なドロップを通知する。
	 *
	 * 期待結果:
	 * - Web Animations APIを呼び出さず、一時的な着地表示を追加しない。
	 */
	it( 'when reduced motion is preferred, should skip the landing animation', () => {
		Object.defineProperty( window, 'matchMedia', {
			configurable: true,
			value: jest.fn( () => ( {
				matches: true,
			} ) ),
		} );
		const { sourceRow } = createPresentation();
		render( <RowDropAnimation /> );
		captureValidDestination( sourceRow, flushAnimationFrame );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		expect( animateMock ).not.toHaveBeenCalled();
		expect(
			document.querySelector( '.yamabiko-table-reorder-drop-animation-moving-row' )
		).toBeNull();
	} );

	/**
	 * 概要:
	 * - Presentation境界が終了した場合に着地表示を次の画面状態へ残さないことを確認する。
	 *
	 * 事前条件:
	 * - 正常なドロップ後の着地アニメーションが進行中である。
	 *
	 * 操作:
	 * - RowDropAnimationをunmountする。
	 *
	 * 期待結果:
	 * - 進行中のアニメーションを取消し、このPresentationが追加した複製を除去する。
	 */
	it( 'when the boundary unmounts during landing, should remove the landing display', () => {
		const { sourceRow } = createPresentation();
		const { unmount } = render( <RowDropAnimation /> );
		captureValidDestination( sourceRow, flushAnimationFrame );
		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		unmount();

		expect( currentAnimation.cancel ).toHaveBeenCalledTimes( 1 );
		expect(
			document.querySelector( '.yamabiko-table-reorder-drop-animation-moving-row' )
		).toBeNull();
		expect( document.querySelector( '.yamabiko-table-reorder-drop-animation-gap' ) ).toBeNull();
	} );
} );