/** 行並び替えに固有のDrop Target Resolution契約を提供する。 */
import type { DropTargetPosition } from '@/reorder/core/drop-target-resolution';
import type { ReorderConstraints } from '@/reorder/core/reorder-target-resolution-rules';
import type { RowReorderTarget } from './reorder-target-resolution';
export type RowDropTargetResolutionRequest = { kind: 'row'; target: RowReorderTarget; constraints: ReorderConstraints; currentPosition: DropTargetPosition };
export type RowReorderDestination = { kind: 'row'; clientId: string; boundaryIndex: number };
export type RowDropTargetResolutionResult = { status: 'valid'; destination: RowReorderDestination } | { status: 'none' };
/** @param request 行DnDの移動先判定入力。 @param boundaryIndex 有効と判定された行間境界。 @return 行のReorder Destination。 */
export const createRowReorderDestination = ( request: RowDropTargetResolutionRequest, boundaryIndex: number ): RowReorderDestination => ( { kind: 'row', clientId: request.target.clientId, boundaryIndex } );
