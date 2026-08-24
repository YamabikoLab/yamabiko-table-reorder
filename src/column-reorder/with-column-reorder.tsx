/**
 * Column Reorderのcontrol prototypeをGutenberg BlockEditへ接続する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { Button } from '@wordpress/components';
import { useLayoutEffect, useState, type ComponentType } from '@wordpress/element';

import { supportsColumnReorder } from './block-support';
import { getColumnControlName, getColumnControlsName } from './messages';
import { resolveColumnTableContext } from './table-context';

type TableAttributes = Record< string, unknown >;

type TableBlockEditProps = BlockEditProps< TableAttributes > & {
	name: string;
};

type ColumnGeometry = {
	left: number;
	width: number;
};

type ControlGeometry = {
	columns: ColumnGeometry[];
	top: number;
};

type ColumnReorderEditProps = {
	BlockEdit: ComponentType< TableBlockEditProps >;
	props: TableBlockEditProps;
};

const getControlGeometry = ( columns: HTMLTableCellElement[] ): ControlGeometry | null => {
	if ( columns.length === 0 ) {
		return null;
	}

	const rects = columns.map( ( cell ) => cell.getBoundingClientRect() );
	return {
		columns: rects.map( ( rect ) => ( {
			left: rect.left,
			width: rect.width,
		} ) ),
		top: Math.min( ...rects.map( ( rect ) => rect.top ) ),
	};
};

/**
 * Column Reorder対応block専用のcontrol prototype描画component。
 *
 * controlの配置とfocus ownershipだけを担当し、並べ替えcommitは行わない。
 *
 * @param componentProps Gutenbergから渡されるBlockEdit propsと元のBlockEdit component。
 */
const ColumnReorderEdit = ( componentProps: ColumnReorderEditProps ) => {
	const { BlockEdit, props } = componentProps;
	const { attributes, clientId, isSelected } = props;
	const [ editorCanvasReference, setEditorCanvasReference ] = useState< HTMLSpanElement | null >(
		null
	);
	const [ geometry, setGeometry ] = useState< ControlGeometry | null >( null );

	useLayoutEffect( () => {
		if ( ! isSelected || ! editorCanvasReference ) {
			setGeometry( null );
			return;
		}

		let resizeObserver: ResizeObserver | null = null;

		const refreshGeometry = () => {
			const currentContext = resolveColumnTableContext( editorCanvasReference, clientId );
			if ( ! currentContext ) {
				setGeometry( null );
				return;
			}

			setGeometry( getControlGeometry( currentContext.columns ) );
		};

		const context = resolveColumnTableContext( editorCanvasReference, clientId );
		if ( ! context ) {
			setGeometry( null );
			return;
		}

		refreshGeometry();
		context.window.addEventListener( 'resize', refreshGeometry );
		context.window.addEventListener( 'scroll', refreshGeometry, true );

		const ResizeObserverConstructor = ( context.window as Window & typeof globalThis )
			.ResizeObserver;
		if ( ResizeObserverConstructor ) {
			resizeObserver = new ResizeObserverConstructor( refreshGeometry );
			resizeObserver.observe( context.table );
		}

		return () => {
			context.window.removeEventListener( 'resize', refreshGeometry );
			context.window.removeEventListener( 'scroll', refreshGeometry, true );
			resizeObserver?.disconnect();
		};
	}, [ editorCanvasReference, attributes, clientId, isSelected ] );

	const showControls = isSelected && geometry;

	return (
		<>
			<BlockEdit { ...props } />
			{ showControls && (
				<div
					aria-label={ getColumnControlsName() }
					className="yamabiko-column-reorder-controls"
					role="toolbar"
				>
					{ geometry.columns.map( ( column, index ) => (
						<Button
							key={ index }
							aria-label={ getColumnControlName( index + 1 ) }
							className="yamabiko-column-reorder-control"
							style={ {
								left: `${ column.left }px`,
								top: `${ geometry.top }px`,
								width: `${ column.width }px`,
							} }
						>
							<span aria-hidden="true">⋮⋮</span>
						</Button>
					) ) }
				</div>
			) }
			{ /*
			 * Existing Table blocks are extended through editor.BlockEdit, so Column
			 * Reorder cannot attach a ref directly to their canvas DOM.
			 *
			 * This editor-only element provides the DOM-local reference used to resolve
			 * the current editor document and window without browsing-context discovery.
			 */ }
			<span aria-hidden="true" hidden ref={ setEditorCanvasReference } />
		</>
	);
};

/**
 * BlockEditへColumn Reorderのcontrol prototype描画境界を追加するHOC。
 *
 * @param BlockEdit Gutenbergが提供する元のBlockEdit component。
 * @return Column Reorderを接続したBlockEdit component。
 */
export const withColumnReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithColumnReorder( props: TableBlockEditProps ) {
		if ( ! supportsColumnReorder( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		return <ColumnReorderEdit BlockEdit={ BlockEdit } props={ props } />;
	};
