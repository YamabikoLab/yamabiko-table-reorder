/**
 * RF InteractionテストがProduction責務へ接続するために、WordPress Block Editor Store上のTable状態とRF状態を準備・破棄する。
 */

import { store as blockEditorStore } from '@wordpress/block-editor';
import type { Block } from '@wordpress/blocks';
import * as wpData from '@wordpress/data';

import {
	applyRfReorder,
	cancelRfApply,
	completeRfApplyRestoration,
	getRfApplyCoordinationSnapshot,
} from './apply-coordination';
import { rfInteractionStore } from './interaction';

/** テストで扱うCore Tableの一行。 */
export type TestTableRow = {
	cells: Array< Record< string, unknown > >;
};

const testTableBlocks = new Map< string, Block >();
const mockedData = wpData as unknown as { dispatch: jest.Mock; select: jest.Mock };
const actualData = jest.requireActual( '@wordpress/data' ) as {
	dispatch: ( storeNameOrDescriptor: unknown ) => unknown;
	select: ( storeNameOrDescriptor: unknown ) => unknown;
};
const testBlockEditorStore: unknown = blockEditorStore;

/**
 * Jestで読み込めないBlock Editor Storeの環境境界だけを代替し、Production Table Integrationから利用できる現在Block参照と属性更新を提供する。
 *
 * `@wordpress/block-editor`は現在のJest変換対象外である依存ESMを経由するため、対象テストではWordPress Dataの
 * その他のStoreを実装のまま維持し、Block Editor Storeとの入出力だけを決定的なTest Doubleへ置き換える。
 */
export const installTestTableStore = (): void => {
	mockedData.select.mockImplementation( ( storeNameOrDescriptor ) => {
		if ( storeNameOrDescriptor === testBlockEditorStore ) {
			return {
				getBlock: ( clientId: string ) => testTableBlocks.get( clientId ) ?? null,
			} as never;
		}
		return actualData.select( storeNameOrDescriptor );
	} );
	mockedData.dispatch.mockImplementation( ( storeNameOrDescriptor ) => {
		if ( storeNameOrDescriptor === testBlockEditorStore ) {
			return {
				updateBlockAttributes: ( clientId: string, attributes: Record< string, unknown > ) => {
					const currentBlock = testTableBlocks.get( clientId );
					if ( currentBlock !== undefined ) {
						testTableBlocks.set( clientId, {
							...currentBlock,
							attributes: { ...currentBlock.attributes, ...attributes },
						} );
					}
				},
			} as never;
		}
		return actualData.dispatch( storeNameOrDescriptor );
	} );
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
	testTableBlocks.clear();
	for ( const block of blocks ) {
		testTableBlocks.set( block.clientId, block );
	}
};

/**
 * Block Editor Storeにある現在Tableを取得する。
 *
 * @param clientId 取得するTableのclientId。
 * @return 現在のBlock。存在しない場合はnull。
 */
export const getTestTableBlock = ( clientId: string ): Block | null =>
	testTableBlocks.get( clientId ) ?? null;

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
	const currentBlock = testTableBlocks.get( clientId );
	if ( currentBlock === undefined ) {
		return;
	}
	testTableBlocks.set( clientId, {
		...currentBlock,
		attributes: { ...currentBlock.attributes, ...attributes },
	} );
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
