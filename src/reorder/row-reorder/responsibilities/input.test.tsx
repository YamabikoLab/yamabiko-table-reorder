/**
 * 行並び替えのポインター入力境界が、開始可能なPCとタッチ端末の入力だけを現在Tableの行DnD開始候補へ接続することを確認する。
 *
 * DnD Engine内部の挙動は再現せず、入力境界が所有する入力受理条件、対象行の限定、
 * Reorder Target Resolutionによる開始可否、開始拒否通知、一時Draggable登録の差し替え、
 * および行DnD固有のEngine設定だけを検証する。Reorder Modeの有効判定はDnD接続境界の責務とする。
 */

import { Draggable, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { RowInput, type RowDndPointerDownHandler } from './input';
import { resolveRowReorderTarget } from './target-resolution';

jest.mock( '@dnd-kit/dom', () => ( {
	Draggable: jest.fn(),
	PointerSensor: {
		configure: jest.fn(),
	},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropManager: jest.fn(),
} ) );

jest.mock( './target-resolution', () => ( {
	resolveRowReorderTarget: jest.fn(),
} ) );

const draggableConstructorMock = Draggable as unknown as jest.Mock;
const pointerSensorConfigureMock = PointerSensor.configure as jest.MockedFunction<
	typeof PointerSensor.configure
>;
const useDragDropManagerMock = useDragDropManager as jest.MockedFunction<
	typeof useDragDropManager
>;
const resolveRowReorderTargetMock = resolveRowReorderTarget as jest.MockedFunction<
	typeof resolveRowReorderTarget
>;

/**
 * DnD Engineの開始可否状態を生成する。
 * @param idle
 */
const createManager = ( idle = true ) =>
	( {
		dragOperation: {
			status: { idle },
		},
	} ) as ReturnType< typeof useDragDropManager >;

/** 現在Tableのtbody直下行を含む入力対象DOMを生成する。 */
const createDirectRowTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = `
		<table><tbody>
			<tr><td>row 0</td></tr>
			<tr><td>row 1</td></tr>
		</tbody></table>
	`;
	const rows = currentTarget.querySelectorAll( 'tbody > tr' );
	const cells = currentTarget.querySelectorAll( 'tbody > tr > td' );
	return { currentTarget, rows, cells };
};

/** 現在Table内の入れ子Table行を開始位置とする入力対象DOMを生成する。 */
const createNestedRowTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = `
		<table><tbody><tr><td>
			<table><tbody><tr><td data-testid="nested-cell">nested</td></tr></tbody></table>
		</td></tr></tbody></table>
	`;
	const target = currentTarget.querySelector( '[data-testid="nested-cell"]' );
	if ( target === null ) {
		throw new Error( 'Nested row test target could not be created.' );
	}
	return { currentTarget, target };
};

/**
 * 行DnD開始処理へ渡すReactポインターイベントを生成する。
 *
 * @param options               イベント生成条件。
 * @param options.target        入力開始位置。
 * @param options.currentTarget 現在Tableの基準要素。
 * @param options.isPrimary     主ポインター入力の場合はtrue。
 * @param options.button        入力ボタン番号。
 * @param options.pointerType   ポインター入力方式。
 * @param options.clientX       ビューポート内の水平操作位置。
 * @param options.clientY       ビューポート内の垂直操作位置。
 * @return 行DnD開始処理へ渡すポインターイベント。
 */
const createPointerEvent = ( options: {
	target: Element;
	currentTarget: Element;
	isPrimary?: boolean;
	button?: number;
	pointerType?: string;
	clientX?: number;
	clientY?: number;
} ): ReactPointerEvent< Element > =>
	( {
		target: options.target,
		currentTarget: options.currentTarget,
		isPrimary: options.isPrimary ?? true,
		button: options.button ?? 0,
		pointerType: options.pointerType ?? 'mouse',
		clientX: options.clientX ?? 0,
		clientY: options.clientY ?? 0,
		preventDefault: jest.fn(),
	} ) as unknown as ReactPointerEvent< Element >;

/** RowInputが子要素へ公開する開始処理を取得する。 */
const renderRowInput = () => {
	const capturedHandler: { current: RowDndPointerDownHandler | null } = { current: null };
	const activeDraggable: { current: Draggable | null } = { current: null };
	const onStartRejection = jest.fn();

	render(
		<RowInput
			tableIdentity="table-1"
			activeDraggable={ activeDraggable }
			onStartRejection={ onStartRejection }
		>
			{ ( handler ) => {
				capturedHandler.current = handler;
				return <div />;
			} }
		</RowInput>
	);

	if ( capturedHandler.current === null ) {
		throw new Error( 'RowInput did not provide a pointer handler.' );
	}

	return { pointerDownHandler: capturedHandler.current, activeDraggable, onStartRejection };
};

describe( 'Row DnD input boundary', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		draggableConstructorMock.mockImplementation( () => ( { destroy: jest.fn() } ) );
		useDragDropManagerMock.mockReturnValue( createManager() );
		resolveRowReorderTargetMock.mockImplementation( ( currentTarget ) => ( {
			status: 'resolved',
			target: currentTarget,
			initialConstraints: { rowCount: 2, blockedBoundaries: [] },
		} ) );
	} );

	/**
	 * 概要:
	 * - 有効な主マウス入力で現在Tableのtbody直下行を開始候補として登録し、次の候補で前回登録を破棄することを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineは新しいDnDを開始でき、tbody直下に2行存在する。
	 *
	 * 操作:
	 * - 1行目、続けて2行目へ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 各入力の行がTable Identityと0-based行位置を持つDraggableとして登録される。
	 * - 2回目の登録前に1回目のDraggableが破棄される。
	 * - Tableセル内部からの開始を許可する行DnD設定が適用される。
	 */
	it( 'when primary mouse input targets direct tbody rows, should register the current row and replace the previous candidate', () => {
		const { currentTarget, rows, cells } = createDirectRowTarget();
		const { pointerDownHandler, activeDraggable } = renderRowInput();

		pointerDownHandler( createPointerEvent( { target: cells[ 0 ], currentTarget } ) );
		const firstDraggable = activeDraggable.current;
		pointerDownHandler( createPointerEvent( { target: cells[ 1 ], currentTarget } ) );

		expect( draggableConstructorMock ).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining( {
				id: 'ytr-row:table-1:0',
				element: rows[ 0 ],
				data: { tableIdentity: 'table-1', sourceRowIndex: 0 },
			} ),
			expect.anything()
		);
		expect( firstDraggable?.destroy ).toHaveBeenCalledTimes( 1 );
		expect( draggableConstructorMock ).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining( {
				id: 'ytr-row:table-1:1',
				element: rows[ 1 ],
				data: { tableIdentity: 'table-1', sourceRowIndex: 1 },
			} ),
			expect.anything()
		);
		const pointerSensorOptions = pointerSensorConfigureMock.mock.calls[ 0 ]?.[ 0 ];
		expect(
			pointerSensorOptions?.preventActivation?.( {} as globalThis.PointerEvent, {} as Draggable )
		).toBe( false );
	} );

	/**
	 * 概要:
	 * - Reorder Target Resolutionが開始拒否した行では理由を通知し、物理DnDへ登録しないことを確認する。
	 *
	 * 事前条件:
	 * - 対象行は結合範囲により開始拒否となる。
	 *
	 * 操作:
	 * - 対象行から主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 対象行が正しいTable Identityと行位置でTarget Resolutionへ渡される。
	 * - 拒否理由と操作位置が通知され、Draggableは登録されない。
	 */
	it( 'when target resolution rejects the row, should notify the rejection without registering a draggable', () => {
		const blockingMergedRange = {
			rowStart: 0,
			rowEnd: 1,
			columnStart: 0,
			columnEnd: 0,
		};
		resolveRowReorderTargetMock.mockReturnValue( {
			status: 'rejected',
			blockingMergedRange,
		} );
		const { currentTarget, cells } = createDirectRowTarget();
		const { pointerDownHandler, onStartRejection } = renderRowInput();

		pointerDownHandler(
			createPointerEvent( { target: cells[ 0 ], currentTarget, clientX: 120, clientY: 240 } )
		);

		expect( resolveRowReorderTargetMock ).toHaveBeenCalledWith( {
			tableIdentity: 'table-1',
			sourceRowIndex: 0,
		} );
		expect( onStartRejection ).toHaveBeenCalledWith( {
			blockingMergedRange,
			clientX: 120,
			clientY: 240,
		} );
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 通常の利用不能結果では通知せず、物理DnDへ登録しないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Target Resolutionは対象行を通常の利用不能として解決する。
	 *
	 * 操作:
	 * - 対象行へ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 開始拒否通知もDraggable登録も発生しない。
	 */
	it( 'when target resolution is unavailable, should not notify or register a draggable', () => {
		resolveRowReorderTargetMock.mockReturnValue( { status: 'unavailable' } );
		const { currentTarget, cells } = createDirectRowTarget();
		const { pointerDownHandler, onStartRejection } = renderRowInput();
		pointerDownHandler( createPointerEvent( { target: cells[ 0 ], currentTarget } ) );

		expect( onStartRejection ).not.toHaveBeenCalled();
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 主タッチ入力も行DnD開始候補として登録できることを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineは新しいDnDを開始でき、tbody直下行へタッチ入力できる。
	 *
	 * 操作:
	 * - 行のセルから主タッチ入力を行う。
	 *
	 * 期待結果:
	 * - 対象行がDraggableとして登録される。
	 */
	it( 'when primary touch input targets a direct tbody row, should register that row as the drag source', () => {
		const { currentTarget, rows, cells } = createDirectRowTarget();
		const { pointerDownHandler } = renderRowInput();
		pointerDownHandler(
			createPointerEvent( { target: cells[ 0 ], currentTarget, pointerType: 'touch' } )
		);

		expect( draggableConstructorMock ).toHaveBeenCalledWith(
			expect.objectContaining( { element: rows[ 0 ] } ),
			expect.anything()
		);
	} );

	/**
	 * 概要:
	 * - DnD開始条件を満たさない入力は開始候補へ登録しないことを確認する。
	 *
	 * 操作:
	 * - 非主ポインター、副ボタン、進行中DnDへの追加入力を行う。
	 *
	 * 期待結果:
	 * - Draggableは登録されない。
	 */
	it.each( [
		{ label: 'non-primary pointer', isPrimary: false, button: 0, pointerType: 'mouse', idle: true },
		{ label: 'secondary button', isPrimary: true, button: 1, pointerType: 'mouse', idle: true },
		{
			label: 'additional pointer during active DnD',
			isPrimary: true,
			button: 0,
			pointerType: 'touch',
			idle: false,
		},
	] )(
		'when $label input is not eligible to start row DnD, should not register a draggable',
		( { isPrimary, button, pointerType, idle } ) => {
			useDragDropManagerMock.mockReturnValue( createManager( idle ) );
			const { currentTarget, cells } = createDirectRowTarget();
			const { pointerDownHandler } = renderRowInput();
			pointerDownHandler(
				createPointerEvent( {
					target: cells[ 0 ],
					currentTarget,
					isPrimary,
					button,
					pointerType,
				} )
			);
			expect( draggableConstructorMock ).not.toHaveBeenCalled();
		}
	);

	/**
	 * 概要:
	 * - 現在Table内の入れ子Table行は開始対象にしないことを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableのセル内部に別Tableが存在する。
	 *
	 * 操作:
	 * - 入れ子Tableの行へ主ポインター入力を行う。
	 *
	 * 期待結果:
	 * - 入れ子Tableの行はDraggableとして登録されない。
	 */
	it( 'when pointer input targets a nested table row, should not register that row as the current table drag source', () => {
		const { currentTarget, target } = createNestedRowTarget();
		const { pointerDownHandler } = renderRowInput();
		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );

		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );
} );
