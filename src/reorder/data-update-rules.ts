/**
 * Data Updateで行・列に共通する配列要素の移動処理を提供する。
 *
 * Reorder Destinationの境界indexを移動後のitem indexへ変換し、元配列を変更せずに新配列を返す。
 */

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

/**
 * 指定した要素をReorder Destinationの境界indexへ移動した新しい配列を返す。
 *
 * @param items            移動対象を含む配列。
 * @param targetIndex      移動対象のindex。
 * @param destinationIndex 元の配列順序に対する移動先の境界index。
 */
export const moveArrayItem = < T >(
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
