/**
 * 結合セルにより並び替えできない位置を、利用者向けの行・列範囲として表現する。
 */

import { __, sprintf } from '@wordpress/i18n';

export type BlockingMergedCellLocation = {
	rowStart: number;
	rowEnd: number;
	columnStart: number;
	columnEnd: number;
};

export type BlockingMergedCellSection = 'head' | 'body' | 'foot';

const getRangeLabel = ( start: number, end: number ): string =>
	start === end ? String( start ) : `${ start }–${ end }`;

/** tbody内の結合セル位置を利用者向け1-based範囲で知らせる。 */
export const getBodyBlockingMergedCellMessage = (
	location: BlockingMergedCellLocation
): string => {
	const rowRange = getRangeLabel( location.rowStart, location.rowEnd );
	const columnRange = getRangeLabel( location.columnStart, location.columnEnd );
	/* translators: 1: 1-based row number or range, 2: 1-based column number or range */
	const message = __(
		'A merged cell at rows %1$s and columns %2$s prevents this move.',
		'yamabiko-table-reorder'
	);
	return sprintf( message, rowRange, columnRange );
};

/** header / footer内の結合セル位置を利用者向け1-based範囲で知らせる。 */
export const getSectionBlockingMergedCellMessage = (
	section: Exclude< BlockingMergedCellSection, 'body' >,
	location: BlockingMergedCellLocation
): string => {
	const rowRange = getRangeLabel( location.rowStart, location.rowEnd );
	const columnRange = getRangeLabel( location.columnStart, location.columnEnd );
	const sectionLabel =
		section === 'head'
			? __( 'header', 'yamabiko-table-reorder' )
			: __( 'footer', 'yamabiko-table-reorder' );
	/* translators: 1: table section label, 2: 1-based row number or range, 3: 1-based column number or range */
	const message = __(
		'A merged cell at %1$s rows %2$s and columns %3$s prevents this move.',
		'yamabiko-table-reorder'
	);
	return sprintf( message, sectionLabel, rowRange, columnRange );
};
