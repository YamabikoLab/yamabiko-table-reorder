/**
 * 利用者向け文言をWordPressの翻訳境界へ集約する。
 *
 * 表示側は翻訳処理の詳細を持たず、この境界から現在の表示文言を取得する。
 */

import { __, sprintf } from '@wordpress/i18n';

/** プラグイン名として表示する翻訳済み文言。 */
export const PLUGIN_NAME = __( 'Yamabiko Table Reorder', 'yamabiko-table-reorder' );

/**
 * 行並び替え入口の表示名を取得する。
 *
 * @return 現在の言語に対応した行並び替え入口の表示名。
 */
export const getRowReorderName = () => __( 'Reorder rows', 'yamabiko-table-reorder' );

/**
 * 列並び替え入口の表示名を取得する。
 *
 * @return 現在の言語に対応した列並び替え入口の表示名。
 */
export const getColumnReorderName = () => __( 'Reorder columns', 'yamabiko-table-reorder' );

/** 現在表示で列DnDを利用できず、RFを代替手段として利用できることを知らせる文言を取得する。 */
export const getColumnDndLayoutUnavailableMessage = () =>
	__(
		'Column drag reordering is unavailable in the current view. You can reorder columns using the form.',
		'yamabiko-table-reorder'
	);

/** RF入口と入力画面の表示名を取得する。 */
export const getRfReorderName = () => __( 'Reorder with form', 'yamabiko-table-reorder' );

/** Chat Reorder入口の表示名を取得する。 */
export const getChatReorderName = () => __( 'Reorder with chat', 'yamabiko-table-reorder' );

/** Chat Reorderの自然言語入力欄の表示名を取得する。 */
export const getChatPromptLabel = () => __( 'Reorder request', 'yamabiko-table-reorder' );

/** Chat Reorderの送信操作の表示名を取得する。 */
export const getChatSendLabel = () => __( 'Send', 'yamabiko-table-reorder' );

/** Chat ReorderのAI出力が許可grammarに一致しないことを知らせる文言を取得する。 */
export const getChatInvalidOutputMessage = () =>
	__( 'The AI response could not be used. Try the request again.', 'yamabiko-table-reorder' );

/** Chat Reorderで列指定を現在Tableへ一意に照合できないことを知らせる文言を取得する。 */
export const getChatUnresolvedColumnMessage = () =>
	__(
		'The specified column could not be identified uniquely in the current table.',
		'yamabiko-table-reorder'
	);

/** RFで並び替える対象を選ぶ入力の表示名を取得する。 */
export const getRfKindLegend = () => __( 'Reorder', 'yamabiko-table-reorder' );

/** RFの行方向を示す表示名を取得する。 */
export const getRfRowsLabel = () => __( 'Rows', 'yamabiko-table-reorder' );

/** RFの列方向を示す表示名を取得する。 */
export const getRfColumnsLabel = () => __( 'Columns', 'yamabiko-table-reorder' );

/** RFで移動元行を指定する入力の表示名を取得する。 */
export const getRfSourceRowLabel = () => __( 'Row to move', 'yamabiko-table-reorder' );

/** RFで移動先行を指定する入力の表示名を取得する。 */
export const getRfTargetRowLabel = () => __( 'Target row', 'yamabiko-table-reorder' );

/** RFで移動先との位置関係を選ぶ入力の表示名を取得する。 */
export const getRfPositionLegend = () => __( 'Position', 'yamabiko-table-reorder' );

/** RFで移動先行の上を示す表示名を取得する。 */
export const getRfAboveLabel = () => __( 'Above', 'yamabiko-table-reorder' );

/** RFで移動先行の下を示す表示名を取得する。 */
export const getRfBelowLabel = () => __( 'Below', 'yamabiko-table-reorder' );

/**
 * RFの現在行数に対応する有効な入力条件を取得する。
 *
 * @param rowCount 現在のtbody行数。
 * @return 1から現在行数までの整数を指定する案内文。
 */
export const getRfRowRangeMessage = ( rowCount: number ) => {
	/* translators: %d: current tbody row count */
	const message = __( 'Enter an integer from 1 to %d.', 'yamabiko-table-reorder' );
	return sprintf( message, rowCount );
};

/** RFの行移動先が上下関係で決まることを知らせる文言を取得する。 */
export const getRfRowTargetHelp = () =>
	__( 'Move the row above or below the target row.', 'yamabiko-table-reorder' );

/** RFで移動元列を指定する入力の表示名を取得する。 */
export const getRfSourceColumnLabel = () => __( 'Column to move', 'yamabiko-table-reorder' );

/** RFで移動先列を指定する入力の表示名を取得する。 */
export const getRfTargetColumnLabel = () => __( 'Target column', 'yamabiko-table-reorder' );

/** RFの列選択が未指定であることを示す選択肢を取得する。 */
export const getRfSelectColumnLabel = () => __( 'Select a column', 'yamabiko-table-reorder' );

/** RFで移動先列の左を示す表示名を取得する。 */
export const getRfLeftLabel = () => __( 'Left', 'yamabiko-table-reorder' );

/** RFで移動先列の右を示す表示名を取得する。 */
export const getRfRightLabel = () => __( 'Right', 'yamabiko-table-reorder' );

/** RFの列移動先が左右関係で決まることを知らせる文言を取得する。 */
export const getRfColumnTargetHelp = () =>
	__( 'Move the column to the left or right of the target column.', 'yamabiko-table-reorder' );

/**
 * RFの列選択肢を現在見出しと1-based列番号から生成する。
 *
 * @param columnNumber 利用者向け1-based列番号。
 * @param heading      現在Tableから取得した見出し。見出しがない場合はnull。
 * @return 利用者が現在列を一意に識別できる表示名。
 */
export const getRfColumnOptionLabel = ( columnNumber: number, heading: string | null ) => {
	if ( heading !== null && heading !== '' ) {
		/* translators: 1: column heading, 2: 1-based column number */
		const message = __( '%1$s (Column %2$d)', 'yamabiko-table-reorder' );
		return sprintf( message, heading, columnNumber );
	}

	/* translators: %d: 1-based column number */
	const message = __( 'Column %d', 'yamabiko-table-reorder' );
	return sprintf( message, columnNumber );
};

/** RF指定で並び順が変わらないことを知らせる文言を取得する。 */
export const getRfNoOpMessage = () =>
	__( "This selection won't change the order.", 'yamabiko-table-reorder' );

/** RF指定を現在Tableで安全に継続できないことを知らせる文言を取得する。 */
export const getRfUnavailableMessage = () =>
	__(
		"This reorder can't continue with the current table. Check the table and try again.",
		'yamabiko-table-reorder'
	);

/** 結合セル位置表示で利用するTable section。 */
type MergedCellSection = 'head' | 'body' | 'foot';

/**
 * 行移動を妨げる結合セル位置を知らせる文言を取得する。
 *
 * 単一行では行番号と列範囲、複数行かつ単一列では行範囲と列番号、それ以外では行・列の両範囲を示す。
 *
 * @param rowStart    利用者向け1-based開始行番号。
 * @param rowEnd      利用者向け1-based終了行番号。
 * @param columnStart 利用者向け1-based開始列番号。
 * @param columnEnd   利用者向け1-based終了列番号。
 * @return 最初に確認された移動を妨げる結合セルを示す案内文。
 */
export const getRowMergedRangeMessage = (
	rowStart: number,
	rowEnd: number,
	columnStart: number,
	columnEnd: number
) => {
	/* 原因セルが単一行に収まる場合は、行番号と占有する列範囲を示す。 */
	if ( rowStart === rowEnd ) {
		/* translators: 1: 1-based row number, 2: first 1-based column number, 3: last 1-based column number */
		const message = __(
			'A merged cell in row %1$d spanning columns %2$d–%3$d prevents this move.',
			'yamabiko-table-reorder'
		);
		return sprintf( message, rowStart, columnStart, columnEnd );
	}

	/* 複数行にまたがる原因セルが単一列だけを占有する場合は、行範囲と列番号を示す。 */
	if ( columnStart === columnEnd ) {
		/* translators: 1: first 1-based row number, 2: last 1-based row number, 3: 1-based column number */
		const message = __(
			'A merged cell spanning rows %1$d–%2$d in column %3$d prevents this move.',
			'yamabiko-table-reorder'
		);
		return sprintf( message, rowStart, rowEnd, columnStart );
	}

	/* translators: 1: first 1-based row number, 2: last 1-based row number, 3: first 1-based column number, 4: last 1-based column number */
	const message = __(
		'A merged cell spanning rows %1$d–%2$d and columns %3$d–%4$d prevents this move.',
		'yamabiko-table-reorder'
	);
	return sprintf( message, rowStart, rowEnd, columnStart, columnEnd );
};

/**
 * 列移動を妨げる結合セル位置を知らせる文言を取得する。
 *
 * bodyでは行方向と同じ位置表現を使用し、headとfootでは領域名を併記する。section内の単一行では行番号、複数行では行範囲を示す。
 *
 * @param section     原因セルが存在するTable section。
 * @param rowStart    利用者向け1-based開始行番号。
 * @param rowEnd      利用者向け1-based終了行番号。
 * @param columnStart 利用者向け1-based開始列番号。
 * @param columnEnd   利用者向け1-based終了列番号。
 * @return 最初に確認された移動を妨げる結合セルを示す案内文。
 */
export const getColumnMergedRangeMessage = (
	section: MergedCellSection,
	rowStart: number,
	rowEnd: number,
	columnStart: number,
	columnEnd: number
) => {
	/* tbodyの原因セルは行方向と同じ行・列位置表現で利用者が特定できる。 */
	if ( section === 'body' ) {
		return getRowMergedRangeMessage( rowStart, rowEnd, columnStart, columnEnd );
	}

	/* headとfootではsection内行番号だけではTable上の位置を区別できないため、領域名を併記する。 */
	const sectionName =
		section === 'head'
			? __( 'header', 'yamabiko-table-reorder' )
			: __( 'footer', 'yamabiko-table-reorder' );

	/* 原因セルがsection内の単一行に収まる場合は、領域名、行番号、列範囲を示す。 */
	if ( rowStart === rowEnd ) {
		/* translators: 1: table section name, 2: 1-based row number, 3: first 1-based column number, 4: last 1-based column number */
		const message = __(
			'A merged cell in %1$s row %2$d spanning columns %3$d–%4$d prevents this move.',
			'yamabiko-table-reorder'
		);
		return sprintf( message, sectionName, rowStart, columnStart, columnEnd );
	}

	/* translators: 1: table section name, 2: first 1-based row number, 3: last 1-based row number, 4: first 1-based column number, 5: last 1-based column number */
	const message = __(
		'A merged cell spanning %1$s rows %2$d–%3$d and columns %4$d–%5$d prevents this move.',
		'yamabiko-table-reorder'
	);
	return sprintf( message, sectionName, rowStart, rowEnd, columnStart, columnEnd );
};

/** RF入力画面を終了する操作の表示名を取得する。 */
export const getRfCancelLabel = () => __( 'Cancel', 'yamabiko-table-reorder' );

/** RFで指定した並び替えを実行する操作の表示名を取得する。 */
export const getRfApplyLabel = () => __( 'Reorder', 'yamabiko-table-reorder' );

/**
 * RF反映に失敗し、Tableが変更されていないことを知らせる文言を取得する。
 *
 * @return 現在の言語に対応したRF反映失敗メッセージ。
 */
export const getRfApplyFailureMessage = () =>
	__( 'Reordering failed. The table has not been changed.', 'yamabiko-table-reorder' );

/**
 * 行DnDを安全に継続できず終了したことを知らせる文言を取得する。
 *
 * @return 現在の言語に対応した行DnD異常終了メッセージ。
 */
export const getRowDndTerminationMessage = () =>
	__( 'Reordering could not continue, so the operation was ended.', 'yamabiko-table-reorder' );

/**
 * PC環境の初回案内に表示する行・列共通の説明文を取得する。
 *
 * @return 現在の言語に対応したPC向け初回案内文。
 */
export const getPcReorderGuidanceMessage = () =>
	__( 'Reorder rows and columns by dragging or using the form.', 'yamabiko-table-reorder' );

/**
 * タッチ環境の初回案内に表示する長押し操作を含む説明文を取得する。
 *
 * @return 現在の言語に対応したタッチ向け初回案内文。
 */
export const getTouchReorderGuidanceMessage = () =>
	__(
		'Long press a cell, then drag, or use the form to reorder rows and columns.',
		'yamabiko-table-reorder'
	);

/**
 * 初回案内を閉じる入口の支援技術向け表示名を取得する。
 *
 * @return 現在の言語に対応した閉じる入口の表示名。
 */
export const getCloseReorderGuidanceLabel = () =>
	__( 'Close reorder guidance', 'yamabiko-table-reorder' );

/** 大規模反映前の確認ダイアログタイトルを取得する。 */
export const getLargeReorderApplyConfirmTitle = () =>
	__( 'Apply the new order?', 'yamabiko-table-reorder' );

/**
 * 大規模な行移動の確認対象を、利用者向けの1-based位置で示す。
 *
 * @param sourcePosition      移動元の行番号。
 * @param destinationPosition 反映後の移動先行番号。
 * @return 移動元と移動先を簡潔に示す文言。
 */
export const getLargeRowReorderMoveSummary = (
	sourcePosition: number,
	destinationPosition: number
) => {
	/* translators: 1: 移動元の行番号, 2: 移動先の行番号 */
	const message = __( 'Row %1$d → %2$d', 'yamabiko-table-reorder' );
	return sprintf( message, sourcePosition, destinationPosition );
};

/**
 * 大規模な列移動の確認対象を、利用者向けの1-based位置で示す。
 *
 * @param sourcePosition      移動元の列番号。
 * @param destinationPosition 反映後の移動先列番号。
 * @return 移動元と移動先を簡潔に示す文言。
 */
export const getLargeColumnReorderMoveSummary = (
	sourcePosition: number,
	destinationPosition: number
) => {
	/* translators: 1: 移動元の列番号, 2: 移動先の列番号 */
	const message = __( 'Column %1$d → %2$d', 'yamabiko-table-reorder' );
	return sprintf( message, sourcePosition, destinationPosition );
};

/** 大規模反映前の確認ダイアログ本文を取得する。 */
export const getLargeReorderApplyConfirmBody = () =>
	__( 'Applying this reorder may take some time.', 'yamabiko-table-reorder' );

/** 大規模反映を続行するボタン表示名を取得する。 */
export const getLargeReorderContinueLabel = () => __( 'Continue', 'yamabiko-table-reorder' );

/** 大規模反映を中止するボタン表示名を取得する。 */
export const getLargeReorderCancelLabel = () => __( 'Cancel', 'yamabiko-table-reorder' );

/** 大規模反映中であることを知らせる文言を取得する。 */
export const getLargeReorderApplyingMessage = () =>
	__( 'Applying the new order…', 'yamabiko-table-reorder' );

/** 大規模反映の完了を待つよう案内する補足文を取得する。 */
export const getLargeReorderApplyingDetail = () =>
	__( 'Please wait until the update is complete.', 'yamabiko-table-reorder' );

/** 大規模反映が完了したことを知らせる文言を取得する。 */
export const getLargeReorderCompletionMessage = () =>
	__( 'Reordering complete.', 'yamabiko-table-reorder' );
