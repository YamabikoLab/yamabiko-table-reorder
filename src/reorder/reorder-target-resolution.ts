/**
 * DnD開始時に並び替え対象と、そのDnDで利用する並び替え制約を確定する責務を提供する。
 *
 * Input InteractionとDnD Interactionから渡された開始対象について、Table Integrationが提供する要求時点の
 * 共通Table構造を取得し、行または列に固有の対象範囲と結合方向の判定へ委譲する。行・列で同じ意味を持つ
 * 開始可否と並び替え制約の規則はReorder Target Resolutionの共通規則として定義する。
 *
 * この責務は判定結果や並び替え制約を保持しない。成立した並び替え制約の保持はReorder Session、
 * DnD開始後の移動先判定はDrop Target Resolutionが担当する。
 */
import { resolveColumnReorderTarget } from '@/reorder/column-reorder/reorder-target-resolution';
import { resolveRowReorderTarget } from '@/reorder/row-reorder/reorder-target-resolution';
import type { TableIntegration } from './table-integration';

/**
 * Reorder Target Resolutionが受け取る1回のDnD開始試行。
 *
 * 行並び替えでは開始したTable区画と行位置を持ち、`body`区画だけを並び替え対象範囲として判定する。
 * 列並び替えではTable全体が対象範囲のため、論理Tableグリッド上の列位置だけを持つ。
 * `clientId`は要求時点の共通Table構造を取得する対象Tableの識別に利用する。
 */
export type ReorderTargetResolutionRequest =
	| {
			kind: 'row';
			clientId: string;
			section: 'head' | 'body' | 'foot';
			/** `body`区画を基準とする0-based行インデックス。 */
			rowIndex: number;
	  }
	| {
			kind: 'column';
			clientId: string;
			/** 論理Tableグリッド上の0-based列インデックス。 */
			columnIndex: number;
	  };

/**
 * 1回のDnDで実際に移動する並び替え対象。
 *
 * Reorder Target Resolutionが対象範囲と結合セル制約を確認し、独立して移動できると判定した行または列だけを
 * 表す。行は`body`区画内、列はTable全体の論理Tableグリッド上の位置を持つ。
 */
export type ReorderTarget =
	| {
			kind: 'row';
			clientId: string;
			/** `body`区画内の0-based行インデックス。 */
			rowIndex: number;
	  }
	| {
			kind: 'column';
			clientId: string;
			/** 論理Tableグリッド上の0-based列インデックス。 */
			columnIndex: number;
	  };

/**
 * 1回のDnD中にDrop Target Resolutionが利用する構造上の並び替え制約。
 *
 * 共通Table構造そのものではなく、対象方向の結合セルを分断するため移動先として利用できない
 * 挿入境界インデックスだけを保持する。`blockedBoundaries`は重複のない昇順とし、成立した
 * Reorder Sessionの間だけ利用する。
 */
export type ReorderConstraints = {
	blockedBoundaries: readonly number[];
};

/**
 * Reorder Target ResolutionがDnDを開始できない理由。
 *
 * 呼び出し側が開始不可の原因を区別できるよう、共通Table構造を確定できない場合、並び替え対象範囲外の場合、
 * 対象方向の結合セルによって単独移動できない場合を別の値で表す。
 *
 * - `table-structure-unavailable`: 要求時点の共通Table構造を取得できない。
 * - `target-out-of-scope`: 開始対象が現在の並び替え対象範囲として成立しない。
 * - `merged-cell`: 開始対象が対象方向の結合セルに含まれ、単独の行または列として移動できない。
 */
export type ReorderTargetResolutionFailureReason =
	| 'table-structure-unavailable'
	| 'target-out-of-scope'
	| 'merged-cell';

/**
 * DnD開始試行に対するReorder Target Resolutionの判定結果。
 *
 * `movable`の場合だけReorder TargetとReorder Constraintsを返す。`immovable`の場合は
 * Reorder Sessionを開始するための値を返さず、開始できない理由だけを返す。
 * 判定結果は保持せず、次の開始試行では要求時点のTable構造から改めて判定する。
 */
export type ReorderTargetResolutionResult =
	| {
			status: 'movable';
			target: ReorderTarget;
			constraints: ReorderConstraints;
	  }
	| {
			status: 'immovable';
			reason: ReorderTargetResolutionFailureReason;
	  };

/**
 * DnD開始試行時にReorder TargetとReorder Constraintsを解決する責務の契約。
 *
 * 開始試行ごとに要求時点の共通Table構造を利用し、以前の判定結果や並び替え制約を再利用しない。
 * DnD開始後の移動先判定と並び替え制約の保持はこの契約の責務に含めない。
 */
export type ReorderTargetResolution = {
	/**
	 * 1回のDnD開始試行を判定する。
	 *
	 * @param request DnD Interactionから渡された開始対象と並び替え種別。
	 * @return 開始可能な場合はReorder TargetとReorder Constraints、開始不可の場合はその理由。
	 */
	resolve: ( request: ReorderTargetResolutionRequest ) => ReorderTargetResolutionResult;
};

/**
 * DnD開始試行ごとに要求時点の共通Table構造を取得してReorder Target Resolutionを行う。
 *
 * 共通Table構造を取得できない場合は推測で開始可否を判定しない。構造を取得できた場合は並び替え種別に応じて
 * 行または列に固有の判定へ委譲する。判定に利用したTable構造と結果は次の開始試行へ持ち越さない。
 *
 * @param tableIntegration 要求時点の共通Table構造を提供するTable Integration。
 * @return 状態を保持せずDnD開始試行を判定するReorder Target Resolution。
 */
export const createReorderTargetResolution = (
	tableIntegration: TableIntegration
): ReorderTargetResolution => ( {
	/**
	 * 要求時点の共通Table構造を基準に1回のDnD開始試行を判定する。
	 *
	 * @param request DnD Interactionから渡された開始対象と並び替え種別。
	 * @return 開始可能なReorder TargetとReorder Constraints、または開始できない理由。
	 */
	resolve: ( request ) => {
		const structure = tableIntegration.getStructure( request.clientId );

		// Table構造を確定できない開始試行では、安全のため並び替えを開始しない。
		if ( structure === null ) {
			return { status: 'immovable', reason: 'table-structure-unavailable' };
		}

		// 並び替え種別ごとに固有の対象範囲と結合方向の規則へ判定を委譲する。
		if ( request.kind === 'row' ) {
			return resolveRowReorderTarget( request, structure );
		}

		return resolveColumnReorderTarget( request, structure );
	},
} );
