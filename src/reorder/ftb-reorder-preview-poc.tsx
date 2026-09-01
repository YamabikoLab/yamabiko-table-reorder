/**
 * #718のPoCとして、Flexible Table Block本体を更新せずに行の並び替え表示を維持し、最後に1回だけ属性更新する実験UIを所有する。
 *
 * 正式なRow Reorder責務には接続せず、選択中FTBの現在Table DOMを同じEditor内へ複製して表示専用の並び替えを行う。
 * `Move`ではBlock属性を変更せず、`Commit once`だけが最終行順を`body`へ反映する。
 */

import type { BlockEditProps } from '@wordpress/blocks';
import { useEffect, useRef, useState, type ComponentType } from '@wordpress/element';

import {
	getFtbPreviewCommitLabel,
	getFtbPreviewFromLabel,
	getFtbPreviewMoveLabel,
	getFtbPreviewToLabel,
} from '@/messages';

import { resolveEditorDomContext } from './editor-dom-context';

/** PoC対象のFlexible Table Block名。 */
const FLEXIBLE_TABLE_BLOCK = 'flexible-table-block/table';

/** WordPress Block Editorのdata store名。 */
const BLOCK_EDITOR_STORE = 'core/block-editor';

/** PoC対象FTBの描画済みfigureを識別するselector。 */
const FTB_FIGURE_SELECTOR =
	'figure.wp-block-flexible-table-block-table:not([data-ytr-ftb-reorder-preview])';

/** FTB CellのPoC向け最小表現。 */
type TableCell = Record< string, unknown >;

/** FTB RowのPoC向け最小表現。 */
type TableRow = Record< string, unknown > & {
	cells: TableCell[];
};

/** PoCで参照するFTB属性。 */
type FlexibleTableAttributes = Record< string, unknown > & {
	body?: TableRow[];
};

/** PoC HOCが利用するBlockEdit props。 */
type FlexibleTableBlockEditProps = BlockEditProps< FlexibleTableAttributes > & {
	name: string;
};

/** Block属性更新に必要なWordPress action。 */
type BlockEditorDispatch = {
	updateBlockAttributes: (
		clientId: string,
		attributes: Partial< FlexibleTableAttributes >
	) => void;
};

/** PoCが利用するWordPress Data APIの最小境界。 */
type WordPressData = {
	dispatch: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorDispatch;
};

/** WordPress Data APIを持つプラグイン実行window。 */
type PluginWindow = Window &
	typeof globalThis & {
		wp?: {
			data?: WordPressData;
		};
	};

/** 表示用並び順を保持するPoC状態。 */
type PreviewState =
	| { phase: 'idle' }
	| { phase: 'preview'; rowOrder: number[] }
	| { phase: 'committing'; rowOrder: number[] };

/** 複製表示と元FTB表示の対応を保持するDOM状態。 */
type PreviewDomState = {
	originalFigure: HTMLElement;
	originalDisplay: string;
	previewFigure: HTMLElement;
};

/**
 * 配列内の1要素を指定した最終位置へ移動する。
 *
 * @param items     並び順を変更する配列。
 * @param fromIndex 移動対象の0-based位置。
 * @param toIndex   移動後の0-based位置。
 * @return 元の要素参照を維持した新しい配列。
 */
const moveItem = < T, >( items: T[], fromIndex: number, toIndex: number ): T[] => {
	const indicesAreValid =
		Number.isInteger( fromIndex ) &&
		Number.isInteger( toIndex ) &&
		fromIndex >= 0 &&
		toIndex >= 0 &&
		fromIndex < items.length &&
		toIndex < items.length;

	if ( ! indicesAreValid ) {
		throw new Error( 'FTB reorder preview PoC requires valid source and destination indices.' );
	}

	const nextItems = [ ...items ];
	const [ movedItem ] = nextItems.splice( fromIndex, 1 );

	if ( movedItem === undefined ) {
		throw new Error( 'FTB reorder preview PoC could not resolve the requested row.' );
	}

	nextItems.splice( toIndex, 0, movedItem );
	return nextItems;
};

/**
 * 描画済みFTBと同じEditor内へ表示専用Tableを複製する。
 *
 * 元FTBは複製表示が存在する間だけ非表示とし、複製側はセル編集を開始できない表示専用DOMにする。
 * 複製表示はPoC自身の表示領域が所有し、FTB本体の再描画に巻き込まれないようにする。
 *
 * @param anchor      現在のEditor表示環境を解決するPoC UIの基準要素。
 * @param previewHost PoC自身が所有する複製表示領域。
 * @param clientId    対象FTBのclientId。
 * @return 元FTBと複製表示のDOM対応。
 */
const createPreviewDom = (
	anchor: HTMLElement,
	previewHost: HTMLElement,
	clientId: string
): PreviewDomState => {
	const editorContext = resolveEditorDomContext( anchor );

	if ( ! editorContext ) {
		throw new Error( 'FTB reorder preview PoC could not resolve the current Editor DOM.' );
	}

	const blockElement = Array.from(
		editorContext.document.querySelectorAll< HTMLElement >( '[data-block]' )
	).find( ( element ) => element.dataset.block === clientId );

	if ( ! blockElement ) {
		throw new Error( 'FTB reorder preview PoC could not resolve the selected Block DOM.' );
	}

	const originalFigure = blockElement.matches( FTB_FIGURE_SELECTOR )
		? blockElement
		: blockElement.querySelector< HTMLElement >( FTB_FIGURE_SELECTOR );

	if ( ! originalFigure ) {
		throw new Error( 'FTB reorder preview PoC requires the rendered FTB figure.' );
	}

	const previewFigure = originalFigure.cloneNode( true ) as HTMLElement;
	previewFigure.dataset.ytrFtbReorderPreview = 'true';
	previewFigure.querySelectorAll< HTMLElement >( '[contenteditable]' ).forEach( ( element ) => {
		element.setAttribute( 'contenteditable', 'false' );
	} );

	const originalDisplay = originalFigure.style.display;
	originalFigure.style.display = 'none';
	previewHost.append( previewFigure );

	return { originalDisplay, originalFigure, previewFigure };
};

/**
 * PoCの複製表示を破棄して元FTBを再表示する。
 *
 * @param previewDom 複製表示と元FTB表示のDOM対応。
 */
const removePreviewDom = ( previewDom: PreviewDomState ) => {
	previewDom.previewFigure.remove();
	previewDom.originalFigure.style.display = previewDom.originalDisplay;
};

/**
 * 複製Tableのtbodyだけで指定行を移動する。
 *
 * @param previewFigure 複製されたFTB figure。
 * @param fromIndex     現在表示上の移動元0-based位置。
 * @param toIndex       現在表示上の移動先0-based位置。
 */
const movePreviewRow = ( previewFigure: HTMLElement, fromIndex: number, toIndex: number ) => {
	const tbody = previewFigure.querySelector( 'tbody' );
	const rows = tbody ? Array.from( tbody.children ) : [];
	const indicesAreValid =
		Number.isInteger( fromIndex ) &&
		Number.isInteger( toIndex ) &&
		fromIndex >= 0 &&
		toIndex >= 0 &&
		fromIndex < rows.length &&
		toIndex < rows.length;

	if ( ! tbody || ! indicesAreValid ) {
		throw new Error( 'FTB reorder preview PoC requires valid tbody row indices.' );
	}

	const movedRow = rows[ fromIndex ];

	if ( ! movedRow ) {
		throw new Error( 'FTB reorder preview PoC could not resolve the rendered source row.' );
	}

	const referenceRow = fromIndex < toIndex ? rows[ toIndex ]?.nextSibling : rows[ toIndex ];
	tbody.insertBefore( movedRow, referenceRow ?? null );
};

/**
 * commit後にEditorが更新済みFTBを描画へ反映できる境界まで待つ。
 *
 * 複製表示はこの境界を通過するまで維持し、commit直後に元の並び順が見える状態へ戻さない。
 *
 * @param editorWindow 対象FTBが描画されているEditor window。
 * @return 2回の描画境界を通過した時点で解決するPromise。
 */
const waitForCommitDisplayBoundary = ( editorWindow: Window ): Promise< void > =>
	new Promise( ( resolve ) => {
		editorWindow.requestAnimationFrame( () => {
			editorWindow.requestAnimationFrame( () => resolve() );
		} );
	} );

/**
 * 選択中FTBへ#718の一時PoC UIを追加する。
 *
 * @param props Gutenbergから渡されるFTBのBlockEdit props。
 * @return 元のFTB編集表示と、選択時だけ表示するPoC操作UI。
 */
const FtbReorderPreviewPoC = ( props: FlexibleTableBlockEditProps ) => {
	const { attributes, clientId, isSelected } = props;
	const anchorRef = useRef< HTMLSpanElement >( null );
	const previewHostRef = useRef< HTMLDivElement >( null );
	const previewDomRef = useRef< PreviewDomState | null >( null );
	const [ fromValue, setFromValue ] = useState( '0' );
	const [ toValue, setToValue ] = useState( '0' );
	const [ state, setState ] = useState< PreviewState >( { phase: 'idle' } );

	useEffect( () => {
		/*
		 * 対象FTBが非選択またはunmountになった場合は一時表示を残さず、Editor本来の表示へ戻す。
		 */
		if ( ! isSelected && previewDomRef.current ) {
			removePreviewDom( previewDomRef.current );
			previewDomRef.current = null;
			setState( { phase: 'idle' } );
		}

		return () => {
			if ( previewDomRef.current ) {
				removePreviewDom( previewDomRef.current );
				previewDomRef.current = null;
			}
		};
	}, [ isSelected ] );

	/** 現在入力された0-based位置で複製表示だけのRow移動を行う。 */
	const move = () => {
		if ( state.phase === 'committing' ) {
			return;
		}

		if ( ! Array.isArray( attributes.body ) ) {
			throw new Error( 'FTB reorder preview PoC requires FTB body rows.' );
		}

		const fromIndex = Number( fromValue );
		const toIndex = Number( toValue );
		const currentOrder =
			state.phase === 'preview' ? state.rowOrder : attributes.body.map( ( _row, index ) => index );
		const nextOrder = moveItem( currentOrder, fromIndex, toIndex );
		const anchor = anchorRef.current;
		const previewHost = previewHostRef.current;

		if ( ! anchor || ! previewHost ) {
			throw new Error( 'FTB reorder preview PoC requires its Editor DOM anchors.' );
		}

		if ( ! previewDomRef.current ) {
			previewDomRef.current = createPreviewDom( anchor, previewHost, clientId );
		}

		movePreviewRow( previewDomRef.current.previewFigure, fromIndex, toIndex );
		setState( { phase: 'preview', rowOrder: nextOrder } );
	};

	/** 複製表示の最終Row順をFTBの`body`へ1回だけ反映する。 */
	const commitOnce = async () => {
		if ( state.phase !== 'preview' || ! previewDomRef.current ) {
			return;
		}

		if ( ! Array.isArray( attributes.body ) ) {
			throw new Error( 'FTB reorder preview PoC requires FTB body rows.' );
		}

		const editorWindow = previewDomRef.current.previewFigure.ownerDocument.defaultView;
		const data = ( window as PluginWindow ).wp?.data;

		if ( ! editorWindow || ! data ) {
			throw new Error( 'FTB reorder preview PoC requires the WordPress Data API.' );
		}

		const finalBody = state.rowOrder.map( ( originalIndex ) => {
			const row = attributes.body?.[ originalIndex ];

			if ( ! row ) {
				throw new Error( 'FTB reorder preview PoC could not resolve the final FTB row.' );
			}

			return row;
		} );

		setState( { phase: 'committing', rowOrder: state.rowOrder } );
		data.dispatch( BLOCK_EDITOR_STORE ).updateBlockAttributes( clientId, { body: finalBody } );

		await waitForCommitDisplayBoundary( editorWindow );

		if ( previewDomRef.current ) {
			removePreviewDom( previewDomRef.current );
			previewDomRef.current = null;
		}

		setState( { phase: 'idle' } );
	};

	if ( ! isSelected ) {
		return <span aria-hidden="true" ref={ anchorRef } style={ { display: 'none' } } />;
	}

	const controlsDisabled = state.phase === 'committing';
	const commitDisabled = state.phase !== 'preview';
	const fromInputId = `ytr-ftb-reorder-preview-from-${ clientId }`;
	const toInputId = `ytr-ftb-reorder-preview-to-${ clientId }`;

	return (
		<>
			<div
				style={ {
					alignItems: 'end',
					display: 'flex',
					flexWrap: 'wrap',
					gap: '8px',
					marginBlock: '8px',
				} }
			>
				<span aria-hidden="true" ref={ anchorRef } style={ { display: 'none' } } />
				<label htmlFor={ fromInputId }>{ getFtbPreviewFromLabel() }</label>
				<input
					disabled={ controlsDisabled }
					id={ fromInputId }
					min="0"
					onChange={ ( event ) => setFromValue( event.currentTarget.value ) }
					style={ { width: '88px' } }
					type="number"
					value={ fromValue }
				/>
				<label htmlFor={ toInputId }>{ getFtbPreviewToLabel() }</label>
				<input
					disabled={ controlsDisabled }
					id={ toInputId }
					min="0"
					onChange={ ( event ) => setToValue( event.currentTarget.value ) }
					style={ { width: '88px' } }
					type="number"
					value={ toValue }
				/>
				<button disabled={ controlsDisabled } onClick={ move } type="button">
					{ getFtbPreviewMoveLabel() }
				</button>
				<button disabled={ commitDisabled } onClick={ commitOnce } type="button">
					{ getFtbPreviewCommitLabel() }
				</button>
			</div>
			<div ref={ previewHostRef } />
		</>
	);
};

/**
 * Flexible Table Blockだけへ#718のPoC UIを追加するHOC。
 *
 * 正式なReorder Mode接続は変更せず、PoC対象外のBlockには一切介入しない。
 *
 * @param BlockEdit Gutenbergが提供する元のBlockEdit component。
 * @return FTBだけにPoC UIを追加したBlockEdit component。
 */
export const withFtbReorderPreviewPoC = (
	BlockEdit: ComponentType< FlexibleTableBlockEditProps >
) =>
	/**
	 * FTBだけへPoC UIを追加する。
	 *
	 * @param props Gutenbergから渡されるBlockEdit props。
	 * @return 非対象Blockは元の表示、FTBは元の表示とPoC UI。
	 */
	function WithFtbReorderPreviewPoC( props: FlexibleTableBlockEditProps ) {
		if ( props.name !== FLEXIBLE_TABLE_BLOCK ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<>
				<FtbReorderPreviewPoC { ...props } />
				<BlockEdit { ...props } />
			</>
		);
	};