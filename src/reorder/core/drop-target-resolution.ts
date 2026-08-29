/**
 * 行・列で同じ意味を持つDrop Target Resolutionの判定規則と入口を提供する。
 *
 * 共通責務は現在位置が有効な挿入境界か、禁止境界でないかだけを判定する。
 * 有効な境界から方向固有のReorder Destinationを生成する責務は各Reorder側へ委譲する。
 */
import {
	createColumnReorderDestination,
	type ColumnDropTargetResolutionRequest,
	type ColumnDropTargetResolutionResult,
} from '@/reorder/column-reorder/drop-target-resolution';
import {
	createRowReorderDestination,
	type RowDropTargetResolutionRequest,
	type RowDropTargetResolutionResult,
} from '@/reorder/row-reorder/drop-target-resolution';
import type { ReorderConstraints } from './reorder-target-resolution-rules';
import type { ReorderDestination, ReorderKind, ReorderTarget } from './reorder-types';

/** DnD Interactionが現在の入力位置から解決した挿入境界。 */
export type DropTargetPosition = { boundaryIndex: number } | null;

/** 指定した並び替え種別に対応する移動先判定入力。 */
export type DropTargetResolutionRequest< K extends ReorderKind = ReorderKind > = {
	[ Kind in K ]: {
		kind: Kind;
		target: ReorderTarget< Kind >;
		constraints: ReorderConstraints;
		currentPosition: DropTargetPosition;
	};
}[ K ];

/** 指定した並び替え種別に対応する移動先判定結果。 */
export type DropTargetResolutionResult< K extends ReorderKind = ReorderKind > = {
	[ Kind in K ]: { status: 'valid'; destination: ReorderDestination< Kind > } | { status: 'none' };
}[ K ];

/** DnD Interactionが具体方向ごとのRequest / Result対応を維持して利用する移動先判定契約。 */
export type DropTargetResolution = {
	resolveRow: ( request: RowDropTargetResolutionRequest ) => RowDropTargetResolutionResult;
	resolveColumn: ( request: ColumnDropTargetResolutionRequest ) => ColumnDropTargetResolutionResult;
};

/**
 * 共通規則から有効な挿入境界を判定する。
 *
 * @param constraints     DnD開始時に確定した構造保持制約。
 * @param currentPosition Input Interactionから渡された現在位置。
 * @return 有効な挿入境界、または有効な移動先がないことを表す`null`。
 */
const resolveBoundaryIndex = (
	constraints: ReorderConstraints,
	currentPosition: DropTargetPosition
): number | null => {
	const boundaryIndex = currentPosition?.boundaryIndex;

	// 対象範囲内の挿入境界へ対応しない現在位置や無効な論理境界では移動先を成立させない。
	if ( boundaryIndex === undefined || ! Number.isInteger( boundaryIndex ) || boundaryIndex < 0 ) {
		return null;
	}

	// 対象方向の結合範囲を分断する禁止境界ではTable構造を保持できないため移動先を成立させない。
	if ( constraints.blockedBoundaries.includes( boundaryIndex ) ) {
		return null;
	}

	return boundaryIndex;
};

/**
 * 渡された判定入力だけを利用するDrop Target Resolutionを生成する。
 *
 * @return 行・列それぞれのRequest / Result対応を型で固定したDrop Target Resolution。
 */
export const createDropTargetResolution = (): DropTargetResolution => ( {
	resolveRow: ( request ) => {
		const boundaryIndex = resolveBoundaryIndex( request.constraints, request.currentPosition );
		if ( boundaryIndex === null ) {
			return { status: 'none' };
		}

		return {
			status: 'valid',
			destination: createRowReorderDestination( request, boundaryIndex ),
		};
	},
	resolveColumn: ( request ) => {
		const boundaryIndex = resolveBoundaryIndex( request.constraints, request.currentPosition );
		if ( boundaryIndex === null ) {
			return { status: 'none' };
		}

		return {
			status: 'valid',
			destination: createColumnReorderDestination( request, boundaryIndex ),
		};
	},
} );
