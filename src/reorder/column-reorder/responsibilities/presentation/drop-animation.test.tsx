/**
 * Column Reorderの終了アニメーションが、通常ドロップ、取消、異常終了に応じてMoving Columnを適切な最終表示へ引き継ぐことを確認する。
 *
 * DnD InteractionやTable更新自体は重複検証せず、Presentationが所有するsnapshot、帰還位置、成功着地、終了表示のcleanupを検証する。
 */

import { act, render } from '@testing-library/react';

import { ColumnDropAnimation } from './drop-animation';

let mockColumnDndPhase: 'idle' | 'active' = 'idle';
let mockDestinationBoundaryIndex: number | null = null;
let mockColumnDndStateListener: ( () => void ) | null = null;
let mockTerminationListener: ( () => void ) | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: ( event: any ) => void;
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
	subscribeColumnDndTerminationNotice: ( listener: () => void ) => {
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
 * 終了表示の配置条件を必要な値だけで表せるDOM矩形を作成する。
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

/** Column DnDの元列と、終了アニメーションが引き継ぐMoving Column、Insertion Gapを用意する。 */
const createPresentation = () => {
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const firstRow = document.createElement( 'tr' );
	const secondRow = document.createElement( 'tr' );
	const firstCell = document.createElement( 'td' );
	const sourceCell = document.createElement( 'td' );
	firstCell.textContent = 'First';
	sourceCell.textContent = 'Source';
	firstRow.appendChild( firstCell );
	secondRow.appendChild( sourceCell );
	tbody.append( firstRow, secondRow );
	table.appendChild( tbody );
	document.body.appendChild( table );

	let sourceTop = 140;
	jest
		.spyOn( firstCell, 'getBoundingClientRect' )
		.mockReturnValue(
			rectangle( { top: 100, bottom: 140, left: 120, right: 220, width: 100, height: 40 } )
		);
	jest.spyOn( sourceCell, 'getBoundingClientRect' ).mockImplementation( () =>
		rectangle( {
			top: sourceTop,
			bottom: sourceTop + 40,
			left: 120,
			right: 220,
			width: 100,
			height: 40,
		} )
	);
	jest
		.spyOn( table, 'getBoundingClientRect' )
		.mockReturnValue(
			rectangle( { top: 100, bottom: 180, left: 120, right: 220, width: 100, height: 80 } )
		);
	Object.defineProperty( window, 'innerHeight', {
		configurable: true,
		value: 500,
	} );
	Object.defineProperty( document, 'elementFromPoint', {
		configurable: true,
		value: jest.fn( ( _x: number, y: number ) => {
			if ( y >= 100 && y < 140 ) {
				return firstCell;
			}
			if ( y >= 140 && y < 180 ) {
				return sourceCell;
			}
			return null;
		} ),
	} );

	const movingDisplay = document.createElement( 'div' );
	movingDisplay.className = 'yamabiko-table-reorder-moving-column';
	movingDisplay.textContent = 'Moving';
	jest
		.spyOn( movingDisplay, 'getBoundingClientRect' )
		.mockReturnValue(
			rectangle( { top: 260, bottom: 340, left: 460, right: 560, width: 100, height: 80 } )
		);

	const insertionGap = document.createElement( 'div' );
	insertionGap.className = 'yamabiko-table-reorder-column-insertion-gap';
	jest
		.spyOn( insertionGap, 'getBoundingClientRect' )
		.mockReturnValue(
			rectangle( { top: 120, bottom: 200, left: 300, right: 400, width: 100, height: 80 } )
		);
	document.body.append( insertionGap, movingDisplay );

	return {
		sourceCell,
		movingDisplay,
		insertionGap,
		setSourceTop: ( top: number ) => {
			sourceTop = top;
		},
	};
};

/**
 * 物理DnDを開始し、active Sessionの現在移動先をPresentationへ同期する。
 *
 * @param sourceCell               DnD Engineが移動対象として管理する開始セル。
 * @param destinationBoundaryIndex active Sessionの現在移動先境界。
 */
const startColumnDrag = (
	sourceCell: HTMLTableCellElement,
	destinationBoundaryIndex: number | null
): void => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: {
				source: { element: sourceCell },
				position: { initial: { x: 170, y: 160 } },
			},
		} );
	} );
	mockColumnDndPhase = 'active';
	mockDestinationBoundaryIndex = destinationBoundaryIndex;
	act( () => {
		mockColumnDndStateListener?.();
	} );
};

describe( 'Column drop animation', () => {
	let animationFrameCallbacks: FrameRequestCallback[];
	let animationFrameId: number;
	let animateMock: jest.Mock;
	let currentAnimation: Animation & { cancel: jest.Mock };
	let originalAnimate: typeof HTMLElement.prototype.animate | undefined;
	let originalMatchMedia: typeof window.matchMedia | undefined;

	beforeEach( () => {
		mockColumnDndPhase = 'idle';
		mockDestinationBoundaryIndex = null;
		mockColumnDndStateListener = null;
		mockTerminationListener = null;
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

	const flushAnimationFrame = (): void => {
		const callbacks = animationFrameCallbacks;
		animationFrameCallbacks = [];
		act( () => {
			callbacks.forEach( ( callback ) => callback( 0 ) );
		} );
	};

	/**
	 * 概要:
	 * - 有効な移動先への通常ドロップではMoving Columnを最後のInsertion Gapへ着地させることを確認する。
	 *
	 * 事前条件:
	 * - activeなColumn DnDに有効移動先が存在する。
	 * - Moving ColumnとInsertion Gapが現在のeditor DOMに描画されている。
	 *
	 * 操作:
	 * - 現在表示を記録した後、通常ドロップを通知する。
	 * - 終了アニメーションを完了する。
	 *
	 * 期待結果:
	 * - Moving Columnが現在位置からInsertion GapへX/Y両方向に350msで移動する。
	 * - 終了アニメーション完了後は、このPresentationが追加した複製表示を残さない。
	 */
	it( 'when a valid column drop completes, should animate the moving column to the insertion gap', () => {
		const { sourceCell } = createPresentation();
		render( <ColumnDropAnimation /> );
		startColumnDrag( sourceCell, 3 );
		flushAnimationFrame();
		flushAnimationFrame();
		const existingBodyChildren = Array.from( document.body.children );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		expect( animateMock ).toHaveBeenCalledWith(
			[ { transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-160px, -140px, 0)' } ],
			{ duration: 350, easing: 'ease-out', fill: 'forwards' }
		);
		const landingElements = getAddedBodyChildren( existingBodyChildren );
		expect( landingElements ).toHaveLength( 2 );

		act( () => {
			currentAnimation.onfinish?.( new Event( 'finish' ) as AnimationPlaybackEvent );
		} );
		expect( landingElements.every( ( element ) => ! element.isConnected ) ).toBe( true );
	} );

	/**
	 * 概要:
	 * - 有効な移動先がない通常ドロップではDnD開始時の絶対座標ではなく元列の現在位置へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - active Sessionに有効移動先がない。
	 * - DnD開始後に元列の現在位置が縦方向へ変化している。
	 *
	 * 操作:
	 * - 通常ドロップを通知する。
	 *
	 * 期待結果:
	 * - Moving Columnは元列の現在位置へ戻り、帰還中だけ元列セルの半透明表示を維持する。
	 */
	it( 'when a column drop has no valid destination, should return the moving column to the current source position', () => {
		const { sourceCell, setSourceTop } = createPresentation();
		render( <ColumnDropAnimation /> );
		startColumnDrag( sourceCell, null );
		flushAnimationFrame();
		flushAnimationFrame();
		setSourceTop( 180 );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		expect( animateMock ).toHaveBeenCalledWith(
			[ { transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-340px, -120px, 0)' } ],
			{ duration: 350, easing: 'ease-out', fill: 'forwards' }
		);
		expect( sourceCell.style.opacity ).toBe( '0.35' );
		act( () => {
			currentAnimation.onfinish?.( new Event( 'finish' ) as AnimationPlaybackEvent );
		} );
		expect( sourceCell.style.opacity ).toBe( '' );
	} );

	/**
	 * 概要:
	 * - 有効移動先を保持した状態から取消しても、idle遷移後のnullでsnapshotを失効させず元列へ戻ることを確認する。
	 *
	 * 事前条件:
	 * - active Sessionの最後の有効移動先とPresentation snapshotが一致している。
	 * - DnD Interactionは取消処理によって既にidleへ遷移している。
	 * - 終了直前のMoving ColumnをDOMから取得できない。
	 *
	 * 操作:
	 * - DnD Engineから取消終了を通知する。
	 *
	 * 期待結果:
	 * - active Session中の最後の移動先と保持済みsnapshotを利用し、Insertion Gapへ着地せず元列へ戻る。
	 */
	it( 'when a valid destination is canceled after the session becomes idle, should return using the last active snapshot', () => {
		const { sourceCell, movingDisplay, insertionGap } = createPresentation();
		render( <ColumnDropAnimation /> );
		startColumnDrag( sourceCell, 3 );
		flushAnimationFrame();
		flushAnimationFrame();
		mockColumnDndPhase = 'idle';
		mockDestinationBoundaryIndex = null;
		act( () => {
			mockColumnDndStateListener?.();
		} );
		movingDisplay.remove();
		insertionGap.remove();

		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: true } );
		} );

		expect( animateMock ).toHaveBeenCalledWith(
			[ { transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-340px, -160px, 0)' } ],
			{ duration: 350, easing: 'ease-out', fill: 'forwards' }
		);
	} );

	/**
	 * 概要:
	 * - 最後に記録したsnapshotとactive Sessionの現在移動先が一致しない場合は、古い着地点を終了表示へ流用しないことを確認する。
	 *
	 * 事前条件:
	 * - 移動先3のPresentation snapshotが記録されている。
	 * - その後active Sessionの移動先だけが4へ更新され、移動先4の表示はまだ記録されていない。
	 * - DnD終了直前のPresentation表示をDOMから取得できない。
	 *
	 * 操作:
	 * - 通常ドロップを通知する。
	 *
	 * 期待結果:
	 * - 移動先3の古いsnapshotを利用せず、成功着地アニメーションを生成しない。
	 */
	it( 'when the saved snapshot no longer matches the active destination, should not reuse the stale landing position', () => {
		const { sourceCell, movingDisplay, insertionGap } = createPresentation();
		render( <ColumnDropAnimation /> );
		startColumnDrag( sourceCell, 3 );
		flushAnimationFrame();
		flushAnimationFrame();

		mockDestinationBoundaryIndex = 4;
		act( () => {
			mockColumnDndStateListener?.();
		} );
		movingDisplay.remove();
		insertionGap.remove();

		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		expect( animateMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 確定不能による異常終了では成功した着地表示を生成しないことを確認する。
	 *
	 * 事前条件:
	 * - 有効移動先とPresentation snapshotが成立している。
	 *
	 * 操作:
	 * - DnD Interactionの異常終了通知後に物理DnD終了を通知する。
	 *
	 * 期待結果:
	 * - Moving Columnの終了アニメーションを開始しない。
	 */
	it( 'when column DnD terminates abnormally, should not create a drop animation', () => {
		const { sourceCell } = createPresentation();
		render( <ColumnDropAnimation /> );
		startColumnDrag( sourceCell, 3 );
		flushAnimationFrame();
		flushAnimationFrame();
		act( () => {
			mockTerminationListener?.();
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		expect( animateMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 動きを抑制する利用者設定では終了アニメーションを生成せず、実Table表示へ直接切り替えることを確認する。
	 *
	 * 事前条件:
	 * - 有効移動先とPresentation表示が成立している。
	 * - editor表示環境でprefers-reduced-motionが有効である。
	 *
	 * 操作:
	 * - 通常ドロップを通知する。
	 *
	 * 期待結果:
	 * - Web Animations APIを呼び出さず、このPresentationの一時表示を追加しない。
	 */
	it( 'when reduced motion is preferred, should skip the drop animation', () => {
		Object.defineProperty( window, 'matchMedia', {
			configurable: true,
			value: jest.fn( () => ( { matches: true } ) ),
		} );
		const { sourceCell } = createPresentation();
		render( <ColumnDropAnimation /> );
		startColumnDrag( sourceCell, 3 );
		flushAnimationFrame();
		flushAnimationFrame();
		const existingBodyChildren = Array.from( document.body.children );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		expect( animateMock ).not.toHaveBeenCalled();
		expect( getAddedBodyChildren( existingBodyChildren ) ).toHaveLength( 0 );
	} );

	/**
	 * 概要:
	 * - Web Animations APIを利用できない環境では一時表示や元列の変更を残さず実Tableへ戻ることを確認する。
	 *
	 * 事前条件:
	 * - 有効移動先がない通常ドロップで、Moving Columnは元列へ戻る対象である。
	 * - editor表示環境ではWeb Animations APIを利用できない。
	 *
	 * 操作:
	 * - 通常ドロップを通知する。
	 *
	 * 期待結果:
	 * - 一時的に複製したMoving Columnを残さず、元列セルの表示も変更前へ戻す。
	 */
	it( 'when the Web Animations API is unavailable, should leave no temporary return display', () => {
		Object.defineProperty( HTMLElement.prototype, 'animate', {
			configurable: true,
			value: undefined,
		} );
		const { sourceCell } = createPresentation();
		render( <ColumnDropAnimation /> );
		startColumnDrag( sourceCell, null );
		flushAnimationFrame();
		flushAnimationFrame();
		const existingBodyChildren = Array.from( document.body.children );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );

		expect( getAddedBodyChildren( existingBodyChildren ) ).toHaveLength( 0 );
		expect( sourceCell.style.opacity ).toBe( '' );
	} );

	/**
	 * 概要:
	 * - Presentation境界が終了した場合に進行中の終了表示を次の画面状態へ残さないことを確認する。
	 *
	 * 事前条件:
	 * - 正常なドロップ後の終了アニメーションが進行中である。
	 *
	 * 操作:
	 * - ColumnDropAnimationをunmountする。
	 *
	 * 期待結果:
	 * - 進行中のアニメーションを取消し、このPresentationが追加した複製を除去する。
	 */
	it( 'when the boundary unmounts during the drop animation, should remove the temporary display', () => {
		const { sourceCell } = createPresentation();
		const { unmount } = render( <ColumnDropAnimation /> );
		startColumnDrag( sourceCell, 3 );
		flushAnimationFrame();
		flushAnimationFrame();
		const existingBodyChildren = Array.from( document.body.children );
		act( () => {
			mockDragDropMonitor.onDragEnd?.( { canceled: false } );
		} );
		const landingElements = getAddedBodyChildren( existingBodyChildren );
		expect( landingElements ).toHaveLength( 2 );

		unmount();

		expect( currentAnimation.cancel ).toHaveBeenCalledTimes( 1 );
		expect( landingElements.every( ( element ) => ! element.isConnected ) ).toBe( true );
	} );
} );