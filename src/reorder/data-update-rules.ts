/**
 * 行・列のデータ更新で共通する、1要素の並び替え規則を提供する。
 *
 * 並び替え先を元の順序に対する境界として扱い、確定済みの移動だけを新しい要素順へ変換する。
 * テーブルや並び替え種別に固有の判断は持たない。
 */

/**
 * 確定した移動先から、対象を除いた後に挿入すべき位置を求める。
 *
 * 元の順序が変わらない移動や、有効な整数位置として扱えない要求には挿入先が存在しない。
 *
 * @param targetIndex      元の順序で移動対象を表す位置。
 * @param destinationIndex 元の順序に対して確定した移動先の境界位置。
 * @return 対象を除いた後に挿入すべき位置。移動が成立しない場合は`null`。
 */
const getDestinationItemIndex = (
	targetIndex: number,
	destinationIndex: number
): number | null => {
	// 実際に順序が変化する有効な整数位置だけを更新対象とする。
	if (
		! Number.isInteger( targetIndex ) ||
		! Number.isInteger( destinationIndex ) ||
		destinationIndex === targetIndex ||
		destinationIndex === targetIndex + 1
	) {
		return null;
	}

	const destinationItemIndex =
		destinationIndex > targetIndex ? destinationIndex - 1 : destinationIndex;
	return destinationItemIndex;
};

/**
 * 確定した移動先に従い、1要素だけを移動した新しい要素列を生成する。
 *
 * 元の要素列は変更しない。対象または移動先を一意に確定できない場合は、部分的な並び替え結果を返さない。
 *
 * @param items            並び替え対象を含む更新前の要素列。
 * @param targetIndex      元の順序で移動対象を表す位置。
 * @param destinationIndex 元の順序に対して確定した移動先の境界位置。
 * @return 並び替え後の新しい要素列。要求が成立しない場合は`null`。
 */
export const moveArrayItem = < T >(
	items: readonly T[],
	targetIndex: number,
	destinationIndex: number
): T[] | null => {
	const destinationItemIndex = getDestinationItemIndex( targetIndex, destinationIndex );

	// 対象と移動先の両方が現在の要素列で成立する場合だけ更新する。
	if (
		destinationItemIndex === null ||
		targetIndex < 0 ||
		targetIndex >= items.length ||
		destinationIndex < 0 ||
		destinationIndex > items.length ||
		destinationItemIndex < 0 ||
		destinationItemIndex >= items.length
	) {
		return null;
	}

	const reorderedItems = [ ...items ];
	const [ movedItem ] = reorderedItems.splice( targetIndex, 1 );
	reorderedItems.splice( destinationItemIndex, 0, movedItem );
	return reorderedItems;
};
