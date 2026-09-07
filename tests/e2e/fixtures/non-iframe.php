<?php
/**
 * Plugin Name: YTR E2E non-iframe editor fixture
 * Description: Registers a Block API v2 block only for the non-iframe compatibility scenario.
 *
 * @package YamabikoTableReorderE2E
 */

if ( 'non-iframe' !== getenv( 'E2E_EDITOR_MODE' ) ) {
	return;
}

add_action(
	'init',
	static function () {
		register_block_type(
			'ytr-e2e/non-iframe',
			array(
				'api_version'     => 2,
				'title'           => 'YTR E2E non-iframe',
				'category'        => 'text',
				'render_callback' => static function (): string {
					return '';
				},
				'supports'        => array(
					'inserter' => false,
				),
			)
		);
	}
);
