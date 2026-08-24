/**
 * Table ReorderのReact state / effect lifecycleとcontroller接続を管理する。
 *
 * interaction / UI stateとcontroller lifecycleは専用hookへ委譲し、
 * WordPress notice APIとsetAttributesをHOC向けstate / commandへ接続する。
 */

import { useMergeRefs } from '@wordpress/compose';
import { useDispatch } from '@wordpress/data';
import { useMemo, useRef } from '@wordpress/element';
import { store as noticesStore } from '@wordpress/notices';

import { announceLiveStatus } from './controller/reorder-ui';
import {
	getNoMovableRowsAnnouncement,
	getNoMovableRowsMessage,
	getRowspanErrorMessage,
} from './messages';
import { getForbiddenInsertionIndices, getNonMovableRowIndices, getRowspanRanges } from './rowspan';
import { resolveTableContext } from './table-context';
import { useTableReorderController } from './use-table-reorder-controller';
import { useTableReorderInteraction } from './use-table-reorder-interaction';

/** custom hookへ渡すGutenberg側の入力。 */
type UseTableReorderOptions = {
	body: unknown;
	clientId: string;
	enabled: boolean;
	isSelected: boolean;
	rowspanProperty?: string;
	setAttributes: ( attributes: { body: unknown[] } ) => void;
};

/** HOCが描画とtoolbar操作に利用する最小state。 */
type TableReorderHookResult = {
	consumeTouchToolbarFocusRequest: () => void;
	dismissKeyboardCoachmark: () => void;
	dismissTouchCoachmark: () => void;
	editorCanvasReferenceRef: ( referenceElement: HTMLSpanElement | null ) => void;
	isHoverCapable: boolean;
	isKeyboardCoachmarkVisible: boolean;
	isTouchCoachmarkVisible: boolean;
	isTouchReorderMode: boolean;
	isTouchToolbarFocusRequested: boolean;
	requestRowControlFocus: () => void;
	toggleTouchReorderMode: () => void;
};

/**
 * Table ReorderのReact lifecycleを所有し、必要な期間だけSortableJS controllerを接続する。
 *
 * @param options Table blockのbody、選択状態、clientId、rowspan property、attribute更新callback。
 * @return Toolbar描画と操作に必要なstate / callback。
 */
export const useTableReorder = ( options: UseTableReorderOptions ): TableReorderHookResult => {
	const { body, clientId, enabled, isSelected, rowspanProperty, setAttributes } = options;
	const editorCanvasReferenceElementRef = useRef< HTMLSpanElement >( null );
	const { createNotice } = useDispatch( noticesStore );
	const { forbiddenInsertionIndices, nonMovableRowIndices } = useMemo( () => {
		const rowspanRanges = rowspanProperty ? getRowspanRanges( body, rowspanProperty ) : [];
		return {
			forbiddenInsertionIndices: getForbiddenInsertionIndices( rowspanRanges ),
			nonMovableRowIndices: getNonMovableRowIndices( rowspanRanges ),
		};
	}, [ body, rowspanProperty ] );
	const {
		editorCanvasReferenceRef: interactionEditorCanvasReferenceRef,
		consumeTouchToolbarFocusRequest,
		dismissKeyboardCoachmark,
		dismissTouchCoachmark,
		interactionMode,
		isHoverCapable,
		isKeyboardCoachmarkVisible,
		isTouchCoachmarkVisible,
		isTouchReorderMode,
		isTouchToolbarFocusRequested,
		toggleTouchReorderMode,
	} = useTableReorderInteraction( {
		clientId,
		enabled,
		isSelected,
	} );

	const { editorCanvasReferenceRef: controllerEditorCanvasReferenceRef, focusRowControl } =
		useTableReorderController( {
			body,
			clientId,
			enabled,
			forbiddenInsertionIndices,
			interactionMode,
			nonMovableRowIndices,
			onBodyCommit: ( reorderedBody ) => {
				setAttributes( { body: reorderedBody } );
			},
		} );
	const editorCanvasReferenceRef = useMergeRefs( [
		editorCanvasReferenceElementRef,
		interactionEditorCanvasReferenceRef,
		controllerEditorCanvasReferenceRef,
	] );

	const createNoMovableRowsNotice = () => {
		void createNotice( 'warning', getNoMovableRowsMessage(), {
			type: 'snackbar',
		} );
	};

	const notifyTouchNoMovableRows = () => {
		createNoMovableRowsNotice();
		const referenceElement = editorCanvasReferenceElementRef.current;
		const context = referenceElement ? resolveTableContext( referenceElement, clientId ) : null;
		if ( context ) {
			announceLiveStatus( context.document, getNoMovableRowsAnnouncement() );
		}
	};

	return {
		consumeTouchToolbarFocusRequest,
		dismissKeyboardCoachmark,
		dismissTouchCoachmark,
		editorCanvasReferenceRef,
		isHoverCapable,
		isKeyboardCoachmarkVisible,
		isTouchCoachmarkVisible,
		isTouchReorderMode,
		isTouchToolbarFocusRequested,
		requestRowControlFocus: () => {
			dismissKeyboardCoachmark();
			const result = focusRowControl();
			if ( result === 'current-row-not-movable' ) {
				void createNotice( 'error', getRowspanErrorMessage(), {
					type: 'snackbar',
				} );
			} else if ( result === 'no-movable-rows' ) {
				createNoMovableRowsNotice();
			}
		},
		toggleTouchReorderMode: () => {
			if ( ! isTouchReorderMode ) {
				dismissTouchCoachmark();
				const rowCount = Array.isArray( body ) ? body.length : 0;
				if ( rowCount === 0 || nonMovableRowIndices.length >= rowCount ) {
					notifyTouchNoMovableRows();
					return;
				}
			}
			toggleTouchReorderMode();
		},
	};
};
