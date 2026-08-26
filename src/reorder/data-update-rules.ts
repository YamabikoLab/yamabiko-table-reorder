/**
 * 行・列のData Updateが共有する、1要素の並び替え規則を提供する。
 *
 * Reorder Destinationを元の順序に対する境界として解釈し、入力配列を変更せずに新しい順序を生成する。
 * Tableやfeature固有の判断は所有せず、確定済み移動を配列順へ反映する責務だけを担う。
 */

/**
 * Reorder Destinationが示す境界を、要素を取り出した後の挿入位置へ変換する。
 *
 * 元の順序が変化しない移動や、境界として解釈できない値には挿入位置が存在しないため`null`を返す。
 *
 * @param targetIndex      元の順序で移動対象を指すindex。
 * @param destinationIndex 元の順序に対して確定したReorder Destinationの境界index。
 * @return 移動対象を除いた配列へ挿入するindex。移動が成立しない場合は`null`。
 */
const getDestinationItemIndex = (
	targetIndex: number,
	destinationIndex: number
): number | null => {
	// Reorder Destinationとして意味を持たない要求では、移動後の挿入位置を生成しない。
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
 * 確定したReorder Destinationに従って1要素だけを移動した新しい配列を返す。
 *
 * 入力配列は更新前の状態として保持し、対象・移動先を安全に確定できない場合は部分的な変更を行わない。
 *
 * @param items            並び替え対象を含む元の要素列。Data Updateの入力状態として変更しない。
 * @param targetIndex      元の順序で移動対象を一意に指すindex。
 * @param destinationIndex 元の順序に対して確定したReorder Destinationの境界index。
 * @return 並び替え後の新しい配列。要求が成立しない場合は`null`。
 */
export const moveArrayItem = < T >(
	items: readonly T[],
	targetIndex: number,
	destinationIndex: number
): T[] | null => {
	const nextIndex = getDestinationItemIndex( targetIndex, destinationIndex );

	// 元配列上で安全に1要素移動を確定できない要求は、Data Updateとして適用しない。
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
