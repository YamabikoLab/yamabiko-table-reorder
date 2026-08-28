import type {
	TableIntegration,
	TableMergedCellStructure,
	TableStructure,
} from './table-integration';

/**
 * Reorder Target Resolutionが受け取るDnD開始試行の入力。
 *
 * Input Interactionが解釈した開始対象を、DnD Interactionからこの責務へ渡すための共通表現である。
 * 行並び替えでは開始したTable sectionと行位置を保持し、body sectionだけを対象にできるようにする。
 * 列並び替えではTable全体を対象とするためsectionを持たず、logical Table grid上の列位置だけを保持する。
 * `clientId`は要求時点の共通Table structureをTable Integrationから取得するために利用する。
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
 *
 * Reorder Target Resolutionで対象範囲と結合セル制約を確認した後だけ生成され、成立したReorder Sessionへ
 * 引き継がれる。行はbody section内の行、列はTable全体のlogical Table grid上の列だけを表す。
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
 * 共通Table structureそのものをReorder Sessionへ保持せず、移動先判定に必要な意味だけへ変換した結果である。
 * `blockedBoundaries`には、対象方向の結合セルを分断するため移動先として利用できないinsertion boundary
 * indexを重複なし・昇順で保持する。この値は成立した1回のReorder Session内だけで利用する。
 */
export type ReorderConstraints = {
	blockedBoundaries: readonly number[];
};

/**
 * Reorder Target ResolutionがDnDを開始できない理由。
 *
 * 呼び出し側が非開始理由を区別できるよう、構造取得不能、対象範囲外、結合セルによる移動不能を
 * 別のreasonとして返す。
 *
 * - `table-structure-unavailable`: 要求時点の共通Table structureを取得できない。
 * - `target-out-of-scope`: 開始対象が行・列の対象範囲または基本的なlogical index条件を満たさない。
 * - `merged-cell`: 開始対象が対象方向の結合セル範囲に含まれ、行・列単位の移動対象として成立しない。
 */
export type ReorderTargetResolutionFailureReason =
	| 'table-structure-unavailable'
	| 'target-out-of-scope'
	| 'merged-cell';

/**
 * DnD開始試行に対するReorder Target Resolutionの解決結果。
 *
 * `movable`はReorder Targetと、そのDnD中に利用するReorder Constraintsを返す。
 * `immovable`はReorder Sessionへ持ち込む値を返さず、開始できないreasonだけを返す。
 * 判定結果自体はReorder Target Resolutionに保持せず、次の開始試行では改めて解決する。
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
 *
 * `resolve()`は開始試行ごとに要求時点の共通Table structureを利用し、以前の判定結果や制約情報を
 * 再利用しない。DnD開始後の移動先判定やReorder ConstraintsのLifecycleはこのContractでは所有しない。
 */
export type ReorderTargetResolution = {
	/**
	 * 1回のDnD開始試行を解決する。
	 *
	 * @param request DnD Interactionから渡された開始対象と並び替え種別。
	 * @return 開始可能な場合はReorder Targetと制約、開始不可の場合はそのreason。
	 */
	resolve: ( request: ReorderTargetResolutionRequest ) => ReorderTargetResolutionResult;
};

/**
 * 0-based indexが開始対象として扱える基本的なlogical indexか判定する。
 *
 * Input Interactionから渡される開始対象は現在Table上の対象を表すため、TableStructureに
 * 行数・列数を重複保持せず、ここでは負数や小数など開始対象として成立しない値だけを除外する。
 *
 * @param index 開始対象として検証する0-based index。
 * @return 0以上の整数として扱える場合は`true`。
 */
const isLogicalIndex = ( index: number ): boolean => Number.isInteger( index ) && index >= 0;

/**
 * 対象indexが指定方向の結合セル範囲に含まれるか判定する。
 *
 * 結合セルの開始位置を含み、`start + span`は含まない半開区間として扱うことで、行と列で同じ
 * 判定規則を利用する。
 *
 * @param start 結合セルが対象方向で開始する0-based index。
 * @param span 結合セルが対象方向に占有する要素数。
 * @param index 結合セル範囲に含まれるか確認する0-based index。
 * @return `index`が結合セルの占有範囲内なら`true`。
 */
const containsIndex = ( start: number, span: number, index: number ): boolean =>
	index >= start && index < start + span;

/**
 * 対象方向の結合セルから、分断できない内部境界を重複なし・昇順で導出する。
 *
 * 1つの結合セルについて開始位置の直後から末尾直前までのinsertion boundaryを無効化する。
 * 複数の結合セルが同じ境界を占有してもSetで重複を除き、Drop Target Resolutionが安定した
 * 判定入力として利用できるよう昇順へ正規化して返す。
 *
 * @param mergedCells 対象方向の制約として扱う結合セル一覧。
 * @param getStart 結合セルから対象方向の0-based開始indexを取得する関数。
 * @param getSpan 結合セルから対象方向の占有数を取得する関数。
 * @return 対象方向の結合を分断するため移動先にできないinsertion boundary index一覧。
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
 *
 * head / footからの開始やlogical indexとして成立しない行は対象範囲外とし、body sectionの縦結合に
 * 含まれる行は行単位で移動できないため非開始とする。移動可能な場合はbody sectionの縦結合だけから
 * `blockedBoundaries`を導出し、横結合だけのセルは行DnDの制約へ含めない。
 *
 * @param request DnD Interactionから渡された行DnD開始試行。
 * @param structure 要求時点の共通Table structure。
 * @return 行のReorder Targetと制約、またはDnDを開始できない理由。
 */
const resolveRowTarget = (
	request: Extract< ReorderTargetResolutionRequest, { kind: 'row' } >,
	structure: TableStructure
): ReorderTargetResolutionResult => {
	// 行DnDの対象範囲はbody sectionだけなので、head / footからの開始は対象範囲外として扱う。
	if ( request.section !== 'body' ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	// 行位置は0以上の整数だけを受け入れ、それ以外は開始対象として成立しない。
	if ( ! isLogicalIndex( request.rowIndex ) ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	// 行DnDではbody sectionの縦結合だけが開始可否と移動先制約に影響する。
	const mergedCells = structure.mergedCells.filter(
		( cell ) => cell.section === 'body' && cell.rowSpan > 1
	);

	// 縦結合セルの占有範囲内にある行は、1行単位のReorder Targetとして成立しない。
	if (
		mergedCells.some( ( cell ) => containsIndex( cell.rowStart, cell.rowSpan, request.rowIndex ) )
	) {
		return { status: 'immovable', reason: 'merged-cell' };
	}

	// 対象範囲と結合セル条件を満たした場合だけ、Reorder Sessionへ渡せる開始結果を返す。
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
 *
 * logical indexとして成立しない列は対象範囲外とし、head / body / footを問わず横結合に含まれる列は
 * 列単位で移動できないため非開始とする。移動可能な場合はTable全体の横結合だけから
 * `blockedBoundaries`を導出し、縦結合だけのセルは列DnDの制約へ含めない。
 *
 * @param request DnD Interactionから渡された列DnD開始試行。
 * @param structure 要求時点の共通Table structure。
 * @return 列のReorder Targetと制約、またはDnDを開始できない理由。
 */
const resolveColumnTarget = (
	request: Extract< ReorderTargetResolutionRequest, { kind: 'column' } >,
	structure: TableStructure
): ReorderTargetResolutionResult => {
	// 列位置は0以上の整数だけを受け入れ、それ以外は開始対象として成立しない。
	if ( ! isLogicalIndex( request.columnIndex ) ) {
		return { status: 'immovable', reason: 'target-out-of-scope' };
	}

	// 列DnDではsectionを問わずTable全体の横結合だけが開始可否と移動先制約に影響する。
	const mergedCells = structure.mergedCells.filter( ( cell ) => cell.columnSpan > 1 );

	// 横結合セルの占有範囲内にある列は、1列単位のReorder Targetとして成立しない。
	if (
		mergedCells.some( ( cell ) =>
			containsIndex( cell.columnStart, cell.columnSpan, request.columnIndex )
		)
	) {
		return { status: 'immovable', reason: 'merged-cell' };
	}

	// 対象範囲と結合セル条件を満たした場合だけ、Reorder Sessionへ渡せる開始結果を返す。
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

		// 要求時点の共通Table structureを取得できない場合は、推測で判定せずDnDを開始不可とする。
		if ( structure === null ) {
			return { status: 'immovable', reason: 'table-structure-unavailable' };
		}

		// 行と列では対象範囲と利用する結合方向が異なるため、Reorder Kindごとの解決処理へ分岐する。
		if ( request.kind === 'row' ) {
			return resolveRowTarget( request, structure );
		}

		return resolveColumnTarget( request, structure );
	},
} );
