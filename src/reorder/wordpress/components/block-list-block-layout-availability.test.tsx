/**
 * Reorder Mode中に選択Tableの物理配置変化をToolbar表示用Layout Availabilityへ反映する監視契約を確認する。
 */

import { act, render } from '@testing-library/react';
import type { PointerEventHandler, ReactNode } from 'react';

import { reorderMode } from '@/reorder/reorder-mode';
import { COLUMN_DND_LAYOUT_AVAILABILITY_DEBOUNCE_MS } from '@/reorder/reorder-tuning';
import {
	ReorderModeBlockListBlock,
	type ReorderModeBlockListBlockProps,
} from '@/reorder/wordpress/components/block-list-block';
import {
	clearColumnDndLayoutAvailabilitySnapshot,
	getColumnDndLayoutAvailabilitySnapshot,
} from '@/reorder/wordpress/column-dnd-layout-availability-state';

let mockColumnDndLayoutAvailability: 'available' | 'unavailable' = 'available';

jest.mock( '@/reorder/column-reorder/responsibilities/layout-availability', () => ( {
	resolveColumnDndLayoutAvailability: () => mockColumnDndLayoutAvailability,
} ) );

jest.mock( '@/reorder/row-reorder/responsibilities/presentation/row-highlight', () => ( {
	RowHighlight: ( {
		children,
	}: {
		children: ( handler: PointerEventHandler< Element > ) => ReactNode;
	} ) => children( () => undefined ),
} ) );

jest.mock( '@/reorder/column-reorder/responsibilities/presentation/column-highlight', () => ( {
	ColumnHighlight: ( {
		children,
	}: {
		children: (
			overHandler: PointerEventHandler< Element >,
			outHandler: PointerEventHandler< Element >
		) => ReactNode;
	} ) =>
		children(
			() => undefined,
			() => undefined
		),
} ) );

jest.mock( '@/reorder/row-reorder/integration/dnd', () => ( {
	RowDnd: ( {
		children,
	}: {
		children: ( handler: PointerEventHandler< Element > ) => ReactNode;
	} ) => children( () => undefined ),
} ) );

jest.mock( '@/reorder/column-reorder/integration/dnd', () => ( {
	ColumnDnd: ( {
		children,
	}: {
		children: ( handler: PointerEventHandler< Element > ) => ReactNode;
	} ) => children( () => undefined ),
} ) );

const BlockListBlock = ( props: ReorderModeBlockListBlockProps ) => (
	<div id={ `block-${ props.clientId }` }>
		<table>
			<tbody>
				<tr>
					<td>Table</td>
				</tr>
			</tbody>
		</table>
	</div>
);

describe( 'Reorder Mode Block wrapper layout availability observation', () => {
	beforeEach( () => {
		reorderMode.notifyTableInactive( 'table-a' );
		clearColumnDndLayoutAvailabilitySnapshot( 'table-a' );
		mockColumnDndLayoutAvailability = 'available';
	} );

	afterEach( () => {
		jest.useRealTimers();
	} );

	/**
	 * Tableのサイズ変化通知からToolbar表示用Layout Availabilityを即時再評価せず、変化が落ち着いてから反映することを確認する。
	 *
	 * 事前条件:
	 * - 選択中Tableの初期Layout Availabilityはavailableである。
	 *
	 * 操作:
	 * - 現在物理配置をunavailableへ変え、Tableのサイズ変化を通知する。
	 * - microtaskとdebounce待機時間を順に経過させる。
	 *
	 * 期待結果:
	 * - microtask経過後もToolbar表示用snapshotはavailableのままである。
	 * - debounce待機時間の経過後にのみunavailableへ更新される。
	 */
	it( 'when ResizeObserver reports a table geometry change, should defer toolbar availability reevaluation until the debounce period ends', async () => {
		jest.useFakeTimers();
		let resizeCallback: ResizeObserverCallback | null = null;
		class TestResizeObserver implements ResizeObserver {
			constructor( callback: ResizeObserverCallback ) {
				resizeCallback = callback;
			}

			disconnect(): void {}
			observe(): void {}
			unobserve(): void {}
		}
		Object.defineProperty( window, 'ResizeObserver', {
			configurable: true,
			value: TestResizeObserver,
		} );

		const { unmount } = render(
			<ReorderModeBlockListBlock
				BlockListBlock={ BlockListBlock }
				blockProps={ {
					clientId: 'table-a',
					isSelected: true,
					name: 'core/table',
				} }
			/>
		);

		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'available' );
		mockColumnDndLayoutAvailability = 'unavailable';

		await act( async () => {
			resizeCallback?.( [], {} as ResizeObserver );
			await Promise.resolve();
		} );
		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'available' );

		act( () => {
			jest.advanceTimersByTime( COLUMN_DND_LAYOUT_AVAILABILITY_DEBOUNCE_MS - 1 );
		} );
		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'available' );

		act( () => {
			jest.advanceTimersByTime( 1 );
		} );
		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'unavailable' );

		unmount();
	} );
} );
