<?php
/**
 * Plugin Name: Yamabiko Table Reorder
 * Description: Accessible table row reordering for supported blocks in the WordPress block editor.
 * Version: 0.4.0
 * Requires at least: 6.8
 * Requires PHP: 8.1
 * Author: YamabikoLab
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: yamabiko-table-reorder
 *
 * @package YamabikoTableReorder
 */

declare(strict_types=1);

namespace YamabikoLab\TableReorder;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Initializes the plugin.
 */
final class Plugin {

	/**
	 * Registers plugin hooks.
	 */
	public static function init(): void {
		add_action(
			'enqueue_block_editor_assets',
			array( self::class, 'enqueue_table_reorder_editor_assets' )
		);
		add_action(
			'enqueue_block_assets',
			array( self::class, 'enqueue_table_reorder_editor_styles' )
		);
	}

	/**
	 * Enqueues Table Reorder assets for the editor.
	 */
	public static function enqueue_table_reorder_editor_assets(): void {
		$handle = self::enqueue_table_reorder_script();

		if ( null === $handle ) {
			return;
		}

		wp_set_script_translations(
			$handle,
			'yamabiko-table-reorder',
			__DIR__ . '/languages'
		);
		self::add_table_reorder_runtime_config( $handle );
	}

	/**
	 * Enqueues the generated Table Reorder stylesheet for editor content.
	 */
	public static function enqueue_table_reorder_editor_styles(): void {
		if ( ! is_admin() ) {
			return;
		}

		$file_path = __DIR__ . '/build/index.css';
		if ( ! is_readable( $file_path ) ) {
			return;
		}

		wp_enqueue_style(
			'yamabiko-table-reorder-style',
			plugins_url( 'build/index.css', __FILE__ ),
			array( 'wp-components' ),
			(string) filemtime( $file_path )
		);
	}