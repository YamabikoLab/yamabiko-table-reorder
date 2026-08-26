import { resolveColumnDropTarget } from '@/column-reorder/drop-target-resolution';
import { resolveRowDropTarget } from '@/row-reorder/drop-target-resolution';
import type { ReorderDestination, ReorderTarget } from './dnd-interaction';
import type { ReorderKind } from './reorder-mode';
import { createTableStructure } from './table-structure';

const isIntegerInRange = ( value: number, min: number, max: number ): boolean =>
	Number.isInteger( value ) && value >= min && value <= max;

const isNoopDestination = ( targetIndex: number, destinationIndex: number ): boolean =>
	destinationIndex === targetIndex || destinationIndex === targetIndex + 1;

/**
 * Drop Target Resolutionへ渡す判定要求。
 */
export type DropTargetResolutionRequest = {
	attributes: Readonly< Record< string, unknown > >;
	blockName: string;
	destinationIndex: number;
	kind: ReorderKind;
	target: ReorderTarget;
};

/**
 * 現在のTable構造と候補となる行間または列間から、有効なReorder Destinationを返す。
 *
 * Drop Target Resolutionの共通Contract入口として`kind`に対応するfeature実装を選択する。
 * row / column固有の結合セル判定は各featureへ委譲し、この境界では混在させない。
 * 判定中にTableデータは変更しない。
 *
 * @param request 並び替え種別、並び替え対象、候補境界、Table属性。
 */
export const resolveDropTarget = (
	request: DropTargetResolutionRequest
): ReorderDestination | null => {
	const { attributes, blockName, destinationIndex, kind, target } = request;
	const structure = createTableStructure( blockName, attributes );
	if ( structure === null ) {
		return null;
	}

	const itemCount =
		kind === 'row' ? structure.sections.body?.rows.length : structure.columnCount;
	if (
		itemCount === undefined ||
		! isIntegerInRange( target.index, 0, itemCount - 1 ) ||
		! isIntegerInRange( destinationIndex, 0, itemCount ) ||
		isNoopDestination( target.index, destinationIndex )
	) {
		return null;
	}

	return kind === 'row'
		? resolveRowDropTarget( structure, target, destinationIndex )
		: resolveColumnDropTarget( structure, target, destinationIndex );
};
