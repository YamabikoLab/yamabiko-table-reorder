/**
 * Reorder Guidance本体が所有する初回案内の一時状態を確認する。
 *
 * WordPressやReactを介さず、表示対象Tableの切り替えと終了通知のTable整合性を検証する。
 */

import { reorderGuidance, reorderGuidanceStore } from '@/reorder/reorder-guidance';

const RESET_TABLE_IDENTITY = '__reorder-guidance-contract-test-reset__';

/** 各テストが初回案内を表示していない状態から開始できるよう、一時状態を初期化する。 */
const resetReorderGuidance = () => {
	reorderGuidance.show( RESET_TABLE_IDENTITY, 'pc' );
	reorderGuidance.hide( RESET_TABLE_IDENTITY );
};

describe( 'Reorder Guidance contract', () => {
	beforeEach( () => {
		resetReorderGuidance();
	} );

	afterEach( () => {
		resetReorderGuidance();
	} );

	/**
	 * 概要:
	 * - 操作対象Tableが変わった場合、現在表示する初回案内も新しいTableへ切り替わることを確認する。
	 *
	 * 事前条件:
	 * - Table AへPC環境の初回案内を表示している。
	 *
	 * 操作:
	 * - Table Bへタッチ環境の初回案内を表示する。
	 *
	 * 期待結果:
	 * - 現在表示する案内はTable Bとタッチ環境の組み合わせだけになる。
	 */
	it( 'when guidance is shown for another table, should replace the active guidance with the new table', () => {
		reorderGuidance.show( 'table-a', 'pc' );

		reorderGuidance.show( 'table-b', 'touch' );

		expect( reorderGuidanceStore.getState().activeGuidance ).toEqual( {
			tableIdentity: 'table-b',
			environment: 'touch',
		} );
	} );

	/**
	 * 概要:
	 * - 過去に案内対象だった別Tableからの終了通知で、現在の案内を消さないことを確認する。
	 *
	 * 事前条件:
	 * - 現在はTable Bへ初回案内を表示している。
	 *
	 * 操作:
	 * - Table Aの初回案内を終了する通知を行う。
	 *
	 * 期待結果:
	 * - Table Bの初回案内を表示したまま維持する。
	 */
	it( 'when another table requests guidance dismissal, should keep the current table guidance active', () => {
		reorderGuidance.show( 'table-b', 'pc' );

		reorderGuidance.hide( 'table-a' );

		expect( reorderGuidanceStore.getState().activeGuidance ).toEqual( {
			tableIdentity: 'table-b',
			environment: 'pc',
		} );
	} );
} );
