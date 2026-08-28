/**
 * DnD開始時に並び替え対象と、そのDnDで利用する並び替え制約を確定する責務を提供する。
 *
 * Input InteractionとDnD Interactionから渡された開始対象を、Table Integrationが提供する要求時点の
 * 共通Table構造と照合し、行または列を独立して並び替え可能か判定する。開始可能な場合はReorder Targetと
 * Reorder Constraintsを返し、開始できない場合は理由を返す。
 *
 * この責務は判定結果や並び替え制約を保持しない。成立した並び替え制約の保持はReorder Session、
 * DnD開始後の移動先判定はDrop Target Resolutionが担当する。
 */
import type {
	TableIntegration,
	TableMergedCellStructure,
	TableStructure,
} from './table-integration';

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
 * 開始対象の位置がReorder Targetとして利用できる論理インデックスか判定する。
 *
 * Table構造は行数・列数を重複保持しないため、開始対象の位置はInput Interactionが現在Table上から解決した
 * 値であることを前提とし、ここでは論理インデックスとして成立する基本条件だけを確認する。
 *
 * @param index 開始対象を示す0-based論理インデックス。
 * @return 論理インデックスとして成立する場合は`true`。
 */
const isLogicalIndex = ( index: number ): boolean => Number.isInteger( index ) && index >= 0;

/**
 * 指定位置が結合セルの占有範囲に含まれるか判定する。
 *
 * 結合セルの占有範囲は開始位置を含み、開始位置に占有数を加えた次の位置は含まないものとして扱う。
 * 行と列のどちらでも同じ占有範囲規則を利用する。
 *
 * @param start 結合セルが対象方向で開始する0-based論理インデックス。
 * @param span  結合セルが対象方向に占有する要素数。
 * @param index 占有範囲に含まれるか確認する0-based論理インデックス。
 * @return 指定位置が結合セルの占有範囲内の場合は`true`。
 */
const containsIndex = ( start: number, span: number, index: number ): boolean =>
	index >= start && index < start + span;

/**
 * 対象方向の結合セルから、移動先として利用できない挿入境界を導出する。
 *
 * 結合セルの内部にある境界だけを禁止し、結合範囲の外側へ移動すること自体は許可する。
 * 複数の結合セルが同じ境界を禁止する場合も1つの境界として扱い、Drop Target Resolutionが
 * 一意な順序で判定できるよう昇順で返す。
 *
 * @param mergedCells 対象方向の制約として扱う結合セル一覧。
 * @param getStart    結合セルから対象方向の開始位置を取得する関数。
 * @param getSpan     結合セルから対象方向の占有数を取得する関数。
 * @return 移動先として利用できない挿入境界インデックス一覧。
 */
const buildBlockedBoundaries = (
	mergedCells: readonly TableMergedCellStructure[],
	getStart: ( cell: TableMergedCellStructure ) => number,
	getSpan: ( cell: TableMergedCellStructure ) => number
): readonly number[] => {
	const boundaries = new Set< number >();

	for ( const cell of mergedCells ) {
		const start = getStart( cell );
		const span = getSpan( cell );

		for ( let offset = 1; offset < span; offset++ ) {
			boundaries.add( start + offset );
		}
	}

	return [ ...boundaries ].sort( ( left, right ) => left - right );
};

/**
 * 並び替え対象範囲内の行または列について、対象方向の結合セル制約を適用して開始可否を判定する。
 *
 * 行・列で共通する規則として、有効な論理インデックスを持ち、対象方向の結合セルに含まれない場合だけ
 * Reorder Targetとして成立する。成立時は同じ結合セル一覧からReorder Constraintsを生成する。
 *
 * @param target 開始可能な場合に返すReorder Target候補。
 * @param targetIndex 対象方向の0-based論理インデックス。
 * @param mergedCells 対象方向の開始可否と移動先制約に影響する結合セル一覧。
 * @param getStart 結合セルから対象方向の開始位置を取得する関数。
 * @param getSpan 結合セルから対象方向の占有数を取得する関数。
 * @return 開始可能なReorder TargetとReorder Constraints、または開始できない理由。
 */
const resolveTargetWithinScope = (
	target: ReorderTarget,
	targetIndex: number,
	mergedCells: readonly TableMergedCellStructure[],
	getStart: ( cell: TableMergedCellStructure ) => number,
	getSpan: ( cell: TableMergedCellStructure ) => number
): ReorderTargetResolutionResult => {
	// Reorder Targetは現在Table上の要素を示す有効な論理インデックスを持つ必要がある。
	if ( ! isLogicalIndex( targetIndex ) ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	const isInsideMergedCell = mergedCells.some( ( cell ) =>
		containsIndex( getStart( cell ), getSpan( cell ), targetIndex )
	);

	// 対象方向の結合セルに含まれる要素は、単独の行または列として並び替えることができない。
	if ( isInsideMergedCell ) {
		return { status: 'immovable', reason: 'merged-cell' };
	}

	const blockedBoundaries = buildBlockedBoundaries( mergedCells, getStart, getSpan );

	return {
		status: 'movable',
		target,
		constraints: { blockedBoundaries },
	};
};

/**
 * 行DnD開始試行を`body`区画内のReorder Targetとして判定する。
 *
 * 行並び替えの対象範囲は`body`区画だけとする。対象範囲内では縦方向に結合されたセルだけを
 * 行の開始可否と移動先制約として扱い、横方向だけの結合は行並び替えを制限しない。
 *
 * @param request DnD Interactionから渡された行DnD開始試行。
 * @param structure 要求時点の共通Table構造。
 * @return 行のReorder TargetとReorder Constraints、または開始できない理由。
 */
const resolveRowTarget = (
	request: Extract< ReorderTargetResolutionRequest, { kind: 'row' } >,
	structure: TableStructure
): ReorderTargetResolutionResult => {
	// 行並び替えでは`body`区画だけをReorder Targetの対象範囲とする。
	if ( request.section !== 'body' ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	const target: ReorderTarget = {
		kind: 'row',
		clientId: request.clientId,
		rowIndex: request.rowIndex,
	};
	const mergedCells = structure.mergedCells.filter(
		( cell ) => cell.section === 'body' && cell.rowSpan > 1
	);

	return resolveTargetWithinScope(
		target,
		request.rowIndex,
		mergedCells,
		( cell ) => cell.rowStart,
		( cell ) => cell.rowSpan
	);
};

/**
 * 列DnD開始試行をTable全体のReorder Targetとして判定する。
 *
 * 列並び替えは`head`、`body`、`foot`を含むTable全体を対象範囲とする。横方向に結合されたセルだけを
 * 列の開始可否と移動先制約として扱い、縦方向だけの結合は列並び替えを制限しない。
 *
 * @param request DnD Interactionから渡された列DnD開始試行。
 * @param structure 要求時点の共通Table構造。
 * @return 列のReorder TargetとReorder Constraints、または開始できない理由。
 */
const resolveColumnTarget = (
	request: Extract< ReorderTargetResolutionRequest, { kind: 'column' } >,
	structure: TableStructure
): ReorderTargetResolutionResult => {
	const target: ReorderTarget = {
		kind: 'column',
		clientId: request.clientId,
		columnIndex: request.columnIndex,
	};
	const mergedCells = structure.mergedCells.filter( ( cell ) => cell.columnSpan > 1 );

	return resolveTargetWithinScope(
		target,
		request.columnIndex,
		mergedCells,
		( cell ) => cell.columnStart,
		( cell ) => cell.columnSpan
	);
};

/**
 * DnD開始試行ごとに要求時点の共通Table構造を取得してReorder Target Resolutionを行う。
 *
 * 共通Table構造を取得できない場合は推測で開始可否を判定しない。構造を取得できた場合は並び替え種別に応じて
 * 行または列の対象範囲と結合方向を適用する。判定に利用したTable構造と結果は次の開始試行へ持ち越さない。
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

		// 並び替え種別ごとに定められた対象範囲と結合方向の規則を適用する。
		if ( request.kind === 'row' ) {
			return resolveRowTarget( request, structure );
		}

		return resolveColumnTarget( request, structure );
	},
} );
