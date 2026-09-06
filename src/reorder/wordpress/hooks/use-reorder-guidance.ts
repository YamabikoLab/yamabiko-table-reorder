/**
 * Reorder GuidanceをWordPress EditorとReactへ接続する。
 *
 * 初回案内の表示契機、PC / タッチの操作環境判定、WordPress preferencesによる表示済み状態、
 * Reorder Mode選択時の案内終了をこの境界で接続し、Reorder Guidance本体へWordPress依存を持ち込まない。
 */

import { dispatch, select } from '@wordpress/data';
import { useCallback, useEffect } from '@wordpress/element';
import { useStore } from 'zustand';

import { resolveEditorDomContext } from '@/reorder/editor-dom-context';
import {
	reorderGuidance,
	reorderGuidanceStore,
	type ReorderGuidanceEnvironment,
} from '@/reorder/reorder-guidance';
import { useReorderMode } from '@/reorder/reorder-mode-react';

const PREFERENCE_SCOPE = 'yamabiko-table-reorder';
const PC_PREFERENCE_KEY = 'initialGuidanceAcknowledgedPc';
const TOUCH_PREFERENCE_KEY = 'initialGuidanceAcknowledgedTouch';

type PreferencesSelectors = {
	get: ( scope: string, key: string ) => unknown;
};

type PreferencesActions = {
	set: ( scope: string, key: string, value: unknown ) => void;
};

/**
 * 操作環境に対応する初回案内の表示済み設定名を取得する。
 *
 * @param environment 表示済み状態を確認する操作環境。
 * @return 操作環境ごとに独立したWordPress preferencesの設定名。
 */
const getPreferenceKey = ( environment: ReorderGuidanceEnvironment ): string => {
	const preferenceKey = environment === 'touch' ? TOUCH_PREFERENCE_KEY : PC_PREFERENCE_KEY;
	return preferenceKey;
};

/**
 * 現在のeditor contextから、初回案内を個別に扱う操作環境を解決する。
 *
 * @param referenceElement 現在のeditor contextを特定できるToolbar要素。
 * @return タッチ操作を主とする環境ではtouch、それ以外ではpc。editor contextを解決できない場合はnull。
 */
const resolveGuidanceEnvironment = (
	referenceElement: Element
): ReorderGuidanceEnvironment | null => {
	const editorContext = resolveEditorDomContext( referenceElement );
	if ( editorContext === null ) {
		return null;
	}

	const { window: editorWindow } = editorContext;
	const touchEnvironment =
		typeof editorWindow.matchMedia === 'function' &&
		editorWindow.matchMedia( '(pointer: coarse)' ).matches;
	const environment: ReorderGuidanceEnvironment = touchEnvironment ? 'touch' : 'pc';
	return environment;
};

/**
 * 対象操作環境で初回案内が表示済みか確認する。
 *
 * @param environment 表示済み状態を確認する操作環境。
 * @return その操作環境で初回案内を完了済みの場合はtrue。
 */
const isInitialGuidanceAcknowledged = ( environment: ReorderGuidanceEnvironment ): boolean => {
	const preferences = select( 'core/preferences' ) as unknown as PreferencesSelectors;
	const acknowledged = Boolean(
		preferences.get( PREFERENCE_SCOPE, getPreferenceKey( environment ) )
	);
	return acknowledged;
};

/**
 * 対象操作環境で初回案内を表示済みとして保存する。
 *
 * @param environment 表示済み状態を保存する操作環境。
 */
const acknowledgeInitialGuidance = ( environment: ReorderGuidanceEnvironment ): void => {
	const preferences = dispatch( 'core/preferences' ) as unknown as PreferencesActions;
	preferences.set( PREFERENCE_SCOPE, getPreferenceKey( environment ), true );
};

/**
 * 対象Tableの初回案内をWordPress Editorへ接続する。
 *
 * Toolbar要素が現在のeditor contextで利用可能になった時点で、その操作環境が未表示なら初回案内を開始する。
 * 初回案内中に行または列の並び替え入口が選択された場合は、表示済みとして保存して案内を終了する。
 *
 * @param tableIdentity    初回案内の対象となるTable Identity。
 * @param referenceElement 現在のeditor contextとPopover位置を特定するToolbar要素。
 * @return 対象Tableの初回案内表示状態と、閉じる操作。
 */
export const useReorderGuidance = (
	tableIdentity: string,
	referenceElement: HTMLElement | null
) => {
	const activeGuidance = useStore( reorderGuidanceStore, ( state ) => state.activeGuidance );
	const { selectedKind } = useReorderMode( tableIdentity );
	const guidanceForTable = activeGuidance?.tableIdentity === tableIdentity ? activeGuidance : null;
	const isVisible = guidanceForTable !== null;

	useEffect( () => {
		if ( referenceElement === null || selectedKind !== null ) {
			return;
		}

		const environment = resolveGuidanceEnvironment( referenceElement );
		if ( environment === null || isInitialGuidanceAcknowledged( environment ) ) {
			return;
		}

		reorderGuidance.show( tableIdentity, environment );
	}, [ referenceElement, selectedKind, tableIdentity ] );

	const dismiss = useCallback( () => {
		if ( guidanceForTable === null ) {
			return;
		}

		acknowledgeInitialGuidance( guidanceForTable.environment );
		reorderGuidance.hide( tableIdentity );
	}, [ guidanceForTable, tableIdentity ] );

	useEffect( () => {
		/* 行または列の入口選択は、初回案内を完了した利用者操作として扱う。 */
		if ( selectedKind === null || guidanceForTable === null ) {
			return;
		}

		acknowledgeInitialGuidance( guidanceForTable.environment );
		reorderGuidance.hide( tableIdentity );
	}, [ guidanceForTable, selectedKind, tableIdentity ] );

	return {
		dismiss,
		isVisible,
	};
};
