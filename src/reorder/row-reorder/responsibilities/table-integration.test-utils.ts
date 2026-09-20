/**
 * Row ReorderテストがProduction Table Integrationへ接続するために、WordPress Block Editor Store境界のTable状態を準備する。
 */

import type { Block } from '@wordpress/blocks';
import { createReduxStore, dispatch, register, select } from '@wordpress/data';

/** テストで扱うCore Tableの一行。 */
export type RowReorderTestTableRow = {
	cells: Array< Record< string, unknown > >;
};

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
 * 現在Block集合を置き換える。
 *
 * @param blocks 現在Blockとして登録するTable集合。
 * @return Block集合の置換Action。
 */
const setBlocks = ( blocks: Block[] ): SetBlocksAction => ( {
	type: 'SET_BLOCKS',
	blocks,
} );

/**
 * 現在Tableの属性更新を要求する。
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
 * Block Editor Store境界の現在状態を更新する。
 *
 * @param state  現在状態。
 * @param action 適用するTable状態変更。
 * @return 状態変更後のBlock集合。
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
 * @param state    現在状態。
 * @param clientId 取得するTableのclientId。
 * @return 現在Block。存在しない場合はnull。
 */
const getBlock = ( state: TestBlockEditorState, clientId: string ): Block | null =>
	state.blocks[ clientId ] ?? null;

/**
 * Jestで直接読み込めないBlock Editor Storeだけを代替し、実@wordpress/dataの公開Store APIへ登録する。
 */
export const rowReorderTestBlockEditorStore = createReduxStore(
	'yamabiko-table-reorder/test-row-block-editor',
	{
		reducer,
		actions: { setBlocks, updateBlockAttributes },
		selectors: { getBlock },
	}
);

register( rowReorderTestBlockEditorStore );

/**
 * Production Table Integrationが参照できるCore Table Blockを作成する。
 *
 * @param clientId Table個体を識別するclientId。
 * @param body     tbodyとして登録する行集合。
 * @return Block Editor Storeへ登録可能なCore Table Block。
 */
export const createRowReorderTestTable = (
	clientId: string,
	body: RowReorderTestTableRow[]
): Block => ( {
	clientId,
	name: 'core/table',
	isValid: true,
	attributes: { body },
	innerBlocks: [],
} );

/**
 * 識別可能なセル内容を持つ単純Table行を作成する。
 *
 * @param rowLabel    行を識別する表示値。
 * @param columnCount 行に含めるセル数。
 * @return 指定数の通常セルから成るTable行。
 */
export const createRowReorderTestRow = (
	rowLabel: string,
	columnCount = 3
): RowReorderTestTableRow => ( {
	cells: Array.from( { length: columnCount }, ( _value, columnIndex ) => ( {
		content: `${ rowLabel }-${ columnIndex + 1 }`,
	} ) ),
} );

/**
 * 現在Table集合をBlock Editor Store境界へ登録する。
 *
 * @param blocks 現在Blockとして利用するTable集合。
 */
export const setRowReorderTestTables = ( blocks: Block[] ): void => {
	dispatch( rowReorderTestBlockEditorStore ).setBlocks( blocks );
};

/**
 * 現在TableをBlock Editor Store境界から取得する。
 *
 * @param clientId 取得するTableのclientId。
 * @return 現在Block。存在しない場合はnull。
 */
export const getRowReorderTestTable = ( clientId: string ): Block | null =>
	select( rowReorderTestBlockEditorStore ).getBlock( clientId );
