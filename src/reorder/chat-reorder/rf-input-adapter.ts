/**
 * Strict parse済みChat Reorder Commandを既存RF Interaction入力へ接続する。
 *
 * Column label / number selectorは現在のColumn Input Descriptorへ一意に照合するが、no-op、結合セル制約、unavailable、Apply可否は既存RFへ委ねる。
 */

import { columnTableIntegration } from '@/reorder/column-reorder/responsibilities/table-integration';
import { rfInteraction } from '@/reorder/reorder-form/responsibilities/interaction';

import type { ChatColumnSelector, ChatReorderCommand } from './command';

/** Chat CommandをRFへ接続した結果。 */
export type ChatRfInputResult =
	| { status: 'submitted' }
	| { status: 'clarification'; message: string }
	| { status: 'unresolved-column' };

/**
 * Column selectorを要求時点の現在Column Input Descriptorへ一意に照合する。
 *
 * @param selector      AI Commandに含まれる未信頼selector。
 * @param tableIdentity 対象Table Identity。
 * @return 一意に解決できた0-based論理列Identity。解決不能または重複時はnull。
 */
const resolveColumnSelector = (
	selector: ChatColumnSelector,
	tableIdentity: string
): number | null => {
	const columns = columnTableIntegration.getColumnInputDescriptors( tableIdentity );
	if ( columns === null ) {
		return null;
	}

	if ( selector.kind === 'number' ) {
		const match = columns.find( ( column ) => column.columnNumber === selector.columnNumber );
		return match?.columnIndex ?? null;
	}

	const requestedLabel = selector.label.trim();
	const matches = columns.filter( ( column ) => column.heading?.trim() === requestedLabel );
	if ( matches.length !== 1 ) {
		return null;
	}
	return matches[ 0 ].columnIndex;
};

/**
 * Chat Commandを既存RF Sessionへ入力し、成立性判断と反映をRFへ委ねる。
 *
 * @param command       Strict parserで構文成立済みのCommand。
 * @param tableIdentity 対象Table Identity。
 * @return RFへ要求した結果、clarification、またはColumn selector解決不能。
 */
export const submitChatCommandToRf = (
	command: ChatReorderCommand,
	tableIdentity: string
): ChatRfInputResult => {
	if ( command.kind === 'ask' ) {
		return { status: 'clarification', message: command.message };
	}

	if ( command.kind === 'row' ) {
		rfInteraction.open( tableIdentity );
		rfInteraction.selectKind( tableIdentity, 'row' );
		rfInteraction.updateRowInput( tableIdentity, {
			sourceRowNumber: String( command.sourceRowNumber ),
			targetRowNumber: String( command.targetRowNumber ),
			position: command.position === 'before' ? 'above' : 'below',
		} );
		rfInteraction.requestApply( tableIdentity );
		return { status: 'submitted' };
	}

	const sourceColumnIndex = resolveColumnSelector( command.source, tableIdentity );
	const targetColumnIndex = resolveColumnSelector( command.target, tableIdentity );
	if ( sourceColumnIndex === null || targetColumnIndex === null ) {
		return { status: 'unresolved-column' };
	}

	rfInteraction.open( tableIdentity );
	rfInteraction.selectKind( tableIdentity, 'column' );
	rfInteraction.updateColumnInput( tableIdentity, {
		sourceColumnIndex,
		targetColumnIndex,
		position: command.position === 'before' ? 'left' : 'right',
	} );
	rfInteraction.requestApply( tableIdentity );
	return { status: 'submitted' };
};
