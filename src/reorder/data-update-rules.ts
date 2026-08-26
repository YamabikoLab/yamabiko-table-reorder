/**
 * 行・列のData Updateで共通する、1要素の並び替え規則を提供する。
 *
 * Reorder Destinationを元の順序に対する境界として扱い、確定済みの移動だけを新しい要素順へ変換する。
 * Tableや並び替え種別に固有の判断は持たず、入力状態を変更しない共通の更新Contractを所有する。
 */

/**
 * Reorder Destinationから、移動対象を除いた後の順序で対象を配置すべき位置を求める。
 *
 * 元の順序が変化しない移動やLogical Indexとして成立しない要求には配置先が存在しないため`null`を返す。
 *
 * @param targetIndex      元の順序で移動対象を表すLogical Index。
 * @param destinationIndex 元の順序に対して確定したReorder Destinationの境界index。
 * @return 移動対象を除いた後の順序で配置すべきindex。移動が成立しない場合は`null`。
 */
const getDestinationItemIndex = (
	targetIndex: number,
	destinationIndex: number
): number | null => {
	// Reorder Destinationは、有効なLogical Indexで実際に順序が変化する境界だけをData Updateへ渡せる。
	if (
		! Number.isInteger( targetIndex ) ||
		! Number.isInteger( destinationIndex ) ||
		destinationIndex === targetIndex ||
		destinationIndex === targetIndex + 1
	) {
		return null;
	}

	// Reorder Destinationは元の順序の境界を表すため、更新結果では対象を除いた後の同じ境界へ配置する。
	const destinationItemIndex =
		destinationIndex > targetIndex ? destinationIndex - 1 : destinationIndex;
	return destinationItemIndex;
};

/**
 * 確定したReorder Destinationに従い、1要素だけを移動した新しい要素列を生成する。
 *
 * 元の要素列は更新前状態として保持する。対象または移動先を一意に確定できない要求には変更結果を生成せず、
 * 部分的な並び替えを外部へ公開しない。
 *
 * @param items            並び替え対象を含む更新前の要素列。
 * @param targetIndex      元の順序で移動対象を表すLogical Index。
 * @param destinationIndex 元の順序に対して確定したReorder Destinationの境界index。
 * @return 並び替え後の新しい要素列。要求が成立しない場合は`null`。
 */
export const moveArrayItem = < T >(
	items: readonly T[],
	targetIndex: number,
	destinationIndex: number
): T[] | null => {
	const destinationItemIndex = getDestinationItemIndex( targetIndex, destinationIndex );

	// Data Updateは、対象と移動先の両方が現在の要素列で一意に成立する場合だけ確定できる。
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
