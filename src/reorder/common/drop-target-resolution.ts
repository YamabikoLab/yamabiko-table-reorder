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

/** DnD Interactionが現在の入力位置から解決した挿入境界。 */
export type DropTargetPosition = { boundaryIndex: number } | null;

/** 両方向を扱う境界で利用する移動先判定入力。 */
export type DropTargetResolutionRequest =
	| RowDropTargetResolutionRequest
	| ColumnDropTargetResolutionRequest;

/** 両方向を扱う境界で利用する移動先判定結果。 */
export type DropTargetResolutionResult =
	| RowDropTargetResolutionResult
	| ColumnDropTargetResolutionResult;

/** 行Requestには行Result、列Requestには列Resultを返す移動先判定契約。 */
export type DropTargetResolution = {
	resolve( request: RowDropTargetResolutionRequest ): RowDropTargetResolutionResult;
	resolve( request: ColumnDropTargetResolutionRequest ): ColumnDropTargetResolutionResult;
};

/**
 * 渡された判定入力だけを利用するDrop Target Resolutionを生成する。
 *
 * @return 行・列のRequest / Result対応を維持するDrop Target Resolution。
 */
export const createDropTargetResolution = (): DropTargetResolution => {
	function resolve( request: RowDropTargetResolutionRequest ): RowDropTargetResolutionResult;
	function resolve( request: ColumnDropTargetResolutionRequest ): ColumnDropTargetResolutionResult;
	function resolve( request: DropTargetResolutionRequest ): DropTargetResolutionResult {
		const boundaryIndex = request.currentPosition?.boundaryIndex;

		// 対象範囲内の挿入境界へ対応しない現在位置や無効な論理境界では移動先を成立させない。
		if ( boundaryIndex === undefined || ! Number.isInteger( boundaryIndex ) || boundaryIndex < 0 ) {
			return { status: 'none' };
		}

		// 対象方向の結合範囲を分断する禁止境界ではTable構造を保持できないため移動先を成立させない。
		if ( request.constraints.blockedBoundaries.includes( boundaryIndex ) ) {
			return { status: 'none' };
		}

		// 両方向を扱う入口では方向だけを選択し、Destinationの意味と生成は各Reorder責務へ委譲する。
		if ( request.kind === 'row' ) {
			return {
				status: 'valid',
				destination: createRowReorderDestination( request, boundaryIndex ),
			};
		}

		return {
			status: 'valid',
			destination: createColumnReorderDestination( request, boundaryIndex ),
		};
	}

	return { resolve };
};
