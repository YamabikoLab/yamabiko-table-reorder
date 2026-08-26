import type { TableBlockAttributes } from '../reorder/table-structure';

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

/**
 * 行並び替え固有のData Updateを行う。
 */
export const applyRowReorder = (
	attributes: TableBlockAttributes,
	targetIndex: number,
	destinationIndex: number
): Record< string, unknown > | null => {
	const body = attributes.body;
	if ( ! Array.isArray( body ) || body.length === 0 ) {
		return null;
	}

	const reorderedBody = moveArrayItem( body, targetIndex, destinationIndex );
	return reorderedBody === null
		? null
		: {
				...attributes,
				body: reorderedBody,
		  };
};
