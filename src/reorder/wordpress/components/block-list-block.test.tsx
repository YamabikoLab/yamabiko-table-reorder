/**
 * Reorder Mode中のTable Block wrapperに対するWordPress Editor接続契約を確認する。
 *
 * Reorder Mode変更をGutenberg本来のBlockListBlock再renderへ伝播させず、YTR専用DOM状態と安定した入力境界だけを現在modeへ同期することを検証する。
 */

import { act, render, waitFor } from '@testing-library/react';
import { useState } from '@wordpress/element';
import type { DragEventHandler, MouseEventHandler } from 'react';

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
jest.mock( 'uuid', () => ( { v4: () => 'block-list-block-test-uuid' } ) );
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

let blockListBlockRenderCount = 0;

/* Gutenbergがfilterで渡すBlockListBlockは公開importできないため、外部component境界だけをwrapper契約を観測できる最小実装にする。 */
const BlockListBlock = ( props: ReorderModeBlockListBlockProps ) => {
	blockListBlockRenderCount += 1;
	const wrapperProps = props.wrapperProps ?? {};

	return (
		<div
			id={ `block-${ props.clientId }` }
			data-testid="block-wrapper"
			draggable={ wrapperProps.draggable as boolean | undefined }
			onMouseDownCapture={ wrapperProps.onMouseDownCapture as MouseEventHandler< HTMLDivElement > }
			onDragStartCapture={ wrapperProps.onDragStartCapture as DragEventHandler< HTMLDivElement > }
		>
			<table ref={ connectTableGeometry }>
				<tbody>
					<tr>
						<td ref={ connectTableGeometry }>Table</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
};

const ReplacementBlockListBlock = ( props: ReorderModeBlockListBlockProps ) => {
	const wrapperProps = props.wrapperProps ?? {};

	return (
		<section
			id={ `block-${ props.clientId }` }
			data-testid="block-wrapper"
			draggable={ wrapperProps.draggable as boolean | undefined }
		>
			<table ref={ connectTableGeometry }>
				<tbody>
					<tr>
						<td ref={ connectTableGeometry }>Table replacement</td>
					</tr>
				</tbody>
			</table>
		</section>
	);
};

const StatefulBlockListBlock = ( props: ReorderModeBlockListBlockProps ) => {
	const [ replaced, setReplaced ] = useState( false );

	if ( replaced ) {
		return (
			<section id={ `block-${ props.clientId }` } data-testid="block-wrapper">
				<table ref={ connectTableGeometry }>
					<tbody>
						<tr>
							<td ref={ connectTableGeometry }>Table replacement</td>
						</tr>
					</tbody>
				</table>
			</section>
		);
	}

	return (
		<div id={ `block-${ props.clientId }` } data-testid="block-wrapper">
			<button type="button" onClick={ () => setReplaced( true ) }>
				Replace wrapper
			</button>
			<table ref={ connectTableGeometry }>
				<tbody>
					<tr>
						<td ref={ connectTableGeometry }>Table</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
};

const renderBlockListBlock = (
	Component: typeof BlockListBlock | typeof ReplacementBlockListBlock = BlockListBlock
) => (
	<ReorderModeBlockListBlock
		BlockListBlock={ Component }
		blockProps={ {
			clientId: 'table-a',
			isSelected: true,
			name: 'core/table',
			wrapperProps: { draggable: true },
		} }
	/>
);

describe( 'Reorder Mode Block wrapper integration', () => {
	beforeEach( () => {
		reorderMode.notifyTableInactive( 'table-a' );
		clearColumnDndLayoutAvailabilitySnapshot( 'table-a' );
		tableGeometryAvailability = 'available';
		blockListBlockRenderCount = 0;
	} );

	/**
	 * Reorder Mode変更がGutenberg本来のBlockListBlock描画へ伝播せず、YTR専用DOM状態だけを同期することを確認する。
	 *
	 * 事前条件:
	 * - Tableは通常編集状態で描画されている。
	 *
	 * 操作:
	 * - 行並び替えへ切り替え、通常編集へ戻す。
	 * - 列並び替えへ切り替え、通常編集へ戻す。
	 *
	 * 期待結果:
	 * - BlockListBlockのrender回数は増えない。
	 * - YTR専用mode属性だけがrow / columnへ同期され、通常編集では削除される。
	 * - Gutenberg由来のdraggable設定は書き換えられない。
	 */
	it( 'when reorder mode changes, should synchronize only YTR DOM state without rerendering BlockListBlock', () => {
		const { getByTestId } = render( renderBlockListBlock() );
		const blockWrapper = getByTestId( 'block-wrapper' );

		expect( blockListBlockRenderCount ).toBe( 1 );
		expect( blockWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBeNull();
		expect( blockWrapper.getAttribute( 'draggable' ) ).toBe( 'true' );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		expect( blockWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBe( 'row' );
		expect( blockListBlockRenderCount ).toBe( 1 );
		expect( blockWrapper.getAttribute( 'draggable' ) ).toBe( 'true' );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		expect( blockWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBeNull();
		expect( blockListBlockRenderCount ).toBe( 1 );

		act( () => reorderMode.select( 'column', 'table-a' ) );
		expect( blockWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBe( 'column' );
		expect( blockListBlockRenderCount ).toBe( 1 );

		act( () => reorderMode.select( 'column', 'table-a' ) );
		expect( blockWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBeNull();
		expect( blockListBlockRenderCount ).toBe( 1 );
	} );

	/**
	 * 安定したwrapper入力handlerが入力時点のReorder Modeを参照し、通常編集へ戻した後も同じReact描画のまま抑止状態を切り替えられることを確認する。
	 *
	 * 事前条件:
	 * - Gutenberg由来のTable Block DnD設定は有効である。
	 *
	 * 操作:
	 * - 通常編集、行並び替え、再度通常編集の順でmouse downとnative drag開始を発生させる。
	 *
	 * 期待結果:
	 * - 通常編集では入力の既定動作を妨げない。
	 * - 行並び替え中は通常編集開始とTable Block DnD開始を抑止する。
	 * - 通常編集へ戻すと再び既定動作を妨げない。
	 */
	it( 'when wrapper input is received across mode changes, should suppress editing and Block drag only while reordering', () => {
		const { getByTestId } = render( renderBlockListBlock() );
		const blockWrapper = getByTestId( 'block-wrapper' );
		const dispatchCancelable = ( type: string ) => {
			const event = new Event( type, { bubbles: true, cancelable: true } );
			blockWrapper.dispatchEvent( event );
			return event.defaultPrevented;
		};

		expect( dispatchCancelable( 'mousedown' ) ).toBe( false );
		expect( dispatchCancelable( 'dragstart' ) ).toBe( false );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		expect( dispatchCancelable( 'mousedown' ) ).toBe( true );
		expect( dispatchCancelable( 'dragstart' ) ).toBe( true );

		act( () => reorderMode.select( 'row', 'table-a' ) );
		expect( dispatchCancelable( 'mousedown' ) ).toBe( false );
		expect( dispatchCancelable( 'dragstart' ) ).toBe( false );
	} );

	/**
	 * Gutenberg側の通常rerenderでwrapper DOMが置き換わった場合も、現在のReorder Modeを新しいwrapperへ同期できることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えモードが有効である。
	 *
	 * 操作:
	 * - BlockListBlock実装を差し替えてwrapper DOMを再接続する。
	 *
	 * 期待結果:
	 * - 置き換え後のwrapperにも現在のrow mode属性が同期される。
	 */
	it( 'when Gutenberg reconnects the wrapper, should resynchronize the current mode to the new wrapper', () => {
		act( () => reorderMode.select( 'row', 'table-a' ) );
		const { getByTestId, rerender } = render( renderBlockListBlock() );

		expect(
			getByTestId( 'block-wrapper' ).getAttribute( 'data-yamabiko-table-reorder-mode' )
		).toBe( 'row' );

		rerender( renderBlockListBlock( ReplacementBlockListBlock ) );

		expect( getByTestId( 'block-wrapper' ).tagName ).toBe( 'SECTION' );
		expect(
			getByTestId( 'block-wrapper' ).getAttribute( 'data-yamabiko-table-reorder-mode' )
		).toBe( 'row' );
	} );

	/**
	 * BlockListBlock自身の更新だけでwrapper DOMが置き換わった場合も、現在のReorder Modeを新しいwrapperへ同期できることを確認する。
	 *
	 * 事前条件:
	 * - 行並び替えモードが有効である。
	 * - ReorderModeBlockListBlockは再renderされない。
	 *
	 * 操作:
	 * - BlockListBlock自身のstate更新によってroot wrapper DOMを置き換える。
	 *
	 * 期待結果:
	 * - 置き換え後のwrapperにも現在のrow mode属性が同期される。
	 */
	it( 'when BlockListBlock replaces its wrapper without rerendering ReorderModeBlockListBlock, should resynchronize the current mode to the new wrapper', async () => {
		act( () => reorderMode.select( 'row', 'table-a' ) );

		const { getByTestId, getByRole } = render(
			<ReorderModeBlockListBlock
				BlockListBlock={ StatefulBlockListBlock }
				blockProps={ {
					clientId: 'table-a',
					isSelected: true,
					name: 'core/table',
					wrapperProps: { draggable: true },
				} }
			/>
		);

		const originalWrapper = getByTestId( 'block-wrapper' );

		expect( originalWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBe( 'row' );

		act( () => {
			getByRole( 'button', { name: 'Replace wrapper' } ).click();
		} );

		const replacedWrapper = getByTestId( 'block-wrapper' );

		expect( replacedWrapper ).not.toBe( originalWrapper );
		expect( replacedWrapper.tagName ).toBe( 'SECTION' );
		await waitFor( () => {
			expect( replacedWrapper.getAttribute( 'data-yamabiko-table-reorder-mode' ) ).toBe( 'row' );
		} );
	} );

	/**
	 * 選択中Tableの物理配置変化をToolbar表示用snapshotへ反映し、利用不能なColumn Reorder Modeを終了することを確認する。
	 *
	 * 事前条件:
	 * - 選択時のTableはColumn DnDを利用可能で、Column Reorder Modeが有効である。
	 *
	 * 操作:
	 * - 同じEditor DOM内でTableの表示属性を変更し、現在物理配置の評価をunavailableへ変える。
	 *
	 * 期待結果:
	 * - Table IdentityごとのToolbar表示用snapshotがunavailableへ更新される。
	 * - 利用不能なColumn Reorder Modeを維持せず通常編集モードへ戻る。
	 */
	it( 'when the selected table layout becomes unavailable, should update its snapshot and leave column mode', async () => {
		const { getByTestId } = render( renderBlockListBlock() );
		const blockWrapper = getByTestId( 'block-wrapper' );

		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'available' );
		act( () => reorderMode.select( 'column', 'table-a' ) );
		expect( reorderMode.getMode( 'table-a' ) ).toBe( 'column' );

		tableGeometryAvailability = 'unavailable';
		blockWrapper.classList.add( 'stacked-layout' );

		await waitFor( () => {
			expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'unavailable' );
			expect( reorderMode.getMode( 'table-a' ) ).toBe( 'edit' );
		} );
	} );

	/**
	 * 連続するlayout変化をToolbar表示用の1回の再評価へまとめることを確認する。
	 *
	 * 事前条件:
	 * - 選択中Tableの初期Layout Availability評価が完了している。
	 *
	 * 操作:
	 * - debounce待機時間内にwindow resizeを複数回発生させる。
	 *
	 * 期待結果:
	 * - 最後の通知から待機時間が経過するまで再評価しない。
	 * - 変化が落ち着いた後に現在の利用不可配置が反映される。
	 */
	it( 'when layout changes continue within the debounce period, should evaluate toolbar availability once after changes settle', () => {
		jest.useFakeTimers();
		const { unmount } = render( renderBlockListBlock() );

		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'available' );
		tableGeometryAvailability = 'unavailable';

		act( () => {
			window.dispatchEvent( new Event( 'resize' ) );
			jest.advanceTimersByTime( COLUMN_DND_LAYOUT_AVAILABILITY_DEBOUNCE_MS / 2 );
			window.dispatchEvent( new Event( 'resize' ) );
			jest.advanceTimersByTime( COLUMN_DND_LAYOUT_AVAILABILITY_DEBOUNCE_MS - 1 );
		} );
		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'available' );

		act( () => {
			jest.advanceTimersByTime( 1 );
		} );
		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'unavailable' );

		unmount();
		jest.useRealTimers();
	} );

	/**
	 * BlockListBlock接続終了時に予約済みのToolbar表示用再評価を破棄することを確認する。
	 *
	 * 事前条件:
	 * - 選択中Tableに対する再評価がdebounce待機中である。
	 *
	 * 操作:
	 * - 対象BlockListBlockをunmountし、その後debounce待機時間を経過させる。
	 *
	 * 期待結果:
	 * - unmount後にLayout Availabilityを再評価しない。
	 */
	it( 'when BlockListBlock unmounts during the debounce period, should cancel the pending toolbar reevaluation', () => {
		jest.useFakeTimers();
		const { unmount } = render( renderBlockListBlock() );

		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'available' );
		act( () => {
			window.dispatchEvent( new Event( 'resize' ) );
		} );
		unmount();
		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'unavailable' );

		act( () => {
			jest.advanceTimersByTime( COLUMN_DND_LAYOUT_AVAILABILITY_DEBOUNCE_MS );
		} );
		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'unavailable' );
		jest.useRealTimers();
	} );

	/**
	 * BlockListBlock接続終了後にToolbar表示用snapshotを残さないことを確認する。
	 *
	 * 事前条件:
	 * - 選択中Tableのavailable snapshotが共有されている。
	 *
	 * 操作:
	 * - 対象BlockListBlockをunmountする。
	 *
	 * 期待結果:
	 * - 対象Tableのsnapshotは安全側のunavailableへ戻る。
	 */
	it( 'when the selected BlockListBlock unmounts, should discard its toolbar snapshot', () => {
		const { unmount } = render( renderBlockListBlock() );
		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'available' );

		unmount();

		expect( getColumnDndLayoutAvailabilitySnapshot( 'table-a' ) ).toBe( 'unavailable' );
	} );
} );
