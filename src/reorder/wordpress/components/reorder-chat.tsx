/**
 * 対応Table向けChat Reorder PoCの入力Presentationと1回分のAI送信Lifecycleを所有する。
 *
 * Chat固有のactive / anchor / 利用者入力 / AI応答状態をこの境界へ閉じ込め、Toolbarへは入口操作だけを公開する。
 * AI出力はstrict parserを通した後だけRF入力へ接続し、Table更新状態やRF validation結果は所有しない。
 */

import { Button, Popover, SelectControl, TextControl } from '@wordpress/components';
import { useState } from '@wordpress/element';
import type { FormEvent, ReactNode } from 'react';

import {
	getChatAutomaticModelLabel,
	getChatInvalidOutputMessage,
	getChatModelLabel,
	getChatPromptLabel,
	getChatSendLabel,
	getChatUnresolvedColumnMessage,
	getRfApplyFailureMessage,
} from '@/messages';
import {
	requestChatModels,
	requestChatReorderCommand,
	type ChatModelOption,
} from '@/reorder/chat-reorder/ai-request';
import { parseChatReorderCommand } from '@/reorder/chat-reorder/command';
import { getChatReorderContext } from '@/reorder/chat-reorder/context-reader';
import { submitChatCommandToRf } from '@/reorder/chat-reorder/rf-input-adapter';
import { ReorderProgressModal } from '@/reorder/wordpress/components/reorder-progress-modal';

import './reorder-chat.scss';

/** Toolbarへ公開するChat入口操作。 */
export type ReorderChatEntry = {
	active: boolean;
	setAnchor: ( anchor: HTMLElement | null ) => void;
	open: () => void;
	close: () => void;
	toggle: () => void;
};

/**
 * providerとmodel IDの組み合わせをSelectControl内の一意な値へ変換する。
 *
 * @param model Chat Reorderで利用できるmodel。
 * @return Chat内の選択状態で使用する値。
 */
const getChatModelValue = ( model: ChatModelOption ): string =>
	`${ encodeURIComponent( model.provider ) }/${ encodeURIComponent( model.id ) }`;

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
	const [ models, setModels ] = useState< ChatModelOption[] >( [] );
	const [ selectedModelValue, setSelectedModelValue ] = useState( '' );
	const [ submitting, setSubmitting ] = useState( false );

	const close = (): void => setActive( false );

	/** 現在利用可能なモデルを取得し、消失した選択は自動選択へ戻す。 */
	const loadModels = async (): Promise< void > => {
		try {
			const availableModels = await requestChatModels();
			setModels( availableModels );
			setSelectedModelValue( ( currentValue ) => {
				if ( currentValue === '' ) {
					return currentValue;
				}
				const remainsAvailable = availableModels.some(
					( model ) => getChatModelValue( model ) === currentValue
				);
				if ( remainsAvailable ) {
					return currentValue;
				}
				return '';
			} );
		} catch {
			setModels( [] );
			setSelectedModelValue( '' );
		}
	};

	const open = (): void => {
		setMessage( null );
		setActive( true );
		void loadModels();
	};
	const toggle = (): void => {
		if ( active ) {
			close();
			return;
		}
		open();
	};

	/**
	 * 今回入力だけを正規化Abilityへ送り、strict parse済みCommandだけをRFへ接続する。
	 *
	 * @param event Chat入力フォームのsubmit event。
	 */
	const submit = async ( event: FormEvent< HTMLFormElement > ): Promise< void > => {
		event.preventDefault();
		const currentInput = input.trim();
		if ( currentInput === '' || submitting ) {
			return;
		}

		setSubmitting( true );
		setMessage( null );
		try {
			const selectedModel =
				models.find( ( model ) => getChatModelValue( model ) === selectedModelValue ) ?? null;
			const commandText = await requestChatReorderCommand(
				currentInput,
				getChatReorderContext( tableIdentity ),
				selectedModel
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
			setMessage( getRfApplyFailureMessage() );
		} finally {
			setSubmitting( false );
		}
	};

	const entry: ReorderChatEntry = { active, setAnchor, open, close, toggle };
	const modelOptions = [
		{ label: getChatAutomaticModelLabel(), value: '' },
		...models.map( ( model ) => ( {
			label: `${ model.providerName }: ${ model.name }`,
			value: getChatModelValue( model ),
		} ) ),
	];

	return (
		<>
			{ children( entry ) }
			{ submitting && <ReorderProgressModal /> }
			{ anchor !== null && active && ! submitting && (
				<Popover anchor={ anchor } focusOnMount="firstElement" onClose={ close } placement="bottom">
					<form className="yamabiko-table-reorder-chat" onSubmit={ submit }>
						<SelectControl
							disabled={ submitting }
							label={ getChatModelLabel() }
							onChange={ setSelectedModelValue }
							options={ modelOptions }
							value={ selectedModelValue }
						/>
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
