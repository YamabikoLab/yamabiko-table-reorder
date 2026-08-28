/**
 * DnD開始後の現在位置から、有効な移動先を判定する責務を提供する。
 *
 * DnD Interactionから渡された並び替え対象、並び替え種別、並び替え制約、現在位置だけを利用し、
 * 行ではbody区画内の行間、列ではTable全体の列間を表す挿入境界について移動先を判定する。
 * Table Integrationや共通Table構造には依存せず、Reorder Target Resolutionが導出した
 * `blockedBoundaries`を再解析しない。
 */
import type {
	ReorderConstraints,
	ReorderTarget,
} from '@/reorder/reorder-target-resolution';

/**
 * Drop Target Resolutionが判定対象とする現在位置。
 *
 * DnD Interactionが現在の入力位置から、現在の並び替え対象範囲内に対応する挿入境界を解決できた場合は
 * `boundaryIndex`を渡す。対象範囲内の挿入境界へ対応しない場合は`null`を渡す。
 */
export type DropTargetPosition = {
	/** 行間または列間を表す0-based挿入境界インデックス。 */
	boundaryIndex: number;
} | null;

/**
 * Drop Target Resolutionが受け取る1回の移動先判定入力。
 *
 * 並び替え種別とReorder Targetの種別を一致させ、成立したReorder Sessionが保持する
 * Reorder Constraintsと現在位置だけを判定へ利用する。
 */
export type DropTargetResolutionRequest =
	| {
			kind: 'row';
			target: Extract< ReorderTarget, { kind: 'row' } >;
			constraints: ReorderConstraints;
			currentPosition: DropTargetPosition;
	  }
	| {
			kind: 'column';
			target: Extract< ReorderTarget, { kind: 'column' } >;
			constraints: ReorderConstraints;
			currentPosition: DropTargetPosition;
	  };

/**
 * Drop Target Resolutionによって有効と判定された現在の移動先。
 *
 * 行ではbody区画内の行間、列ではTable全体の列間を表す挿入境界を保持する。
 */
export type ReorderDestination =
	| {
			kind: 'row';
			clientId: string;
			/** `body`区画内の行間を表す0-based挿入境界インデックス。 */
			boundaryIndex: number;
	  }
	| {
			kind: 'column';
			clientId: string;
			/** Table全体の列間を表す0-based挿入境界インデックス。 */
			boundaryIndex: number;
	  };

/**
 * DnD中の現在位置に対するDrop Target Resolutionの判定結果。
 *
 * 構造保持条件を満たす挿入境界だけを`valid`として返し、対象範囲内の移動先へ対応しない場合や
 * 対象方向の結合を分断する境界では`none`を返す。
 */
export type DropTargetResolutionResult =
	| {
			status: 'valid';
			destination: ReorderDestination;
	  }
	| {
			status: 'none';
	  };

/**
 * DnD開始後の現在位置から有効なReorder Destinationを判定する責務の契約。
 *
 * 判定結果や並び替え制約を保持せず、呼び出しごとに渡された値だけを利用する。
 */
export type DropTargetResolution = {
	/**
	 * 現在位置が有効な移動先として成立するか判定する。
	 *
	 * @param request activeなDnD Interactionから渡された現在の判定入力。
	 * @return 有効なReorder Destination、または有効な移動先なし。
	 */
	resolve: ( request: DropTargetResolutionRequest ) => DropTargetResolutionResult;
};

/**
 * 渡された判定入力だけを利用するDrop Target Resolutionを生成する。
 *
 * @return DnD開始後の現在位置を状態を保持せず判定するDrop Target Resolution。
 */
export const createDropTargetResolution = (): DropTargetResolution => ( {
	/**
	 * 現在位置に対応する挿入境界が構造保持条件を満たす場合だけ移動先として返す。
	 *
	 * @param request activeなDnD Interactionから渡された現在の判定入力。
	 * @return 有効なReorder Destination、または有効な移動先なし。
	 */
	resolve: ( request ) => {
		const boundaryIndex = request.currentPosition?.boundaryIndex;

		// 現在位置が対象範囲内の挿入境界へ対応しない場合は、有効な移動先を成立させない。
		if ( boundaryIndex === undefined || ! isBoundaryIndex( boundaryIndex ) ) {
			return { status: 'none' };
		}

		// 対象方向の結合セルを分断する境界では、Table構造を保持できないため移動先を成立させない。
		if ( request.constraints.blockedBoundaries.includes( boundaryIndex ) ) {
			return { status: 'none' };
		}

		let destination: ReorderDestination;

		// 並び替え種別ごとに、対応するReorder Destinationの種別を維持する。
		if ( request.kind === 'row' ) {
			destination = {
				kind: 'row',
				clientId: request.target.clientId,
				boundaryIndex,
			};
		} else {
			destination = {
				kind: 'column',
				clientId: request.target.clientId,
				boundaryIndex,
			};
		}

		return { status: 'valid', destination };
	},
} );

/**
 * 現在位置が挿入境界を表す論理インデックスとして成立するか判定する。
 *
 * @param index 現在位置に対応する挿入境界インデックス。
 * @return 0以上の整数である場合は`true`。
 */
const isBoundaryIndex = ( index: number ): boolean => Number.isInteger( index ) && index >= 0;
