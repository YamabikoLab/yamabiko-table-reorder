/**
 * Reorder Form（RF）の入力画面をWordPress Popoverとして表示するPresentationを所有する。
 *
 * RF Interactionを状態正本として購読し、利用者の入力を同責務へ通知する。Table構造や移動可否は再解釈せず、
 * RF Interactionが公開する現在結果だけを利用者向け表示へ変換する。
 * 入力Popoverの手動配置と狭い表示領域での表示状態はRF Interactionから分離したPresentation状態として扱う。
 */

import { Button, Popover } from '@wordpress/components';
import { useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

import {
	getRfAboveLabel,
	getRfApplyLabel,
	getRfBelowLabel,
	getRfCancelLabel,
	getColumnMergedRangeMessage,
	getRfColumnOptionLabel,
	getRfColumnSelectionUnavailableMessage,
	getRfColumnTargetHelp,
	getRfColumnsLabel,
	getRfKindLegend,
	getRfLeftLabel,
	getRfNoOpMessage,
	getRfPositionLegend,
	getRfReorderName,
	getRfRightLabel,
	getRowMergedRangeMessage,
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
import { AnnouncementDelivery } from '@/reorder/wordpress/announcement/delivery';
import { RF_POPOVER_DRAG_THRESHOLD_PX, RF_POPOVER_OFFSET_PX } from '@/reorder/reorder-tuning';
import { useReorderFormCollapse } from '@/reorder/wordpress/components/reorder-form-collapse';
import { useReorderFormNarrowLayout } from '@/reorder/wordpress/components/reorder-form-layout';
import { requestReorderFocus } from '@/reorder/wordpress/focus/reorder';
import {
	clampReorderFormPosition,
	type ReorderFormPosition,
	useReorderFormPosition,
} from '@/reorder/wordpress/components/reorder-form-position';

import './reorder-form.scss';

/** RF入力Popoverの表示に必要な対象Table、配置基準、現在状態。 */
type ReorderFormPopoverProps = {
	anchor: HTMLElement | null;
	tableIdentity: string;
	state: RfInteractionReactState;
};

/** RF入力Popoverのドラッグ開始から終了まで保持するPointer操作情報。 */
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

/** Popover外のTable操作だけではRF Sessionを終了しない。 */
const ignorePopoverClose = () => undefined;

/** 狭い表示領域でRF入力画面を折りたたむ操作の表示名を取得する。 */
const getRfCollapseLabel = () => __( 'Collapse reorder form', 'yamabiko-table-reorder' );

/** 狭い表示領域でRF入力画面を展開する操作の表示名を取得する。 */
const getRfExpandLabel = () => __( 'Expand reorder form', 'yamabiko-table-reorder' );

/**
 * Pointer操作対象がRF入力や確定操作そのものかを判定する。
 *
 * 直接操作する部品ではPopover移動を開始せず、通常の入力・選択・ボタン操作を優先する。
 *
 * @param target Pointer操作を開始したDOM EventTarget。
 * @return RF入力や確定操作を直接受ける要素の場合はtrue。それ以外はfalse。
 */
const isDirectInteractionTarget = ( target: EventTarget | null ): boolean => {
	const element = target as Element | null;
	if ( element === null || typeof element.closest !== 'function' ) {
		return false;
	}

	const directInteractionTarget =
		element.closest( 'input, select, textarea, button, a, [contenteditable="true"]' ) !== null;
	return directInteractionTarget;
};

/**
 * 現在列記述を利用者向け選択肢へ変換する。
 *
 * @param descriptor RF Interactionが公開する現在列記述。
 * @return 見出しがある場合は見出しと列番号、ない場合は列番号だけを示す表示名。
 */
const getColumnOptionLabel = ( descriptor: ColumnInputDescriptor ): string =>
	getRfColumnOptionLabel( descriptor.columnNumber, descriptor.heading );

/**
 * RF Interactionの現在結果を、利用者が指定を修正できる一つの案内へ変換する。
 *
 * @param state 現在Tableから見たRF Interaction状態。
 * @return 表示すべき案内。入力待ちまたは並び替え可能ならnull。
 */
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

	if ( state.kind === 'row' ) {
		const { rowStart, rowEnd, columnStart, columnEnd } = state.result.blockingMergedRange;
		return getRowMergedRangeMessage( rowStart + 1, rowEnd + 1, columnStart + 1, columnEnd + 1 );
	}

	const { section, rowStart, rowEnd, columnStart, columnEnd } = state.result.blockingMergedRange;
	return getColumnMergedRangeMessage(
		section,
		rowStart + 1,
		rowEnd + 1,
		columnStart + 1,
		columnEnd + 1
	);
};

/**
 * 折りたたみ時に現在の入力内容をTable確認と両立できる短い要約へ変換する。
 *
 * @param state 現在Tableから見たRF Interaction状態。
 * @return 現在の移動元、移動先、位置関係を簡潔に示す文言。
 */
const getCollapsedSummary = ( state: RfInteractionReactState ): string => {
	if ( state.status !== 'open' ) {
		return '';
	}

	if ( state.kind === 'row' ) {
		const source = state.input.sourceRowNumber || '–';
		const target = state.input.targetRowNumber || '–';
		let position = '–';
		if ( state.input.position !== null ) {
			position = state.input.position === 'above' ? getRfAboveLabel() : getRfBelowLabel();
		}
		return `${ source } → ${ target } · ${ position }`;
	}

	const sourceDescriptor = state.columns.find(
		( descriptor ) => descriptor.columnIndex === state.input.sourceColumnIndex
	);
	const targetDescriptor = state.columns.find(
		( descriptor ) => descriptor.columnIndex === state.input.targetColumnIndex
	);
	const source = sourceDescriptor === undefined ? '–' : getColumnOptionLabel( sourceDescriptor );
	const target = targetDescriptor === undefined ? '–' : getColumnOptionLabel( targetDescriptor );
	let position = '–';
	if ( state.input.position !== null ) {
		position = state.input.position === 'left' ? getRfLeftLabel() : getRfRightLabel();
	}
	return `${ source } → ${ target } · ${ position }`;
};

/**
 * 手動配置されたRF入力PopoverをWordPress Popoverへ渡す仮想配置基準へ変換する。
 *
 * @param position      Editor viewport基準のPopover左上位置。
 * @param ownerDocument 現在のEditor DOMを所有するdocument。
 * @return 指定位置を原点とするWordPress Popover用仮想配置基準。
 */
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

/**
 * 対応TableのRF入力画面を、表示領域に応じてPopoverまたは下部dockとして表示する。
 *
 * wide表示の初期位置はRF Toolbar入口を基準とし、利用者が入力部品以外のPopover面をドラッグした後は
 * その位置を同一RF Session中で維持する。narrow表示では手動位置を適用せず、画面下部へ固定する。
 *
 * @param props               対象Table、Toolbar anchor、RF Interaction状態。
 * @param props.anchor        RF Toolbar入口のDOM要素。
 * @param props.tableIdentity RF Session対象Table Identity。
 * @param props.state         対象Tableから見た現在RF Interaction状態。
 * @return RFがopenで配置基準を取得できている場合の入力画面。それ以外はnull。
 */
export const ReorderFormPopover = ( props: ReorderFormPopoverProps ) => {
	const { anchor, state, tableIdentity } = props;
	const dragStateRef = useRef< ReorderFormDragState | null >( null );
	const suppressClickRef = useRef( false );
	const isNarrow = useReorderFormNarrowLayout( anchor );
	const { collapsed, setCollapsed } = useReorderFormCollapse( tableIdentity );
	const { position, setPosition } = useReorderFormPosition( tableIdentity );

	/*
	 * RFが利用可能になった時点で初期操作へ移動する。
	 * targetが現在DOMに成立しない場合はFocus Coordinationがその場で終了する。
	 */
	useEffect( () => {
		if ( anchor === null || state.status !== 'open' ) {
			return;
		}
		requestReorderFocus( { type: 'rf-open', tableIdentity }, anchor );
	}, [ anchor, state.status, tableIdentity ] );

	if ( anchor === null || state.status !== 'open' ) {
		return null;
	}

	const resultMessage = getCurrentResultMessage( state );
	const controlIdPrefix = `yamabiko-table-reorder-rf-${ tableIdentity }`;
	const rowKindId = `${ controlIdPrefix }-kind-row`;
	const columnKindId = `${ controlIdPrefix }-kind-column`;
	const formContentId = `${ controlIdPrefix }-content`;
	const sourceRowId = `${ controlIdPrefix }-source-row`;
	const targetRowId = `${ controlIdPrefix }-target-row`;
	const rowRangeId = `${ controlIdPrefix }-row-range`;
	const rowAboveId = `${ controlIdPrefix }-row-above`;
	const rowBelowId = `${ controlIdPrefix }-row-below`;
	const sourceColumnId = `${ controlIdPrefix }-source-column`;
	const targetColumnId = `${ controlIdPrefix }-target-column`;
	const sourceColumnProblemId = `${ controlIdPrefix }-source-column-problem`;
	const targetColumnProblemId = `${ controlIdPrefix }-target-column-problem`;
	const columnLeftId = `${ controlIdPrefix }-column-left`;
	const columnRightId = `${ controlIdPrefix }-column-right`;
	const manuallyPositioned = ! isNarrow && position !== null;
	const popoverAnchor =
		manuallyPositioned && position !== null
			? createManualPopoverAnchor( position, anchor.ownerDocument )
			: anchor;
	const popoverOffset = manuallyPositioned ? 0 : RF_POPOVER_OFFSET_PX;
	const narrowCollapsed = isNarrow && collapsed;
	const rowInputProblems =
		state.kind === 'row' && state.result.status === 'not-ready' ? state.result.inputProblems : [];
	const sourceRowInvalid = rowInputProblems.some( ( problem ) => problem.target === 'source' );
	const targetRowInvalid = rowInputProblems.some( ( problem ) => problem.target === 'target' );
	const columnInputProblems =
		state.kind === 'column' && state.result.status === 'not-ready'
			? state.result.inputProblems
			: [];
	const sourceColumnInvalid = columnInputProblems.some(
		( problem ) => problem.target === 'source'
	);
	const targetColumnInvalid = columnInputProblems.some(
		( problem ) => problem.target === 'target'
	);
	const popoverClassName = isNarrow
		? 'yamabiko-table-reorder-rf-popover is-narrow'
		: 'yamabiko-table-reorder-rf-popover';

	/**
	 * RF入力Popoverの直接操作部品以外からPointer移動を開始する。
	 *
	 * narrow表示は画面下部へ固定するため、手動移動を開始しない。
	 *
	 * @param event Popover面で開始されたprimary pointer操作。
	 */
	const startDragging = ( event: ReactPointerEvent< HTMLDivElement > ): void => {
		if (
			isNarrow ||
			! event.isPrimary ||
			event.button !== 0 ||
			isDirectInteractionTarget( event.target )
		) {
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

	/**
	 * 現在RF入力PopoverをPointer位置へ追従させ、Editor viewport内に操作可能な範囲を維持する。
	 *
	 * @param event ドラッグ中のprimary pointer操作。
	 */
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
			if ( distance < RF_POPOVER_DRAG_THRESHOLD_PX ) {
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

	/**
	 * RF入力PopoverのPointer移動を終了する。
	 *
	 * ドラッグ後にラベル等のclickが発火して入力値を変更しないよう、その直後のclickだけを無効にする。
	 *
	 * @param event 終了または取消されたPointer操作。
	 */
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

	/**
	 * ドラッグ終了によって生成されたclickだけを入力操作として扱わない。
	 *
	 * @param event RF入力Popover内で発生したclick。
	 */
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
			className={ popoverClassName }
			flip={ ! isNarrow && ! manuallyPositioned }
			focusOnMount={ false }
			noArrow={ isNarrow || manuallyPositioned }
			offset={ isNarrow ? 0 : popoverOffset }
			onClose={ ignorePopoverClose }
			onFocusOutside={ ignorePopoverClose }
			placement="bottom-start"
			shift={ ! isNarrow }
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
				<div className="yamabiko-table-reorder-rf__header">
					<h2 className="yamabiko-table-reorder-rf__title">{ getRfReorderName() }</h2>
					{ isNarrow && (
						<Button
							aria-controls={ formContentId }
							aria-expanded={ ! collapsed }
							className="yamabiko-table-reorder-rf__collapse"
							label={ collapsed ? getRfExpandLabel() : getRfCollapseLabel() }
							onClick={ () => setCollapsed( ! collapsed ) }
							variant="tertiary"
						>
							<span aria-hidden="true">{ collapsed ? '⌃' : '⌄' }</span>
						</Button>
					) }
				</div>

				{ narrowCollapsed && (
					<p className="yamabiko-table-reorder-rf__summary">{ getCollapsedSummary( state ) }</p>
				) }
				<div hidden={ narrowCollapsed } id={ formContentId }>
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
									aria-describedby={ state.rowCount !== null ? rowRangeId : undefined }
									aria-invalid={ sourceRowInvalid || undefined }
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
									aria-describedby={ state.rowCount !== null ? rowRangeId : undefined }
									aria-invalid={ targetRowInvalid || undefined }
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
								<p
									className={
										sourceRowInvalid || targetRowInvalid
											? 'yamabiko-table-reorder-rf__notice'
											: 'yamabiko-table-reorder-rf__help'
									}
									id={ rowRangeId }
								>
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
									aria-describedby={ sourceColumnInvalid ? sourceColumnProblemId : undefined }
									aria-invalid={ sourceColumnInvalid || undefined }
									id={ sourceColumnId }
									onChange={ ( event ) =>
										rfInteraction.updateColumnInput( tableIdentity, {
											...state.input,
											sourceColumnIndex:
												event.currentTarget.value === ''
													? null
													: Number( event.currentTarget.value ),
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
							{ sourceColumnInvalid && (
								<p className="yamabiko-table-reorder-rf__notice" id={ sourceColumnProblemId }>
									{ getRfColumnSelectionUnavailableMessage() }
								</p>
							) }
							<label htmlFor={ targetColumnId }>
								<span>{ getRfTargetColumnLabel() }</span>
								<select
									aria-describedby={ targetColumnInvalid ? targetColumnProblemId : undefined }
									aria-invalid={ targetColumnInvalid || undefined }
									id={ targetColumnId }
									onChange={ ( event ) =>
										rfInteraction.updateColumnInput( tableIdentity, {
											...state.input,
											targetColumnIndex:
												event.currentTarget.value === ''
													? null
													: Number( event.currentTarget.value ),
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
							{ targetColumnInvalid && (
								<p className="yamabiko-table-reorder-rf__notice" id={ targetColumnProblemId }>
									{ getRfColumnSelectionUnavailableMessage() }
								</p>
							) }
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
						<>
							<p className="yamabiko-table-reorder-rf__notice">{ resultMessage }</p>
							<AnnouncementDelivery message={ resultMessage } source={ state.result } />
						</>
					) }

					<div className="yamabiko-table-reorder-rf__actions">
						<Button
							onClick={ () => {
								rfInteraction.close( tableIdentity );
								requestReorderFocus( { type: 'rf-explicit-close' }, anchor );
							} }
							variant="secondary"
						>
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
			</div>
		</Popover>
	);
};
