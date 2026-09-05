/**
 * 行並び替えのポインター入力境界が、開始可能なPCとタッチ端末の入力だけを現在Tableの行DnD開始候補へ接続することを確認する。
 *
 * DnD Engine内部の挙動は再現せず、入力境界が所有する入力受理条件、対象行の限定、
 * 一時Draggable登録の差し替え、および行DnD固有のEngine設定だけを検証する。
 */

import { Draggable, Feedback, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { RowInput, type RowDndPointerDownHandler } from './input';

jest.mock( '@dnd-kit/dom', () => ( {
	Draggable: jest.fn(),
	Feedback: {
		configure: jest.fn(),
	},
	PointerSensor: {
		configure: jest.fn(),
	},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropManager: jest.fn(),
} ) );

const draggableConstructorMock = Draggable as unknown as jest.Mock;
const feedbackConfigureMock = Feedback.configure as jest.MockedFunction<
	typeof Feedback.configure
>;
const pointerSensorConfigureMock = PointerSensor.configure as jest.MockedFunction<
	typeof PointerSensor.configure
>;
const useDragDropManagerMock = useDragDropManager as jest.MockedFunction<
	typeof useDragDropManager
>;

/**
 * ポインター入力境界へ渡す最小限のDnD Engine状態を生成する。
 *
 * @param idle 新しいDnD開始入力を受け付けられる場合はtrue。
 * @return テストで利用するDnD Engine状態。
 */
const createManager = ( idle = true ) =>
	( {
		dragOperation: {
			status: {
				idle,
			},
		},
	} ) as ReturnType< typeof useDragDropManager >;

/** 現在Tableのtbody直下行を含む入力対象DOMを生成する。 */
const createDirectRowTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = `
		<table>
			<tbody>
				<tr><td>row 0</td></tr>
				<tr><td>row 1</td></tr>
			</tbody>
		</table>
	`;

	const rows = currentTarget.querySelectorAll( 'tbody > tr' );
	const cells = currentTarget.querySelectorAll( 'tbody > tr > td' );

	if ( rows.length !== 2 || cells.length !== 2 ) {
		throw new Error( 'Row input test table could not be created.' );
	}

	return {
		currentTarget,
		rows,
		cells,
	};
};

/** 現在Table内の入れ子Table行を開始位置とする入力対象DOMを生成する。 */
const createNestedRowTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = `
		<table>
			<tbody>
				<tr>
					<td>
						<table>
							<tbody>
								<tr><td data-testid="nested-cell">nested</td></tr>
							</tbody>
						</table>
					</td>
				</tr>
			</tbody>
		</table>
	`;

	const target = currentTarget.querySelector( '[data-testid="nested-cell"]' );
	if ( ! target ) {
		throw new Error( 'Nested row test target could not be created.' );
	}

	return {
		currentTarget,
		target,
	};
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
 * @return 行DnD開始処理へ渡すポインターイベント。
 */
const createPointerEvent = ( options: {
	target: Element;
	currentTarget: Element;
	isPrimary?: boolean;
	button?: number;
	pointerType?: string;
} ): ReactPointerEvent< Element > =>
	( {
		target: options.target,
		currentTarget: options.currentTarget,
		isPrimary: options.isPrimary ?? true,
		button: options.button ?? 0,
		pointerType: options.pointerType ?? 'mouse',
	} ) as unknown as ReactPointerEvent< Element >;

/**
 * RowInputが子要素へ公開する現在のポインター開始処理を取得する。
 *
 * @param options                         描画条件。
 * @param options.enabled                 行並び替え開始入力を受け付ける場合はtrue。
 * @param options.activeDraggable         現在の一時Draggableを保持する参照。
 * @param options.activeDraggable.current 現在の一時Draggable。未登録の場合はnull。
 * @return 公開された開始処理と一時Draggable参照。
 */
const renderRowInput = ( options?: {
	enabled?: boolean;
	activeDraggable?: { current: Draggable | null };
} ) => {
	const capturedPointerDownHandler: {
		current: RowDndPointerDownHandler | null;
	} = {
		current: null,
	};
	const activeDraggable = options?.activeDraggable ?? { current: null };

	render(
		<RowInput
			enabled={ options?.enabled ?? true }
			tableIdentity="table-1"
			activeDraggable={ activeDraggable }
		>
			{ ( handler ) => {
				capturedPointerDownHandler.current = handler;
				return <div />;
			} }
		</RowInput>
	);

	const pointerDownHandler = capturedPointerDownHandler.current;
	if ( pointerDownHandler === null ) {
		throw new Error( 'RowInput did not provide a pointer handler.' );
	}

	return {
		pointerDownHandler,
		activeDraggable,
	};
};

describe( 'Row DnD input boundary', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		draggableConstructorMock.mockImplementation( () => ( {
			destroy: jest.fn(),
		} ) );
		useDragDropManagerMock.mockReturnValue( createManager() );
	} );

	/**
	 * 概要:
	 * - 有効なPC主入力で現在Tableのtbody直下行を開始候補として登録し、次の候補では前回登録を破棄することを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えが有効で、DnD Engineは新しいDnDを開始できる。
	 * - 現在Tableのtbodyには2行存在する。
	 *
	 * 操作:
	 * - 1行目、続けて2行目のセルから主マウスボタン入力を行う。
	 *
	 * 期待結果:
	 * - 各入力に対応する行だけがTable Identityと0-based行位置を持つDraggableとして登録される。
	 * - 2回目の登録前に1回目の一時Draggableが破棄される。
	 * - dnd-kit標準表示とTableセル内部からの開始を許可する行DnD設定が適用される。
	 */
	it( 'when primary mouse input targets direct tbody rows, should register only the current row and replace the previous candidate', () => {
		const { currentTarget, rows, cells } = createDirectRowTarget();
		const { pointerDownHandler, activeDraggable } = renderRowInput();

		pointerDownHandler(
			createPointerEvent( {
				target: cells[ 0 ],
				currentTarget,
			} )
		);

		const firstDraggable = activeDraggable.current;
		expect( firstDraggable ).not.toBeNull();
		expect( draggableConstructorMock ).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining( {
				id: 'ytr-row:table-1:0',
				element: rows[ 0 ],
				data: {
					tableIdentity: 'table-1',
					sourceRowIndex: 0,
				},
			} ),
			expect.anything()
		);

		pointerDownHandler(
			createPointerEvent( {
				target: cells[ 1 ],
				currentTarget,
			} )
		);

		expect( firstDraggable?.destroy ).toHaveBeenCalledTimes( 1 );
		expect( draggableConstructorMock ).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining( {
				id: 'ytr-row:table-1:1',
				element: rows[ 1 ],
				data: {
					tableIdentity: 'table-1',
					sourceRowIndex: 1,
				},
			} ),
			expect.anything()
		);
		expect( feedbackConfigureMock ).toHaveBeenCalledWith( {
			feedback: 'default',
		} );

		const pointerSensorOptions = pointerSensorConfigureMock.mock.calls[ 0 ]?.[ 0 ];
		expect(
			pointerSensorOptions?.preventActivation?.( {} as globalThis.PointerEvent, {} as Draggable )
		).toBe( false );
	} );

	/**
	 * 概要:
	 * - 有効なタッチ主入力をPC入力と同じPointerSensor経路へ接続できることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えが有効で、DnD Engineは新しいDnDを開始できる。
	 * - 現在Tableのtbody直下行へタッチ入力できる。
	 *
	 * 操作:
	 * - 行のセルから主タッチ入力を行う。
	 *
	 * 期待結果:
	 * - 入力対象行がTable Identityと0-based行位置を持つDraggableとして登録される。
	 */
	it( 'when primary touch input targets a direct tbody row, should register that row as the drag source', () => {
		const { currentTarget, rows, cells } = createDirectRowTarget();
		const { pointerDownHandler } = renderRowInput();

		pointerDownHandler(
			createPointerEvent( {
				target: cells[ 0 ],
				currentTarget,
				pointerType: 'touch',
			} )
		);

		expect( draggableConstructorMock ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: 'ytr-row:table-1:0',
				element: rows[ 0 ],
				data: {
					tableIdentity: 'table-1',
					sourceRowIndex: 0,
				},
			} ),
			expect.anything()
		);
	} );

	/**
	 * 概要:
	 * - 行DnD開始条件を満たさないポインター入力を開始候補へ登録しないことを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableのtbody直下行へ入力できる。
	 *
	 * 操作:
	 * - 非主ポインター、副ボタン、または進行中DnDへの追加入力を行う。
	 *
	 * 期待結果:
	 * - いずれの入力でもDraggableは登録されない。
	 */
	it.each( [
		{
			label: 'non-primary pointer',
			isPrimary: false,
			button: 0,
			pointerType: 'mouse',
			idle: true,
		},
		{
			label: 'secondary button',
			isPrimary: true,
			button: 1,
			pointerType: 'mouse',
			idle: true,
		},
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
	 * - 現在Table内に入れ子Tableがあっても、そのtbody行を行DnD開始対象にしないことを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableのセル内部に別Tableが存在する。
	 *
	 * 操作:
	 * - 入れ子Tableのtbody行に対して有効な主ポインター入力を行う。
	 *
	 * 期待結果:
	 * - 入れ子Tableの行は現在Tableのtbody直下行ではないため、Draggableは登録されない。
	 */
	it( 'when pointer input targets a nested table row, should not register that row as the current table drag source', () => {
		const { currentTarget, target } = createNestedRowTarget();
		const { pointerDownHandler } = renderRowInput();

		pointerDownHandler(
			createPointerEvent( {
				target,
				currentTarget,
			} )
		);

		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 行並び替えが無効なTableではポインター入力から行DnD開始候補を作らないことを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableは通常編集状態で、DnD Engine自体は利用できる。
	 *
	 * 操作:
	 * - tbody直下行へ有効な主ポインター入力を行う。
	 *
	 * 期待結果:
	 * - Draggableは登録されない。
	 */
	it( 'when row reordering is disabled, should ignore an otherwise eligible pointer start input', () => {
		const { currentTarget, cells } = createDirectRowTarget();
		const { pointerDownHandler } = renderRowInput( {
			enabled: false,
		} );

		pointerDownHandler(
			createPointerEvent( {
				target: cells[ 0 ],
				currentTarget,
			} )
		);

		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );
} );
