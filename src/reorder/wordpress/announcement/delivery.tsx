/**
 * Announcement Deliveryとして、呼び出し元で確定した通知文言をfocusから独立して支援技術へ届ける。
 *
 * 通知する意味、結果の成立性、一回性状態は所有せず、呼び出し元が所有する通知契機を受け取って
 * Browser Accessibility Platformへ公開することだけを担当する。
 */

import { VisuallyHidden } from '@wordpress/components';
import { useEffect, useRef } from '@wordpress/element';

/** Announcement Deliveryへ渡す確定済み文言と、呼び出し元が所有する通知契機。 */
type AnnouncementDeliveryProps = {
	message: string;
	source: object;
};

/**
 * 確定済みの一回分の通知文言をpolite live regionへ公開する。
 *
 * 同じ文言でも呼び出し元が新しい通知契機を渡した場合は、live regionを一度空にしてから再度公開する。
 * Delivery自身は過去の通知、差分、通知ID、Sessionを保持しない。
 *
 * @param props         支援技術へ届ける確定済み通知。
 * @param props.message 呼び出し元で確定した通知文言。
 * @param props.source  呼び出し元が所有する現在評価または一回性結果の参照。
 * @return 支援技術向けの非表示live region。
 */
export const AnnouncementDelivery = ( props: AnnouncementDeliveryProps ) => {
	const { message, source } = props;
	const regionRef = useRef< HTMLSpanElement | null >( null );

	useEffect( () => {
		const region = regionRef.current;
		if ( region === null ) {
			return;
		}

		const view = region.ownerDocument.defaultView;
		if ( view === null ) {
			return;
		}

		/*
		 * 同じ文言の新しい結果も支援技術が変化として認識できるよう、現在の通知だけを一度空にして再公開する。
		 * 過去値との比較や履歴は保持しない。
		 */
		region.textContent = '';
		const timeoutId = view.setTimeout( () => {
			region.textContent = message;
		}, 0 );

		return () => {
			view.clearTimeout( timeoutId );
		};
	}, [ message, source ] );

	return (
		<VisuallyHidden>
			<span ref={ regionRef } aria-atomic="true" aria-live="polite" role="status" />
		</VisuallyHidden>
	);
};
