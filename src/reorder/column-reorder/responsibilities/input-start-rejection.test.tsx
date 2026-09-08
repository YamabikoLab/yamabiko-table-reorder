/**
 * Column Input Interactionが、Design上の開始拒否だけを利用者向け通知へ接続することを確認する。
 */

import { useDragDropManager } from '@dnd-kit/react';
import { render } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { ColumnInput, type ColumnDndPointerDownHandler } from './input';
import { notifyColumnStartRejection } from './presentation/start-rejection-notice-event';
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

jest.mock( '@/reorder/column-reorder/integration/source-column-resolution', () => ( {
	resolveColumnSourceIndex: jest.fn( () => 1 ),
} ) );

jest.mock( './presentation/start-rejection-notice-event', () => ( {
	notifyColumnStartRejection: jest.fn(),
} ) );

jest.mock( './target-resolution', () => ( {
	columnReorderTargetResolution: {
		resolve: jest.fn(),
	},
} ) );

const useDragDropManagerMock = useDragDropManager as jest.MockedFunction<
	typeof useDragDropManager
>;
const targetResolutionMock = columnReorderTargetResolution.resolve as jest.MockedFunction<
	typeof columnReorderTargetResolution.resolve
>;
const notifyColumnStartRejectionMock = notifyColumnStartRejection as jest.MockedFunction<
	typeof notifyColumnStartRejection
>;

/** Column Inputが公開する開始処理を取得する。 */
const renderColumnInput = (): ColumnDndPointerDownHandler => {
	const capturedHandler: { current: ColumnDndPointerDownHandler | null } = { current: null };

	render(
		<ColumnInput enabled tableIdentity="table-a" activeDraggable={ { current: null } }>
			{ ( handler ) => {
				capturedHandler.current = handler;
				return <div />;
			} }
		</ColumnInput>
	);

	if ( capturedHandler.current === null ) {
		throw new Error( 'ColumnInput did not provide a pointer handler.' );
	}

	return capturedHandler.current;
};

/** 開始拒否確認に必要なTableとポインター入力を生成する。 */
const createPointerInput = (): ReactPointerEvent< Element > => {
	const currentTarget = document.createElement( 'div' );
	currentTarget.innerHTML = '<table><tbody><tr><td data-target="true">A</td></tr></tbody></table>';
	const target = currentTarget.querySelector( '[data-target="true"]' );

	if ( target === null ) {
		throw new Error( 'Column rejection test target could not be created.' );
	}

	return {
		target,
		currentTarget,
		pointerType: 'mouse',
		isPrimary: true,
		button: 0,
		clientX: 120,
		clientY: 240,
		preventDefault: jest.fn(),
	} as unknown as ReactPointerEvent< Element >;
};

describe( 'Column input start rejection', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		useDragDropManagerMock.mockReturnValue( {
			dragOperation: {
				status: {
					idle: true,
				},
			},
		} as ReturnType< typeof useDragDropManager > );
	} );

	/**
	 * 結合範囲により列DnD開始を拒否した場合、利用者向け理由と操作位置を通知することを確認する。
	 *
	 * 事前条件:
	 * - Reorder Target Resolutionが対象列を結合範囲による開始拒否として解決する。
	 *
	 * 操作:
	 * - 対象セルで主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 開始拒否理由と操作位置がPresentationへ一回通知される。
	 */
	it( 'when target resolution rejects the column, should notify the presentation with the rejection reason and interaction position', () => {
		targetResolutionMock.mockReturnValue( {
			status: 'rejected',
			reason: 'merged-range',
		} );
		const pointerDownHandler = renderColumnInput();

		pointerDownHandler( createPointerInput() );

		expect( notifyColumnStartRejectionMock ).toHaveBeenCalledWith( {
			reason: 'merged-range',
			clientX: 120,
			clientY: 240,
		} );
	} );

	/**
	 * 通常の利用不能結果を利用者向け開始拒否として通知しないことを確認する。
	 *
	 * 事前条件:
	 * - Reorder Target Resolutionが対象列を通常の利用不能として解決する。
	 *
	 * 操作:
	 * - 対象セルで主マウス入力を行う。
	 *
	 * 期待結果:
	 * - 開始拒否通知は発生しない。
	 */
	it( 'when target resolution returns unavailable, should not notify a start rejection', () => {
		targetResolutionMock.mockReturnValue( { status: 'unavailable' } );
		const pointerDownHandler = renderColumnInput();

		pointerDownHandler( createPointerInput() );

		expect( notifyColumnStartRejectionMock ).not.toHaveBeenCalled();
	} );
} );
