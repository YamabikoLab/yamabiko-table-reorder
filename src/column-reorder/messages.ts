import { __, sprintf } from '@wordpress/i18n';

/** Column control toolbarのaccessible name。 */
export const getColumnControlsName = (): string =>
	__( 'Column reorder controls', 'yamabiko-table-reorder' );

/**
 * 個別column controlのaccessible name。
 *
 * @param columnNumber 1-based column number。
 */
export const getColumnControlName = ( columnNumber: number ): string =>
	sprintf(
		/* translators: %d: column number. */
		__( 'Column %d', 'yamabiko-table-reorder' ),
		columnNumber
	);

/** keyboard操作開始前の説明。 */
export const getColumnControlDescription = (): string =>
	__( 'Press Enter or Space to start moving this column.', 'yamabiko-table-reorder' );

/** keyboard並べ替え中の案内。 */
export const getColumnKeyboardGuidance = (): string =>
	__( '← → Move　Enter / Space Confirm　Esc Cancel', 'yamabiko-table-reorder' );

/** single-pointer並べ替え中の案内。 */
export const getColumnPointerGuidance = (): string =>
	__( 'Click a destination column　Esc Cancel', 'yamabiko-table-reorder' );

/**
 * 列移動開始を支援技術へ伝える。
 *
 * @param columnNumber 1-based column number。
 * @param columnCount  総列数。
 */
export const getColumnMoveStartedAnnouncement = (
	columnNumber: number,
	columnCount: number
): string =>
	sprintf(
		/* translators: 1: current column number, 2: total column count. */
		__( 'Moving column %1$d of %2$d.', 'yamabiko-table-reorder' ),
		columnNumber,
		columnCount
	);

/**
 * single-pointerで移動対象を選択したことを支援技術へ伝える。
 *
 * @param columnNumber 1-based column number。
 */
export const getColumnDestinationRequestedAnnouncement = ( columnNumber: number ): string =>
	sprintf(
		/* translators: %d: selected column number. */
		__( 'Column %d selected. Choose a destination.', 'yamabiko-table-reorder' ),
		columnNumber
	);

/**
 * keyboardの移動先候補変更を支援技術へ伝える。
 *
 * @param columnNumber 1-based destination column number。
 * @param columnCount  総列数。
 */
export const getColumnDestinationChangedAnnouncement = (
	columnNumber: number,
	columnCount: number
): string =>
	sprintf(
		/* translators: 1: destination column number, 2: total column count. */
		__( 'Move to column %1$d of %2$d.', 'yamabiko-table-reorder' ),
		columnNumber,
		columnCount
	);

/**
 * 列移動確定を支援技術へ伝える。
 *
 * @param oldColumnNumber 1-based original column number。
 * @param newColumnNumber 1-based destination column number。
 */
export const getColumnMoveCommittedAnnouncement = (
	oldColumnNumber: number,
	newColumnNumber: number
): string =>
	sprintf(
		/* translators: 1: original column number, 2: destination column number. */
		__( 'Moved column from position %1$d to %2$d.', 'yamabiko-table-reorder' ),
		oldColumnNumber,
		newColumnNumber
	);

/**
 * 列移動キャンセルを支援技術へ伝える。
 *
 * @param columnNumber 1-based unchanged column number。
 */
export const getColumnMoveCanceledAnnouncement = ( columnNumber: number ): string =>
	sprintf(
		/* translators: %d: unchanged column number. */
		__( 'Canceled moving column %d.', 'yamabiko-table-reorder' ),
		columnNumber
	);

/**
 * keyboardでこれ以上移動できないことを支援技術へ伝える。
 *
 * @param direction 移動できない方向。
 */
export const getColumnMoveBoundaryAnnouncement = ( direction: 'left' | 'right' ): string => {
	const directionLabel =
		direction === 'left'
			? __( 'left', 'yamabiko-table-reorder' )
			: __( 'right', 'yamabiko-table-reorder' );
	return sprintf(
		/* translators: %s: translated movement direction. */
		__( 'This column cannot move any farther %s.', 'yamabiko-table-reorder' ),
		directionLabel
	);
};
