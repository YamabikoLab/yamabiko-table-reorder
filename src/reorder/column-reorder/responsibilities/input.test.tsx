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
	 * 縦結合を考慮した論理列で開始候補を登録し、次の候補で前回登録を破棄する。
	 *
	 * 期待結果:
	 * - 対象セルは論理列1、次セルは論理列2として解決される。
	 */
	it( 'when primary mouse input targets cells after a continuing rowspan, should register the logical column and replace the previous candidate', () => {
		const { currentTarget, target, next } = createTableTarget();
		const { pointerDownHandler, activeDraggable } = renderColumnInput();

		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );
		const firstDraggable = activeDraggable.current;
		pointerDownHandler( createPointerEvent( { target: next, currentTarget } ) );

		expect( targetResolutionMock.resolve ).toHaveBeenNthCalledWith( 1, {
			tableIdentity: 'table-1',
			sourceColumnIndex: 1,
		} );
		expect( firstDraggable?.destroy ).toHaveBeenCalledTimes( 1 );
		expect( targetResolutionMock.resolve ).toHaveBeenNthCalledWith( 2, {
			tableIdentity: 'table-1',
			sourceColumnIndex: 2,
		} );
	} );

	/**
	 * 横結合セルの後続セルをTable全体の論理列位置で解決する。
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
	 * 第一段階で開始不可となった列は物理DnDへ登録しない。
	 *
	 * 期待結果:
	 * - Draggableは登録されない。
	 */
	it( 'when first-stage target resolution rejects the column, should not register a draggable', () => {
		targetResolutionMock.resolve.mockReturnValue( { status: 'rejected', reason: 'merged-range' } );
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();
		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );

		expect( draggableConstructorMock ).not.toHaveBeenCalled();
	} );

	/**
	 * activeな物理DnD中は現在の開始候補を維持する。
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
	 * タッチ入力を共通の開始対象解決経路へ接続する。
	 *
	 * 期待結果:
	 * - Draggableが登録され、タッチ用Delay制約が利用される。
	 */
	it( 'when primary touch input targets a resolvable column, should register it through the shared path with a delay constraint', () => {
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();
		pointerDownHandler( createPointerEvent( { target, currentTarget, pointerType: 'touch' } ) );

		expect( draggableConstructorMock ).toHaveBeenCalledTimes( 1 );
		const options = pointerSensorConfigureMock.mock.calls[ 0 ]?.[ 0 ];
		options?.activationConstraints?.( { pointerType: 'touch' } as PointerEvent );
		expect( delayConstraintMock ).toHaveBeenCalledWith( { value: 250, tolerance: 5 } );
	} );

	/**
	 * マウス入力には短い移動距離の開始条件を適用する。
	 *
	 * 期待結果:
	 * - Distance制約が利用される。
	 */
	it( 'when mouse input is registered, should use the mouse distance activation constraint', () => {
		const { currentTarget, target } = createTableTarget();
		const { pointerDownHandler } = renderColumnInput();
		pointerDownHandler( createPointerEvent( { target, currentTarget } ) );

		const options = pointerSensorConfigureMock.mock.calls[ 0 ]?.[ 0 ];
		options?.activationConstraints?.( { pointerType: 'mouse' } as PointerEvent );
		expect( distanceConstraintMock ).toHaveBeenCalledWith( { value: 5 } );
	} );

	/**
	 * 対象外ポインター入力は開始候補として扱わない。
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
