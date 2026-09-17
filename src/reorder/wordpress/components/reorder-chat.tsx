/**
 * 対応Table向けChat Reorder PoCの入力Presentationと1回分のAI送信Lifecycleを所有する。
 *
 * Chat固有のactive / anchor / 利用者入力 / AI応答状態をこの境界へ閉じ込め、Toolbarへは入口操作だけを公開する。
 * AI出力はstrict parserを通した後だけRF入力へ接続し、Table更新状態やRF validation結果は所有しない。
 */

import { Button, Popover, TextControl } from '@wordpress/components';
import { useState } from '@wordpress/element';
import type { FormEvent, ReactNode } from 'react';

import {
	getChatInvalidOutputMessage,
	getChatPromptLabel,
	getChatSendLabel,
	getChatTransportUnavailableMessage,
	getChatUnresolvedColumnMessage,
} from '@/messages';
import { getChatAiTransport, requestChatReorderCommand } from '@/reorder/chat-reorder/ai-request';
import { parseChatReorderCommand } from '@/reorder/chat-reorder/command';
import { getChatReorderContext } from '@/reorder/chat-reorder/context-reader';
import { submitChatCommandToRf } from '@/reorder/chat-reorder/rf-input-adapter';

import './reorder-chat.scss';

/** Toolbarへ公開するChat入口操作。 */
export type ReorderChatEntry = {
	active: boolean;
	setAnchor: ( anchor: HTMLElement | null ) => void;
	open: () => void;
	close: () => void;
	toggle: () => void;
};

/** Chat Reorder接続境界へ渡すprops。 */
type ReorderChatProps = {
	tableIdentity: string;
	children: ( entry: ReorderChatEntry ) => ReactNode;
};

/**
 * 対応TableへChat固有Lifecycleを接続し、Toolbarには入口操作だけを提供する。
 *
 * @param props 対象Table IdentityとToolbarを描画するrender function。
 * @return Toolbar入口と、active時だけ表示するChat Popover。
 */
export const ReorderChat = ( props: ReorderChatProps ) => {
	const { tableIdentity, children } = props;
	const [ anchor, setAnchor ] = useState< HTMLElement | null >( null );
	const [ active, setActive ] = useState( false );
	const [ input, setInput ] = useState( '' );
	const [ message, setMessage ] = useState< string | null >( null );
	const [ submitting, setSubmitting ] = useState( false );

	const close = (): void => setActive( false );
	const open = (): void => {
		setMessage( null );
		setActive( true );
	};
	const toggle = (): void => {
		if ( active ) {
			close();
			return;
		}
		open();
	};

	/**
	 * 今回入力だけをAIへ送り、strict parse済みCommandだけをRFへ接続する。
	 *
	 * @param event Chat入力フォームのsubmit event。
	 */
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
			close();
		} catch {
			setMessage( getChatInvalidOutputMessage() );
		} finally {
			setSubmitting( false );
		}
	};

	const entry: ReorderChatEntry = { active, setAnchor, open, close, toggle };

	return (
		<>
			{ children( entry ) }
			{ anchor !== null && active && (
				<Popover anchor={ anchor } focusOnMount="firstElement" onClose={ close } placement="bottom">
					<form className="yamabiko-table-reorder-chat" onSubmit={ submit }>
						<TextControl
							disabled={ submitting }
							label={ getChatPromptLabel() }
							onChange={ setInput }
							value={ input }
						/>
						{ message !== null && <p role="status">{ message }</p> }
						<Button disabled={ submitting || input.trim() === '' } type="submit" variant="primary">
							{ getChatSendLabel() }
						</Button>
					</form>
				</Popover>
			) }
		</>
	);
};
