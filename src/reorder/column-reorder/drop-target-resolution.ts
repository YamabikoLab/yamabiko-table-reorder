/** 列並び替えに固有のDrop Target Resolution契約を提供する。 */
import type { DropTargetPosition } from '@/reorder/core/drop-target-resolution';
import type { ReorderConstraints } from '@/reorder/core/reorder-target-resolution-rules';
import type { ColumnReorderTarget } from './reorder-target-resolution';
export type ColumnDropTargetResolutionRequest = { kind: 'column'; target: ColumnReorderTarget; constraints: ReorderConstraints; currentPosition: DropTargetPosition };
export type ColumnReorderDestination = { kind: 'column'; clientId: string; boundaryIndex: number };
export type ColumnDropTargetResolutionResult = { status: 'valid'; destination: ColumnReorderDestination } | { status: 'none' };
/** @param request 列DnDの移動先判定入力。 @param boundaryIndex 有効と判定された列間境界。 @return 列のReorder Destination。 */
export const createColumnReorderDestination = ( request: ColumnDropTargetResolutionRequest, boundaryIndex: number ): ColumnReorderDestination => ( { kind: 'column', clientId: request.target.clientId, boundaryIndex } );
