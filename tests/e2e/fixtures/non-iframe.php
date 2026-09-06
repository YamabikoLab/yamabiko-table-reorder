<?php
/**
 * Plugin Name: YTR E2E non-iframe editor fixture
 * Description: Supplies a classic meta box only for the non-iframe compatibility scenario.
 *
 * @package YamabikoTableReorderE2E
 */

if ( 'non-iframe' !== getenv( 'E2E_EDITOR_MODE' ) ) {
	return;
}

add_action(
	'add_meta_boxes',
	static function () {
		add_meta_box(
			'ytr-e2e-editor-context',
			'YTR E2E editor context',
			static function () {
				echo '<p>Classic meta box compatibility fixture.</p>';
			},
			'post'
		);
	}
);
