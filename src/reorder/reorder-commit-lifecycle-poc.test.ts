/**
 * #714第2段階PoCのcommit前後におけるBlock選択とReorder Modeの分離、および選択解除あり / なしの比較経路を確認する。
 *
 * 実Editorの描画性能は検証せず、属性更新を同じ計測境界で1回だけ実行し、選択解除有無だけをA/B差分とすることを確認する。
 */

import { reorderModeIntegration } from './reorder-mode';
import {
	registerReorderCommitLifecyclePoC,
	runRowReorderCommitPoC,
	runRowReorderCommitWithoutClearPoC,
} from './reorder-commit-lifecycle-poc';

type BlockRecord = {
	attributes: {
		body: Array< { cells: Array< { content: string } > } >;
	};
	clientId: string;
	name: string;
};

type TestWindow = Window &
	typeof globalThis & {
		wp?: {
			data: {
				dispatch: () => {
					clearSelectedBlock: jest.Mock;
					selectBlock: jest.Mock;
					updateBlockAttributes: jest.Mock;
				};
				select: () => {
					getBlock: ( clientId: string ) => BlockRecord | null;
					getSelectedBlockClientId: () => string | null;
				};
			};
		};
		ytrReorderCommitPoC?: unknown;
	};

/**
 * requestAnimationFrameを同期的に進め、PoCが固定時間待機に依存しない状態で観測境界を通過させる。
 */
const installSynchronousAnimationFrame = () => {
	jest.spyOn( window, 'requestAnimationFrame' ).mockImplementation( ( callback ) => {
		callback( performance.now() );
		return 1;
	} );
};

describe( 'Reorder commit lifecycle PoC', () => {
	const table: BlockRecord = {
		attributes: {
			body: [ { cells: [ { content: 'A' } ] }, { cells: [ { content: 'B' } ] } ],
		},
		clientId: 'table-a',
		name: 'core/table',
	};
	let selectedClientId: string | null;
	let clearSelectedBlock: jest.Mock;
	let selectBlock: jest.Mock;
	let updateBlockAttributes: jest.Mock;

	beforeEach( () => {
		selectedClientId = table.clientId;
		clearSelectedBlock = jest.fn( () => {
			selectedClientId = null;
		} );
		selectBlock = jest.fn( ( clientId: string ) => {
			selectedClientId = clientId;
		} );
		updateBlockAttributes = jest.fn();
		installSynchronousAnimationFrame();

		const testWindow = window as TestWindow;
		testWindow.wp = {
			data: {
				dispatch: () => ( {
					clearSelectedBlock,
					selectBlock,
					updateBlockAttributes,
				} ),
				select: () => ( {
					getBlock: ( clientId: string ) => ( clientId === table.clientId ? table : null ),
					getSelectedBlockClientId: () => selectedClientId,
				} ),
			},
		};
	} );

	afterEach( () => {
		reorderModeIntegration.exit();
		jest.restoreAllMocks();
		const testWindow = window as TestWindow;
		delete testWindow.wp;
		delete testWindow.ytrReorderCommitPoC;
	} );

	/**
	 * 概要:
	 * - 選択解除ありのcommitでは、選択Blockがなく同じReorder Modeが維持されている場合だけ対象Tableを再選択することを確認する。
	 *
	 * 事前条件:
	 * - Table Aが選択され、行並び替えモードが有効である。
	 *
	 * 操作:
	 * - Row `0 → 1`の選択解除ありPoC commitを実行する。
	 *
	 * 期待結果:
	 * - Table選択を一度解除する。
	 * - `updateBlockAttributes()`を一度だけ実行する。
	 * - Reorder Modeを維持したままTable Aを再選択する。
	 */
	it( 'when clear-before-commit leaves selection empty, should reselect the active reorder table', async () => {
		reorderModeIntegration.select( 'row', table.clientId );

		const result = await runRowReorderCommitPoC( 0, 1 );

		expect( clearSelectedBlock ).toHaveBeenCalledTimes( 1 );
		expect( updateBlockAttributes ).toHaveBeenCalledTimes( 1 );
		expect( updateBlockAttributes ).toHaveBeenCalledWith( table.clientId, {
			body: [ table.attributes.body[ 1 ], table.attributes.body[ 0 ] ],
		} );
		expect( selectBlock ).toHaveBeenCalledTimes( 1 );
		expect( selectBlock ).toHaveBeenCalledWith( table.clientId, null );
		expect( reorderModeIntegration.isSelected( 'row', table.clientId ) ).toBe( true );
		expect( result.selectionStrategy ).toBe( 'clear-before-commit' );
		expect( result.selectionOutcome ).toBe( 'reselected-table' );
	} );

	/**
	 * 概要:
	 * - 選択解除なしの比較経路ではTable選択を維持したまま、同じ属性更新と観測境界を通ることを確認する。
	 *
	 * 事前条件:
	 * - Table Aが選択され、行並び替えモードが有効である。
	 *
	 * 操作:
	 * - Row `0 → 1`の選択解除なしPoC commitを実行する。
	 *
	 * 期待結果:
	 * - `clearSelectedBlock()`を呼ばない。
	 * - `updateBlockAttributes()`は一度だけ実行する。
	 * - Table Aの選択とReorder Modeを維持し、再選択しない。
	 */
	it( 'when keeping selection for comparison, should update once without clearing or reselecting', async () => {
		reorderModeIntegration.select( 'row', table.clientId );

		const result = await runRowReorderCommitWithoutClearPoC( 0, 1 );

		expect( clearSelectedBlock ).not.toHaveBeenCalled();
		expect( updateBlockAttributes ).toHaveBeenCalledTimes( 1 );
		expect( updateBlockAttributes ).toHaveBeenCalledWith( table.clientId, {
			body: [ table.attributes.body[ 1 ], table.attributes.body[ 0 ] ],
		} );
		expect( selectBlock ).not.toHaveBeenCalled();
		expect( selectedClientId ).toBe( table.clientId );
		expect( reorderModeIntegration.isSelected( 'row', table.clientId ) ).toBe( true );
		expect( result.selectionStrategy ).toBe( 'keep-selected' );
		expect( result.selectionOutcome ).toBe( 'table-already-selected' );
	} );

	/**
	 * 概要:
	 * - commit中に利用者が別Blockを選択してReorder Modeが終了した場合は、元Tableへ選択を戻さないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aが選択され、行並び替えモードが有効である。
	 *
	 * 操作:
	 * - 属性更新時にParagraph選択とReorder Mode終了が発生した状態を作る。
	 *
	 * 期待結果:
	 * - 属性更新は一度だけ成立する。
	 * - Table Aは再選択されない。
	 * - 利用者が移した選択を優先する。
	 */
	it( 'when user selection ends reorder mode during commit, should not steal selection back', async () => {
		reorderModeIntegration.select( 'row', table.clientId );
		updateBlockAttributes.mockImplementation( () => {
			selectedClientId = 'paragraph-a';
			reorderModeIntegration.exit();
		} );

		const result = await runRowReorderCommitPoC( 0, 1 );

		expect( updateBlockAttributes ).toHaveBeenCalledTimes( 1 );
		expect( selectBlock ).not.toHaveBeenCalled();
		expect( selectedClientId ).toBe( 'paragraph-a' );
		expect( result.selectionOutcome ).toBe( 'reorder-mode-ended' );
	} );

	/**
	 * 概要:
	 * - commit中に同じTableがすでに再選択されている場合は重ねて再選択しないことを確認する。
	 *
	 * 事前条件:
	 * - Table Aが選択され、行並び替えモードが有効である。
	 *
	 * 操作:
	 * - 属性更新時にTable Aが再選択された状態を作る。
	 *
	 * 期待結果:
	 * - PoC側から追加の`selectBlock()`を呼ばない。
	 * - Reorder Modeは維持する。
	 */
	it( 'when the active table is already selected after commit, should keep selection without reselecting', async () => {
		reorderModeIntegration.select( 'row', table.clientId );
		updateBlockAttributes.mockImplementation( () => {
			selectedClientId = table.clientId;
		} );

		const result = await runRowReorderCommitPoC( 0, 1 );

		expect( selectBlock ).not.toHaveBeenCalled();
		expect( reorderModeIntegration.isSelected( 'row', table.clientId ) ).toBe( true );
		expect( result.selectionOutcome ).toBe( 'table-already-selected' );
	} );

	/**
	 * 概要:
	 * - 実Editorから第2段階PoCとA/B比較を実行する一時APIが登録されることを確認する。
	 *
	 * 事前条件:
	 * - PoC APIはまだwindowへ登録されていない。
	 *
	 * 操作:
	 * - PoC APIを登録する。
	 *
	 * 期待結果:
	 * - Row / Columnそれぞれに選択解除あり / なしのcommit入口が公開される。
	 */
	it( 'when the PoC runner is registered, should expose clear and no-clear comparison entry points', () => {
		registerReorderCommitLifecyclePoC();

		const testWindow = window as TestWindow;
		expect( testWindow.ytrReorderCommitPoC ).toEqual( {
			column: expect.any( Function ),
			columnWithoutClear: expect.any( Function ),
			isCommitting: expect.any( Function ),
			row: expect.any( Function ),
			rowWithoutClear: expect.any( Function ),
		} );
	} );
} );
