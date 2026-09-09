/**
 * 列DnD中の対象Tableに対する水平自動スクロールを所有する。
 *
 * DnD Engineが変換した座標へ依存せず、editor documentと同じ座標系のpointer位置から左右端を判定する。
 * 1回のColumn DnD Sessionで横スクロール対象を固定し、端領域にpointerが留まる間はrequestAnimationFrameで継続する。
 * スクロール限界では不要な更新を停止し、Session終了時には保持中のDOM参照とframeを破棄する。
 */

/** 列DnD中に保持する、editor document基準の現在pointer位置。 */
export type ColumnPointerPosition = {
	clientX: number;
	clientY: number;
};

/** 水平自動スクロールの進行をDnD接続境界へ公開する操作。 */
export type ColumnHorizontalAutoScroll = {
	/**
	 * 1回の列DnDで利用する横スクロール対象を移動元DOMから確定する。
	 *
	 * @param sourceElement DnD Engineが移動対象として管理するDOM要素。
	 */
	start: ( sourceElement: Element | undefined ) => void;
	/**
	 * 現在pointer位置を更新し、必要な場合だけ水平自動スクロールを開始または再開する。
	 *
	 * @param position editor document基準の現在pointer位置。
	 */
	updatePointer: ( position: ColumnPointerPosition ) => void;
	/** 現在の自動スクロールを終了し、次のDnDへ持ち越せない一時状態を破棄する。 */
	stop: () => void;
};

const EDGE_THRESHOLD_RATIO = 0.2;
const SCROLL_STEP_PX = 16;

type ScrollDirection = -1 | 1;

/**
 * 移動元Tableから、Column Reorderが利用する最寄りの横スクロール領域を解決する。
 *
 * block固有classへ依存せず、横方向に実際のoverflowを持つ祖先だけを対象とする。
 *
 * @param sourceElement DnD Engineが移動対象として管理するDOM要素。
 * @return 1回のDnDで固定して利用できる横スクロール領域。対象がない場合はnull。
 */
const resolveHorizontalScrollArea = ( sourceElement: Element | undefined ): HTMLElement | null => {
	const table = sourceElement?.closest( 'table' );
	let candidate = table?.parentElement ?? null;

	/* 対象Tableから外側へ、実際に横スクロールを所有する最寄りの祖先だけを探索する。 */
	while ( candidate !== null ) {
		const view = candidate.ownerDocument.defaultView;
		const overflowX = view?.getComputedStyle( candidate ).overflowX ?? '';
		const allowsHorizontalScroll = [ 'auto', 'scroll', 'overlay' ].includes( overflowX );
		const hasHorizontalOverflow = candidate.scrollWidth > candidate.clientWidth;

		/* Column Reorderの横スクロールを成立させる両条件を満たした最寄りの祖先をSession対象として確定する。 */
		if ( allowsHorizontalScroll && hasHorizontalOverflow ) {
			return candidate;
		}

		candidate = candidate.parentElement;
	}

	return null;
};

/**
 * 現在pointer位置が左右どちらの自動スクロール領域にあるかを解決する。
 *
 * 横端判定は対象スクロール領域内のpointerだけに成立させ、上下方向の移動や領域外位置から縦スクロールを誘発しない。
 *
 * @param scrollArea 1回のDnDで固定した横スクロール領域。
 * @param position   editor document基準の現在pointer位置。
 * @return 左方向は-1、右方向は1。自動スクロール不要な位置はnull。
 */
const resolveScrollDirection = (
	scrollArea: HTMLElement,
	position: ColumnPointerPosition
): ScrollDirection | null => {
	const rectangle = scrollArea.getBoundingClientRect();

	/* 現在pointerが対象領域の縦範囲外にある場合は、横端付近であっても当該Tableの自動スクロール対象にしない。 */
	if ( position.clientY < rectangle.top || position.clientY > rectangle.bottom ) {
		return null;
	}

	const threshold = rectangle.width * EDGE_THRESHOLD_RATIO;

	if ( position.clientX <= rectangle.left + threshold ) {
		return -1;
	}

	if ( position.clientX >= rectangle.right - threshold ) {
		return 1;
	}

	return null;
};

/**
 * 1回のColumn DnD Sessionに対する水平自動スクロール境界を生成する。
 *
 * pointerが端で停止しても継続して横スクロールし、実際にscroll位置が変化したframeだけ呼び出し側へ通知する。
 * スクロール限界、中央領域への移動、DnD終了ではframe予約を停止する。
 *
 * @param onScroll 横スクロールによってTableの画面位置が変化した後に実行する処理。
 * @return DnD開始、pointer更新、終了を接続する操作。
 */
export const createColumnHorizontalAutoScroll = (
	onScroll: ( position: ColumnPointerPosition ) => void
): ColumnHorizontalAutoScroll => {
	let scrollArea: HTMLElement | null = null;
	let latestPointer: ColumnPointerPosition | null = null;
	let frameId: number | null = null;

	const cancelFrame = (): void => {
		if ( frameId === null || scrollArea === null ) {
			frameId = null;
			return;
		}

		scrollArea.ownerDocument.defaultView?.cancelAnimationFrame( frameId );
		frameId = null;
	};

	const runFrame = (): void => {
		frameId = null;

		if ( scrollArea === null || latestPointer === null ) {
			return;
		}

		const direction = resolveScrollDirection( scrollArea, latestPointer );

		/* pointerが端領域を離れた場合は、次のpointer更新まで自動スクロールを継続しない。 */
		if ( direction === null ) {
			return;
		}

		const previousScrollLeft = scrollArea.scrollLeft;
		scrollArea.scrollLeft += direction * SCROLL_STEP_PX;

		/* スクロール限界では同じframe処理を予約し続けず、pointerが再び動くまで停止する。 */
		if ( scrollArea.scrollLeft === previousScrollLeft ) {
			return;
		}

		onScroll( latestPointer );
		frameId = scrollArea.ownerDocument.defaultView?.requestAnimationFrame( runFrame ) ?? null;
	};

	const ensureFrame = (): void => {
		if ( frameId !== null || scrollArea === null || latestPointer === null ) {
			return;
		}

		if ( resolveScrollDirection( scrollArea, latestPointer ) === null ) {
			return;
		}

		frameId = scrollArea.ownerDocument.defaultView?.requestAnimationFrame( runFrame ) ?? null;
	};

	return {
		start: ( sourceElement ) => {
			cancelFrame();
			scrollArea = resolveHorizontalScrollArea( sourceElement );
			latestPointer = null;
		},
		updatePointer: ( position ) => {
			latestPointer = position;
			ensureFrame();
		},
		stop: () => {
			cancelFrame();
			scrollArea = null;
			latestPointer = null;
		},
	};
};
