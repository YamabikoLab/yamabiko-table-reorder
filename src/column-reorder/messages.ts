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
