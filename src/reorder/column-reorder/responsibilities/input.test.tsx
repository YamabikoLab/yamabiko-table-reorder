/**
 * 列並び替えのポインター入力境界が、PCとタッチ端末を同じ開始対象解決経路へ接続することを確認する。
 *
 * DnD Engine内部の進行は再現せず、入力受理、論理列解決、Target Resolution結果、
 * 入力方式固有の開始条件、一時Draggable登録の差し替えを検証する。Reorder Modeの有効判定はDnD接続境界の責務とする。
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
 * DnD Engineの開始可否状態を生成する。
 * @param idle
 */
const createManager = ( idle = true ) =>
	( { dragOperation: { status: { idle } } } ) as ReturnType< typeof useDragDropManager >;

/** 縦結合を含むTableと対象セルを生成する。 */
const createTableTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = `
		<table><tbody>
			<tr><td rowspan="2">A</td><td>B</td><td>C</td></tr>
			<tr><td data-testid="target">D</td><td data-testid="next">E</td></tr>
		</tbody></table>
	`;
	const target = currentTarget.querySelector( '[data-testid="target"]' );
	const next = currentTarget.querySelector( '[data-testid="next"]' );
	if ( target === null || next === null ) {
		throw new Error( 'Column input test table could not be created.' );
	}
	return { currentTarget, target, next };
};

/** 横結合の後続セルを持つTableを生成する。 */
const createColspanTableTarget = () => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML =
		'<table><tbody><tr><td colspan="2">A</td><td data-testid="target">B</td></tr></tbody></table>';
	const target = currentTarget.querySelector( '[data-testid="target"]' );
	if ( target === null ) {
		throw new Error( 'Column colspan input test target could not be created.' );
	}
	return { currentTarget, target };
};

/**
 * 列DnD開始処理へ渡すポインターイベントを生成する。
 * @param options
 * @param options.target
 * @param options.currentTarget
 * @param options.pointerType
 * @param options.isPrimary
 * @param options.button
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

/** ColumnInputが子要素へ公開する開始処理を取得する。 */
const renderColumnInput = () => {
	const capturedHandler: { current: ColumnDndPointerDownHandler | null } = { current: null };
	const activeDraggable: { current: Draggable | null } = { current: null };

	render(
		<ColumnInput tableIdentity="table-1" activeDraggable={ activeDraggable }>
			{ ( handler ) => {
				capturedHandler.current = handler;
				return <div />;
			} }
		</ColumnInput>
	);

	if ( capturedHandler.current === null ) {
		throw new Error( 'ColumnInput did not provide a pointer handler.' );
	}

	return { pointerDownHandler: capturedHandler.current, activeDraggable };
};

describe( 'Column DnD input boundary', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		draggableConstructorMock.mockImplementation( () => ( { destroy: jest.fn() } ) );
		distanceConstraintMock.mockImplementation( ( options ) => options );
		delayConstraintMock.mockImplementation( ( options ) => options );
		useDragDropManagerMock.mockReturnValue( createManager() );
		targetResolutionMock.resolve.mockImplementation( ( target ) => ( {
			status: 'resolved',
			target,
			initialConstraints: { columnCount: 3, blockedBoundaries: [] },
		} ) );
	} );

	/**
	 * 概要:
	 * - 縦結合を考慮した論理列で開始候補を登録し、次の候補で前回登録を破棄することを確認する。
	 *
	 * 事前条件:
	 * - 前行から継続する縦結合により、対象セルのDOM上の位置と論理列位置が異なる。
	 *
	 * 操作:
	 * - 同じ行の2つのセルへ順に主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 対象セルは論理列1、次セルは論理列2として解決される。
	 * - 解決済み列は入力対象セルをelement、解決済みTargetをdataとしてDraggableへ登録される。
	 * - 2回目の開始候補登録前に1回目のDraggableが破棄される。
	 */
	it( 'when primary mouse input targets cells after a continuing rowspan, should register the logical column and replace the previous candidate', () => {
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
				element: target,
				data: { tableIdentity: 'table-1', sourceColumnIndex: 1 },
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
	 * 概要:
	 * - 横結合セルの後続セルをTable全体の論理列位置で解決することを確認する。
	 *
	 * 事前条件:
	 * - 対象セルの直前に2論理列を占有する横結合セルが存在する。
	 *
	 * 操作:
	 * - 横結合セルの後続セルへ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 対象セルは論理列2として解決される。
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
	 * 概要:
	 * - 第一段階で開始不可となった列は物理DnDへ登録しないことを確認する。
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
			blockingMergedRange: { columnStart: 0, columnEnd: 1 },
		} );
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();
		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );

		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - activeな物理DnD中は現在の開始候補を維持することを確認する。
	 *
	 * 事前条件:
	 * - idle中の入力でDraggableが登録された後、DnD Engineがactiveになっている。
	 *
	 * 操作:
	 * - active DnD中に別セルへ主入力を行う。
	 *
	 * 期待結果:
	 * - 現在のDraggableは破棄されず、新しい解決も行われない。
	 */
	it( 'when a physical drag is already active, should preserve the current draggable and ignore additional pointer input', () => {
		const manager = { dragOperation: { status: { idle: true } } };
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
	 * 概要:
	 * - タッチ入力を共通の開始対象解決経路へ接続し、通常スクロールを開始時点で妨げないことを確認する。
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
	 * - タッチ用Delay制約が利用される。
	 */
	it( 'when primary touch input targets a resolvable column, should register it through the shared path with a delay constraint', () => {
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();
		const event = createPointerEvent( { target, currentTarget, pointerType: 'touch' } );
		pointerDownHandler( event );

		expect( targetResolutionMock.resolve ).toHaveBeenCalledWith( {
			tableIdentity: 'table-1',
			sourceColumnIndex: 1,
		} );
		expect( draggableConstructorMock ).toHaveBeenCalledTimes( 1 );
		expect( event.preventDefault ).not.toHaveBeenCalled();
		const activationConstraints =
			pointerSensorConfigureMock.mock.calls[ 0 ]?.[ 0 ]?.activationConstraints;
		if ( typeof activationConstraints !== 'function' ) {
			throw new Error( 'PointerSensor activationConstraints callback was not configured.' );
		}
		activationConstraints( { pointerType: 'touch' } as PointerEvent, {} as Draggable );
		expect( delayConstraintMock ).toHaveBeenCalledWith( { value: 250, tolerance: 5 } );
	} );

	/**
	 * 概要:
	 * - マウス入力には短い移動距離の開始条件を適用し、開始時点でブラウザー既定動作を抑止することを確認する。
	 *
	 * 事前条件:
	 * - 対象列は開始可能で、DnD Engineはidleである。
	 *
	 * 操作:
	 * - 対象セルへ主マウス入力を行う。
	 *
	 * 期待結果:
	 * - pointerdown時点でブラウザー既定動作を抑止する。
	 * - Distance制約が利用される。
	 */
	it( 'when mouse input is registered, should use the mouse distance activation constraint', () => {
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();
		const event = createPointerEvent( { target, currentTarget } );
		pointerDownHandler( event );

		expect( event.preventDefault ).toHaveBeenCalledTimes( 1 );
		const activationConstraints =
			pointerSensorConfigureMock.mock.calls[ 0 ]?.[ 0 ]?.activationConstraints;
		if ( typeof activationConstraints !== 'function' ) {
			throw new Error( 'PointerSensor activationConstraints callback was not configured.' );
		}
		activationConstraints( { pointerType: 'mouse' } as PointerEvent, {} as Draggable );
		expect( distanceConstraintMock ).toHaveBeenCalledWith( { value: 5 } );
	} );

	/**
	 * 概要:
	 * - タッチ入力のTarget Resolutionが開始拒否となる場合も通常スクロールを開始時点で妨げないことを確認する。
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
			blockingMergedRange: { columnStart: 0, columnEnd: 1 },
		} );
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();
		const event = createPointerEvent( { target, currentTarget, pointerType: 'touch' } );
		pointerDownHandler( event );

		expect( targetResolutionMock.resolve ).toHaveBeenCalledTimes( 1 );
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
		expect( event.preventDefault ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 現在Table内の入れ子Tableセルを列並び替え開始対象にしないことを確認する。
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
		if ( nested === null ) {
			throw new Error( 'Nested column input test target could not be created.' );
		}
		const { pointerDownHandler } = renderColumnInput();
		pointerDownHandler(
			createPointerEvent( { target: nested, currentTarget, pointerType: 'touch' } )
		);

		expect( targetResolutionMock.resolve ).not.toHaveBeenCalled();
		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	/**
	 * 概要:
	 * - 対象外ポインター入力は開始候補として扱わないことを確認する。
	 *
	 * 操作:
	 * - pen、非主ポインター、副ボタン入力を行う。
	 *
	 * 期待結果:
	 * - Draggableは登録されない。
	 */
	it.each( [
		{ label: 'pen pointer', pointerType: 'pen', isPrimary: true, button: 0 },
		{ label: 'non-primary pointer', pointerType: 'mouse', isPrimary: false, button: 0 },
		{ label: 'secondary button', pointerType: 'mouse', isPrimary: true, button: 1 },
	] )(
		'when $label input is not eligible to start column DnD, should not register a draggable',
		( { pointerType, isPrimary, button } ) => {
			const { currentTarget, target } = createTableTarget();
			const { pointerDownHandler } = renderColumnInput();
			pointerDownHandler(
				createPointerEvent( { target, currentTarget, pointerType, isPrimary, button } )
			);
			expect( draggableConstructorMock ).not.toHaveBeenCalled();
		}
	);
} );
