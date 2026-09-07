/**
 * 列並び替えのPC入力境界が、現在Tableの論理列を第一段階で解決し、開始可能な候補だけを物理DnDへ登録することを確認する。
 *
 * DnD Engine内部の進行は再現せず、PC入力受理、論理列解決、Target Resolution結果、
 * 一時Draggable登録の差し替えというInput Interactionから観測できる振る舞いを検証する。
 */

import { Draggable, PointerSensor } from '@dnd-kit/dom';
import { useDragDropManager } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { ColumnInput, type ColumnDndPointerDownHandler } from './input';
import { columnReorderTargetResolution } from './target-resolution';

jest.mock( '@dnd-kit/dom', () => ( {
	Draggable: jest.fn(),
	PointerActivationConstraints: {
		Distance: jest.fn(),
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
 * PC入力境界へ渡す最小限のDnD Engine状態を生成する。
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
 * 列DnD開始処理へ渡すPCポインターイベントを生成する。
 *
 * @param options               入力条件。
 * @param options.target        PC入力が開始されたDOM要素。
 * @param options.currentTarget 現在Tableの基準要素。
 * @param options.pointerType   ポインター入力方式。
 * @return 列DnD開始処理へ渡すReactポインターイベント。
 */
const createPointerEvent = ( options: {
	target: Element;
	currentTarget: Element;
	pointerType?: string;
} ): ReactPointerEvent< Element > =>
	( {
		target: options.target,
		currentTarget: options.currentTarget,
		isPrimary: true,
		button: 0,
		pointerType: options.pointerType ?? 'mouse',
		preventDefault: jest.fn(),
	} ) as unknown as ReactPointerEvent< Element >;

/** ColumnInputが子要素へ公開する現在のPCポインター開始処理を取得する。 */
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

describe( 'Column PC input boundary', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		draggableConstructorMock.mockImplementation( () => ( {
			destroy: jest.fn(),
		} ) );
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
	 * 概要:
	 * - PC入力位置を結合状態を反映した論理列へ解決し、現在候補だけを物理DnDへ登録することを確認する。
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
				data: {
					tableIdentity: 'table-1',
					sourceColumnIndex: 1,
				},
			} ),
			expect.anything()
		);

		pointerDownHandler( createPointerEvent( { target: next, currentTarget } ) );

		expect( firstDraggable?.destroy ).toHaveBeenCalledTimes( 1 );
		expect( targetResolutionMock.resolve ).toHaveBeenNthCalledWith( 2, {
			tableIdentity: 'table-1',
			sourceColumnIndex: 2,
		} );
		expect( pointerSensorConfigureMock ).toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 横結合セルの後ろにあるセルを、DOM上の位置ではなくTable全体の論理列位置で開始候補にすることを確認する。
	 *
	 * 事前条件:
	 * - 対象セルの直前に2論理列を占有する横結合セルが存在する。
	 *
	 * 操作:
	 * - 横結合セルの後続セルへ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 対象セルは論理列2として第一段階解決され、同じ論理列を表すDraggableが登録される。
	 */
	it( 'when mouse input targets a cell after a colspan, should resolve its table-wide logical column before registration', () => {
		const { currentTarget, target } = createColspanTableTarget();
		const { pointerDownHandler } = renderColumnInput();

		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );

		expect( targetResolutionMock.resolve ).toHaveBeenCalledWith( {
			tableIdentity: 'table-1',
			sourceColumnIndex: 2,
		} );
		expect( draggableConstructorMock ).toHaveBeenCalledWith(
			expect.objectContaining( {
				id: 'ytr-column:table-1:2',
				element: target,
			} ),
			expect.anything()
		);
	} );

	/**
	 * 概要:
	 * - 第一段階で開始不可となった列は物理DnD開始候補へ登録されないことを確認する。
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
	 * 概要:
	 * - 新しい開始試行が開始不可になった場合、前回入力で登録した開始候補を次の物理DnDへ持ち越さないことを確認する。
	 *
	 * 事前条件:
	 * - 1回目の入力は開始可能でDraggableが登録される。
	 * - 2回目の入力は第一段階Target Resolutionで開始拒否となる。
	 *
	 * 操作:
	 * - 開始可能なセルへ入力した後、開始不可となる別セルへ入力する。
	 *
	 * 期待結果:
	 * - 前回のDraggableは破棄され、新しいDraggableは登録されない。
	 */
	it( 'when a new mouse input is rejected after a previous candidate was registered, should discard the previous candidate without replacing it', () => {
		const { currentTarget, target, next } = createTableTarget();
		const { pointerDownHandler, activeDraggable } = renderColumnInput();

		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );
		const firstDraggable = activeDraggable.current;
		targetResolutionMock.resolve.mockReturnValue( {
			status: 'rejected',
			reason: 'merged-range',
		} );

		pointerDownHandler( createPointerEvent( { target: next, currentTarget } ) );

		expect( firstDraggable?.destroy ).toHaveBeenCalledTimes( 1 );
		expect( activeDraggable.current ).toBeNull();
		expect( draggableConstructorMock ).toHaveBeenCalledTimes( 1 );
	} );

	/**
	 * 概要:
	 * - activeな物理DnD中は追加のPC入力から別の開始候補を生成しないことを確認する。
	 *
	 * 事前条件:
	 * - DnD Engineは既にactiveな物理DnDを処理している。
	 *
	 * 操作:
	 * - 現在Tableのセルへ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 第一段階Target ResolutionもDraggable登録も行われない。
	 */
	it( 'when a physical drag is already active, should ignore additional mouse input without resolving or registering another candidate', () => {
		useDragDropManagerMock.mockReturnValue( createManager( false ) );
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();

		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );

		expect( targetResolutionMock.resolve ).not.toHaveBeenCalled();
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - Phase 5ではタッチ入力をPC入力経路へ混入させないことを確認する。
	 *
	 * 操作:
	 * - 対象セルへタッチポインター入力を行う。
	 *
	 * 期待結果:
	 * - 第一段階解決もDraggable登録も行われない。
	 */
	it( 'when pointer input is not from a mouse, should leave the candidate unresolved for the later touch phase', () => {
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();

		pointerDownHandler(
			createPointerEvent( {
				target,
				currentTarget,
				pointerType: 'touch',
			} )
		);

		expect( targetResolutionMock.resolve ).not.toHaveBeenCalled();
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 現在Table内の入れ子Tableセルを列並び替え開始対象にしないことを確認する。
	 *
	 * 事前条件:
	 * - 現在Tableのセル内部に別Tableが存在する。
	 *
	 * 操作:
	 * - 入れ子Tableのセルへ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 第一段階解決もDraggable登録も行われない。
	 */
	it( 'when mouse input targets a nested table cell, should not treat it as a column of the current table', () => {
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

		pointerDownHandler( createPointerEvent( { target: nested, currentTarget } ) );

		expect( targetResolutionMock.resolve ).not.toHaveBeenCalled();
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );
} );
