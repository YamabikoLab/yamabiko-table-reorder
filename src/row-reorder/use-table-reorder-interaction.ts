/**
 * Table Reorderのinteraction / UI stateをReact側で管理する。
 *
 * hover capability、入力方式、touch並び替えmode、coachmark preferenceを所有し、
 * controller lifecycleやGutenberg notice / setAttributesとは分離する。
 */

import { useRefEffect } from '@wordpress/compose';
import { useDispatch, useSelect } from '@wordpress/data';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';

import { HANDLE_ZONE_CLASS } from './controller/reorder-ui';
import type { ReorderInteractionMode } from './controller/sortable-controller';
import { resolveTableContext, type TableContext } from './table-context';

/** hover操作を利用できる端末を判定するmedia query。 */
const HOVER_REORDER_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';

/** WordPress preferences storeへ保存するscope。 */
const PREFERENCES_SCOPE = 'yamabiko-editor-tools';

/** PC keyboard初回coachmarkのdismiss状態を保存するpreference名。 */
const KEYBOARD_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderKeyboardCoachmarkDismissed';

/** touch初回coachmarkのdismiss状態を保存するpreference名。 */
const TOUCH_COACHMARK_DISMISSED_PREFERENCE = 'tableReorderTouchCoachmarkDismissed';

/** 入力方式の判定に使わない修飾キー。 */
const MODIFIER_KEYS = new Set( [ 'Alt', 'Control', 'Meta', 'Shift' ] );

/** interaction hook内で扱う入力方式。 */
type InputModality = 'keyboard' | 'pointer';

/** WordPress preferences selectorの利用部分。 */
type PreferencesSelector = {
	get: ( scope: string, name: string ) => unknown;
};

/** WordPress preferences actionsの利用部分。 */
type PreferencesActions = {
	set: ( scope: string, name: string, value: unknown ) => Promise< unknown > | unknown;
};

/** WordPress block editor actionsの利用部分。 */
type BlockEditorActions = {
	selectBlock: ( clientId: string ) => void;
};

/** interaction hookへ渡すTable block側の入力。 */
type UseTableReorderInteractionOptions = {
	clientId: string;
	enabled: boolean;
	isSelected: boolean;
};

/** interaction hookが親へ公開するstate / command。 */
type TableReorderInteraction = {
	anchorRef: ( anchor: HTMLSpanElement | null ) => void;
	consumeTouchToolbarFocusRequest: () => void;
	dismissKeyboardCoachmark: () => void;
	dismissTouchCoachmark: () => void;
	interactionMode: ReorderInteractionMode | null;
	isHoverCapable: boolean;
	isKeyboardCoachmarkVisible: boolean;
	isTouchCoachmarkVisible: boolean;
	isTouchReorderMode: boolean;
	isTouchToolbarFocusRequested: boolean;
	toggleTouchReorderMode: () => void;
};

/**
 * Table Reorderのhover / input / touch mode / coachmark stateを所有する。
 *
 * @param options interaction判定に必要なclientId、plugin有効状態、block選択状態。
 * @return hidden anchor用ref、controller mode、HOCが利用するinteraction state / command。
 */
export const useTableReorderInteraction = (
	options: UseTableReorderInteractionOptions
): TableReorderInteraction => {
	const { clientId, enabled, isSelected } = options;
	const preferencesActions = useDispatch( 'core/preferences' ) as unknown as PreferencesActions;
	const { selectBlock } = useDispatch( 'core/block-editor' ) as unknown as BlockEditorActions;
	const isKeyboardCoachmarkDismissed = useSelect( ( registrySelect ) => {
		const preferences = registrySelect( 'core/preferences' ) as unknown as PreferencesSelector;
		return preferences.get( PREFERENCES_SCOPE, KEYBOARD_COACHMARK_DISMISSED_PREFERENCE ) === true;
	}, [] );
	const isTouchCoachmarkDismissed = useSelect( ( registrySelect ) => {
		const preferences = registrySelect( 'core/preferences' ) as unknown as PreferencesSelector;
		return preferences.get( PREFERENCES_SCOPE, TOUCH_COACHMARK_DISMISSED_PREFERENCE ) === true;
	}, [] );
	const [ isHoverCapable, setIsHoverCapable ] = useState(
		() => window.matchMedia( HOVER_REORDER_MEDIA_QUERY ).matches
	);
	const [ inputModality, setInputModality ] = useState< InputModality >( 'pointer' );
	const inputModalityRef = useRef< InputModality >( 'pointer' );
	const [ isKeyboardCoachmarkTriggered, setIsKeyboardCoachmarkTriggered ] = useState( false );
	const [ isKeyboardCoachmarkDismissedLocally, setIsKeyboardCoachmarkDismissedLocally ] =
		useState( false );
	const hasKeyboardCoachmarkBeenVisibleRef = useRef( false );
	const [ isTouchCoachmarkDismissedLocally, setIsTouchCoachmarkDismissedLocally ] =
		useState( false );
	const [ isTouchReorderMode, setIsTouchReorderMode ] = useState( false );
	const [ isTouchToolbarFocusRequested, setIsTouchToolbarFocusRequested ] = useState( false );
	const hasHandledInitialTouchGestureRef = useRef( false );
	const suppressNextTableClickRef = useRef( false );
	const currentContextRef = useRef< TableContext | null >( null );

	const isKeyboardCoachmarkVisible =
		enabled &&
		isSelected &&
		isHoverCapable &&
		isKeyboardCoachmarkTriggered &&
		! isKeyboardCoachmarkDismissed &&
		! isKeyboardCoachmarkDismissedLocally;
	const isTouchCoachmarkVisible =
		enabled &&
		isSelected &&
		! isHoverCapable &&
		! isTouchReorderMode &&
		! isTouchCoachmarkDismissed &&
		! isTouchCoachmarkDismissedLocally;

	useEffect( () => {
		if ( ! enabled ) {
			return;
		}

		const hoverMedia = window.matchMedia( HOVER_REORDER_MEDIA_QUERY );
		const syncHoverCapability = () => {
			setIsHoverCapable( hoverMedia.matches );
			if ( hoverMedia.matches ) {
				setIsTouchReorderMode( false );
			}
		};

		syncHoverCapability();
		hoverMedia.addEventListener( 'change', syncHoverCapability );
		return () => {
			hoverMedia.removeEventListener( 'change', syncHoverCapability );
		};
	}, [ enabled ] );

	useEffect( () => {
		if ( isKeyboardCoachmarkVisible ) {
			hasKeyboardCoachmarkBeenVisibleRef.current = true;
		}
	}, [ isKeyboardCoachmarkVisible ] );

	const bindDocumentListeners = useCallback(
		( targetDocument: Document, getContext: () => TableContext | null ) => {
			const isTargetInsideTable = ( target: EventTarget | null ) => {
				const node = target as Node | null;
				const table = getContext()?.tbody.closest( 'table' );
				return Boolean( node && table?.contains( node ) );
			};
			const onKeyDown = ( event: KeyboardEvent ) => {
				if ( ! MODIFIER_KEYS.has( event.key ) ) {
					inputModalityRef.current = 'keyboard';
					setInputModality( 'keyboard' );
				}
			};
			const onPointerDown = ( event: PointerEvent ) => {
				inputModalityRef.current = 'pointer';
				setInputModality( 'pointer' );

				if (
					hasHandledInitialTouchGestureRef.current ||
					isHoverCapable ||
					isTouchCoachmarkDismissed ||
					isTouchCoachmarkDismissedLocally ||
					! isTargetInsideTable( event.target )
				) {
					return;
				}

				hasHandledInitialTouchGestureRef.current = true;
				event.preventDefault();
				event.stopPropagation();
				suppressNextTableClickRef.current = true;
				setIsTouchToolbarFocusRequested( true );
				if ( ! isSelected ) {
					selectBlock( clientId );
				}
			};
			const onClick = ( event: MouseEvent ) => {
				if ( ! suppressNextTableClickRef.current || ! isTargetInsideTable( event.target ) ) {
					return;
				}

				suppressNextTableClickRef.current = false;
				event.preventDefault();
				event.stopPropagation();
			};
			const onFocusIn = ( event: FocusEvent ) => {
				const target = event.target as Element | null;
				if ( ! target?.classList.contains( HANDLE_ZONE_CLASS ) ) {
					return;
				}

				if (
					inputModalityRef.current !== 'keyboard' ||
					! hasKeyboardCoachmarkBeenVisibleRef.current
				) {
					return;
				}

				setIsKeyboardCoachmarkTriggered( false );
				setIsKeyboardCoachmarkDismissedLocally( true );
				void preferencesActions.set(
					PREFERENCES_SCOPE,
					KEYBOARD_COACHMARK_DISMISSED_PREFERENCE,
					true
				);
			};

			targetDocument.addEventListener( 'keydown', onKeyDown, true );
			targetDocument.addEventListener( 'pointerdown', onPointerDown, true );
			targetDocument.addEventListener( 'click', onClick, true );
			targetDocument.addEventListener( 'focusin', onFocusIn, true );

			return () => {
				targetDocument.removeEventListener( 'keydown', onKeyDown, true );
				targetDocument.removeEventListener( 'pointerdown', onPointerDown, true );
				targetDocument.removeEventListener( 'click', onClick, true );
				targetDocument.removeEventListener( 'focusin', onFocusIn, true );
			};
		},
		[
			clientId,
			isHoverCapable,
			isSelected,
			isTouchCoachmarkDismissed,
			isTouchCoachmarkDismissedLocally,
			preferencesActions,
			selectBlock,
		]
	);

	useEffect( () => {
		if ( ! enabled ) {
			return;
		}

		return bindDocumentListeners( window.document, () => currentContextRef.current );
	}, [ bindDocumentListeners, enabled ] );

	const anchorRef = useRefEffect(
		( anchor: HTMLSpanElement ) => {
			if ( ! enabled ) {
				return;
			}

			const context = resolveTableContext( anchor, clientId );
			currentContextRef.current = context;
			if ( ! context ) {
				return () => {
					currentContextRef.current = null;
				};
			}

			const unbindEditorListeners =
				context.document === window.document
					? undefined
					: bindDocumentListeners( context.document, () => context );

			return () => {
				unbindEditorListeners?.();
				if ( currentContextRef.current === context ) {
					currentContextRef.current = null;
				}
			};
		},
		[ bindDocumentListeners, clientId, enabled ]
	);

	useEffect( () => {
		if ( ! isSelected ) {
			setIsTouchReorderMode( false );
		}
	}, [ isSelected ] );

	useEffect( () => {
		if (
			! enabled ||
			! isSelected ||
			! isHoverCapable ||
			isKeyboardCoachmarkDismissed ||
			isKeyboardCoachmarkDismissedLocally
		) {
			setIsKeyboardCoachmarkTriggered( false );
			return;
		}

		if ( inputModality === 'keyboard' ) {
			setIsKeyboardCoachmarkTriggered( true );
		}
	}, [
		enabled,
		inputModality,
		isHoverCapable,
		isKeyboardCoachmarkDismissed,
		isKeyboardCoachmarkDismissedLocally,
		isSelected,
	] );

	const dismissKeyboardCoachmark = () => {
		setIsKeyboardCoachmarkTriggered( false );
		setIsKeyboardCoachmarkDismissedLocally( true );
		void preferencesActions.set( PREFERENCES_SCOPE, KEYBOARD_COACHMARK_DISMISSED_PREFERENCE, true );
	};

	const dismissTouchCoachmark = () => {
		setIsTouchCoachmarkDismissedLocally( true );
		void preferencesActions.set( PREFERENCES_SCOPE, TOUCH_COACHMARK_DISMISSED_PREFERENCE, true );
	};

	let interactionMode: ReorderInteractionMode | null = null;
	if ( isHoverCapable ) {
		interactionMode = 'hover';
	} else if ( isSelected && isTouchReorderMode ) {
		interactionMode = 'touch';
	}

	return {
		anchorRef,
		consumeTouchToolbarFocusRequest: () => {
			setIsTouchToolbarFocusRequested( false );
		},
		dismissKeyboardCoachmark,
		dismissTouchCoachmark,
		interactionMode,
		isHoverCapable,
		isKeyboardCoachmarkVisible,
		isTouchCoachmarkVisible,
		isTouchReorderMode,
		isTouchToolbarFocusRequested,
		toggleTouchReorderMode: () => {
			setIsTouchReorderMode( ( isActive ) => ! isActive );
		},
	};
};
