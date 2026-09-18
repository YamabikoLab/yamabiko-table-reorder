/**
 * WordPress EditorのTableツールバーへReorder Mode / RF入口と初回案内を表示するReactコンポーネントを所有する。
 *
 * 行・列DnDとRFを排他的に接続し、初回案内表示中は3つの入口を共通の並び替え入口として強調する。
 */

import { BlockControls } from '@wordpress/block-editor';
import { Popover, ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { useState } from '@wordpress/element';

import {
	getColumnDndLayoutUnavailableMessage,
	getColumnReorderName,
	getRfReorderName,
	getRowReorderName,
} from '@/messages';
import { rfInteraction } from '@/reorder/reorder-form/responsibilities/interaction';
import { useRfInteraction } from '@/reorder/reorder-form/responsibilities/interaction-react';
import type { ReorderKind } from '@/reorder/reorder-mode';
import { useReorderMode } from '@/reorder/reorder-mode-react';
import { reorderFormCollapse } from '@/reorder/wordpress/components/reorder-form-collapse';
import { ReorderFormPopover } from '@/reorder/wordpress/components/reorder-form';
import {
	reorderFormHeight,
	useReorderFormNarrowHeight,
} from '@/reorder/wordpress/components/reorder-form-height';
import { reorderFormPosition } from '@/reorder/wordpress/components/reorder-form-position';
import { ReorderGuidance } from '@/reorder/wordpress/components/guidance';
import { useColumnDndLayoutAvailabilitySnapshot } from '@/reorder/wordpress/column-dnd-layout-availability-state';
import { useReorderGuidance } from '@/reorder/wordpress/hooks/use-reorder-guidance';

/** Reorder入口のツールバーへ接続する対象Tableを表す。 */
type ReorderModeToolbarProps = {
	tableIdentity: string;
};

/** 行並び替えのツールバー入口に表示する専用アイコン。 */
const rowReorderIcon = (
	<svg
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect height="4" rx="0.75" width="14" x="2.5" y="3.5" />
		<line x1="6" x2="6" y1="3.5" y2="7.5" />
		<line x1="8.25" x2="13.75" y1="5.5" y2="5.5" />
		<rect height="4" rx="0.75" width="14" x="2.5" y="10" />
		<line x1="6" x2="6" y1="10" y2="14" />
		<line x1="8.25" x2="13.75" y1="12" y2="12" />
		<rect height="4" rx="0.75" width="14" x="2.5" y="16.5" />
		<line x1="6" x2="6" y1="16.5" y2="20.5" />
		<line x1="8.25" x2="13.75" y1="18.5" y2="18.5" />
		<line x1="20" x2="20" y1="6.25" y2="17.75" />
		<polyline points="18,8.25 20,6.25 22,8.25" />
		<polyline points="18,15.75 20,17.75 22,15.75" />
	</svg>
);

/** 列並び替えのツールバー入口に表示する専用アイコン。 */
const columnReorderIcon = (
	<svg
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect height="14" rx="0.75" width="4" x="3.5" y="2.5" />
		<line x1="3.5" x2="7.5" y1="6" y2="6" />
		<rect height="14" rx="0.75" width="4" x="10" y="2.5" />
		<line x1="10" x2="14" y1="6" y2="6" />
		<rect height="14" rx="0.75" width="4" x="16.5" y="2.5" />
		<line x1="16.5" x2="20.5" y1="6" y2="6" />
		<line x1="6.25" x2="17.75" y1="20" y2="20" />
		<polyline points="8.25,18 6.25,20 8.25,22" />
		<polyline points="15.75,18 17.75,20 15.75,22" />
	</svg>
);

/** RFのツールバー入口に表示するフォーム専用アイコン。 */
const formReorderIcon = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		width="24"
		height="24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<rect x="1" y="2" width="13.8" height="12.8" rx="2.1" fill="none" />

		<rect x="3.3" y="4.6" width="2.5" height="2.5" rx="0.4" fill="none" />
		<rect x="7.3" y="4.6" width="5.2" height="2.5" rx="0.5" fill="none" />

		<rect x="3.3" y="9" width="2.5" height="2.5" rx="0.4" fill="none" />
		<rect x="7.3" y="9" width="5.2" height="2.5" rx="0.5" fill="none" />

		<path d="M19.3 2.8v11.4" fill="none" />
		<path d="m17.5 4.6 1.8-1.8 1.8 1.8" fill="none" />
		<path d="m17.5 12.4 1.8 1.8 1.8-1.8" fill="none" />

		<path d="M2.3 19.8h11.4" fill="none" />
		<path d="m4.1 18-1.8 1.8 1.8 1.8" fill="none" />
		<path d="m11.9 18 1.8 1.8-1.8 1.8" fill="none" />
	</svg>
);

/**
 * 対応Tableの行・列DnD / RF入口を表示し、排他状態と初回案内へ接続する。
 *
 * @param props ツールバーを表示するTable Identity。
 * @return 現在の並び替え選択状態と初回案内状態を反映したツールバー入口。
 */
export const ReorderModeToolbar = ( props: ReorderModeToolbarProps ) => {
	const { tableIdentity } = props;
	const { selectedKind, select: selectMode } = useReorderMode( tableIdentity );
	const columnDndLayoutAvailability = useColumnDndLayoutAvailabilitySnapshot( tableIdentity );
	const rfState = useRfInteraction( tableIdentity );
	const [ guidanceAnchor, setGuidanceAnchor ] = useState< HTMLElement | null >( null );
	const [ columnDndAnchor, setColumnDndAnchor ] = useState< HTMLElement | null >( null );
	const [ columnDndReasonVisible, setColumnDndReasonVisible ] = useState( false );
	const [ rfAnchor, setRfAnchor ] = useState< HTMLElement | null >( null );
	const rfActive = rfState.status !== 'closed';
	const rfApplying = rfState.status === 'applying';
	const columnDndUnavailable = columnDndLayoutAvailability === 'unavailable';
	const columnDndUnavailableReasonId = `yamabiko-table-reorder-column-dnd-unavailable-${ tableIdentity }`;
	const { dismiss, guidance } = useReorderGuidance( tableIdentity, guidanceAnchor, rfActive );
	useReorderFormNarrowHeight( tableIdentity, rfAnchor, rfState.status === 'open' );

	/* 初回案内中は、3つの入口全体を共通の開始位置として通常時より強調する。 */
	const guidanceTargetClassName =
		guidance !== null ? 'yamabiko-table-reorder-guidance-target' : undefined;

	/**
	 * RFがopenなら終了してから選択したDnDモードへ進む。
	 * @param kind
	 */
	const selectDndMode = ( kind: ReorderKind ): void => {
		/* RF反映中は新しい並び替え操作を開始しない。 */
		if ( rfApplying ) {
			return;
		}

		/* 物理列配置が成立しない場合は、理由を確認できる入口を維持したままColumn Reorder Modeへ進ませない。 */
		if ( kind === 'column' && columnDndUnavailable ) {
			return;
		}

		if ( rfState.status === 'open' ) {
			rfInteraction.close( tableIdentity );
		}

		selectMode( kind );
	};

	const columnDndEntry = (
		<ToolbarButton
			aria-disabled={ columnDndUnavailable || undefined }
			aria-describedby={
				columnDndUnavailable && columnDndReasonVisible ? columnDndUnavailableReasonId : undefined
			}
			ref={ setColumnDndAnchor }
			disabled={ rfApplying }
			icon={ columnReorderIcon }
			isPressed={ selectedKind === 'column' }
			label={ getColumnReorderName() }
			onBlur={ () => setColumnDndReasonVisible( false ) }
			onClick={ () => {
				if ( columnDndUnavailable ) {
					setColumnDndReasonVisible( true );
				}
				selectDndMode( 'column' );
			} }
			onFocus={ () => {
				if ( columnDndUnavailable ) {
					setColumnDndReasonVisible( true );
				}
			} }
			onMouseEnter={ () => {
				if ( columnDndUnavailable ) {
					setColumnDndReasonVisible( true );
				}
			} }
			onMouseLeave={ () => {
				if ( columnDndAnchor?.ownerDocument.activeElement !== columnDndAnchor ) {
					setColumnDndReasonVisible( false );
				}
			} }
			onTouchStart={ () => {
				if ( columnDndUnavailable ) {
					setColumnDndReasonVisible( true );
				}
			} }
		/>
	);

	/** RF入口の再選択では終了し、開始時はDnDモードを通常編集へ戻してからSessionを開く。 */
	const selectRf = (): void => {
		/* RF反映中は新しい並び替え操作を開始しない。 */
		if ( rfApplying ) {
			return;
		}

		if ( rfState.status === 'open' ) {
			rfInteraction.close( tableIdentity );
			return;
		}

		if ( selectedKind !== null ) {
			selectMode( selectedKind );
		}

		/* 新しいRF Sessionは前回のPresentation状態を引き継がず初期状態から開始する。 */
		reorderFormPosition.beginSession( tableIdentity );
		reorderFormCollapse.beginSession( tableIdentity );
		reorderFormHeight.beginSession( tableIdentity );
		rfInteraction.open( tableIdentity );
	};

	return (
		<BlockControls>
			<ToolbarGroup className={ guidanceTargetClassName }>
				{ /* 選択中の入口だけを現在の並び替え手段として表示する。 */ }
				<ToolbarButton
					ref={ setGuidanceAnchor }
					disabled={ rfApplying }
					icon={ rowReorderIcon }
					isPressed={ selectedKind === 'row' }
					label={ getRowReorderName() }
					onClick={ () => selectDndMode( 'row' ) }
				/>
				{ columnDndEntry }
				<ToolbarButton
					data-ytr-focus-target="rf-toolbar"
					data-ytr-table-identity={ tableIdentity }
					ref={ setRfAnchor }
					disabled={ rfApplying }
					icon={ formReorderIcon }
					isPressed={ rfState.status === 'open' }
					label={ getRfReorderName() }
					onClick={ selectRf }
				/>
			</ToolbarGroup>
			{ columnDndUnavailable && columnDndReasonVisible && columnDndAnchor !== null && (
				<Popover
					anchor={ columnDndAnchor }
					focusOnMount={ false }
					onClose={ () => setColumnDndReasonVisible( false ) }
					placement="bottom"
				>
					<p id={ columnDndUnavailableReasonId } role="tooltip">
						{ getColumnDndLayoutUnavailableMessage() }
					</p>
				</Popover>
			) }
			{ /* RFの入力状態はPopoverのmountではなくRF Interactionが所有する。 */ }
			<ReorderFormPopover anchor={ rfAnchor } state={ rfState } tableIdentity={ tableIdentity } />
			{ /* 有効な案内対象がある場合だけ、確定済みの操作環境で初回案内を描画する。 */ }
			{ guidance !== null && (
				<ReorderGuidance
					anchor={ guidanceAnchor }
					environment={ guidance.environment }
					onDismiss={ dismiss }
				/>
			) }
		</BlockControls>
	);
};
