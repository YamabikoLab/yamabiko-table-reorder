const DESCRIPTION_CLASS = 'yamabiko-table-reorder-column-description';
const LIVE_STATUS_CLASS = 'yamabiko-table-reorder-column-live-status';

const liveStatusByDocument = new WeakMap< Document, HTMLElement >();

/** owning document 内の polite live region へ通知する。 */
export const announceColumnLiveStatus = ( document: Document, message: string ) => {
	let status = liveStatusByDocument.get( document );
	if ( ! status || ! status.isConnected ) {
		status = document.createElement( 'div' );
		status.className = `${ DESCRIPTION_CLASS } ${ LIVE_STATUS_CLASS }`;
		status.setAttribute( 'role', 'status' );
		status.setAttribute( 'aria-live', 'polite' );
		status.setAttribute( 'aria-atomic', 'true' );
		document.body.append( status );
		liveStatusByDocument.set( document, status );
	}

	status.textContent = '';
	queueMicrotask( () => {
		if ( status?.isConnected ) {
			status.textContent = message;
		}
	} );
};
