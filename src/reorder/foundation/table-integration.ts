/**
 * Supported Table Block固有のデータ構造とReorder coreの共通Table構造を接続する境界を提供する。
 *
 * 対応Tableから要求時点のデータを取得し、Supported Block固有の属性解釈を各Integrationへ委譲したうえで、
 * `head`、`body`、`foot`の共通区画表現から結合セルの論理Tableグリッドを復元する。
 * Reorder coreはこの境界を通じて、対象Tableごとの属性構造や結合セル表現の違いを意識せずにTable構造を利用できる。
 *
 * Table IntegrationはTableデータや変換結果を保持せず、要求ごとに現在データから共通Table構造を作る。
 * 対象Tableを安全に変換できない場合は不完全な構造を返さず`null`とする。並び替え対象判定、
 * 並び替え制約の導出、移動先判定、Reorder Sessionの状態管理はこの責務に含めない。
 */

import { SUPPORTED_BLOCK_INTEGRATIONS } from '@/reorder/foundation/supported-block/registry';

/**
 * Table Integration内部で利用する共通のTable区画。
 *
 * 対象Tableごとに異なる区画表現を`head`、`body`、`foot`の3種類へ統一する。
 */
type TableSection = 'head' | 'body' | 'foot';

/**
 * Reorder coreがTableの構造上の制約を判断するために利用する共通Table構造。
 *
 * 通常セルの内容や装飾は保持せず、並び替え可否の判断に必要な結合セルの位置と範囲だけを保持する。
 * Reorder Target ResolutionなどTable Integrationの利用側は、この共通契約を直接参照する。
 *
 * この値は要求時点のTableから作成する一時的な結果であり、Table Integrationは後続要求や別のDnDへ
 * 持ち越さない。
 */
export type TableStructure = {
	/** Table内に存在する結合セルの位置と範囲。通常セルは含まない。 */
	mergedCells: readonly TableMergedCellStructure[];
};

/**
 * 共通Table構造上で1つの結合セルが占有する位置と範囲を表す。
 *
 * 行位置と列位置は、結合による占有範囲を考慮した論理Tableグリッド上で表す。
 * `TableStructure`とともにTable Integrationの共通契約として利用側へ公開する。
 */
export type TableMergedCellStructure = {
	/** 結合セルが属するTable区画。 */
	section: 'head' | 'body' | 'foot';
	/** 区画内で結合セルが開始する0-based行位置。 */
	rowStart: number;
	/** 論理Tableグリッド上で結合セルが開始する0-based列位置。 */
	columnStart: number;
	/** 結合セルが縦方向に占有する行数。 */
	rowSpan: number;
	/** 結合セルが横方向に占有する列数。 */
	columnSpan: number;
};

/**
 * Table Integrationが対象Tableの現在データを取得するために利用するBlock Editorストアの契約。
 *
 * `clientId`は対象Table個体の識別に利用する。要求ごとに現在のBlockを取得し、以前取得したBlockや属性を
 * 再利用しない。`block.name`はTable個体の識別ではなく、対応Table種類の判定にだけ利用する。
 */
export type TableIntegrationBlockStore = {
	/**
	 * `clientId`に対応する要求時点のBlockを取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return 要求時点のBlock。対象が存在しない場合は`null`または`undefined`。
	 */
	getBlock: ( clientId: string ) =>
		| {
				name: string;
				attributes: unknown;
		  }
		| null
		| undefined;
};

/**
 * 外部Table pluginとReorder coreの間でTable構造を受け渡すTable Integrationの契約。
 *
 * 呼び出し側は対象Tableの`clientId`だけを渡し、対象Table固有の属性構造や結合セル表現を意識しない。
 * 対象Blockが存在しない、非対応Table、`body`区画が欠落している、または安全に共通構造へ変換できない場合は
 * `null`を返し、不完全なTable構造は提供しない。
 *
 * Table Integration自身はTableデータ、共通Table構造、DnD状態、Reorder Session、並び替え制約を
 * 状態として保持しない。
 */
export type TableIntegration = {
	/**
	 * 対象Tableの要求時点の共通Table構造を取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return 共通Table構造。対象を取得できない、非対応Table、または安全に変換できない場合は`null`。
	 */
	getStructure: ( clientId: string ) => TableStructure | null;
};

/**
 * Table区画を論理Tableグリッドへ復元する前の、Table種類に依存しないセル表現。
 *
 * 対象Table固有の結合範囲表現は各Supported Block Integrationで解釈済みとし、
 * 共通処理は`rowSpan`と`columnSpan`だけを扱う。
 */
export type TableIntegrationCell = {
	/** セルが縦方向に占有する行数。 */
	rowSpan: number;
	/** セルが横方向に占有する列数。 */
	columnSpan: number;
};

/**
 * Table区画を論理Tableグリッドへ復元する前の、Table種類に依存しない行表現。
 *
 * セル内容や装飾はTable構造判定に不要なため保持しない。
 */
export type TableIntegrationRow = {
	/** 表示順に並ぶ区画内のセル一覧。 */
	cells: readonly TableIntegrationCell[];
};

/**
 * 各Supported Block Integrationが固有属性から作成し、共通構造復元へ渡すTable区画一覧。
 *
 * `head`と`foot`は省略可能なため空配列へ正規化する。`body`はTable本体として必須とし、欠落時は
 * この表現を成立させない。
 */
export type TableIntegrationSections = Readonly<
	Record< TableSection, readonly TableIntegrationRow[] >
>;

/**
 * 1種類のSupported Blockについて、固有属性をTable Integration共通の区画表現へ適応する内部契約。
 *
 * Supported Block固有属性を完全に解釈できた場合だけ共通区画表現を返し、不完全な構造を推測しない。
 */
export type SupportedBlockIntegration = {
	/**
	 * Supported Block固有属性をTable Integration共通の区画表現へ変換する。
	 *
	 * @param attributes 要求時点のSupported Block固有属性。
	 * @return 共通のTable区画一覧。安全に変換できない場合は`null`。
	 */
	getSections: ( attributes: unknown ) => TableIntegrationSections | null;
};

/**
 * 現在セルが論理Tableグリッド上で開始できる最初の列位置を求める。
 *
 * 先行行の縦結合が後続行の列を占有している場合、その占有範囲を避けて現在セルの横幅全体を配置できる
 * 最初の列を採用する。これにより、物理的なセル配列位置ではなく結合を考慮した論理列位置を確定する。
 *
 * @param occupiedUntilRow 各論理列がどの行まで先行する縦結合に占有されるかを表す一覧。
 * @param rowStart         現在セルが属する区画内の0-based行位置。
 * @param minimumColumn    現在セルについて探索を開始する最小列位置。
 * @param columnSpan       現在セルが横方向に占有する列数。
 * @return 現在セルを配置できる論理Tableグリッド上の0-based開始列位置。
 */
const findColumnStart = (
	occupiedUntilRow: readonly number[],
	rowStart: number,
	minimumColumn: number,
	columnSpan: number
): number => {
	let candidate = minimumColumn;

	// 現在セルを置ける最初の論理列が確定するまで、先行する縦結合と重ならない候補位置を探す。
	while ( true ) {
		let isAvailable = true;
		// 候補位置からセルの横幅全体を確認し、1列でも縦結合に占有されていればその候補を採用しない。
		for ( let column = candidate; column < candidate + columnSpan; column++ ) {
			// 先行する縦結合が占有中の列を含む候補位置には、新しいセルを配置しない。
			if ( ( occupiedUntilRow[ column ] ?? 0 ) > rowStart ) {
				isAvailable = false;
				break;
			}
		}

		// 現在セルの横幅全体を配置できる最初の候補位置を、そのセルの論理開始列として確定する。
		if ( isAvailable ) {
			return candidate;
		}

		candidate++;
	}
};

/**
 * 1つのTable区画について論理Tableグリッドを復元し、結合セルの共通構造を作成する。
 *
 * 先行する縦結合の占有範囲を考慮して各セルの論理列位置を確定し、縦または横に2以上を占有するセルだけを
 * 結合セルとして結果へ含める。通常セルは位置計算に利用するが共通Table構造には保持しない。
 * 縦結合が区画末尾を越える指定は、実在する行までを占有範囲として扱う。
 *
 * @param section 共通Table構造へ記録するTable区画。
 * @param rows    Table種類に依存しない区画内の行一覧。
 * @return 区画内の結合セル一覧。
 */
const buildSectionMergedCells = (
	section: TableSection,
	rows: readonly TableIntegrationRow[]
): readonly TableMergedCellStructure[] => {
	const occupiedUntilRow: number[] = [];
	const mergedCells: TableMergedCellStructure[] = [];

	// 区画の行を上から順に配置し、先行行の縦結合による占有を後続行の論理列位置へ反映する。
	for ( let rowStart = 0; rowStart < rows.length; rowStart++ ) {
		const row = rows[ rowStart ];
		let minimumColumn = 0;

		// 1行内のセルを表示順に配置し、各セルについて結合を考慮した論理開始列を確定する。
		for ( const cell of row.cells ) {
			const rowSpan = Math.min( cell.rowSpan, rows.length - rowStart );
			const columnStart = findColumnStart(
				occupiedUntilRow,
				rowStart,
				minimumColumn,
				cell.columnSpan
			);

			// 現在セルが占有するすべての論理列へ縦方向の占有期限を反映し、後続行との重なりを防ぐ。
			for ( let column = columnStart; column < columnStart + cell.columnSpan; column++ ) {
				occupiedUntilRow[ column ] = Math.max(
					occupiedUntilRow[ column ] ?? 0,
					rowStart + rowSpan
				);
			}

			// 共通Table構造には、並び替え制約の判断に必要な結合セルだけを保持する。
			if ( rowSpan > 1 || cell.columnSpan > 1 ) {
				mergedCells.push( {
					section,
					rowStart,
					columnStart,
					rowSpan,
					columnSpan: cell.columnSpan,
				} );
			}

			minimumColumn = columnStart + cell.columnSpan;
		}
	}

	return mergedCells;
};

/**
 * 正規化済みのTable区画一覧からReorder core共通のTable構造を構築する。
 *
 * `head`、`body`、`foot`それぞれについて結合を考慮した論理Tableグリッドを復元し、結合セルだけを
 * `TableStructure`へ集約する。Supported Block固有属性はこの処理へ持ち込まない。
 *
 * @param sections Table種類に依存しないTable区画一覧。
 * @return Reorder coreが利用する共通Table構造。
 */
const buildTableStructure = ( sections: TableIntegrationSections ): TableStructure => {
	const mergedCells: TableMergedCellStructure[] = [];

	// `head`、`body`、`foot`をそれぞれ独立した論理Tableグリッドとして復元し、Table全体の結合セル構造へ集約する。
	for ( const section of [ 'head', 'body', 'foot' ] as const ) {
		mergedCells.push( ...buildSectionMergedCells( section, sections[ section ] ) );
	}

	return { mergedCells };
};

/**
 * Reorder coreから利用するTable Integrationを作成する。
 *
 * 構造取得要求ごとに対象Tableの現在Blockを取得し、その時点のTable種類に対応するSupported Block Integrationで
 * 固有属性を共通区画表現へ適応してから、Table Integration共通の論理Tableグリッドを復元する。
 * Block、属性、共通Table構造は内部状態として保持せず、後続要求では現在のストア状態を基準にする。
 *
 * 対象Blockが存在しない、非対応Table、または属性を安全に変換できない場合は`null`を返す。
 * Reorder固有の並び替え対象判定、並び替え制約導出、移動先判定はこの境界では行わない。
 *
 * @param blockEditorStore 対象`clientId`から要求時点のBlockを取得するストア契約。
 * @return 状態を保持せず要求時点のTable構造を提供するTable Integration。
 */
export const createTableIntegration = (
	blockEditorStore: TableIntegrationBlockStore
): TableIntegration => ( {
	getStructure: ( clientId ) => {
		const block = blockEditorStore.getBlock( clientId );

		// 対象Tableの現在データを取得できない場合は、共通Table構造を推測しない。
		if ( ! block ) {
			return null;
		}

		const integration = SUPPORTED_BLOCK_INTEGRATIONS[ block.name ];

		// 対応対象として定義されていないTable種類はReorder coreへ公開しない。
		if ( ! integration ) {
			return null;
		}

		const sections = integration.getSections( block.attributes );

		// Supported Block固有属性を安全に共通区画へ適応できない場合は、不完全なTable構造を返さない。
		if ( sections === null ) {
			return null;
		}

		return buildTableStructure( sections );
	},
} );
