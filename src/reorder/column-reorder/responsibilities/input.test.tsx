/**
 * 列並び替えのポインター入力境界が、PCとタッチ端末を同じ開始対象解決経路へ接続することを確認する。
 *
 * DnD Engine内部の進行は再現せず、入力受理、論理列解決、Target Resolution結果、
 * 入力方式固有の開始条件、一時Draggable登録の差し替えというInput Interactionから観測できる振る舞いを検証する。
 */

import { Draggable, PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { ColumnInput, type ColumnDndPointerDownHandler } from './input';
import { columnReorderTargetResolution } from './target-resolution';

jest.mock( '@dnd-kit/dom', () => ( {
	Draggable: jest.fn(),
	PointerActivationConstraints: {
		Distance: jest.fn(),
		Delay: jest.fn(),
	},
	PointerSensor: {
		configure: jest.fn(),
	},
} ) );

jest.mock( '@dnd-kit/react', () => ( {
	useDragDropManager: jest.fn(),
} ) );

jest.mock( './target-resolution', () => ( {
	columnReorderTargetResolution: {
		resolve: jest.fn(),
	},
} ) );

const draggableConstructorMock = Draggable as unknown as jest.Mock;
const distanceConstraintMock = PointerActivationConstraints.Distance as unknown as jest.Mock;
const delayConstraintMock = PointerActivationConstraints.Delay as unknown as jest.Mock;
const pointerSensorConfigureMock = PointerSensor.configure as jest.MockedFunction<
	typeof PointerSensor.configure
>;
const useDragDropManagerMock = useDragDropManager as jest.MockedFunction<
	typeof useDragDropManager
>;
const targetResolutionMock = columnReorderTargetResolution as jest.Mocked<
	typeof columnReorderTargetResolution
>;

/**
 * ポインター入力境界へ渡す最小限のDnD Engine状態を生成する。
 *
 * @param idle 新しい物理DnD開始候補を受け付けられる場合はtrue。
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

/** 縦結合を含み、DOM上のcellIndexと論理列位置が異なるTableを生成する。 */
const createTableTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = `
		<table>
			<tbody>
				<tr>
					<td rowspan="2">A</td>
					<td>B</td>
					<td>C</td>
				</tr>
				<tr>
					<td data-testid="target">D</td>
					<td data-testid="next">E</td>
				</tr>
			</tbody>
		</table>
	`;

	const target = currentTarget.querySelector( '[data-testid="target"]' );
	const next = currentTarget.querySelector( '[data-testid="next"]' );

	if ( ! target || ! next ) {
		throw new Error( 'Column input test table could not be created.' );
	}

	return { currentTarget, target, next };
};

/** 横結合の後続セルでDOM上のcellIndexと論理列位置が異なるTableを生成する。 */
const createColspanTableTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = `
		<table>
			<tbody>
				<tr>
					<td colspan="2">A</td>
					<td data-testid="target">B</td>
				</tr>
			</tbody>
		</table>
	`;

	const target = currentTarget.querySelector( '[data-testid="target"]' );
	if ( ! target ) {
		throw new Error( 'Column colspan input test target could not be created.' );
	}

	return { currentTarget, target };
};

/**
 * 列DnD開始処理へ渡すポインターイベントを生成する。
 *
 * @param options               入力条件。
 * @param options.target        入力が開始されたDOM要素。
 * @param options.currentTarget 現在Tableの基準要素。
 * @param options.pointerType   ポインター入力方式。
 * @param options.isPrimary     主ポインター入力の場合はtrue。
 * @param options.button        入力ボタン番号。
 * @return 列DnD開始処理へ渡すReactポインターイベント。
 */
const createPointerEvent = ( options: {
	target: Element;
	currentTarget: Element;
	pointerType?: string;
	isPrimary?: boolean;
	button?: number;
} ): ReactPointerEvent< Element > =>
	( {
		target: options.target,
		currentTarget: options.currentTarget,
		isPrimary: options.isPrimary ?? true,
		button: options.button ?? 0,
		pointerType: options.pointerType ?? 'mouse',
		preventDefault: jest.fn(),
	} ) as unknown as ReactPointerEvent< Element >;

/** ColumnInputが子要素へ公開する現在のポインター開始処理を取得する。 */
const renderColumnInput = () => {
	const capturedHandler: { current: ColumnDndPointerDownHandler | null } = { current: null };
	const activeDraggable: { current: Draggable | null } = { current: null };

	render(
		<ColumnInput enabled tableIdentity="table-1" activeDraggable={ activeDraggable }>
			{ ( handler ) => {
				capturedHandler.current = handler;
				return <div />;
			} }
		</ColumnInput>
	);

	if ( capturedHandler.current === null ) {
		throw new Error( 'ColumnInput did not provide a pointer handler.' );
	}

	return {
		pointerDownHandler: capturedHandler.current,
		activeDraggable,
	};
};

describe( 'Column DnD input boundary', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		draggableConstructorMock.mockImplementation( () => ( {
			destroy: jest.fn(),
		} ) );
		distanceConstraintMock.mockImplementation( ( options ) => options );
		delayConstraintMock.mockImplementation( ( options ) => options );
		useDragDropManagerMock.mockReturnValue( createManager() );
		targetResolutionMock.resolve.mockImplementation( ( target ) => ( {
			status: 'resolved',
			target,
			initialConstraints: {
				columnCount: 3,
				blockedBoundaries: [],
			},
		} ) );
	} );

	/**
	 * PC入力位置を結合状態を反映した論理列へ解決し、現在候補だけを物理DnDへ登録することを確認する。
	 *
	 * 事前条件:
	 * - 前行から継続する縦結合により、対象セルのDOM上の位置と論理列位置が異なる。
	 *
	 * 操作:
	 * - 同じ行の2つのセルへ順に主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 対象セルは論理列1、次セルは論理列2として第一段階解決される。
	 * - 2回目の開始候補登録前に1回目のDraggableが破棄される。
	 */
	it( 'when primary mouse input targets cells after a continuing rowspan, should register the resolved logical column and replace the previous candidate', () => {
		const { currentTarget, target, next } = createTableTarget();
		const { pointerDownHandler, activeDraggable } = renderColumnInput();

		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );
		const firstDraggable = activeDraggable.current;

		expect( targetResolutionMock.resolve ).toHaveBeenNthCalledWith( 1, {
			tableIdentity: 'table-1',
			sourceColumnIndex: 1,
		} );
		expect( draggableConstructorMock ).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining( {
				id: 'ytr-column:table-1:1',
				element: target,
			} ),
			expect.anything()
		);

		pointerDownHandler( createPointerEvent( { target: next, currentTarget } ) );

		expect( firstDraggable?.destroy ).toHaveBeenCalledTimes( 1 );
		expect( targetResolutionMock.resolve ).toHaveBeenNthCalledWith( 2, {
			tableIdentity: 'table-1',
			sourceColumnIndex: 2,
		} );
	} );

	/**
	 * 横結合セルの後ろにあるセルをTable全体の論理列位置で開始候補にすることを確認する。
	 *
	 * 事前条件:
	 * - 対象セルの直前に2論理列を占有する横結合セルが存在する。
	 *
	 * 操作:
	 * - 横結合セルの後続セルへ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 対象セルは論理列2として第一段階解決される。
	 */
	it( 'when mouse input targets a cell after a colspan, should resolve its table-wide logical column before registration', () => {
		const { currentTarget, target } = createColspanTableTarget();
		const { pointerDownHandler } = renderColumnInput();

		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );

		expect( targetResolutionMock.resolve ).toHaveBeenCalledWith( {
			tableIdentity: 'table-1',
			sourceColumnIndex: 2,
		} );
	} );

	/**
	 * 第一段階で開始不可となった列は物理DnD開始候補へ登録されないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Target Resolutionが対象列を開始拒否として解決する。
	 *
	 * 操作:
	 * - 対象セルへ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - Draggableは登録されない。
	 */
	it( 'when first-stage target resolution rejects the column, should not register a draggable', () => {
		targetResolutionMock.resolve.mockReturnValue( {
			status: 'rejected',
			reason: 'merged-range',
		} );
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();

		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );

		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	/**
	 * activeな物理DnD中は現在の開始候補を維持し、追加入力から別候補へ置き換えないことを確認する。
	 *
	 * 事前条件:
	 * - idle中の入力でDraggableが登録された後、DnD Engineがactiveになっている。
	 *
	 * 操作:
	 * - active DnD中に別セルへ主入力を行う。
	 *
	 * 期待結果:
	 * - 現在のDraggableは破棄されず、新しい第一段階解決も行われない。
	 */
	it( 'when a physical drag is already active, should preserve the current draggable and ignore additional pointer input', () => {
		const manager = {
			dragOperation: {
				status: {
					idle: true,
				},
			},
		};
		useDragDropManagerMock.mockReturnValue( manager as ReturnType< typeof useDragDropManager > );
		const { currentTarget, target, next } = createTableTarget();
		const { pointerDownHandler, activeDraggable } = renderColumnInput();

		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );
		const currentDraggable = activeDraggable.current;
		manager.dragOperation.status.idle = false;
		pointerDownHandler(
			createPointerEvent( { target: next, currentTarget, pointerType: 'touch' } )
		);

		expect( currentDraggable?.destroy ).not.toHaveBeenCalled();
		expect( activeDraggable.current ).toBe( currentDraggable );
		expect( targetResolutionMock.resolve ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * タッチ入力をPC入力と同じ第一段階Target ResolutionとDraggable登録経路へ接続し、通常スクロールを開始時点で妨げないことを確認する。
	 *
	 * 事前条件:
	 * - 対象列は開始可能で、DnD Engineはidleである。
	 *
	 * 操作:
	 * - 対象セルへ主タッチ入力を行う。
	 *
	 * 期待結果:
	 * - マウスと同じTarget Resolutionを経てDraggableが登録される。
	 * - pointerdown時点ではブラウザー既定動作を抑止しない。
	 * - タッチ開始条件には長押しが設定される。
	 */
	it( 'when primary touch input targets a resolvable column, should register it through the shared path without preventing the initial browser action', () => {
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();
		const event = createPointerEvent( {
			target,
			currentTarget,
			pointerType: 'touch',
		} );

		pointerDownHandler( event );

		expect( targetResolutionMock.resolve ).toHaveBeenCalledWith( {
			tableIdentity: 'table-1',
			sourceColumnIndex: 1,
		} );
		expect( draggableConstructorMock ).toHaveBeenCalledTimes( 1 );
		expect( event.preventDefault ).not.toHaveBeenCalled();

		const pointerSensorOptions = pointerSensorConfigureMock.mock.calls[ 0 ]?.[ 0 ];
		const activationConstraints = pointerSensorOptions?.activationConstraints;
		if ( typeof activationConstraints !== 'function' ) {
			throw new Error( 'Column touch activation constraints were not configured.' );
		}

		activationConstraints(
			{ pointerType: 'touch' } as globalThis.PointerEvent,
			{} as Draggable
		);
		expect( delayConstraintMock ).toHaveBeenCalledWith( {
			value: 250,
			tolerance: 5,
		} );
	} );

	/**
	 * PC入力は従来どおり短い移動距離で開始し、文字選択を開始入力時点で抑止することを確認する。
	 *
	 * 事前条件:
	 * - 対象列は開始可能で、DnD Engineはidleである。
	 *
	 * 操作:
	 * - 対象セルへ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - pointerdown時点でブラウザー既定動作を抑止する。
	 * - マウス開始条件には短い移動距離が設定される。
	 */
	it( 'when primary mouse input targets a resolvable column, should preserve the distance activation and prevent the initial browser action', () => {
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();
		const event = createPointerEvent( { target, currentTarget } );

		pointerDownHandler( event );

		expect( event.preventDefault ).toHaveBeenCalledTimes( 1 );
		const pointerSensorOptions = pointerSensorConfigureMock.mock.calls[ 0 ]?.[ 0 ];
		const activationConstraints = pointerSensorOptions?.activationConstraints;
		if ( typeof activationConstraints !== 'function' ) {
			throw new Error( 'Column mouse activation constraints were not configured.' );
		}

		activationConstraints(
			{ pointerType: 'mouse' } as globalThis.PointerEvent,
			{} as Draggable
		);
		expect( distanceConstraintMock ).toHaveBeenCalledWith( { value: 5 } );
	} );

	/**
	 * タッチ入力の第一段階Target Resolutionが開始拒否となる場合も通常スクロールを開始時点で妨げないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Target Resolutionが対象列を開始拒否として解決する。
	 *
	 * 操作:
	 * - 対象セルへ主タッチ入力を行う。
	 *
	 * 期待結果:
	 * - Draggableは登録されず、pointerdown時点のブラウザー既定動作も抑止しない。
	 */
	it( 'when touch target resolution rejects the column, should not register a draggable or prevent the initial browser action', () => {
		targetResolutionMock.resolve.mockReturnValue( {
			status: 'rejected',
			reason: 'merged-range',
		} );
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();
		const event = createPointerEvent( {
			target,
			currentTarget,
			pointerType: 'touch',
		} );

		pointerDownHandler( event );

		expect( targetResolutionMock.resolve ).toHaveBeenCalledTimes( 1 );
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
		expect( event.preventDefault ).not.toHaveBeenCalled();
	} );

	/**
	 * 現在Table内の入れ子Tableセルを列並び替え開始対象にしないことを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableのセル内部に別Tableが存在する。
	 *
	 * 操作:
	 * - 入れ子Tableのセルへ主タッチ入力を行う。
	 *
	 * 期待結果:
	 * - 第一段階解決もDraggable登録も行われない。
	 */
	it( 'when touch input targets a nested table cell, should not treat it as a column of the current table', () => {
		const currentTarget = document.createElement( 'div' );
		currentTarget.innerHTML = `
			<table><tbody><tr><td>
				<table><tbody><tr><td data-testid="nested">nested</td></tr></tbody></table>
			</td></tr></tbody></table>
		`;
		const nested = currentTarget.querySelector( '[data-testid="nested"]' );
		if ( ! nested ) {
			throw new Error( 'Nested column input test target could not be created.' );
		}
		const { pointerDownHandler } = renderColumnInput();

		pointerDownHandler(
			createPointerEvent( {
				target: nested,
				currentTarget,
				pointerType: 'touch',
			} )
		);

		expect( targetResolutionMock.resolve ).not.toHaveBeenCalled();
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );
} );