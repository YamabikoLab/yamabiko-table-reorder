/**
 * Reorder Form（RF）の入力画面をWordPress Popoverとして表示するPresentationを所有する。
 *
 * RF Interactionを状態正本として購読し、利用者の入力を同責務へ通知する。Table構造や移動可否は再解釈せず、
 * RF Interactionが公開する現在結果だけを利用者向け表示へ変換する。
 * 入力Popoverの手動配置はRF Interactionから分離したPresentation状態として扱う。
 */

import { Button, Popover } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

import {
	getBodyBlockingMergedCellMessage,
	getSectionBlockingMergedCellMessage,
} from '@/blocking-merged-cell-message';
import {
	getRfAboveLabel,
	getRfApplyLabel,
	getRfBelowLabel,
	getRfCancelLabel,
	getRfColumnOptionLabel,
	getRfColumnTargetHelp,
	getRfColumnsLabel,
	getRfKindLegend,
	getRfLeftLabel,
	getRfNoOpMessage,
	getRfPositionLegend,
	getRfReorderName,
	getRfRightLabel,
	getRfRowRangeMessage,
	getRfRowsLabel,
	getRfRowTargetHelp,
	getRfSelectColumnLabel,
	getRfSourceColumnLabel,
	getRfSourceRowLabel,
	getRfTargetColumnLabel,
	getRfTargetRowLabel,
	getRfUnavailableMessage,
} from '@/messages';
import type { ColumnInputDescriptor } from '@/reorder/column-reorder/responsibilities/table-integration';
import { rfInteraction } from '@/reorder/reorder-form/responsibilities/interaction';
import type { RfInteractionReactState } from '@/reorder/reorder-form/responsibilities/interaction-react';
import {
	clampReorderFormPosition,
	type ReorderFormPosition,
	useReorderFormPosition,
} from '@/reorder/wordpress/components/reorder-form-position';

import './reorder-form.scss';

type ReorderFormPopoverProps = {
	anchor: HTMLElement | null;
	tableIdentity: string;
	state: RfInteractionReactState;
};

type ReorderFormDragState = {
	pointerId: number;
	startX: number;
	startY: number;
	offsetX: number;
	offsetY: number;
	width: number;
	height: number;
	moved: boolean;
	view: Window;
};

const dragThreshold = 4;
const ignorePopoverClose = () => undefined;

const isDirectInteractionTarget = ( target: EventTarget | null ): boolean => {
	const element = target as Element | null;
	if ( element === null || typeof element.closest !== 'function' ) {
		return false;
	}

	return element.closest( 'input, select, textarea, button, a, [contenteditable="true"]' ) !== null;
};

const getColumnOptionLabel = ( descriptor: ColumnInputDescriptor ): string =>
	getRfColumnOptionLabel( descriptor.columnNumber, descriptor.heading );

const getCurrentResultMessage = ( state: RfInteractionReactState ): string | null => {
	if (
		state.status !== 'open' ||
		state.result.status === 'not-ready' ||
		state.result.status === 'resolved'
	) {
		return null;
	}

	if ( state.result.status === 'unavailable' ) {
		return getRfUnavailableMessage();
	}

	if ( state.result.status === 'no-op' ) {
		return getRfNoOpMessage();
	}

	const location = {
		rowStart: state.result.blockingMergedCell.rowStart + 1,
		rowEnd: state.result.blockingMergedCell.rowEnd + 1,
		columnStart: state.result.blockingMergedCell.columnStart + 1,
		columnEnd: state.result.blockingMergedCell.columnEnd + 1,
	};

	if ( state.kind === 'row' || state.result.blockingMergedCell.section === 'body' ) {
		return getBodyBlockingMergedCellMessage( location );
	}

	return getSectionBlockingMergedCellMessage(
		state.result.blockingMergedCell.section,
		location
	);
};

const createManualPopoverAnchor = ( position: ReorderFormPosition, ownerDocument: Document ) => ( {
	ownerDocument,
	getBoundingClientRect: (): DOMRect =>
		( {
			x: position.x,
			y: position.y,
			left: position.x,
			top: position.y,
			right: position.x,
			bottom: position.y,
			width: 0,
			height: 0,
			toJSON: () => ( {} ),
		} ) as DOMRect,
} );

export const ReorderFormPopover = ( props: ReorderFormPopoverProps ) => {
	const { anchor, state, tableIdentity } = props;
	const dragStateRef = useRef< ReorderFormDragState | null >( null );
	const suppressClickRef = useRef( false );
	const { position, setPosition } = useReorderFormPosition( tableIdentity );

	if ( anchor === null || state.status !== 'open' ) {
		return null;
	}

	const resultMessage = getCurrentResultMessage( state );
	const controlIdPrefix = `yamabiko-table-reorder-rf-${ tableIdentity }`;
	const rowKindId = `${ controlIdPrefix }-kind-row`;
	const columnKindId = `${ controlIdPrefix }-kind-column`;
	const sourceRowId = `${ controlIdPrefix }-source-row`;
	const targetRowId = `${ controlIdPrefix }-target-row`;
	const rowAboveId = `${ controlIdPrefix }-row-above`;
	const rowBelowId = `${ controlIdPrefix }-row-below`;
	const sourceColumnId = `${ controlIdPrefix }-source-column`;
	const targetColumnId = `${ controlIdPrefix }-target-column`;
	const columnLeftId = `${ controlIdPrefix }-column-left`;
	const columnRightId = `${ controlIdPrefix }-column-right`;
	const manuallyPositioned = position !== null;
	const popoverAnchor =
		position === null ? anchor : createManualPopoverAnchor( position, anchor.ownerDocument );
	const popoverOffset = manuallyPositioned ? 0 : 8;

	const startDragging = ( event: ReactPointerEvent< HTMLDivElement > ): void => {
		if ( ! event.isPrimary || event.button !== 0 || isDirectInteractionTarget( event.target ) ) {
			return;
		}

		const popoverContent = event.currentTarget.closest( '.components-popover__content' );
		const view = event.currentTarget.ownerDocument.defaultView;
		if ( popoverContent === null || view === null ) {
			return;
		}

		const rectangle = popoverContent.getBoundingClientRect();
		dragStateRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			offsetX: event.clientX - rectangle.left,
			offsetY: event.clientY - rectangle.top,
			width: rectangle.width,
			height: rectangle.height,
			moved: false,
			view,
		};
		event.currentTarget.setPointerCapture( event.pointerId );
	};

	const moveDragging = ( event: ReactPointerEvent< HTMLDivElement > ): void => {
		const dragState = dragStateRef.current;
		if ( dragState === null || dragState.pointerId !== event.pointerId ) {
			return;
		}

		if ( ! dragState.moved ) {
			const distance = Math.hypot(
				event.clientX - dragState.startX,
				event.clientY - dragState.startY
			);
			if ( distance < dragThreshold ) {
				return;
			}
			dragState.moved = true;
		}

		const requestedPosition = {
			x: event.clientX - dragState.offsetX,
			y: event.clientY - dragState.offsetY,
		};
		const nextPosition = clampReorderFormPosition(
			requestedPosition,
			{ width: dragState.width, height: dragState.height },
			{ width: dragState.view.innerWidth, height: dragState.view.innerHeight }
		);
		setPosition( nextPosition );
		event.preventDefault();
	};

	const stopDragging = ( event: ReactPointerEvent< HTMLDivElement > ): void => {
		const dragState = dragStateRef.current;
		if ( dragState === null || dragState.pointerId !== event.pointerId ) {
			return;
		}

		if ( event.currentTarget.hasPointerCapture( event.pointerId ) ) {
			event.currentTarget.releasePointerCapture( event.pointerId );
		}
		dragStateRef.current = null;

		if ( dragState.moved ) {
			suppressClickRef.current = true;
			dragState.view.setTimeout( () => {
				suppressClickRef.current = false;
			}, 0 );
		}
	};

	const suppressDraggedClick = ( event: ReactMouseEvent< HTMLDivElement > ): void => {
		if ( ! suppressClickRef.current ) {
			return;
		}

		suppressClickRef.current = false;
		event.preventDefault();
		event.stopPropagation();
	};

	return (
		<Popover
			anchor={ popoverAnchor }
			className="yamabiko-table-reorder-rf-popover"
			flip={ ! manuallyPositioned }
			focusOnMount={ false }
			noArrow={ manuallyPositioned }
			offset={ popoverOffset }
			onClose={ ignorePopoverClose }
			onFocusOutside={ ignorePopoverClose }
			placement="bottom-start"
			shift
			variant="unstyled"
		>
			<div
				className="yamabiko-table-reorder-rf"
				onClickCapture={ suppressDraggedClick }
				onPointerCancel={ stopDragging }
				onPointerDown={ startDragging }
				onPointerMove={ moveDragging }
				onPointerUp={ stopDragging }
			>
				<h2 className="yamabiko-table-reorder-rf__title">{ getRfReorderName() }</h2>

				<fieldset className="yamabiko-table-reorder-rf__fieldset">
					<legend>{ getRfKindLegend() }</legend>
					<label htmlFor={ rowKindId }>
						<input
							checked={ state.kind === 'row' }
							id={ rowKindId }
							name={ `yamabiko-table-reorder-rf-kind-${ tableIdentity }` }
							onChange={ () => rfInteraction.selectKind( tableIdentity, 'row' ) }
							type="radio"
						/>
						{ getRfRowsLabel() }
					</label>
					<label htmlFor={ columnKindId }>
						<input
							checked={ state.kind === 'column' }
							id={ columnKindId }
							name={ `yamabiko-table-reorder-rf-kind-${ tableIdentity }` }
							onChange={ () => rfInteraction.selectKind( tableIdentity, 'column' ) }
							type="radio"
						/>
						{ getRfColumnsLabel() }
					</label>
				</fieldset>

				{ state.kind === 'row' ? (
					<div className="yamabiko-table-reorder-rf__fields">
						<label htmlFor={ sourceRowId }>
							<span>{ getRfSourceRowLabel() }</span>
							<input
								id={ sourceRowId }
								inputMode="numeric"
								max={ state.rowCount ?? undefined }
								min={ 1 }
								onChange={ ( event ) =>
									rfInteraction.updateRowInput( tableIdentity, {
										...state.input,
										sourceRowNumber: event.currentTarget.value,
									} )
								}
								step={ 1 }
								type="number"
								value={ state.input.sourceRowNumber }
							/>
						</label>
						<label htmlFor={ targetRowId }>
							<span>{ getRfTargetRowLabel() }</span>
							<input
								id={ targetRowId }
								inputMode="numeric"
								max={ state.rowCount ?? undefined }
								min={ 1 }
								onChange={ ( event ) =>
									rfInteraction.updateRowInput( tableIdentity, {
										...state.input,
										targetRowNumber: event.currentTarget.value,
									} )
								}
								step={ 1 }
								type="number"
								value={ state.input.targetRowNumber }
							/>
						</label>
						{ state.rowCount !== null && (
							<p className="yamabiko-table-reorder-rf__help">
								{ getRfRowRangeMessage( state.rowCount ) }
							</p>
						) }
						<fieldset className="yamabiko-table-reorder-rf__fieldset">
							<legend>{ getRfPositionLegend() }</legend>
							<label htmlFor={ rowAboveId }>
								<input
									checked={ state.input.position === 'above' }
									id={ rowAboveId }
									name={ `yamabiko-table-reorder-rf-row-position-${ tableIdentity }` }
									onChange={ () =>
										rfInteraction.updateRowInput( tableIdentity, {
											...state.input,
											position: 'above',
										} )
									}
									type="radio"
								/>
								{ getRfAboveLabel() }
							</label>
							<label htmlFor={ rowBelowId }>
								<input
									checked={ state.input.position === 'below' }
									id={ rowBelowId }
									name={ `yamabiko-table-reorder-rf-row-position-${ tableIdentity }` }
									onChange={ () =>
										rfInteraction.updateRowInput( tableIdentity, {
											...state.input,
											position: 'below',
										} )
									}
									type="radio"
								/>
								{ getRfBelowLabel() }
							</label>
						</fieldset>
						<p className="yamabiko-table-reorder-rf__help">{ getRfRowTargetHelp() }</p>
					</div>
				) : (
					<div className="yamabiko-table-reorder-rf__fields">
						<label htmlFor={ sourceColumnId }>
							<span>{ getRfSourceColumnLabel() }</span>
							<select
								id={ sourceColumnId }
								onChange={ ( event ) =>
									rfInteraction.updateColumnInput( tableIdentity, {
										...state.input,
										sourceColumnIndex:
											event.currentTarget.value === '' ? null : Number( event.currentTarget.value ),
									} )
								}
								value={ state.input.sourceColumnIndex ?? '' }
							>
								<option value="">{ getRfSelectColumnLabel() }</option>
								{ state.columns.map( ( descriptor ) => (
									<option key={ descriptor.columnIndex } value={ descriptor.columnIndex }>
										{ getColumnOptionLabel( descriptor ) }
									</option>
								) ) }
							</select>
						</label>
						<label htmlFor={ targetColumnId }>
							<span>{ getRfTargetColumnLabel() }</span>
							<select
								id={ targetColumnId }
								onChange={ ( event ) =>
									rfInteraction.updateColumnInput( tableIdentity, {
										...state.input,
										targetColumnIndex:
											event.currentTarget.value === '' ? null : Number( event.currentTarget.value ),
									} )
								}
								value={ state.input.targetColumnIndex ?? '' }
							>
								<option value="">{ getRfSelectColumnLabel() }</option>
								{ state.columns.map( ( descriptor ) => (
									<option key={ descriptor.columnIndex } value={ descriptor.columnIndex }>
										{ getColumnOptionLabel( descriptor ) }
									</option>
								) ) }
							</select>
						</label>
						<fieldset className="yamabiko-table-reorder-rf__fieldset">
							<legend>{ getRfPositionLegend() }</legend>
							<label htmlFor={ columnLeftId }>
								<input
									checked={ state.input.position === 'left' }
									id={ columnLeftId }
									name={ `yamabiko-table-reorder-rf-column-position-${ tableIdentity }` }
									onChange={ () =>
										rfInteraction.updateColumnInput( tableIdentity, {
											...state.input,
											position: 'left',
										} )
									}
									type="radio"
								/>
								{ getRfLeftLabel() }
							</label>
							<label htmlFor={ columnRightId }>
								<input
									checked={ state.input.position === 'right' }
									id={ columnRightId }
									name={ `yamabiko-table-reorder-rf-column-position-${ tableIdentity }` }
									onChange={ () =>
										rfInteraction.updateColumnInput( tableIdentity, {
											...state.input,
											position: 'right',
										} )
									}
									type="radio"
								/>
								{ getRfRightLabel() }
							</label>
						</fieldset>
						<p className="yamabiko-table-reorder-rf__help">{ getRfColumnTargetHelp() }</p>
					</div>
				) }

				{ resultMessage !== null && (
					<p className="yamabiko-table-reorder-rf__notice" role="status">
						{ resultMessage }
					</p>
				) }

				<div className="yamabiko-table-reorder-rf__actions">
					<Button onClick={ () => rfInteraction.close( tableIdentity ) } variant="secondary">
						{ getRfCancelLabel() }
					</Button>
					<Button
						disabled={ ! state.canApply }
						onClick={ () => rfInteraction.requestApply( tableIdentity ) }
						variant="primary"
					>
						{ getRfApplyLabel() }
					</Button>
				</div>
			</div>
		</Popover>
	);
};
