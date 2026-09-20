/**
 * RF InteractionテストがProduction責務へ接続するために、WordPress Block Editor Store上のTable状態とRF状態を準備・破棄する。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import type { Block } from '@wordpress/blocks';
import { dispatch, select } from '@wordpress/data';

import {
	applyRfReorder,
	cancelRfApply,
	completeRfApplyRestoration,
	getRfApplyCoordinationSnapshot,
} from './apply-coordination';
import { rfInteractionStore } from './interaction';
import { testBlockEditorStore } from './block-editor-store.test-utils';

/** テストで扱うCore Tableの一行。 */
export type TestTableRow = {
	cells: Array< Record< string, unknown > >;
};

/**
 * Production Table Integrationが参照できるCore Table Blockを作成する。
 *
 * @param clientId Table個体を識別するclientId。
 * @param body     tbodyとして登録する行集合。
 * @param head     任意のthead行集合。
 * @return Block Editor Storeへ登録可能なCore Table Block。
 */
export const createTestTableBlock = (
	clientId: string,
	body: TestTableRow[],
	head?: TestTableRow[]
): Block => ( {
	clientId,
	name: 'core/table',
	isValid: true,
	attributes: {
		body,
		...( head === undefined ? {} : { head } ),
	},
	innerBlocks: [],
} );

/**
 * 識別可能なセル内容を持つ単純Table行を作成する。
 *
 * @param rowLabel    行を識別する表示値。
 * @param columnCount 行に含めるセル数。
 * @return 指定数の通常セルから成るTable行。
 */
export const createTestTableRow = ( rowLabel: string, columnCount = 3 ): TestTableRow => ( {
	cells: Array.from( { length: columnCount }, ( _value, columnIndex ) => ( {
		content: `${ rowLabel }-${ columnIndex + 1 }`,
	} ) ),
} );

/**
 * テスト対象Table集合をBlock Editor Store環境境界の現在Blockとして登録する。
 *
 * @param blocks 現在Blockとして利用するTable集合。
 */
export const setTestTableBlocks = ( blocks: Block[] ): void => {
	dispatch( testBlockEditorStore ).setBlocks( blocks );
};

/**
 * Block Editor Storeにある現在Tableを取得する。
 *
 * @param clientId 取得するTableのclientId。
 * @return 現在のBlock。存在しない場合はnull。
 */
export const getTestTableBlock = ( clientId: string ): Block | null =>
	select( testBlockEditorStore ).getBlock( clientId );

/**
 * 現在Tableの外部変更をBlock Editor Store環境境界へ反映する。
 *
 * @param clientId   更新するTableのclientId。
 * @param attributes 現在属性へ反映する属性集合。
 */
export const updateTestTableAttributes = (
	clientId: string,
	attributes: Record< string, unknown >
): void => {
	dispatch( blockEditorStore ).updateBlockAttributes( clientId, attributes );
};

/**
 * 前テストが完了前に残したRF Apply LifecycleをProduction公開操作で完了する。
 */
const settleRfApplyCoordination = (): void => {
	const snapshot = getRfApplyCoordinationSnapshot();
	if ( snapshot.phase === 'confirming' ) {
		cancelRfApply();
		return;
	}
	if ( snapshot.phase === 'applying' ) {
		applyRfReorder();
		completeRfApplyRestoration();
		return;
	}
	if ( snapshot.phase === 'restoring' ) {
		completeRfApplyRestoration();
	}
};

/**
 * RF Interaction、RF Apply Coordination、Block Editor Storeをテスト初期状態へ戻す。
 */
export const resetRfInteractionTestState = (): void => {
	settleRfApplyCoordination();
	rfInteractionStore.setState( {
		session: { status: 'closed' },
		applyOutcome: { status: 'idle' },
	} );
	setTestTableBlocks( [] );
};
