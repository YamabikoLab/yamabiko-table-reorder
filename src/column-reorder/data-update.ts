/**
 * 確定した列の並び替えを、テーブル全体の列順へ反映する。
 *
 * 見出し、本体、フッターで同じ列が対応し続けるよう、すべてのセクションへ同じ列移動を適用する。
 * セルの内容や属性、結合情報は保持し、更新後もテーブル構造として解釈できる場合だけ結果を確定する。
 */

import { moveArrayItem } from '@/reorder/data-update-rules';
import { getTableBlockAdapter, TABLE_SECTION_NAMES } from '@/reorder/table-block-adapter';
import { createTableStructure, type TableBlockAttributes } from '@/reorder/table-structure';

/**
 * 元の列位置を、並び替え後の列位置へ対応付ける。
 *
 * 同じ対応関係を全セクションで共有することで、テーブル全体を1つの列移動として更新する。
 *
 * @param columnCount 並び替え前のテーブルで共有する列数。
 * @param targetIndex 元の順序で移動対象となる列の位置。
 * @param destinationIndex 元の順序に対して確定した移動先の境界位置。
 * @return 元の列位置から移動後の列位置への対応表。移動要求が成立しない場合は`null`。
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
 * 1列の確定した移動を、テーブルの全セクションへ反映した新しい属性を生成する。
 *
 * 各セルが占有する列の移動後位置に従ってセル順だけを組み替える。ブロック固有の読み書きに失敗した場合や、
 * 更新後の各セクションで列の対応関係を保てない場合は、途中まで更新した結果を返さない。
 *
 * @param blockName 列並び替え対象のGutenbergブロック名。
 * @param attributes 並び替え前のテーブル属性。入力値は変更しない。
 * @param targetIndex 元の列順で移動対象となる列の位置。
 * @param destinationIndex 元の列順に対して確定した移動先の境界位置。
 * @return 列位置だけを変更した新しい属性。テーブル構造を保持できない場合は`null`。
 */
export const applyColumnReorder = (
	blockName: string,
	attributes: TableBlockAttributes,
	targetIndex: number,
	destinationIndex: number
): Record< string, unknown > | null => {
	const adapter = getTableBlockAdapter( blockName );
	if ( adapter === null ) {
		return null;
	}

	const structure = createTableStructure( blockName, attributes );

	// 全セクションで同じ列位置を共有できるテーブルだけを更新対象とする。
	if ( structure === null ) {
		return null;
	}

	const indexMap = createColumnIndexMap( structure.columnCount, targetIndex, destinationIndex );
	if ( indexMap === null ) {
		return null;
	}

	let nextAttributes: Record< string, unknown > = { ...attributes };
	for ( const sectionName of TABLE_SECTION_NAMES ) {
		const layout = structure.sections[ sectionName ];
		if ( layout === undefined ) {
			continue;
		}

		const reorderedRows = layout.rows.map( ( rowLayout ) => {
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

		const updatedAttributes = adapter.writeSectionRows(
			nextAttributes,
			sectionName,
			reorderedRows
		);

		// すべての対象セクションを完全に書き戻せる場合だけ更新を継続する。
		if ( updatedAttributes === null ) {
			return null;
		}
		nextAttributes = updatedAttributes;
	}

	// 更新後も全セクションで同じ列位置を共有できる場合だけ結果を確定する。
	const preservesTableStructure = createTableStructure( blockName, nextAttributes ) !== null;
	const resultAttributes = preservesTableStructure ? nextAttributes : null;
	return resultAttributes;
};
