/**
 * Reorder Mode中に選択Tableの物理配置変化をToolbar表示用Layout Availabilityへ反映する監視契約を確認する。
 */

import { act, render } from '@testing-library/react';

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

/* @wordpress/componentsのuuid / theme ESM境界だけをJestで読める決定的な実装へ置き換える。 */
jest.mock( 'uuid', () => ( { v4: () => 'block-list-layout-test-uuid' } ) );
jest.mock( '@wordpress/theme', () => ( {
	ThemeProvider: ( { children }: { children: React.ReactNode } ) => children,
} ) );

/* Jestで読み込めないBlock Editor Storeの環境境界だけを代替し、WordPress Dataは実Storeへ接続する。 */
jest.mock( '@wordpress/block-editor', () => ( {
	store: jest.requireActual(
		'@/reorder/reorder-form/responsibilities/block-editor-store.test-utils'
	).testBlockEditorStore,
} ) );

/*
 * Jestのbrowser解決が選ぶESMではなく、同じProduction packageが公開するCommonJS入口を使用する。
 * JSDOMにないResizeObserver境界だけを無処理とし、Row / Column DnD自体はProduction実装を接続する。
 */
jest.mock( '@preact/signals-core', () => {
	class TestResizeObserver {
		disconnect(): void {}
		observe(): void {}
		unobserve(): void {}
	}
	global.ResizeObserver = TestResizeObserver;

	return jest.requireActual(
		`${ process.cwd() }/node_modules/@preact/signals-core/dist/signals-core.js`
	);
} );

let tableGeometryAvailability: 'available' | 'unavailable' = 'available';

/**
 * JSDOMに実セル配置がないため、Production Layout Availabilityが観測する物理境界だけを与える。
 *
 * @param element 観測対象のTableまたはセル。
 */
const connectTableGeometry = ( element: HTMLTableElement | HTMLTableCellElement | null ): void => {
	if ( element === null ) {
		return;
	}

	element.getBoundingClientRect = () => {
		const isCell = element instanceof HTMLTableCellElement;
		const hasCellBox = ! isCell || tableGeometryAvailability === 'available';
		return {
			x: 0,
			y: 0,
			left: 0,
			top: 0,
			right: hasCellBox ? 100 : 0,
			bottom: hasCellBox ? 20 : 0,
			width: hasCellBox ? 100 : 0,
			height: hasCellBox ? 20 : 0,
			toJSON: () => ( {} ),
		} as DOMRect;
	};
};

/* Gutenbergがfilterで渡すBlockListBlockは公開importできないため、外部component境界だけをTable配置監視に必要な最小実装にする。 */
const BlockListBlock = ( props: ReorderModeBlockListBlockProps ) => (
	<div id={ `block-${ props.clientId }` }>
		<table ref={ connectTableGeometry }>
			<tbody>
				<tr>
					<td ref={ connectTableGeometry }>Table</td>
				</tr>
			</tbody>
		</table>
	</div>
);

describe( 'Reorder Mode Block wrapper layout availability observation', () => {
	beforeEach( () => {
		reorderMode.notifyTableInactive( 'table-a' );
		clearColumnDndLayoutAvailabilitySnapshot( 'table-a' );
		tableGeometryAvailability = 'available';
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
		tableGeometryAvailability = 'unavailable';

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
