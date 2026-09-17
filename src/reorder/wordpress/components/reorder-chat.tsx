/**
 * 対応Table向けChat Reorder PoCの入力Presentationと1回分のAI送信Lifecycleを所有する。
 *
 * AI出力はstrict parserを通した後だけRF入力へ接続し、Table更新状態やRF validation結果は所有しない。
 */

import { Button, Popover, TextControl } from '@wordpress/components';
import { useState, type FormEvent } from '@wordpress/element';

import {
	getChatInvalidOutputMessage,
	getChatPromptLabel,
	getChatSendLabel,
	getChatTransportUnavailableMessage,
	getChatUnresolvedColumnMessage,
} from '@/messages';
import {
	getChatAiTransport,
	requestChatReorderCommand,
} from '@/reorder/chat-reorder/ai-request';
import { parseChatReorderCommand } from '@/reorder/chat-reorder/command';
import { getChatReorderContext } from '@/reorder/chat-reorder/context';
import { submitChatCommandToRf } from '@/reorder/chat-reorder/rf-input-adapter';

import './reorder-chat.scss';

/** Chat Reorder Popoverへ渡す表示契約。 */
type ReorderChatPopoverProps = {
	anchor: HTMLElement | null;
	tableIdentity: string;
	active: boolean;
	onClose: () => void;
};

/** 対応Table向けChat Reorder入力を表示する。 */
export const ReorderChatPopover = ( props: ReorderChatPopoverProps ) => {
	const { anchor, tableIdentity, active, onClose } = props;
	const [ input, setInput ] = useState( '' );
	const [ message, setMessage ] = useState< string | null >( null );
	const [ submitting, setSubmitting ] = useState( false );

	if ( anchor === null || ! active ) {
		return null;
	}

	/** 今回入力だけをAIへ送り、strict parse済みCommandだけをRFへ接続する。 */
	const submit = async ( event: FormEvent< HTMLFormElement > ): Promise< void > => {
		event.preventDefault();
		const currentInput = input.trim();
		if ( currentInput === '' || submitting ) {
			return;
		}

		const transport = getChatAiTransport();
		if ( transport === null ) {
			setMessage( getChatTransportUnavailableMessage() );
			return;
		}

		setSubmitting( true );
		setMessage( null );
		try {
			const commandText = await requestChatReorderCommand(
				currentInput,
				getChatReorderContext( tableIdentity ),
				transport
			);
			const parsed = parseChatReorderCommand( commandText );
			if ( parsed.status === 'invalid' ) {
				setMessage( getChatInvalidOutputMessage() );
				return;
			}

			const result = submitChatCommandToRf( parsed.command, tableIdentity );
			if ( result.status === 'clarification' ) {
				setMessage( result.message );
				return;
			}
			if ( result.status === 'unresolved-column' ) {
				setMessage( getChatUnresolvedColumnMessage() );
				return;
			}

			setInput( '' );
			onClose();
		} catch {
			setMessage( getChatInvalidOutputMessage() );
		} finally {
			setSubmitting( false );
		}
	};

	return (
		<Popover anchor={ anchor } focusOnMount="firstElement" onClose={ onClose } placement="bottom">
			<form className="yamabiko-table-reorder-chat" onSubmit={ submit }>
				<TextControl
					label={ getChatPromptLabel() }
					value={ input }
					onChange={ setInput }
					disabled={ submitting }
				/>
				{ message !== null && <p role="status">{ message }</p> }
				<Button disabled={ submitting || input.trim() === '' } type="submit" variant="primary">
					{ getChatSendLabel() }
				</Button>
			</form>
		</Popover>
	);
};
