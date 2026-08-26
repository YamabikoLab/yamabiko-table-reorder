/**
 * 確定済みの列並び替えを、Table全sectionへ同じlogical column移動として反映するData Updateを提供する。
 *
 * head / body / footの列対応を崩さず、cell内容・属性・結合情報を保持したまま位置だけを変更する。
 * 更新後もTable Structureとして成立する場合だけ結果を確定する。
 */

import { moveArrayItem } from '../reorder/data-update-rules';
import {
	createTableStructure,
	type TableBlockAttributes,
	type TableSectionName,
} from '../reorder/table-structure';

/**
 * 列移動を同じ規則で適用するTable section。
 *
 * 列DnDはsectionごとに別の移動を行わず、存在するhead / body / footすべてへ同じlogical column変換を適用する。
 */
const TABLE_SECTION_NAMES: readonly TableSectionName[] = [ 'head', 'body', 'foot' ];

/**
 * 元のlogical column indexを、列移動後のlogical column indexへ対応付ける。
 *
 * 1つの対応表を全sectionで共有することで、Table全体を同じ列移動として更新する。
 *
 * @param columnCount      並び替え前のTable全体で共有するlogical column数。
 * @param targetIndex      元の順序で移動対象columnを表すLogical Index。
 * @param destinationIndex 元の順序に対して確定したReorder Destinationの境界index。
 * @return 元indexから移動後indexへの対応表。移動要求が成立しない場合は`null`。
 */
const createColumnIndexMap = (
	columnCount: number,
	targetIndex: number,
	destinationIndex: number
): number[] | null => {
	const reorderedIndexes = moveArrayItem(
		Array.from( { length: columnCount }, ( _, index ) => index ),
		targetIndex,
		destinationIndex
	);
	if ( reorderedIndexes === null ) {
		return null;
	}

	const indexMap = Array.from( { length: columnCount }, () => -1 );
	for ( let newIndex = 0; newIndex < reorderedIndexes.length; newIndex++ ) {
		indexMap[ reorderedIndexes[ newIndex ] ] = newIndex;
	}
	return indexMap;
};

/**
 * 1列の確定済み移動をTable全sectionへ反映した新しいattributesを生成する。
 *
 * 各cellが占有するlogical columnの移動後位置に従ってcell順だけを組み替え、cell objectとrow・block固有属性は
 * 保持する。更新後の全sectionを再び同一のTable Structureとして解釈できない場合は更新を破棄する。
 *
 * @param blockName        列並び替え対象となるGutenberg block名。
 * @param attributes       並び替え前のTable block attributes。入力状態として変更しない。
 * @param targetIndex      元のTable順序で移動対象columnを表すLogical Index。
 * @param destinationIndex 元のTable順序に対して確定したReorder Destinationの境界index。
 * @return 列位置だけを変更した新しいattributes。Table構造を保持できない場合は`null`。
 */
export const applyColumnReorder = (
	blockName: string,
	attributes: TableBlockAttributes,
	targetIndex: number,
	destinationIndex: number
): Record< string, unknown > | null => {
	const structure = createTableStructure( blockName, attributes );

	// 列Data Updateは、全sectionで共有できるLogical Index空間を確定できるTableにだけ適用する。
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

	// 列移動後も全sectionで同じLogical Indexが同じ列を指せる場合だけ、更新結果を確定する。
	const preservesTableStructure = createTableStructure( blockName, nextAttributes ) !== null;
	const resultAttributes = preservesTableStructure ? nextAttributes : null;
	return resultAttributes;
};
