import { __, sprintf } from '@wordpress/i18n';

/** 個別 column control の accessible name。 */
export const getColumnControlName = ( columnNumber: number ): string =>
	sprintf(
		/* translators: %d: column number. */
		__( 'Reorder column %d', 'yamabiko-table-reorder' ),
		columnNumber
	);

/** keyboard 操作開始前の説明。 */
export const getColumnControlDescription = (): string =>
	__( 'Press Enter or Space to start moving this column.', 'yamabiko-table-reorder' );

/** keyboard 並べ替え中の案内。 */
export const getColumnKeyboardGuidance = (): string =>
	__( '← → Move　Enter / Space Confirm　Esc Cancel', 'yamabiko-table-reorder' );

/** single-pointer 並べ替え中の案内。 */
export const getColumnPointerGuidance = (): string =>
	__( 'Click destination　Esc Cancel', 'yamabiko-table-reorder' );

/** 列の前へ挿入する destination の accessible name。 */
export const getColumnDestinationBeforeName = ( columnNumber: number ): string =>
	sprintf(
		/* translators: %d: column number. */
		__( 'Move before column %d', 'yamabiko-table-reorder' ),
		columnNumber
	);

/** table 末尾の destination の accessible name。 */
export const getColumnDestinationEndName = (): string =>
	__( 'Move to the end of the table.', 'yamabiko-table-reorder' );

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

/** single-pointer で移動対象を選択したことを支援技術へ伝える。 */
export const getColumnDestinationRequestedAnnouncement = ( columnNumber: number ): string =>
	sprintf(
		/* translators: %d: selected column number. */
		__( 'Column %d selected. Choose a destination.', 'yamabiko-table-reorder' ),
		columnNumber
	);

/** keyboard の移動先候補変更を支援技術へ伝える。 */
export const getColumnDestinationChangedAnnouncement = (
	columnNumber: number,
	columnCount: number
): string =>
	sprintf(
		/* translators: 1: destination column number, 2: total column count. */
		__( 'Move column to position %1$d of %2$d.', 'yamabiko-table-reorder' ),
		columnNumber,
		columnCount
	);

/** 列移動確定を支援技術へ伝える。 */
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

/** 列移動キャンセルを支援技術へ伝える。 */
export const getColumnMoveCanceledAnnouncement = ( columnNumber: number ): string =>
	sprintf(
		/* translators: %d: unchanged column number. */
		__( 'Canceled moving column %d.', 'yamabiko-table-reorder' ),
		columnNumber
	);

/** keyboard でこれ以上移動できないことを支援技術へ伝える。 */
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
