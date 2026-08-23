/**
 * Column Reorder の control prototype を Gutenberg BlockEdit へ接続する。
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
 * Column Reorder prototype を接続した BlockEdit HOC。
 *
 * Phase 2 では control の配置と focus ownership だけを確立し、並べ替え commit は行わない。
 *
 * @param BlockEdit Gutenberg が提供する元の BlockEdit component。
 */
export const withColumnReorder = ( BlockEdit: ComponentType< TableBlockEditProps > ) =>
	function WithColumnReorder( props: TableBlockEditProps ) {
		const { clientId, isSelected, name } = props;
		const [ anchor, setAnchor ] = useState< HTMLSpanElement | null >( null );
		const [ geometry, setGeometry ] = useState< ControlGeometry | null >( null );

		useLayoutEffect( () => {
			if ( ! isSelected || ! anchor || ! supportsColumnReorder( name ) ) {
				setGeometry( null );
				return;
			}

			let resizeObserver: ResizeObserver | null = null;

			const refreshGeometry = () => {
				const currentContext = resolveColumnTableContext( anchor, clientId );
				if ( ! currentContext ) {
					setGeometry( null );
					return;
				}

				setGeometry( getControlGeometry( currentContext.columns ) );
			};

			const context = resolveColumnTableContext( anchor, clientId );
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
		}, [ anchor, clientId, isSelected, name ] );

		const showControls = isSelected && supportsColumnReorder( name ) && geometry;

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
				<span aria-hidden="true" hidden ref={ setAnchor } />
			</>
		);
	};
