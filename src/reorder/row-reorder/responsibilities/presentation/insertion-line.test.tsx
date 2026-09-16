/**
 * Row Reorderの挿入位置表示が、DnD中の有効な移動先境界とdrop直後の行領域を正しく表現することを確認する。
 *
 * 移動先解決そのものは重複して検証せず、null時の非表示、先頭・行間・末尾境界への対応、editor表示領域への制限、
 * スクロール時の再計測、および正常なdrop後の可変行高枠とcleanupを検証する。
 */

import { act, render } from '@testing-library/react';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import { DND_POST_DROP_ROW_OUTLINE_DURATION_MS } from '@/reorder/reorder-tuning';

import { RowInsertionLine } from './insertion-line';

let mockDestinationBoundaryIndex: number | null = null;
let mockDragDropMonitor: {
	onDragStart?: ( event: any ) => void;
	onDragMove?: () => void;
	onDragEnd?: ( event: { canceled: boolean } ) => void;
} = {};

jest.mock( '@/reorder/row-reorder/integration/dnd-interaction-react', () => ( {
	useRowDndDestinationBoundaryIndex: () => mockDestinationBoundaryIndex,
} ) );

jest.mock( '@/reorder/editor-dom-context', () => ( {
	resolveEditorDomContext: jest.fn(),
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropMonitor: ( monitor: typeof mockDragDropMonitor ) => {
		mockDragDropMonitor = monitor;
	},
} ) );

const resolveEditorDomContextMock = resolveEditorDomContext as jest.MockedFunction<
	typeof resolveEditorDomContext
>;

/**
 * 挿入位置表示の成立条件を必要な値だけで表せるDOM矩形を作成する。
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
 * 挿入位置表示の成立条件を満たす2行の対象Tableを用意する。
 *
 * @param firstHeight 先頭行の実測高さとして扱う値。
 * @param secondHeight 2行目の実測高さとして扱う値。
 * @return 対象行とtbodyの表示位置を変更できるmock。
 */
const createSourceTable = ( firstHeight = 40, secondHeight = 50 ) => {
	const tableTop = 80;
	const firstBottom = tableTop + firstHeight;
	const secondBottom = firstBottom + secondHeight;
	const table = document.createElement( 'table' );
	const tbody = document.createElement( 'tbody' );
	const first = document.createElement( 'tr' );
	const second = document.createElement( 'tr' );
	first.appendChild( document.createElement( 'td' ) );
	second.appendChild( document.createElement( 'td' ) );
	tbody.append( first, second );
	table.appendChild( tbody );
	document.body.appendChild( table );

	jest
		.spyOn( table, 'getBoundingClientRect' )
		.mockReturnValue( rectangle( { left: -20, right: 300, width: 320 } ) );
	const bodyRectangleMock = jest
		.spyOn( tbody, 'getBoundingClientRect' )
		.mockReturnValue(
			rectangle( { top: tableTop, bottom: secondBottom, height: firstHeight + secondHeight } )
		);
	jest.spyOn( first, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: tableTop,
			bottom: firstBottom,
			height: firstHeight,
		} )
	);
	jest.spyOn( second, 'getBoundingClientRect' ).mockReturnValue(
		rectangle( {
			top: firstBottom,
			bottom: secondBottom,
			height: secondHeight,
		} )
	);

	return { first, second, bodyRectangleMock };
};

/**
 * DnD Engineから対象行の物理DnD開始が通知された状態を作る。
 *
 * @param row 物理DnDの移動対象として通知する行。
 */
const startPhysicalDrag = ( row: HTMLTableRowElement ) => {
	act( () => {
		mockDragDropMonitor.onDragStart?.( {
			operation: { source: { element: row } },
		} );
	} );
};

/**
 * DnD Engineから物理DnD終了が通知された状態を作る。
 *
 * @param canceled DnDがcancelされた終了かどうか。
 */
const endPhysicalDrag = ( canceled: boolean ) => {
	act( () => {
		mockDragDropMonitor.onDragEnd?.( { canceled } );
	} );
};

describe( 'Row insertion line', () => {
	beforeEach( () => {
		jest.useFakeTimers();
		mockDestinationBoundaryIndex = null;
		mockDragDropMonitor = {};
		document.body.replaceChildren();
		resolveEditorDomContextMock.mockReturnValue( {
			document,
			window: { innerWidth: 240, innerHeight: 600 } as unknown as NonNullable<
				Document[ 'defaultView' ]
			>,
		} );
	} );

	afterEach( () => {
		jest.useRealTimers();
	} );

	/**
	 * 概要:
	 * - 有効な移動先境界がない場合は挿入線を表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 物理DnDは対象行で開始している。
	 * - DnD Interactionの移動先境界はnullである。
	 *
	 * 操作:
	 * - 挿入位置表示を描画する。
	 *
	 * 期待結果:
	 * - 挿入線は表示されない。
	 */
	it( 'when the destination boundary is null, should not show an insertion line', () => {
		const { first } = createSourceTable();
		render( <RowInsertionLine /> );
		startPhysicalDrag( first );

		expect( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - 最初の要素の手前を示す移動先境界を、先頭行の論理的な上端へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 2行のTableで境界0が有効な移動先である。
	 *
	 * 操作:
	 * - 物理DnD開始後に境界0を表示する。
	 *
	 * 期待結果:
	 * - 先頭行の論理的な上端へ挿入線が表示される。
	 */
	it( 'when the destination is before the first row, should show the line at the first logical row top', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 0;
		rerender( <RowInsertionLine /> );

		const line = document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement;
		expect( line ).not.toBeNull();
		expect( line.style.top ).toBe( '80px' );
	} );

	/**
	 * 概要:
	 * - 行間の有効な移動先境界を、その論理境界へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 2行のTableで境界1が有効な移動先である。
	 * - Table左端は表示領域外、右端は表示領域より外側にある。
	 *
	 * 操作:
	 * - 物理DnD開始後に境界1を表示する。
	 *
	 * 期待結果:
	 * - 行間の論理境界へ、現在表示領域とTableが重なる横幅だけ挿入線が表示される。
	 */
	it( 'when an internal destination boundary is active, should show the line at the logical boundary within the visible table width', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 1;
		rerender( <RowInsertionLine /> );

		const line = document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement;
		expect( line ).not.toBeNull();
		expect( line.style.top ).toBe( '120px' );
		expect( line.style.left ).toBe( '0px' );
		expect( line.style.width ).toBe( '240px' );
	} );

	/**
	 * 概要:
	 * - 最後の要素の後ろを示す移動先境界を、最終行の論理的な下端へ表示することを確認する。
	 *
	 * 事前条件:
	 * - 2行のTableで境界2が有効な移動先である。
	 *
	 * 操作:
	 * - 物理DnD開始後に境界2を表示する。
	 *
	 * 期待結果:
	 * - 最終行の論理的な下端へ挿入線が表示される。
	 */
	it( 'when the destination is after the last row, should show the line at the last logical row bottom', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );

		const line = document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement;
		expect( line ).not.toBeNull();
		expect( line.style.top ).toBe( '170px' );
	} );

	/**
	 * 概要:
	 * - 移動先境界が変わらなくても、Table全体の物理移動に伴って論理境界の表示位置を再計測することを確認する。
	 *
	 * 事前条件:
	 * - 境界0の挿入線が先頭境界に表示されている。
	 * - editor内のスクロール等により、tbody全体の表示位置が変化している。
	 *
	 * 操作:
	 * - DnD Engineから物理移動を通知する。
	 *
	 * 期待結果:
	 * - 移動先境界を変更せず、挿入線がtbody全体の現在位置へ追従する。
	 */
	it( 'when the table body moves without changing the destination boundary, should remeasure the current logical boundary position', () => {
		const { first, bodyRectangleMock } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 0;
		rerender( <RowInsertionLine /> );
		expect(
			( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement ).style
				.top
		).toBe( '80px' );

		bodyRectangleMock.mockReturnValue( rectangle( { top: 60, bottom: 150, height: 90 } ) );
		act( () => {
			mockDragDropMonitor.onDragMove?.();
		} );

		expect(
			( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) as HTMLElement ).style
				.top
		).toBe( '60px' );
	} );

	/**
	 * 概要:
	 * - 下方向への正常なdrop後に、移動元行の実測高さでdrop位置を囲むことを確認する。
	 *
	 * 事前条件:
	 * - 先頭の40px行を最終境界へ移動している。
	 *
	 * 操作:
	 * - 正常なphysical dropを完了する。
	 *
	 * 期待結果:
	 * - 挿入線は消え、最終境界の上側40pxを囲む枠が表示される。
	 */
	it( 'when a row is dropped downward, should outline the measured source-row height above the destination boundary', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );

		endPhysicalDrag( false );

		const outline = document.querySelector(
			'.yamabiko-table-reorder-post-drop-row-outline'
		) as HTMLElement;
		expect( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) ).toBeNull();
		expect( outline ).not.toBeNull();
		expect( outline.style.top ).toBe( '130px' );
		expect( outline.style.height ).toBe( '40px' );
		expect( outline.style.left ).toBe( '0px' );
		expect( outline.style.width ).toBe( '240px' );
	} );

	/**
	 * 概要:
	 * - 上方向への正常なdrop後に、移動元行の実測高さでdrop位置を囲むことを確認する。
	 *
	 * 事前条件:
	 * - 2行目の50px行を先頭境界へ移動している。
	 *
	 * 操作:
	 * - 正常なphysical dropを完了する。
	 *
	 * 期待結果:
	 * - 先頭境界の下側50pxを囲む枠が表示される。
	 */
	it( 'when a row is dropped upward, should outline the measured source-row height below the destination boundary', () => {
		const { second } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( second );
		mockDestinationBoundaryIndex = 0;
		rerender( <RowInsertionLine /> );

		endPhysicalDrag( false );

		const outline = document.querySelector(
			'.yamabiko-table-reorder-post-drop-row-outline'
		) as HTMLElement;
		expect( outline ).not.toBeNull();
		expect( outline.style.top ).toBe( '80px' );
		expect( outline.style.height ).toBe( '50px' );
	} );

	/**
	 * 概要:
	 * - 複数行テキスト等で高さのある行でも、固定値ではなく実測高さをdrop後表示へ反映することを確認する。
	 *
	 * 事前条件:
	 * - 移動元の先頭行は90pxの高さで描画されている。
	 *
	 * 操作:
	 * - 最終境界へ正常にdropする。
	 *
	 * 期待結果:
	 * - drop位置の枠は移動元行と同じ90pxの高さになる。
	 */
	it( 'when the source row has a taller measured height, should preserve that height in the post-drop outline', () => {
		const { first } = createSourceTable( 90, 50 );
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );

		endPhysicalDrag( false );

		const outline = document.querySelector(
			'.yamabiko-table-reorder-post-drop-row-outline'
		) as HTMLElement;
		expect( outline.style.top ).toBe( '130px' );
		expect( outline.style.height ).toBe( '90px' );
	} );

	/**
	 * 概要:
	 * - drop後の行領域枠が所定時間だけ表示され、その後自動的に消えることを確認する。
	 *
	 * 事前条件:
	 * - 正常なdropによる行領域枠が表示されている。
	 *
	 * 操作:
	 * - drop後表示時間を経過させる。
	 *
	 * 期待結果:
	 * - 表示時間内は枠が残り、表示時間経過後に自動的に消える。
	 */
	it( 'when the post-drop duration elapses, should remove the row outline', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );
		endPhysicalDrag( false );

		act( () => {
			jest.advanceTimersByTime( DND_POST_DROP_ROW_OUTLINE_DURATION_MS - 1 );
		} );
		expect(
			document.querySelector( '.yamabiko-table-reorder-post-drop-row-outline' )
		).not.toBeNull();

		act( () => {
			jest.advanceTimersByTime( 1 );
		} );
		expect( document.querySelector( '.yamabiko-table-reorder-post-drop-row-outline' ) ).toBeNull();
	} );

	/**
	 * 概要:
	 * - cancelされたDnDではdrop後の行領域枠を表示しないことを確認する。
	 *
	 * 事前条件:
	 * - 有効な移動先境界に挿入線が表示されている。
	 *
	 * 操作:
	 * - physical DnDをcancelする。
	 *
	 * 期待結果:
	 * - 挿入線は除去され、行領域枠とtimerは作成されない。
	 */
	it( 'when the physical drag is canceled, should not show a post-drop row outline', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );

		endPhysicalDrag( true );

		expect( document.querySelector( '.yamabiko-table-reorder-insertion-line' ) ).toBeNull();
		expect( document.querySelector( '.yamabiko-table-reorder-post-drop-row-outline' ) ).toBeNull();
		expect( jest.getTimerCount() ).toBe( 0 );
	} );

	/**
	 * 概要:
	 * - 有効な挿入線がないDnD終了ではdrop後表示を開始しないことを確認する。
	 *
	 * 事前条件:
	 * - 物理DnDは開始しているが、有効な移動先境界はない。
	 *
	 * 操作:
	 * - physical dropを完了する。
	 *
	 * 期待結果:
	 * - 行領域枠は表示されず、drop後表示用のtimerも開始されない。
	 */
	it( 'when a physical drop ends without a visible insertion line, should not start post-drop display', () => {
		const { first } = createSourceTable();
		render( <RowInsertionLine /> );
		startPhysicalDrag( first );

		endPhysicalDrag( false );

		expect( document.querySelector( '.yamabiko-table-reorder-post-drop-row-outline' ) ).toBeNull();
		expect( jest.getTimerCount() ).toBe( 0 );
	} );

	/**
	 * 概要:
	 * - drop後表示中に次のDnDが始まった場合、前回の表示を次の操作へ持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - 前回の正常なdropによる行領域枠が表示時間内で残っている。
	 *
	 * 操作:
	 * - 次のphysical DnDを開始する。
	 *
	 * 期待結果:
	 * - 前回のdrop後表示とtimerが破棄される。
	 */
	it( 'when a new physical drag starts during post-drop display, should clear the previous outline and timer', () => {
		const { first } = createSourceTable();
		const { rerender } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );
		endPhysicalDrag( false );
		expect( jest.getTimerCount() ).toBe( 1 );

		mockDestinationBoundaryIndex = null;
		startPhysicalDrag( first );

		expect( document.querySelector( '.yamabiko-table-reorder-post-drop-row-outline' ) ).toBeNull();
		expect( jest.getTimerCount() ).toBe( 0 );
	} );

	/**
	 * 概要:
	 * - componentが破棄された場合、drop後表示の未完了timerを残さないことを確認する。
	 *
	 * 事前条件:
	 * - 正常なdrop後の行領域枠が表示時間内で残っている。
	 *
	 * 操作:
	 * - 挿入位置表示componentをunmountする。
	 *
	 * 期待結果:
	 * - 未完了のdrop後表示timerが破棄される。
	 */
	it( 'when the component unmounts during post-drop display, should clear the pending timer', () => {
		const { first } = createSourceTable();
		const { rerender, unmount } = render( <RowInsertionLine /> );
		startPhysicalDrag( first );
		mockDestinationBoundaryIndex = 2;
		rerender( <RowInsertionLine /> );
		endPhysicalDrag( false );
		expect( jest.getTimerCount() ).toBe( 1 );

		unmount();

		expect( jest.getTimerCount() ).toBe( 0 );
	} );
} );
