/**
 * Column Reorderの現在の有効な挿入位置を、押しのけ表示から独立した垂直線として描画する。
 *
 * 挿入位置そのものはDnD Interactionが提供する0-based移動先境界だけを利用し、Presentation独自の移動先状態を持たない。
 * 挿入線の表示側はオーバーレイの現在の横移動方向へ追従し、左方向では挿入空間の左端、右方向では右端へ表示する。
 * DnD開始時の論理列境界をSession中の基準として固定し、物理移動やスクロールではTable全体の現在位置だけへ追従する。
 */

import { useDragDropMonitor } from '@dnd-kit/react';
import { createPortal, useEffect, useState } from '@wordpress/element';
import type { CSSProperties } from 'react';

import {
	useColumnDndDestinationBoundaryIndex,
	useColumnDndSourceColumnIndex,
} from '@/reorder/column-reorder/integration/dnd-interaction-react';
import {
	measureTableColumnBoundaryGeometry,
	resolveTableColumnInlineDirection,
	type ColumnInlineDirection,
} from '@/reorder/column-reorder/infrastructure/column-geometry';
import { resolveEditorDomContext } from '@/reorder/editor-dom-context';

import './insertion-line.scss';

/** 挿入線の表示側を決める、オーバーレイの現在の横移動方向。 */
type ColumnHorizontalMovementDirection = 'leftward' | 'rightward' | null;

/** 1回のColumn DnD中に維持する、押しのけ前の挿入線配置基準。 */
type ColumnInsertionLineSessionLayout = {
	/** スクロール後の現在位置を追従する対象Table。論理列境界の再計測には使用しない。 */
	sourceTable: HTMLTableElement;
	/** DnD開始時に確定した移動対象1列分の表示幅。 */
	sourceColumnWidth: number;
	/** DnD開始時にDOMから観測できた論理列境界を、0-based境界位置ごとに固定したTable相対位置。 */
	boundaryOffsets: ReadonlyMap< number, number >;
	/** 論理列方向の位置を現在の物理横位置へ変換するためのTable方向。 */
	inlineDirection: ColumnInlineDirection;
	/** 挿入線を現在のeditor contextへ描画するためのdocument。 */
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
	/** 挿入線を配置する現在のeditor document。 */
	editorDocument: Document;
};

/**
 * 移動対象セルから、そのDnD中の挿入線表示で維持する論理配置を解決する。
 *
 * @param sourceElement DnD Engineが現在の移動対象として管理するDOM要素。
 * @return 挿入線の基準となる論理配置。Column Reorder対象として成立しない場合はnull。
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

	const sourceColumnWidth = sourceCell.getBoundingClientRect().width;
	const boundaryGeometry = measureTableColumnBoundaryGeometry( sourceTable );

	/* 移動対象1列分の幅と論理列境界を確定できないTable状態では、そのDnDの挿入線表示を成立させない。 */
	if ( sourceColumnWidth <= 0 || boundaryGeometry.length === 0 ) {
		return null;
	}

	const boundaryOffsets = new Map(
		boundaryGeometry.map( ( boundary ) => [ boundary.index, boundary.offset ] )
	);

	return {
		sourceTable,
		sourceColumnWidth,
		boundaryOffsets,
		inlineDirection: resolveTableColumnInlineDirection( sourceTable ),
		editorDocument: editorContext.document,
		editorWindow: editorContext.window,
	};
};

/**
 * DnD開始時の論理境界と現在の横移動方向から、現在の挿入線表示位置を解決する。
 *
 * 押しのけ後の個別セル位置には追従せず、現在の挿入空間に対して左方向移動では左端、右方向移動では右端を示す。
 * Table自体の現在位置だけを再計測し、スクロールや表示領域の変化へ追従する。
 *
 * @param sessionLayout            DnD開始時に確定した論理配置。
 * @param sourceColumnIndex        DnD InteractionがSession開始時から所有する0-based移動元論理列位置。
 * @param destinationBoundaryIndex DnD Interactionが有効とした0-based移動先境界。
 * @param movementDirection        オーバーレイの現在の横移動方向。未確定時は論理境界をそのまま表示する。
 * @return 現在のeditor表示領域内へ描画できる挿入線配置。描画できない場合はnull。
 */
const resolveInsertionLineLayout = (
	sessionLayout: ColumnInsertionLineSessionLayout,
	sourceColumnIndex: number | null,
	destinationBoundaryIndex: number | null,
	movementDirection: ColumnHorizontalMovementDirection
): ColumnInsertionLineLayout | null => {
	/* DnD Interactionが移動元または有効な移動先を持たない期間は、Presentation側で挿入位置を補完しない。 */
	if ( sourceColumnIndex === null || destinationBoundaryIndex === null ) {
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

	if ( movementDirection !== null ) {
		let logicalGapStartOffset = destinationBoundaryOffset;

		/* 現在の挿入空間はGap表示と同じ論理位置を基準とし、挿入線だけを物理移動方向に応じて左右端へ切り替える。 */
		if ( destinationBoundaryIndex > sourceColumnIndex ) {
			logicalGapStartOffset -= sessionLayout.sourceColumnWidth;
		}

		let gapLeft = tableRectangle.left + logicalGapStartOffset;
		if ( sessionLayout.inlineDirection === 'rtl' ) {
			gapLeft = tableRectangle.right - logicalGapStartOffset - sessionLayout.sourceColumnWidth;
		}

		left = gapLeft;
		if ( movementDirection === 'rightward' ) {
			left += sessionLayout.sourceColumnWidth;
		}
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
		editorDocument: sessionLayout.editorDocument,
	};
};

/**
 * DnD Interactionが示す現在の有効な移動先境界を、対象Table上の挿入線として描画する。
 *
 * DnD開始時の論理境界をそのSession中の表示基準として維持し、DnD Engineの移動通知から現在の横移動方向を更新する。
 * scrollは現在のeditor documentで監視し、入力位置が変わらないAuto ScrollでもTableの現在位置へ追従する。
 *
 * @return 現在の有効な挿入位置を示す垂直線。有効な表示位置がない場合はnull。
 */
export const ColumnInsertionLine = () => {
	const sourceColumnIndex = useColumnDndSourceColumnIndex();
	const destinationBoundaryIndex = useColumnDndDestinationBoundaryIndex();
	const [ sessionLayout, setSessionLayout ] = useState< ColumnInsertionLineSessionLayout | null >(
		null
	);
	const [ movementDirection, setMovementDirection ] =
		useState< ColumnHorizontalMovementDirection >( null );
	const [ measurementRevision, setMeasurementRevision ] = useState( 0 );
	const [ layout, setLayout ] = useState< ColumnInsertionLineLayout | null >( null );

	useDragDropMonitor( {
		onDragStart: ( event ) => {
			setSessionLayout( resolveInsertionLineSessionLayout( event.operation.source?.element ) );
			setMovementDirection( null );
		},
		onDragMove: ( event ) => {
			const nextX = event.to?.x;
			const currentX = event.operation.position.current.x;

			/* 同一移動通知内の更新前後位置から現在方向を確定し、横位置が変わらない通知では直前方向を維持する。 */
			if ( nextX !== undefined && nextX !== currentX ) {
				const nextDirection: ColumnHorizontalMovementDirection =
					nextX < currentX ? 'leftward' : 'rightward';
				setMovementDirection( nextDirection );
			}

			/* 同じ移動先境界でもスクロール等でTable全体の画面上の位置が変わるため、現在位置を再計測する。 */
			setMeasurementRevision( ( current ) => current + 1 );
		},
		onDragEnd: () => {
			/* 物理DnD終了後は、そのSessionの論理配置・移動方向・挿入位置表示を次の操作へ持ち越さない。 */
			setSessionLayout( null );
			setMovementDirection( null );
			setLayout( null );
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
		/* 有効な移動先境界またはDnD開始時の論理配置を確認できない期間は、挿入線を残さない。 */
		if ( sessionLayout === null ) {
			setLayout( null );
			return;
		}

		setLayout(
			resolveInsertionLineLayout(
				sessionLayout,
				sourceColumnIndex,
				destinationBoundaryIndex,
				movementDirection
			)
		);
	}, [
		destinationBoundaryIndex,
		measurementRevision,
		movementDirection,
		sessionLayout,
		sourceColumnIndex,
	] );

	/* 現在描画できる有効な挿入位置がない期間は、表示要素自体を生成しない。 */
	if ( layout === null ) {
		return null;
	}

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
};
