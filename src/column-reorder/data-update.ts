import { moveArrayItem } from '../reorder/data-update-rules';
import {
	createTableStructure,
	type TableBlockAttributes,
	type TableSectionName,
} from '../reorder/table-structure';

const TABLE_SECTION_NAMES: readonly TableSectionName[] = [ 'head', 'body', 'foot' ];

const createColumnIndexMap = (
	columnCount: number,
	targetIndex: number,
	destinationIndex: number
): number[] | null => {
	const reordered = moveArrayItem(
		Array.from( { length: columnCount }, ( _, index ) => index ),
		targetIndex,
		destinationIndex
	);
	if ( reordered === null ) {
		return null;
	}
	const indexMap = Array.from( { length: columnCount }, () => -1 );
	for ( let newIndex = 0; newIndex < reordered.length; newIndex++ ) {
		indexMap[ reordered[ newIndex ] ] = newIndex;
	}
	return indexMap;
};

/**
 * 列並び替え固有のData Updateを行う。
 *
 * @param blockName        ブロック名。
 * @param attributes       テーブルブロックの属性。
 * @param targetIndex      移動対象の列インデックス。
 * @param destinationIndex 移動先の列インデックス。
 */
export const applyColumnReorder = (
	blockName: string,
	attributes: TableBlockAttributes,
	targetIndex: number,
	destinationIndex: number
): Record< string, unknown > | null => {
	const structure = createTableStructure( blockName, attributes );
	if ( structure === null ) {
		return null;
	}
	const indexMap = createColumnIndexMap( structure.columnCount, targetIndex, destinationIndex );
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
