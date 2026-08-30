/**
 * Table Integrationが確定済み並び替えを対応Table Blockのデータ更新へ適応する境界を提供する。
 *
 * 対応Table Block固有の属性構造を方向共通の更新用Tableデータへ変換し、選択済みの行・列責務から
 * 渡された更新規則を現在データへ適用する。Block属性更新の開始と成立確認はこの境界だけが担当し、
 * 行・列固有の並び替え規則は解釈しない。
 */
import type { ConcreteReorderKind, ReorderKind } from '@/reorder/core/reorder-types';

/** Reorder coreからTable Integrationへ渡す方向共通の更新表現。 */
export type TableReorderUpdate< K extends ReorderKind = ReorderKind > = {
	kind: K;
	clientId: string;
	/** 並び替え前の0-based位置。 */
	sourceIndex: number;
	/** 並び替え後に対象が占める0-based位置。 */
	destinationIndex: number;
};

/** 具体的な一方向へ確定したTable更新。 */
export type ConcreteTableReorderUpdate< K extends ReorderKind > = TableReorderUpdate< K > & {
	kind: ConcreteReorderKind< K >;
};

/** Table Integrationが確認できた外部更新状態。 */
export type TableUpdateResult =
	| { status: 'updated' }
	| { status: 'unavailable' }
	| { status: 'unconfirmed' };

/** Table Integration更新用の共通Table区画名。 */
export type TableUpdateSectionName = 'head' | 'body' | 'foot';

/**
 * 対応Table固有セルを、並び替え時に内容を保持したまま扱う共通表現。
 *
 * `data`は元のセルデータを変更せず保持し、結合範囲だけを方向固有規則が参照できる共通値として提供する。
 */
export type TableUpdateCell = {
	data: Record< string, unknown >;
	rowSpan: number;
	columnSpan: number;
};

/** 対応Table固有行を、セル内容を保持したまま扱う共通表現。 */
export type TableUpdateRow = {
	data: Record< string, unknown >;
	cells: readonly TableUpdateCell[];
};

/** 1つのTable区画について、存在状態と現在行順を保持する共通更新表現。 */
export type TableUpdateSection = {
	exists: boolean;
	rows: readonly TableUpdateRow[];
};

/**
 * Table Integrationが要求時点の対応Tableから作る方向共通の更新用Tableデータ。
 *
 * 行・列責務はこの値だけを利用し、Core TableやFlexible Table Block固有の属性名を直接解釈しない。
 */
export type TableUpdateData = Readonly<
	Record< TableUpdateSectionName, TableUpdateSection >
>;

/** 1回の並び替えでBlock属性へ反映するTable区画の変更。 */
export type TableUpdateChanges = Partial<
	Record< TableUpdateSectionName, readonly TableUpdateRow[] >
>;

/**
 * 具体方向の規則に従って、要求時点の共通Tableデータから更新対象区画を決定する契約。
 *
 * @param table  Table Integrationが要求時点の対応Tableから作成した共通更新用データ。
 * @param update Data Updateで共通位置へ正規化済みの同方向更新。
 * @return Block属性へ反映する区画変更。現在状態で安全に更新できない場合は`null`。
 */
export type TableUpdateChangesResolver< K extends ReorderKind > = (
	table: TableUpdateData,
	update: ConcreteTableReorderUpdate< K >
) => TableUpdateChanges | null;

/** Table IntegrationがBlock Editorの現在状態と更新APIを利用するための契約。 */
export type TableUpdateBlockStore = {
	/**
	 * 対象clientIdの要求時点のBlockを取得する。
	 *
	 * @param clientId 対象Table個体を特定するBlock EditorのclientId。
	 * @return 現在Block。存在しない場合は`null`または`undefined`。
	 */
	getBlock: ( clientId: string ) => { name: string; attributes: unknown } | null | undefined;
	/**
	 * 対象Blockへ1つの属性更新を適用する。
	 *
	 * @param clientId   対象Table個体を特定するBlock EditorのclientId。
	 * @param attributes 1回の並び替えとして同時に反映する属性差分。
	 */
	updateBlockAttributes: ( clientId: string, attributes: Record< string, unknown > ) => void;
};

/** 確定した並び替えを対応Table Blockへ反映するTable Integration更新境界。 */
export type TableUpdateIntegration = {
	/**
	 * 具体方向へ確定した1回の並び替えを、同方向の更新規則を利用して対象Tableへ反映する。
	 *
	 * @param update         Data Updateで共通位置へ正規化済みの更新。
	 * @param resolveChanges DnD開始時に選択済みの方向に対応するTable更新規則。
	 * @return 更新成立を確認できた状態、開始不可、または開始後に成立を確認できない状態。
	 */
	updateReorder: < K extends ReorderKind >(
		update: ConcreteTableReorderUpdate< K >,
		resolveChanges: TableUpdateChangesResolver< K >
	) => TableUpdateResult;
};

/** Table種類ごとに異なる結合範囲属性を読み取る契約。 */
type SpanReader = {
	/** @param cell 対応Table固有のセル。 @return 縦方向の占有数。 */
	getRowSpan: ( cell: Record< string, unknown > ) => number | null;
	/** @param cell 対応Table固有のセル。 @return 横方向の占有数。 */
	getColumnSpan: ( cell: Record< string, unknown > ) => number | null;
};

/**
 * Table属性、行、セルとして安全に参照できるオブジェクトか判定する。
 *
 * 外部Tableデータを推測で解釈しないため、配列や`null`を属性オブジェクトとして扱わない。
 *
 * @param value 外部Tableデータから受け取った判定対象。
 * @return 属性を安全に参照できるオブジェクトなら`true`。
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	value !== null && typeof value === 'object' && ! Array.isArray( value );

/**
 * 対応Table固有セルに保存された結合範囲を共通の占有数へ正規化する。
 *
 * 結合指定がない通常セルは1として扱い、指定がある場合は1以上の整数だけを有効な結合範囲とする。
 *
 * @param value 対応Table固有セルから取得した結合範囲値。
 * @return 1以上の占有数。安全に解釈できない値では`null`。
 */
const parseSpan = ( value: unknown ): number | null => {
	// 結合範囲が省略された通常セルは1行1列を占有する。
	if ( value === undefined ) {
		return 1;
	}

	// 対応Tableが保存し得る数値または数値文字列だけを結合範囲として解釈する。
	if ( typeof value !== 'number' && typeof value !== 'string' ) {
		return null;
	}

	const span = Number( value );
	// Table上の占有数は1以上の整数である必要があり、それ以外から有効な構造を推測しない。
	const normalizedSpan = Number.isInteger( span ) && span >= 1 ? span : null;
	return normalizedSpan;
};

/** Core Table固有の結合範囲表現を読み取る。 */
const coreTableSpanReader: SpanReader = {
	getRowSpan: ( cell ) => parseSpan( cell.rowspan ),
	getColumnSpan: ( cell ) => parseSpan( cell.colspan ),
};

/** Flexible Table Block固有の結合範囲表現を読み取る。 */
const flexibleTableBlockSpanReader: SpanReader = {
	getRowSpan: ( cell ) => parseSpan( cell.rowSpan ),
	getColumnSpan: ( cell ) => parseSpan( cell.colSpan ),
};

/** 対応Table Block名から結合範囲の読み取り規則を選択する対応表。 */
const TABLE_SPAN_READERS: Readonly< Partial< Record< string, SpanReader > > > = {
	'core/table': coreTableSpanReader,
	'flexible-table-block/table': flexibleTableBlockSpanReader,
};

/**
 * 1つの対応Table区画を、元データと結合範囲を保持する共通更新表現へ変換する。
 *
 * @param section    要求時点の対応Table固有区画データ。
 * @param spanReader 対応Table種類に応じた結合範囲の読み取り規則。
 * @return 共通更新用区画。区画を安全に解釈できない場合は`null`。
 */
const normalizeTableSection = (
	section: unknown,
	spanReader: SpanReader
): TableUpdateSection | null => {
	// `head`と`foot`を含む省略区画は作成せず、存在しない状態をそのまま保持する。
	if ( section === undefined ) {
		return { exists: false, rows: [] };
	}

	// 存在する区画を行一覧として解釈できない場合は、更新可能なTableデータを推測しない。
	if ( ! Array.isArray( section ) ) {
		return null;
	}

	const rows: TableUpdateRow[] = [];
	// 区画内の全行とセルを変換し、部分的にしか解釈できない区画を更新側へ渡さない。
	for ( const row of section ) {
		// 各行はセル一覧を保持するTable行として安全に参照できる必要がある。
		if ( ! isRecord( row ) || ! Array.isArray( row.cells ) ) {
			return null;
		}

		const cells: TableUpdateCell[] = [];
		// セル内容を保持したまま、方向固有規則が必要とする縦横の占有範囲だけを共通値へ変換する。
		for ( const cell of row.cells ) {
			// 各セルは内容と結合範囲を保持するTableセルとして安全に参照できる必要がある。
			if ( ! isRecord( cell ) ) {
				return null;
			}

			const rowSpan = spanReader.getRowSpan( cell );
			const columnSpan = spanReader.getColumnSpan( cell );
			// 結合範囲を確定できないセルが1つでもあれば、現在Tableを安全な更新対象として扱わない。
			if ( rowSpan === null || columnSpan === null ) {
				return null;
			}

			cells.push( { data: cell, rowSpan, columnSpan } );
		}

		rows.push( { data: row, cells } );
	}

	return { exists: true, rows };
};

/**
 * 対応Table固有属性を、行・列どちらの更新規則も利用できる共通Tableデータへ変換する。
 *
 * @param attributes 要求時点の対応Table固有属性。
 * @param spanReader 対応Table種類に応じた結合範囲の読み取り規則。
 * @return 3区画の共通更新用データ。安全に変換できない場合は`null`。
 */
const normalizeTableData = (
	attributes: unknown,
	spanReader: SpanReader
): TableUpdateData | null => {
	// Table属性そのものを安全に参照できない場合は、区画構造を推測しない。
	if ( ! isRecord( attributes ) ) {
		return null;
	}

	const head = normalizeTableSection( attributes.head, spanReader );
	const body = normalizeTableSection( attributes.body, spanReader );
	const foot = normalizeTableSection( attributes.foot, spanReader );
	// 1区画でも安全に解釈できなければ、Table全体の部分的な更新データを成立させない。
	if ( head === null || body === null || foot === null ) {
		return null;
	}

	return { head, body, foot };
};

/**
 * 方向固有規則が決定した区画変更を、対応Table Blockへ渡す属性差分へ戻す。
 *
 * @param changes 元の行・セルデータを保持した共通Table区画の変更。
 * @return `updateBlockAttributes()`へ1回で渡す属性差分。
 */
const createAttributesUpdate = ( changes: TableUpdateChanges ): Record< string, unknown > => {
	const attributesUpdate: Record< string, unknown > = {};

	// 方向固有規則が変更対象とした区画だけを属性差分へ含め、対象外区画は現在値のまま維持する。
	for ( const sectionName of [ 'head', 'body', 'foot' ] as const ) {
		const rows = changes[ sectionName ];
		// 方向固有規則が変更対象に含めなかった区画は属性更新へ追加しない。
		if ( rows === undefined ) {
			continue;
		}

		attributesUpdate[ sectionName ] = rows.map( ( row ) => ( {
			...row.data,
			cells: row.cells.map( ( cell ) => cell.data ),
		} ) );
	}

	return attributesUpdate;
};

/**
 * Block属性のうち今回の更新対象が期待した内容へ反映されたか確認する。
 *
 * 更新差分に含まれる値だけを再帰的に比較し、更新対象外のBlock属性が存在していても成立確認を妨げない。
 *
 * @param actual   更新後に再取得したBlock属性またはその部分値。
 * @param expected 今回の更新差分で期待する属性またはその部分値。
 * @return 更新対象の内容が期待結果と等価なら`true`。
 */
const areEquivalent = ( actual: unknown, expected: unknown ): boolean => {
	// 同一値または同一参照なら、その更新対象は期待結果と一致している。
	if ( Object.is( actual, expected ) ) {
		return true;
	}

	// どちらかが配列なら、両方が同じ要素数の配列として各位置の内容まで一致する必要がある。
	if ( Array.isArray( actual ) || Array.isArray( expected ) ) {
		if (
			! Array.isArray( actual ) ||
			! Array.isArray( expected ) ||
			actual.length !== expected.length
		) {
			return false;
		}
		return actual.every( ( value, index ) => areEquivalent( value, expected[ index ] ) );
	}

	// 配列以外は両方とも属性オブジェクトとして参照できる場合だけ部分属性を比較する。
	if ( ! isRecord( actual ) || ! isRecord( expected ) ) {
		return false;
	}

	const expectedKeys = Object.keys( expected );
	// 更新差分に含まれる各属性だけを確認し、今回変更していない外部属性は成立判定の対象にしない。
	return expectedKeys.every(
		( key ) => key in actual && areEquivalent( actual[ key ], expected[ key ] )
	);
};

/**
 * 対応Table Blockの更新を提供するTable Integration境界を作成する。
 *
 * @param blockStore 現在Blockの取得と1回の属性更新を提供するBlock Editorストア契約。
 * @return 状態を保持せず、要求ごとに外部Table状態を確認する更新境界。
 */
export const createTableUpdateIntegration = (
	blockStore: TableUpdateBlockStore
): TableUpdateIntegration => ( {
	updateReorder: < K extends ReorderKind >(
		update: ConcreteTableReorderUpdate< K >,
		resolveChanges: TableUpdateChangesResolver< K >
	): TableUpdateResult => {
		const block = blockStore.getBlock( update.clientId );
		// DnD確定後に対象Tableが存在しなくなった場合は、過去の状態で更新を推測せず開始不可として返す。
		if ( ! block ) {
			return { status: 'unavailable' };
		}

		const spanReader = TABLE_SPAN_READERS[ block.name ];
		// 要求時点で対応対象ではないTable種類へ更新方法を推測して適用しない。
		if ( ! spanReader ) {
			return { status: 'unavailable' };
		}

		const table = normalizeTableData( block.attributes, spanReader );
		// 対応Table固有属性を安全な共通更新データへ変換できない場合は更新を開始しない。
		if ( table === null ) {
			return { status: 'unavailable' };
		}

		const changes = resolveChanges( table, update );
		// DnD確定後の現在状態で方向固有の更新規則を安全に成立させられない場合は更新を開始しない。
		if ( changes === null ) {
			return { status: 'unavailable' };
		}

		const attributesUpdate = createAttributesUpdate( changes );
		blockStore.updateBlockAttributes( update.clientId, attributesUpdate );

		const updatedBlock = blockStore.getBlock( update.clientId );
		// 更新開始後に対象Tableを取得できなくなった場合やTable種類が変化した場合は成立状態を推測しない。
		if (
			! updatedBlock ||
			updatedBlock.name !== block.name ||
			! isRecord( updatedBlock.attributes )
		) {
			return { status: 'unconfirmed' };
		}

		const isConfirmed = areEquivalent( updatedBlock.attributes, attributesUpdate );
		const result: TableUpdateResult = isConfirmed
			? { status: 'updated' }
			: { status: 'unconfirmed' };
		return result;
	},
} );
