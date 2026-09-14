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

const renderColumnInput = (): ColumnDndPointerDownHandler => {
	const capturedHandler: { current: ColumnDndPointerDownHandler | null } = { current: null };

	render(
		<ColumnInput tableIdentity="table-a" activeDraggable={ { current: null } }>
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

	it( 'when target resolution rejects the column, should notify the presentation with the blocking cell and interaction position', () => {
		const blockingMergedCell = {
			section: 'body' as const,
			rowStart: 2,
			rowEnd: 2,
			columnStart: 1,
			columnEnd: 2,
		};
		targetResolutionMock.mockReturnValue( {
			status: 'rejected',
			blockingMergedCell,
		} );
		const pointerDownHandler = renderColumnInput();

		pointerDownHandler( createPointerInput() );

		expect( notifyColumnStartRejectionMock ).toHaveBeenCalledWith( {
			blockingMergedCell,
			clientX: 120,
			clientY: 240,
		} );
	} );

	it( 'when target resolution returns unavailable, should not notify a start rejection', () => {
		targetResolutionMock.mockReturnValue( { status: 'unavailable' } );
		const pointerDownHandler = renderColumnInput();

		pointerDownHandler( createPointerInput() );

		expect( notifyColumnStartRejectionMock ).not.toHaveBeenCalled();
	} );
} );
