/**
 * Row Reorderの有効drop後に、移動完了位置を確定処理中の静止表示として維持することを確認する。
 *
 * DnD中Presentationの詳細は重複して検証せず、確定表示への切替、文書スクロールとの関係、終了時の解除、
 * および確定表示を成立させない終了条件を確認する。
 */

import { act, render } from '@testing-library/react';

import { RowCommitDisplay } from './commit-display';

let mockRowDndPhase: 'idle' | 'active' = 'idle';
let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: () => void;
	onDragEnd?: ( event: any ) => void;
} = {};

jest.mock( '@/reorder/row-reorder/integration/dnd-interaction-react', () => ( {
	useRowDndPhase: () => mockRowDndPhase,
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/dnd-interaction', () => ( {
	getRowDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

/**
 * 確定表示の配置条件を必要な値だけで表せるDOM矩形を作成する。
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

/** 有効dropの確定表示へ引き継ぐ移動元、Moving Row、Insertion Gapを用意する。 */
const createPresentation = () => {
	const table = document.createElement( 'table' );
	const tableBody = document.createElement( 'tbody' );
	const sourceRow = document.createElement( 'tr' );
	sourceRow.className = 'yamabiko-table-reorder-moving-row-source';
	const cell = document.createElement( 'td' );
	cell.textContent = 'Moved row';
	sourceRow.appendChild( cell );
	tableBody.appendChild( sourceRow );
	table.appendChild( tableBody );
	document.body.appendChild( table );

	const insertionGap = document.createElement( 'div' );
	insertionGap.className = 'yamabiko-table-reorder-insertion-gap';
	jest.spyOn( insertionGap, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( { top: 100, left: 120, width: 400, height: 40 } )
	);

	const movingDisplay = document.createElement( 'div' );
	movingDisplay.className = 'yamabiko-table-reorder-moving-row';
	movingDisplay.textContent = 'Moved row';
	jest.spyOn( movingDisplay, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( { top: 300, left: 450, width: 400, height: 40 } )
	);

	document.body.append( insertionGap, movingDisplay );
	return { sourceRow, movingDisplay, insertionGap };
};

describe( 'Row commit display', () => {
	let animationFrameCallbacks: FrameRequestCallback[];
	let animationFrameId: number;
	let scrollXDescriptor: PropertyDescriptor | undefined;
	let scrollYDescriptor: PropertyDescriptor | undefined;

	beforeEach( () => {
		mockRowDndPhase = 'active';
		mockDestinationBoundaryIndex = 1;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		animationFrameCallbacks = [];
		animationFrameId = 0;
		scrollXDescriptor = Object.getOwnPropertyDescriptor( window, 'scrollX' );
		scrollYDescriptor = Object.getOwnPropertyDescriptor( window, 'scrollY' );
		Object.defineProperty( window, 'scrollX', { configurable: true, value: 30 } );
		Object.defineProperty( window, 'scrollY', { configurable: true, value: 200 } );
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
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		if ( scrollXDescriptor === undefined ) {
			delete ( window as Partial< Window > ).scrollX;
		} else {
			Object.defineProperty( window, 'scrollX', scrollXDescriptor );
		}
		if ( scrollYDescriptor === undefined ) {
			delete ( window as Partial< Window > ).scrollY;
		} else {
			Object.defineProperty( window, 'scrollY', scrollYDescriptor );
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
	 * 有効dropでは移動行をeditor文書上の最終位置へ固定し、確定中の重複表示を隠すことを確認する。
	 *
	 * 事前条件:
	 * - editorは横30px、縦200pxスクロールしている。
	 * - DnD中のMoving RowとInsertion Gapが有効移動先に表示されている。
	 *
	 * 操作:
	 * - 有効な移動先へdropし、同じ終了処理で追加される後続Presentationの描画周期まで進める。
	 *
	 * 期待結果:
	 * - 確定表示はviewport固定ではなくeditor文書座標へ配置される。
	 * - 移動元、DnD中表示、後から追加された終了表示は隠れ、静止した移動行だけが表示される。
	 */
	it( 'when a valid row drop starts committing, should anchor the final row display to editor document coordinates', () => {
		const { sourceRow, movingDisplay, insertionGap } = createPresentation();
		render( <RowCommitDisplay /> );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: false,
				operation: { source: { element: sourceRow } },
			} );
		} );

		const commitDisplay = document.querySelector< HTMLElement >(
			'.yamabiko-table-reorder-row-commit-display'
		);
		expect( commitDisplay ).not.toBeNull();
		expect( commitDisplay?.style.position ).toBe( 'absolute' );
		expect( commitDisplay?.style.top ).toBe( '300px' );
		expect( commitDisplay?.style.left ).toBe( '150px' );
		expect( sourceRow.style.visibility ).toBe( 'hidden' );
		expect( movingDisplay.style.visibility ).toBe( 'hidden' );
		expect( insertionGap.style.visibility ).toBe( 'hidden' );

		const lateMovingDisplay = document.createElement( 'div' );
		lateMovingDisplay.className = 'yamabiko-table-reorder-moving-row';
		document.body.appendChild( lateMovingDisplay );
		flushAnimationFrame();
		expect( lateMovingDisplay.style.visibility ).toBe( 'hidden' );
		expect( commitDisplay?.style.visibility ).not.toBe( 'hidden' );
	} );

	/**
	 * 確定処理が完了したら静止表示を除去し、確定中だけ隠していたPresentationを元へ戻すことを確認する。
	 *
	 * 事前条件:
	 * - 有効drop後の確定表示が成立している。
	 *
	 * 操作:
	 * - DnD Interactionをidleへ遷移させる。
	 *
	 * 期待結果:
	 * - 静止確定表示は残らない。
	 * - 確定表示への切替時に隠した既存Presentationは元の表示指定へ戻る。
	 */
	it( 'when row commit finishes, should remove the commit display and restore temporarily hidden presentation', () => {
		const { sourceRow, movingDisplay, insertionGap } = createPresentation();
		const { rerender } = render( <RowCommitDisplay /> );
		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: false,
				operation: { source: { element: sourceRow } },
			} );
		} );
		expect(
			document.querySelector( '.yamabiko-table-reorder-row-commit-display' )
		).not.toBeNull();

		mockRowDndPhase = 'idle';
		rerender( <RowCommitDisplay /> );

		expect( document.querySelector( '.yamabiko-table-reorder-row-commit-display' ) ).toBeNull();
		expect( sourceRow.style.visibility ).toBe( '' );
		expect( movingDisplay.style.visibility ).toBe( '' );
		expect( insertionGap.style.visibility ).toBe( '' );
	} );

	/**
	 * 取消または有効な移動先がない終了では、移動済みと誤認させる確定表示を生成しないことを確認する。
	 *
	 * 操作:
	 * - 取消終了と、有効移動先のない通常終了をそれぞれ通知する。
	 *
	 * 期待結果:
	 * - どちらの終了でも静止確定表示を生成しない。
	 */
	it( 'when a drag is canceled or has no valid destination, should not create a commit display', () => {
		const { sourceRow } = createPresentation();
		render( <RowCommitDisplay /> );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: true,
				operation: { source: { element: sourceRow } },
			} );
		} );
		expect( document.querySelector( '.yamabiko-table-reorder-row-commit-display' ) ).toBeNull();

		mockDestinationBoundaryIndex = null;
		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: false,
				operation: { source: { element: sourceRow } },
			} );
		} );
		expect( document.querySelector( '.yamabiko-table-reorder-row-commit-display' ) ).toBeNull();
	} );

	/**
	 * editor環境または確定位置を安全に解決できない場合は、不完全な静止表示を生成しないことを確認する。
	 *
	 * 事前条件:
	 * - 有効な移動先は成立している。
	 *
	 * 操作:
	 * - editor文書を持たない終了と、Insertion Gapを確認できない終了を通知する。
	 *
	 * 期待結果:
	 * - いずれの場合も推測した位置へ確定表示を生成しない。
	 */
	it( 'when commit presentation cannot be resolved safely, should not create a partial commit display', () => {
		const { sourceRow, insertionGap } = createPresentation();
		render( <RowCommitDisplay /> );

		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: false,
				operation: { source: { element: undefined } },
			} );
		} );
		expect( document.querySelector( '.yamabiko-table-reorder-row-commit-display' ) ).toBeNull();

		insertionGap.remove();
		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: false,
				operation: { source: { element: sourceRow } },
			} );
		} );
		expect( document.querySelector( '.yamabiko-table-reorder-row-commit-display' ) ).toBeNull();
	} );

	/**
	 * 表示境界が終了した場合は、未完了の確定表示と予約済みの表示処理を次の画面状態へ残さないことを確認する。
	 *
	 * 事前条件:
	 * - 有効drop後の確定表示と次の描画周期が存在する。
	 *
	 * 操作:
	 * - RowCommitDisplayをunmountする。
	 *
	 * 期待結果:
	 * - 静止確定表示は除去され、予約済みの描画処理は取消される。
	 */
	it( 'when the presentation boundary unmounts during commit, should remove the display and cancel pending presentation work', () => {
		const { sourceRow } = createPresentation();
		const { unmount } = render( <RowCommitDisplay /> );
		act( () => {
			mockDragDropMonitor.onDragEnd?.( {
				canceled: false,
				operation: { source: { element: sourceRow } },
			} );
		} );
		expect(
			document.querySelector( '.yamabiko-table-reorder-row-commit-display' )
		).not.toBeNull();

		unmount();

		expect( document.querySelector( '.yamabiko-table-reorder-row-commit-display' ) ).toBeNull();
		expect( window.cancelAnimationFrame ).toHaveBeenCalledTimes( 1 );
	} );
} );
