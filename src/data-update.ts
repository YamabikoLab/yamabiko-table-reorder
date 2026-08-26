import type { CommittedReorder } from './dnd-interaction';
import {
	createTableStructure,
	getTableSectionRows,
	type TableBlockAttributes,
	type TableSectionName,
} from './table-structure';

/**
 * Data UpdateがWordPress側へ確定更新を渡すcallback。
 */
export type SetTableAttributes = ( attributes: Record< string, unknown > ) => void;

/**
 * Data Updateへ渡す確定更新要求。
 */
export type DataUpdateRequest = {
	attributes: TableBlockAttributes;
	blockName: string;
	committedReorder: CommittedReorder;
	setAttributes: SetTableAttributes;
};

const TABLE_SECTION_NAMES: readonly TableSectionName[] = [ 'head', 'body', 'foot' ];

const getDestinationItemIndex = (
	targetIndex: number,
	destinationIndex: number
): number | null => {
	if (
		! Number.isInteger( targetIndex ) ||
		! Number.isInteger( destinationIndex ) ||
		destinationIndex === targetIndex ||
		destinationIndex === targetIndex + 1
	) {
		return null;
	}

	return destinationIndex > targetIndex ? destinationIndex - 1 : destinationIndex;
};

const moveArrayItem = < T >(
	items: readonly T[],
	targetIndex: number,
	destinationIndex: number
): T[] | null => {
	const nextIndex = getDestinationItemIndex( targetIndex, destinationIndex );
	if (
		nextIndex === null ||
		targetIndex < 0 ||
		targetIndex >= items.length ||
		destinationIndex < 0 ||
		destinationIndex > items.length ||
		nextIndex < 0 ||
		nextIndex >= items.length
	) {
		return null;
	}

	const reordered = [ ...items ];
	const [ movedItem ] = reordered.splice( targetIndex, 1 );
	reordered.splice( nextIndex, 0, movedItem );
	return reordered;
};

const createColumnIndexMap = (
	columnCount: number,
	targetIndex: number,
	destinationIndex: number
): number[] | null => {
	const columns = Array.from( { length: columnCount }, ( _, index ) => index );
	const reordered = moveArrayItem( columns, targetIndex, destinationIndex );
	if ( reordered === null ) {
		return null;
	}

	const indexMap = Array.from( { length: columnCount }, () => -1 );
	for ( let newIndex = 0; newIndex < reordered.length; newIndex++ ) {
		indexMap[ reordered[ newIndex ] ] = newIndex;
	}
	return indexMap;
};

const reorderRows = (
	attributes: TableBlockAttributes,
	targetIndex: number,
	destinationIndex: number
): Record< string, unknown > | null => {
	const body = getTableSectionRows( attributes, 'body' );
	if ( body === null || body.length === 0 ) {
		return null;
	}

	const reorderedBody = moveArrayItem( body, targetIndex, destinationIndex );
	if ( reorderedBody === null ) {
		return null;
	}

	return {
		...attributes,
		body: reorderedBody,
	};
};

const reorderColumns = (
	blockName: string,
	attributes: TableBlockAttributes,
	targetIndex: number,
	destinationIndex: number
): Record< string, unknown > | null => {
	const structure = createTableStructure( blockName, attributes );
	if ( structure === null ) {
		return null;
	}

	const indexMap = createColumnIndexMap(
		structure.columnCount,
		targetIndex,
		destinationIndex
	);
	if ( indexMap === null ) {
		return null;
	}

	const nextAttributes: Record< string, unknown > = { ...attributes };
	for ( const sectionName of TABLE_SECTION_NAMES ) {
		const layout = structure.sections[ sectionName ];
		if ( layout === undefined ) {
			continue;
		}

		nextAttributes[ sectionName ] = layout.rows.map( ( rowLayout ) => {
			const reorderedPlacements = [ ...rowLayout.placements ].sort( ( left, right ) => {
				const leftStart = Math.min(
					...Array.from(
						{ length: left.columnSpan },
						( _, offset ) => indexMap[ left.columnStart + offset ]
					)
				);
				const rightStart = Math.min(
					...Array.from(
						{ length: right.columnSpan },
						( _, offset ) => indexMap[ right.columnStart + offset ]
					)
				);
				return leftStart - rightStart;
			} );

			return {
				...rowLayout.row,
				cells: reorderedPlacements.map( ( placement ) => placement.cell ),
			};
		} );
	}

	return createTableStructure( blockName, nextAttributes ) === null ? null : nextAttributes;
};

/**
 * 確定済み並び替えを新しいTable block attributesへ変換する。
 *
 * Reorder Destinationの`index`は元のTable順序に対する行間または列間の境界indexとして
 * 解釈する。元attributesとcell objectは変更せず、行または列の位置だけを変更する。
 * 不正な入力や同位置へのno-opでは`null`を返す。
 *
 * @param blockName Core TableまたはFlexible Table Blockのblock名。
 * @param attributes 現在のTable block attributes。
 * @param committedReorder Data Updateへ渡された確定済み並び替え。
 */
export const applyCommittedReorder = (
	blockName: string,
	attributes: TableBlockAttributes,
	committedReorder: CommittedReorder
): Record< string, unknown > | null => {
	const { destination, kind, target } = committedReorder;

	return kind === 'row'
		? reorderRows( attributes, target.index, destination.index )
		: reorderColumns( blockName, attributes, target.index, destination.index );
};

/**
 * 確定済み並び替えを1回だけWordPress側のTableデータへ反映する。
 *
 * 変換が成立した場合だけ`setAttributes`を1回呼び出す。キャンセルや無効な完了は
 * Committed Reorderを生成しないため、この境界へ到達しない。
 *
 * @param request 現在attributes、確定済み並び替え、WordPress更新callback。
 * @return 更新を反映した場合は`true`、反映しなかった場合は`false`。
 */
export const commitReorderData = ( request: DataUpdateRequest ): boolean => {
	const { attributes, blockName, committedReorder, setAttributes } = request;
	const nextAttributes = applyCommittedReorder(
		blockName,
		attributes,
		committedReorder
	);
	if ( nextAttributes === null ) {
		return false;
	}

	setAttributes( nextAttributes );
	return true;
};
