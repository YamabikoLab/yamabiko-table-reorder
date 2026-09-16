/**
 * Column Reorderの現在の有効な挿入位置と、正常なdrop直後の列領域を対象Table上へ描画する。
 *
 * DnD中はDnD Interactionが提供する0-based移動先境界だけを利用し、Presentation独自の移動先補正を持たない。
 * DnD開始時の論理列境界をSession中の基準として固定し、物理移動やスクロールではTable全体の現在位置だけへ追従する。
 * 正常なphysical drop後は、最後に表示していた境界と移動元列の実測幅からdrop位置の列領域を短時間だけ枠で示す。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useRef, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import { useColumnDndDestinationBoundaryIndex } from '@/reorder/column-reorder/integration/dnd-interaction-react';
import { resolveColumnSourceIndex } from '@/reorder/column-reorder/integration/source-column-resolution';
import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
	type ColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import { DND_POST_DROP_COLUMN_OUTLINE_DURATION_MS } from '@/reorder/reorder-tuning';

import './insertion-line.scss';

/** 1回のColumn DnD中に維持する挿入位置表示の論理配置基準。 */
type ColumnInsertionLineSessionLayout = {
	/** スクロール後の現在位置を追従する対象Table。論理列境界の再計測には使用しない。 */
	sourceTable: HTMLTableElement;
	/** DnD開始時にDOMから観測できた論理列境界を、0-based境界位置ごとに固定したTable相対位置。 */
	boundaryOffsets: ReadonlyMap< number, number >;
	/** 移動元セルから開始時に解決した0-based論理列位置。drop後表示に利用できない場合はnull。 */
	sourceColumnIndex: number | null;
	/** DnD開始時の論理列境界から実測した移動元列幅。drop後表示に利用できない場合はnull。 */
	sourceColumnWidth: number | null;
	/** 論理列方向の位置を現在の物理横位置へ変換するためのTable方向。 */
	inlineDirection: ColumnInlineDirection;
	/** 挿入位置表示を現在のeditor contextへ描画するためのdocument。 */
	editorDocument: Document;
	/** 現在のeditor表示領域との重なりを判定するためのwindow。 */
	editorWindow: Window;
};

/** 挿入線を現在のeditor表示領域へ描画するための配置情報。 */
type ColumnInsertionLineLayout = {
	/** 現在のeditor表示領域内で描画を開始する上端位置。 */
	top: number;
	/** 現在の挿入位置を示す物理横位置。 */
	left: number;
	/** 対象Tableと現在のeditor表示領域が重なる縦方向の表示高。 */
	height: number;
	/** DnD Interactionが有効とした0-based移動先境界。 */
	boundaryIndex: number;
	/** 挿入線を配置する現在のeditor document。 */
	editorDocument: Document;
};

/** drop位置の列領域を現在のeditor表示領域へ描画するための配置情報。 */
type ColumnPostDropOutlineLayout = {
	top: number;
	left: number;
	width: number;
	height: number;
	editorDocument: Document;
};

/**
 * 移動元論理列の実測幅を、DnD開始時に観測できた隣接境界から解決する。
 *
 * @param boundaryOffsets   DnD開始時に観測できた論理列境界位置。
 * @param sourceColumnIndex 移動元列の0-based論理列位置。
 * @return 移動元列の実測幅。隣接境界を安全に利用できない場合はnull。
 */
const resolveSourceColumnWidth = (
	boundaryOffsets: ReadonlyMap< number, number >,
	sourceColumnIndex: number | null
): number | null => {
	if ( sourceColumnIndex === null ) {
		return null;
	}

	const sourceStartOffset = boundaryOffsets.get( sourceColumnIndex );
	const sourceEndOffset = boundaryOffsets.get( sourceColumnIndex + 1 );

	/* 移動元列を囲む両境界を開始時DOMから観測できない場合は、列幅を推測しない。 */
	if ( sourceStartOffset === undefined || sourceEndOffset === undefined ) {
		return null;
	}

	const sourceColumnWidth = sourceEndOffset - sourceStartOffset;
	const validSourceColumnWidth = sourceColumnWidth > 0 ? sourceColumnWidth : null;
	return validSourceColumnWidth;
};

/**
 * 移動対象セルから、そのDnD中の挿入位置表示で維持する論理配置を解決する。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 挿入位置表示の基準となる論理配置。Column Reorder対象として成立しない場合はnull。
 */
const resolveInsertionLineSessionLayout = (
	sourceElement: Element | undefined
): ColumnInsertionLineSessionLayout | null => {
	if ( ! sourceElement ) {
		return null;
	}

	const sourceCell = sourceElement.closest( 'th, td' ) as HTMLTableCellElement | null;
	const sourceTable = sourceCell?.closest( 'table' ) as HTMLTableElement | null;

	/* Column Reorderの移動対象セルと対象Tableを確認できない場合は、別DOMから開始時配置を推測しない。 */
	if ( sourceCell === null || sourceTable === null ) {
		return null;
	}

	const editorContext = resolveEditorDomContext( sourceCell );

	/* 現在のeditor contextを解決できない場合は、別の表示環境を代用して描画しない。 */
	if ( editorContext === null ) {
		return null;
	}

	const boundaryGeometry = measureTableColumnBoundaryGeometry( sourceTable );

	/* 論理列境界を確定できないTable状態では、そのDnDの挿入位置表示を成立させない。 */
	if ( boundaryGeometry.length === 0 ) {
		return null;
	}

	const boundaryOffsets = new Map(
		boundaryGeometry.map( ( boundary ) => [ boundary.index, boundary.offset ] )
	);
	const sourceColumnIndex = resolveColumnSourceIndex( sourceTable, sourceCell );

	return {
		sourceTable,
		boundaryOffsets,
		sourceColumnIndex,
		sourceColumnWidth: resolveSourceColumnWidth( boundaryOffsets, sourceColumnIndex ),
		inlineDirection: resolveTableColumnInlineDirection( sourceTable ),
		editorDocument: editorContext.document,
		editorWindow: editorContext.window,
	};
};

/**
 * DnD開始時の論理境界から、現在の挿入線表示位置を解決する。
 *
 * DnD Interactionが有効としたdestination boundaryをPresentation側で補正せず、その境界を現在のTable位置へ変換する。
 * Table自体の現在位置だけを再計測し、スクロールや表示領域の変化へ追従する。
 *
 * @param sessionLayout            DnD開始時に確定した論理配置。
 * @param destinationBoundaryIndex DnD Interactionが有効とした0-based移動先境界。
 * @return 現在のeditor表示領域内へ描画できる挿入線配置。描画できない場合はnull。
 */
const resolveInsertionLineLayout = (
	sessionLayout: ColumnInsertionLineSessionLayout,
	destinationBoundaryIndex: number | null
): ColumnInsertionLineLayout | null => {
	/* DnD Interactionが有効な移動先を持たない期間は、Presentation側で挿入位置を補完しない。 */
	if ( destinationBoundaryIndex === null ) {
		return null;
	}

	const destinationBoundaryOffset = sessionLayout.boundaryOffsets.get( destinationBoundaryIndex );

	/* DnD開始時に観測できなかった論理境界は、表示側で人工的な位置を生成しない。 */
	if ( destinationBoundaryOffset === undefined ) {
		return null;
	}

	const tableRectangle = sessionLayout.sourceTable.getBoundingClientRect();
	let left = tableRectangle.left + destinationBoundaryOffset;

	/* RTLでは論理開始端がTable右端になるため、論理境界を現在の物理横位置へ変換する。 */
	if ( sessionLayout.inlineDirection === 'rtl' ) {
		left = tableRectangle.right - destinationBoundaryOffset;
	}

	const top = Math.max( tableRectangle.top, 0 );
	const bottom = Math.min( tableRectangle.bottom, sessionLayout.editorWindow.innerHeight );
	const height = bottom - top;

	/* 対象Tableと現在表示領域が縦方向に重ならない場合、または境界が横方向の表示領域外なら挿入線を生成しない。 */
	if ( height <= 0 || left < 0 || left > sessionLayout.editorWindow.innerWidth ) {
		return null;
	}

	return {
		top,
		left,
		height,
		boundaryIndex: destinationBoundaryIndex,
		editorDocument: sessionLayout.editorDocument,
	};
};

/**
 * 最後に表示していた挿入境界から、drop位置を示す列領域の枠を解決する。
 *
 * 論理後方への移動では境界の論理開始側、論理前方への移動では境界の論理終了側へ、移動元列の実測幅ぶんだけ領域を展開する。
 * LTR / RTLでは同じ論理方向を対応する物理左右へ変換する。
 * この表示はdrop位置を示すだけで、Table更新成功の判定や更新後DOMの追跡は行わない。
 *
 * @param sessionLayout       DnD開始時に確定した移動元列と論理配置。
 * @param insertionLineLayout drop直前に実際に表示されていた挿入線配置。
 * @return drop位置の列領域を示す枠配置。移動元列の位置または幅が成立しない場合はnull。
 */
const resolvePostDropOutlineLayout = (
	sessionLayout: ColumnInsertionLineSessionLayout,
	insertionLineLayout: ColumnInsertionLineLayout
): ColumnPostDropOutlineLayout | null => {
	const { sourceColumnIndex, sourceColumnWidth } = sessionLayout;

	/* drop位置の列領域を確定できる移動元列位置と実測幅がない場合は、枠を推測して表示しない。 */
	if ( sourceColumnIndex === null || sourceColumnWidth === null || sourceColumnWidth <= 0 ) {
		return null;
	}

	const isMovingForward = insertionLineLayout.boundaryIndex > sourceColumnIndex;
	const outlineExtendsToPhysicalLeft =
		sessionLayout.inlineDirection === 'ltr' ? isMovingForward : ! isMovingForward;
	const left = outlineExtendsToPhysicalLeft
		? insertionLineLayout.left - sourceColumnWidth
		: insertionLineLayout.left;

	return {
		top: insertionLineLayout.top,
		left,
		width: sourceColumnWidth,
		height: insertionLineLayout.height,
		editorDocument: insertionLineLayout.editorDocument,
	};
};

/**
 * DnD中の有効な移動先境界を挿入線として描画し、正常なdrop直後はdrop位置の列領域を短時間だけ枠で示す。
 *
 * DnD開始時の論理境界と移動元列幅をそのSession中の表示基準として維持し、現在のdestination boundaryを直接表示する。
 * scrollは現在のeditor documentで監視し、入力位置が変わらないAuto ScrollでもTableの現在位置へ追従する。
 * cancelまたは有効な挿入線がない終了ではdrop後表示を行わず、DnD終了またはPresentation終了時はSession固有の監視と予約処理を破棄する。
 *
 * @return DnD中の挿入線、または正常なdrop直後の列領域枠。表示位置がない場合はnull。
 */
export const ColumnInsertionLine = () => {
	const destinationBoundaryIndex = useColumnDndDestinationBoundaryIndex();
	const [ sessionLayout, setSessionLayout ] = useState< ColumnInsertionLineSessionLayout | null >(
		null
	);
	const [ measurementRevision, setMeasurementRevision ] = useState( 0 );
	const [ layout, setLayout ] = useState< ColumnInsertionLineLayout | null >( null );
	const [ postDropOutlineLayout, setPostDropOutlineLayout ] =
		useState< ColumnPostDropOutlineLayout | null >( null );
	const postDropTimerRef = useRef< ReturnType< typeof setTimeout > | null >( null );

	/** 前回のdrop後表示が新しい操作へ持ち越されないよう、保留中のtimerを破棄する。 */
	const clearPostDropTimer = () => {
		if ( postDropTimerRef.current === null ) {
			return;
		}

		clearTimeout( postDropTimerRef.current );
		postDropTimerRef.current = null;
	};

	useEffect( () => {
		return () => {
			if ( postDropTimerRef.current !== null ) {
				clearTimeout( postDropTimerRef.current );
				postDropTimerRef.current = null;
			}
		};
	}, [] );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			clearPostDropTimer();
			setPostDropOutlineLayout( null );
			setLayout( null );
			setSessionLayout( resolveInsertionLineSessionLayout( event.operation.source?.element ) );
		},
		onDragMove: () => {
			/* 同じ移動先境界でもスクロール等でTable全体の画面上の位置が変わるため、現在位置を再計測する。 */
			setMeasurementRevision( ( current ) => current + 1 );
		},
		onDragEnd: ( event ) => {
			clearPostDropTimer();

			const postDropLayout =
				! event.canceled && sessionLayout !== null && layout !== null
					? resolvePostDropOutlineLayout( sessionLayout, layout )
					: null;

			setSessionLayout( null );
			setLayout( null );
			setPostDropOutlineLayout( postDropLayout );

			/* cancelまたは有効な列領域を確定できない終了では、drop後表示を開始しない。 */
			if ( postDropLayout === null ) {
				return;
			}

			postDropTimerRef.current = setTimeout( () => {
				setPostDropOutlineLayout( null );
				postDropTimerRef.current = null;
			}, DND_POST_DROP_COLUMN_OUTLINE_DURATION_MS );
		},
	} );

	useEffect( () => {
		if ( sessionLayout === null ) {
			return;
		}

		let animationFrameId: number | null = null;

		/**
		 * Auto Scrollなど入力位置の更新を伴わないスクロールでも、固定した論理配置を現在のTable位置へ再変換する。
		 * 連続するスクロール通知は同じ描画フレームで1回にまとめ、Presentation自身が高頻度なReact更新を追加しない。
		 */
		const requestScrollMeasurement = (): void => {
			if ( animationFrameId !== null ) {
				return;
			}

			animationFrameId = sessionLayout.editorWindow.requestAnimationFrame( () => {
				animationFrameId = null;
				setMeasurementRevision( ( current ) => current + 1 );
			} );
		};

		/* editor内のどのスクロール境界が動いてもTableの現在位置へ追従できるよう、documentのcapture段階で通知を受ける。 */
		sessionLayout.editorDocument.addEventListener( 'scroll', requestScrollMeasurement, true );

		return () => {
			sessionLayout.editorDocument.removeEventListener( 'scroll', requestScrollMeasurement, true );

			/* DnD終了やPresentation境界終了後に予約済み再計測を実行しない。 */
			if ( animationFrameId !== null ) {
				sessionLayout.editorWindow.cancelAnimationFrame( animationFrameId );
			}
		};
	}, [ sessionLayout ] );

	useEffect( () => {
		/* 有効な移動先境界またはDnD開始時の論理配置を確認できない期間は、DnD中の挿入線を表示しない。 */
		if ( sessionLayout === null ) {
			setLayout( null );
			return;
		}

		setLayout( resolveInsertionLineLayout( sessionLayout, destinationBoundaryIndex ) );
	}, [ destinationBoundaryIndex, measurementRevision, sessionLayout ] );

	if ( layout !== null ) {
		const style: CSSProperties = {
			top: layout.top,
			left: layout.left,
			height: layout.height,
		};

		return createPortal(
			<div
				aria-hidden="true"
				className="yamabiko-table-reorder-column-insertion-line"
				style={ style }
			/>,
			layout.editorDocument.body
		);
	}

	/* drop直後の列領域を表示する期間以外は、表示要素自体を生成しない。 */
	if ( postDropOutlineLayout === null ) {
		return null;
	}

	const postDropStyle: CSSProperties = {
		top: postDropOutlineLayout.top,
		left: postDropOutlineLayout.left,
		width: postDropOutlineLayout.width,
		height: postDropOutlineLayout.height,
	};

	return createPortal(
		<div
			aria-hidden="true"
			className="yamabiko-table-reorder-post-drop-column-outline"
			style={ postDropStyle }
		/>,
		postDropOutlineLayout.editorDocument.body
	);
};
