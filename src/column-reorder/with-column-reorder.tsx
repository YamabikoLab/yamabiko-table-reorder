/**
 * Column Reorder を Gutenberg BlockEdit へ接続する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { useLayoutEffect, useRef, useState, type ComponentType } from '@wordpress/element';

import { supportsColumnReorder } from './block-support';
import { createColumnReorderController } from './controller/column-reorder-controller';
import { resolveColumnTableContext } from './table-context';

type TableAttributes = Record< string, unknown >;

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

type ColumnReorderEditProps = {
	BlockEdit: ComponentType< TableBlockEditProps >;
	props: TableBlockEditProps;
};

/**
 * Gutenberg integration と controller lifecycle だけを所有する薄い component。
 *
 * @param componentProps 元の BlockEdit と Gutenberg props。
 */
const ColumnReorderEdit = ( componentProps: ColumnReorderEditProps ) => {
	const { BlockEdit, props } = componentProps;
	const { attributes, clientId, setAttributes } = props;
	const [ editorCanvasReference, setEditorCanvasReference ] = useState< HTMLSpanElement | null >(
		null
	);
	const pendingFocusIndexRef = useRef< number | null >( null );

	useLayoutEffect( () => {
		if ( ! editorCanvasReference ) {
			pendingFocusIndexRef.current = null;
			return;
		}
		const context = resolveColumnTableContext( editorCanvasReference, clientId );
		if ( ! context ) {
			pendingFocusIndexRef.current = null;
			return;
		}

		const controller = createColumnReorderController( {
			attributes,
			context,
			onCommit: ( nextAttributes, focusColumnIndex ) => {
				pendingFocusIndexRef.current = focusColumnIndex;
				setAttributes( nextAttributes );
			},
		} );
		const pendingFocusIndex = pendingFocusIndexRef.current;
		if ( pendingFocusIndex !== null && controller.focusColumnControlAt( pendingFocusIndex ) ) {
			pendingFocusIndexRef.current = null;
		}

		return controller.destroy;
	}, [ attributes, clientId, editorCanvasReference, setAttributes ] );

	return (
		<>
			<BlockEdit { ...props } />
			{ /*
			 * Existing Table blocks are extended through editor.BlockEdit, so Column
			 * Reorder cannot attach a ref directly to their canvas DOM.
			 *
			 * This editor-only element provides the DOM-local reference used to resolve
			 * the current editor document and window.
			 */ }
			<span aria-hidden="true" hidden ref={ setEditorCanvasReference } />
		</>
	);
};

/**
 * BlockEdit へ Column Reorder の integration boundary を追加する HOC。
 *
 * @param BlockEdit Gutenberg が提供する元の BlockEdit component。
 */
export const withColumnReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithColumnReorder( props: TableBlockEditProps ) {
		if ( ! supportsColumnReorder( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		return <ColumnReorderEdit BlockEdit={ BlockEdit } props={ props } />;
	};
