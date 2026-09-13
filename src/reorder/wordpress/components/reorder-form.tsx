/**
 * Reorder Form（RF）の入力画面をWordPress Popoverとして表示するPresentationを所有する。
 *
 * RF Interactionを状態正本として購読し、利用者の入力を同責務へ通知する。Table構造や移動可否は再解釈せず、
 * RF Interactionが公開する現在結果だけを利用者向け表示へ変換する。
 */

import { Button, Popover } from '@wordpress/components';

import {
	getRfAboveLabel,
	getRfApplyLabel,
	getRfBelowLabel,
	getRfCancelLabel,
	getRfColumnMergedRangeMessage,
	getRfColumnOptionLabel,
	getRfColumnTargetHelp,
	getRfColumnsLabel,
	getRfKindLegend,
	getRfLeftLabel,
	getRfNoOpMessage,
	getRfPositionLegend,
	getRfReorderName,
	getRfRightLabel,
	getRfRowMergedRangeMessage,
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

import './reorder-form.scss';

/** RF入力Popoverの表示に必要な対象Table、配置基準、現在状態。 */
type ReorderFormPopoverProps = {
	anchor: HTMLElement | null;
	tableIdentity: string;
	state: RfInteractionReactState;
};

/** Popover外のTable操作だけではRF Sessionを終了しない。 */
const ignorePopoverClose = () => undefined;

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
		const { rowStart, rowEnd } = state.result.blockingMergedRange;
		return getRfRowMergedRangeMessage( rowStart + 1, rowEnd + 1 );
	}

	const { columnStart, columnEnd } = state.result.blockingMergedRange;
	return getRfColumnMergedRangeMessage( columnStart + 1, columnEnd + 1 );
};

/**
 * 対応TableのRF入力画面をToolbar基準のPopoverとして表示する。
 *
 * @param props               対象Table、Toolbar anchor、RF Interaction状態。
 * @param props.anchor        RF Toolbar入口のDOM要素。
 * @param props.tableIdentity RF Session対象Table Identity。
 * @param props.state         対象Tableから見た現在RF Interaction状態。
 * @return RFがopenで配置基準を取得できている場合の入力Popover。それ以外はnull。
 */
export const ReorderFormPopover = ( props: ReorderFormPopoverProps ) => {
	const { anchor, state, tableIdentity } = props;

	if ( anchor === null || state.status !== 'open' ) {
		return null;
	}

	const resultMessage = getCurrentResultMessage( state );

	return (
		<Popover
			anchor={ anchor }
			className="yamabiko-table-reorder-rf-popover"
			flip
			focusOnMount={ false }
			offset={ 8 }
			onClose={ ignorePopoverClose }
			onFocusOutside={ ignorePopoverClose }
			placement="bottom-start"
			shift
			variant="unstyled"
		>
			<div className="yamabiko-table-reorder-rf">
				<h2 className="yamabiko-table-reorder-rf__title">{ getRfReorderName() }</h2>

				<fieldset className="yamabiko-table-reorder-rf__fieldset">
					<legend>{ getRfKindLegend() }</legend>
					<label>
						<input
							checked={ state.kind === 'row' }
							name={ `yamabiko-table-reorder-rf-kind-${ tableIdentity }` }
							onChange={ () => rfInteraction.selectKind( tableIdentity, 'row' ) }
							type="radio"
						/>
						{ getRfRowsLabel() }
					</label>
					<label>
						<input
							checked={ state.kind === 'column' }
							name={ `yamabiko-table-reorder-rf-kind-${ tableIdentity }` }
							onChange={ () => rfInteraction.selectKind( tableIdentity, 'column' ) }
							type="radio"
						/>
						{ getRfColumnsLabel() }
					</label>
				</fieldset>

				{ state.kind === 'row' ? (
					<div className="yamabiko-table-reorder-rf__fields">
						<label>
							<span>{ getRfSourceRowLabel() }</span>
							<input
								inputMode="numeric"
								onChange={ ( event ) =>
									rfInteraction.updateRowInput( tableIdentity, {
										...state.input,
										sourceRowNumber: event.currentTarget.value,
									} )
								}
								type="number"
								value={ state.input.sourceRowNumber }
							/>
						</label>
						<label>
							<span>{ getRfTargetRowLabel() }</span>
							<input
								inputMode="numeric"
								onChange={ ( event ) =>
									rfInteraction.updateRowInput( tableIdentity, {
										...state.input,
										targetRowNumber: event.currentTarget.value,
									} )
								}
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
							<label>
								<input
									checked={ state.input.position === 'above' }
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
							<label>
								<input
									checked={ state.input.position === 'below' }
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
						<label>
							<span>{ getRfSourceColumnLabel() }</span>
							<select
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
						<label>
							<span>{ getRfTargetColumnLabel() }</span>
							<select
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
						<fieldset className="yamabiko-table-reorder-rf__fieldset">
							<legend>{ getRfPositionLegend() }</legend>
							<label>
								<input
									checked={ state.input.position === 'left' }
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
							<label>
								<input
									checked={ state.input.position === 'right' }
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
