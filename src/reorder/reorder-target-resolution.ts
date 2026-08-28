import type { TableIntegration } from './table-integration';

/**
 * Reorder Target Resolutionが受け取るDnD開始試行の入力。
 *
 * 行並び替えでは開始したTable sectionと行位置、列並び替えではlogical Table grid上の
 * 列位置を受け取る。`clientId`は要求時点の共通Table structureをTable Integrationから
 * 取得するために利用する。
 */
export type ReorderTargetResolutionRequest =
	| {
			kind: 'row';
			clientId: string;
			section: 'head' | 'body' | 'foot';
			/** section内の0-based行index。 */
			rowIndex: number;
	  }
	| {
			kind: 'column';
			clientId: string;
			/** logical Table grid上の0-based列index。 */
			columnIndex: number;
	  };

/**
 * 1回のDnDで実際に移動するReorder Target。
 */
export type ReorderTarget =
	| {
			kind: 'row';
			clientId: string;
			/** body section内の0-based行index。 */
			rowIndex: number;
	  }
	| {
			kind: 'column';
			clientId: string;
			/** logical Table grid上の0-based列index。 */
			columnIndex: number;
	  };

/**
 * 1回のDnD中にDrop Target Resolutionが利用する構造上の制約。
 *
 * `blockedBoundaries`には、対象方向の結合セルを分断するため移動先として利用できない
 * insertion boundary indexを重複なし・昇順で保持する。
 */
export type ReorderConstraints = {
	blockedBoundaries: readonly number[];
};

/**
 * Reorder Target ResolutionがDnDを開始できない理由。
 */
export type ReorderTargetResolutionFailureReason =
	| 'table-structure-unavailable'
	| 'target-out-of-scope'
	| 'merged-cell';

/**
 * DnD開始試行に対するReorder Target Resolutionの解決結果。
 *
 * 移動可能な場合だけReorder Targetと、そのDnD中に利用するReorder Constraintsを返す。
 * 移動不可の場合はReorder Sessionへ持ち込む値を返さず、非開始理由だけを提供する。
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
 * DnD開始試行時にReorder Targetと構造上の制約を解決する責務のContract。
 */
export type ReorderTargetResolution = {
	resolve: ( request: ReorderTargetResolutionRequest ) => ReorderTargetResolutionResult;
};

type TableStructure = NonNullable< ReturnType< TableIntegration[ 'getStructure' ] > >;
type TableMergedCellStructure = TableStructure[ 'mergedCells' ][ number ];

/**
 * 0-based indexが開始対象として扱える基本的な論理indexか判定する。
 *
 * Input Interactionから渡される開始対象は現在Table上の対象を表すため、TableStructureに
 * 行数・列数を重複保持せず、ここでは負数や小数など開始対象として成立しない値だけを除外する。
 */
const isLogicalIndex = ( index: number ): boolean => Number.isInteger( index ) && index >= 0;

/**
 * 対象indexが指定方向の結合セル範囲に含まれるか判定する。
 */
const containsIndex = ( start: number, span: number, index: number ): boolean =>
	index >= start && index < start + span;

/**
 * 対象方向の結合セルから、分断できない内部境界を重複なし・昇順で導出する。
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
 * 行DnD開始試行をbody sectionのReorder Targetとして解決する。
 */
const resolveRowTarget = (
	request: Extract< ReorderTargetResolutionRequest, { kind: 'row' } >,
	structure: TableStructure
): ReorderTargetResolutionResult => {
	if ( request.section !== 'body' || ! isLogicalIndex( request.rowIndex ) ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	const mergedCells = structure.mergedCells.filter(
		( cell ) => cell.section === 'body' && cell.rowSpan > 1
	);

	if (
		mergedCells.some( ( cell ) => containsIndex( cell.rowStart, cell.rowSpan, request.rowIndex ) )
	) {
		return { status: 'immovable', reason: 'merged-cell' };
	}

	return {
		status: 'movable',
		target: {
			kind: 'row',
			clientId: request.clientId,
			rowIndex: request.rowIndex,
		},
		constraints: {
			blockedBoundaries: buildBlockedBoundaries(
				mergedCells,
				( cell ) => cell.rowStart,
				( cell ) => cell.rowSpan
			),
		},
	};
};

/**
 * 列DnD開始試行をTable全体のReorder Targetとして解決する。
 */
const resolveColumnTarget = (
	request: Extract< ReorderTargetResolutionRequest, { kind: 'column' } >,
	structure: TableStructure
): ReorderTargetResolutionResult => {
	if ( ! isLogicalIndex( request.columnIndex ) ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	const mergedCells = structure.mergedCells.filter( ( cell ) => cell.columnSpan > 1 );

	if (
		mergedCells.some( ( cell ) =>
			containsIndex( cell.columnStart, cell.columnSpan, request.columnIndex )
		)
	) {
		return { status: 'immovable', reason: 'merged-cell' };
	}

	return {
		status: 'movable',
		target: {
			kind: 'column',
			clientId: request.clientId,
			columnIndex: request.columnIndex,
		},
		constraints: {
			blockedBoundaries: buildBlockedBoundaries(
				mergedCells,
				( cell ) => cell.columnStart,
				( cell ) => cell.columnSpan
			),
		},
	};
};

/**
 * DnD開始試行ごとに要求時点の共通Table structureを取得してReorder Target Resolutionを行う。
 *
 * Table Integrationから取得した共通Table structureを個々の開始試行の間だけ利用し、判定結果や
 * Reorder Constraintsを内部状態として保持しない。行ではbody sectionの縦結合、列ではTable全体の
 * 横結合だけを対象方向の制約へ変換し、結合範囲を越える移動自体は制限しない。
 *
 * @param tableIntegration 要求時点の共通Table structureを提供するTable Integration。
 * @return 状態を保持せずDnD開始試行を解決するReorder Target Resolution。
 */
export const createReorderTargetResolution = (
	tableIntegration: TableIntegration
): ReorderTargetResolution => ( {
	resolve: ( request ) => {
		const structure = tableIntegration.getStructure( request.clientId );

		if ( structure === null ) {
			return { status: 'immovable', reason: 'table-structure-unavailable' };
		}

		return request.kind === 'row'
			? resolveRowTarget( request, structure )
			: resolveColumnTarget( request, structure );
	},
} );
