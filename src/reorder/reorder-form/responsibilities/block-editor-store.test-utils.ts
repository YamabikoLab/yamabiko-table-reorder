/**
 * RF Interactionテストで利用するBlock Editor Store環境境界を提供する。
 *
 * Jestで読み込めないBlock Editor実装の代わりに、Production Table Integrationが利用する
 * Block参照と属性更新をWordPress Dataの公開Store APIへ接続する。
 */

import type { Block } from '@wordpress/blocks';
import { createReduxStore, register } from '@wordpress/data';

type TestBlockEditorState = {
	blocks: Record< string, Block >;
};

type SetBlocksAction = {
	type: 'SET_BLOCKS';
	blocks: Block[];
};

type UpdateBlockAttributesAction = {
	type: 'UPDATE_BLOCK_ATTRIBUTES';
	clientId: string;
	attributes: Record< string, unknown >;
};

type TestBlockEditorAction = SetBlocksAction | UpdateBlockAttributesAction;

const INITIAL_STATE: TestBlockEditorState = { blocks: {} };

/**
 * Table集合をテストで必要な現在Block状態として置き換える。
 *
 * @param blocks 現在Blockとして登録するTable集合。
 * @return Table集合の置換Action。
 */
const setBlocks = ( blocks: Block[] ): SetBlocksAction => ( {
	type: 'SET_BLOCKS',
	blocks,
} );

/**
 * 指定Tableの現在属性へ変更を反映する。
 *
 * @param clientId   更新するTableのclientId。
 * @param attributes 現在属性へ反映する属性集合。
 * @return Table属性更新Action。
 */
const updateBlockAttributes = (
	clientId: string,
	attributes: Record< string, unknown >
): UpdateBlockAttributesAction => ( {
	type: 'UPDATE_BLOCK_ATTRIBUTES',
	clientId,
	attributes,
} );

/**
 * Block Editor Store環境境界の現在状態を更新する。
 *
 * @param state  現在のBlock Editor Store状態。
 * @param action 適用するTable状態変更。
 * @return 状態変更後のBlock Editor Store状態。
 */
const reducer = ( state = INITIAL_STATE, action: TestBlockEditorAction ): TestBlockEditorState => {
	if ( action.type === 'SET_BLOCKS' ) {
		return {
			blocks: Object.fromEntries( action.blocks.map( ( block ) => [ block.clientId, block ] ) ),
		};
	}

	if ( action.type === 'UPDATE_BLOCK_ATTRIBUTES' ) {
		const currentBlock = state.blocks[ action.clientId ];
		if ( currentBlock === undefined ) {
			return state;
		}

		return {
			blocks: {
				...state.blocks,
				[ action.clientId ]: {
					...currentBlock,
					attributes: { ...currentBlock.attributes, ...action.attributes },
				},
			},
		};
	}

	return state;
};

/**
 * clientIdに対応する現在Blockを取得する。
 *
 * @param state    現在のBlock Editor Store状態。
 * @param clientId 取得するTableのclientId。
 * @return 現在のBlock。存在しない場合はnull。
 */
const getBlock = ( state: TestBlockEditorState, clientId: string ): Block | null =>
	state.blocks[ clientId ] ?? null;

/** RF InteractionテストをProduction Table Integrationへ接続するBlock Editor Store環境境界。 */
export const testBlockEditorStore = createReduxStore( 'yamabiko-table-reorder/test-block-editor', {
	reducer,
	actions: { setBlocks, updateBlockAttributes },
	selectors: { getBlock },
} );

register( testBlockEditorStore );
