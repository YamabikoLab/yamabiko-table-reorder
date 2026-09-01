/**
 * #714でRow属性更新そのものだけを実Editor上から確認するPure Fast PoC UIを所有する。
 *
 * 計測、描画待機、選択復元、Reorder Mode確認、ログ出力を行わず、選択中TableのRow順変更を
 * 1回のBlock属性更新へ直接渡す最小経路だけを提供する。
 */

/** WordPress Block Editorのdata store名。 */
const BLOCK_EDITOR_STORE = 'core/block-editor';

/** Pure Fast Row commit PoCボタンのDOM id。 */
const PURE_FAST_ROW_BUTTON_ID = 'ytr-pure-fast-row-commit-poc';

/** Pure Fast Row commit PoCで固定して移動する元Row。 */
const PURE_FAST_ROW_FROM_INDEX = 0;

/** Pure Fast Row commit PoCで固定して移動する先Row。 */
const PURE_FAST_ROW_TO_INDEX = 50;

type TableRow = Record< string, unknown >;

type BlockRecord = {
	attributes: {
		body?: TableRow[];
	};
};

type BlockEditorSelector = {
	getBlock: ( clientId: string ) => BlockRecord | null;
	getSelectedBlockClientId: () => string | null;
};

type BlockEditorDispatch = {
	updateBlockAttributes: ( clientId: string, attributes: { body: TableRow[] } ) => void;
};

type WordPressData = {
	dispatch: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorDispatch;
	select: ( storeName: typeof BLOCK_EDITOR_STORE ) => BlockEditorSelector;
};

type PureFastRowCommitPoCWindow = Window &
	typeof globalThis & {
		wp?: {
			data?: WordPressData;
		};
	};

/**
 * 計測やLifecycle処理を挟まず、指定TableのRow 0をRow 50へ移動する。
 *
 * @param clientId 更新対象TableのclientId。
 */
const commitPureFastRow = ( clientId: string ): void => {
	const data = ( window as PureFastRowCommitPoCWindow ).wp?.data;
	const block = data?.select( BLOCK_EDITOR_STORE ).getBlock( clientId );
	const body = block?.attributes.body;

	if ( ! data || ! Array.isArray( body ) || body.length <= PURE_FAST_ROW_TO_INDEX ) {
		return;
	}

	const nextBody = [ ...body ];
	const [ movedRow ] = nextBody.splice( PURE_FAST_ROW_FROM_INDEX, 1 );

	if ( movedRow === undefined ) {
		return;
	}

	nextBody.splice( PURE_FAST_ROW_TO_INDEX, 0, movedRow );
	data.dispatch( BLOCK_EDITOR_STORE ).updateBlockAttributes( clientId, { body: nextBody } );
};

/**
 * Row属性更新だけを直接実行するPure Fast PoCボタンを登録する。
 */
export const registerPureFastRowCommitPoCButton = (): void => {
	if ( document.getElementById( PURE_FAST_ROW_BUTTON_ID ) ) {
		return;
	}

	let pendingClientId: string | null = null;
	const button = document.createElement( 'button' );
	button.id = PURE_FAST_ROW_BUTTON_ID;
	button.type = 'button';
	button.textContent = 'PoC: Pure Fast Row 0→50';
	button.style.position = 'fixed';
	button.style.right = '16px';
	button.style.bottom = '96px';
	button.style.zIndex = '100000';
	button.style.padding = '8px 12px';
	button.style.border = '1px solid currentColor';
	button.style.borderRadius = '4px';
	button.style.background = 'Canvas';
	button.style.color = 'CanvasText';
	button.style.cursor = 'pointer';

	button.addEventListener( 'pointerdown', ( event ) => {
		event.preventDefault();
		event.stopPropagation();
		pendingClientId = ( window as PureFastRowCommitPoCWindow ).wp?.data
			?.select( BLOCK_EDITOR_STORE )
			.getSelectedBlockClientId() ?? null;
	} );

	button.addEventListener( 'click', ( event ) => {
		event.preventDefault();
		event.stopPropagation();

		const clientId = pendingClientId;
		pendingClientId = null;

		if ( clientId !== null ) {
			commitPureFastRow( clientId );
		}
	} );

	document.body.appendChild( button );
};
