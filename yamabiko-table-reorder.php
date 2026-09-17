<?php
/**
 * Plugin Name: Yamabiko Table Reorder
 * Description: Table reordering for supported blocks in the WordPress block editor.
 * Version: 0.9.7
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

	private const MCP_CONTRACT_ABILITY = 'yamabiko-table-reorder/get-reorder-contract';

	/**
	 * Registers plugin hooks.
	 */
	public static function init(): void {
		add_action(
			'enqueue_block_editor_assets',
			array( self::class, 'enqueue_editor_assets' )
		);
		add_action(
			'enqueue_block_assets',
			array( self::class, 'enqueue_editor_content_styles' )
		);
		add_action(
			'wp_abilities_api_categories_init',
			array( self::class, 'register_ability_category' )
		);
		add_action(
			'wp_abilities_api_init',
			array( self::class, 'register_reorder_contract_ability' )
		);
		add_action(
			'mcp_adapter_init',
			array( self::class, 'register_mcp_server' )
		);
	}

	/**
	 * Registers the YTR Abilities API category when that API is available.
	 */
	public static function register_ability_category(): void {
		if ( ! function_exists( 'wp_register_ability_category' ) ) {
			return;
		}

		wp_register_ability_category(
			'yamabiko-table-reorder',
			array(
				'label'       => __( 'Yamabiko Table Reorder', 'yamabiko-table-reorder' ),
				'description' => __( 'Read-only contracts for Yamabiko Table Reorder integrations.', 'yamabiko-table-reorder' ),
			)
		);
	}

	/**
	 * Registers the read-only RF command contract used by the focused MCP server.
	 */
	public static function register_reorder_contract_ability(): void {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		wp_register_ability(
			self::MCP_CONTRACT_ABILITY,
			array(
				'label'               => __( 'Get reorder contract', 'yamabiko-table-reorder' ),
				'description'         => __( 'Returns the compact command contract accepted by the Yamabiko Table Reorder chat proof of concept.', 'yamabiko-table-reorder' ),
				'category'            => 'yamabiko-table-reorder',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'properties'           => array(
						'contract' => array( 'type' => 'string' ),
					),
					'required'             => array( 'contract' ),
					'additionalProperties' => false,
				),
				'execute_callback'    => static fn (): array => array(
					'contract' => 'v=1;row=number;column=number|label;position=before|after',
				),
				'permission_callback' => static fn (): bool => current_user_can( 'edit_posts' ),
				'meta'                => array(
					'annotations' => array(
						'readOnlyHint'    => true,
						'destructiveHint' => false,
					),
				),
			)
		);
	}

	/**
	 * Registers a focused MCP server that exposes only the read-only YTR contract ability.
	 *
	 * @param object $adapter MCP Adapter instance supplied by the official adapter plugin.
	 */
	public static function register_mcp_server( object $adapter ): void {
		$http_transport = '\\WP\\MCP\\Transport\\HttpTransport';
		$error_handler   = '\\WP\\MCP\\Infrastructure\\ErrorHandling\\ErrorLogMcpErrorHandler';
		if ( ! method_exists( $adapter, 'create_server' ) || ! class_exists( $http_transport ) || ! class_exists( $error_handler ) ) {
			return;
		}

		$adapter->create_server(
			'yamabiko-table-reorder',
			'yamabiko-table-reorder',
			'mcp',
			'Yamabiko Table Reorder',
			'Read-only Yamabiko Table Reorder integration contract',
			'1.0.0',
			array( $http_transport ),
			$error_handler,
			null,
			array( self::MCP_CONTRACT_ABILITY ),
			array(),
			array()
		);
	}

	/**
	 * Enqueues the formal v1 editor entry when a build is available.
	 */
	public static function enqueue_editor_assets(): void {
		$asset_path = __DIR__ . '/build/index.asset.php';
		$file_path  = __DIR__ . '/build/index.js';

		if ( ! is_readable( $asset_path ) || ! is_readable( $file_path ) ) {
			return;
		}

		$asset = require $asset_path;

		if ( ! is_array( $asset ) ) {
			return;
		}

		$dependencies = isset( $asset['dependencies'] ) && is_array( $asset['dependencies'] )
			? $asset['dependencies']
			: array();
		$version      = isset( $asset['version'] ) && is_string( $asset['version'] )
			? $asset['version']
			: false;
		$handle       = 'yamabiko-table-reorder-index';

		$runtime_handle = self::register_webpack_runtime_script();
		if ( null !== $runtime_handle ) {
			$dependencies[] = $runtime_handle;
		}

		wp_enqueue_script(
			$handle,
			plugins_url( 'build/index.js', __FILE__ ),
			$dependencies,
			$version,
			true
		);

		wp_set_script_translations(
			$handle,
			'yamabiko-table-reorder',
			__DIR__ . '/languages'
		);
	}

	/**
	 * Enqueues presentation styles in the editor content context.
	 *
	 * The stylesheet is limited to administration requests so it is available in both
	 * iframe and non-iframe block editors without affecting the site front end.
	 */
	public static function enqueue_editor_content_styles(): void {
		if ( ! is_admin() ) {
			return;
		}

		$file_path = __DIR__ . '/build/index.css';

		if ( ! is_readable( $file_path ) ) {
			return;
		}

		wp_enqueue_style(
			'yamabiko-table-reorder-index',
			plugins_url( 'build/index.css', __FILE__ ),
			array(),
			(string) filemtime( $file_path )
		);
	}

	/**
	 * Registers the shared Webpack runtime generated by the hot development build.
	 *
	 * @return string|null Runtime handle when the development runtime is available.
	 */
	private static function register_webpack_runtime_script(): ?string {
		$file_path = __DIR__ . '/build/runtime.js';

		if ( ! is_readable( $file_path ) ) {
			return null;
		}

		$handle = 'yamabiko-table-reorder-webpack-runtime';

		wp_register_script(
			$handle,
			plugins_url( 'build/runtime.js', __FILE__ ),
			array(),
			(string) filemtime( $file_path ),
			true
		);

		return $handle;
	}
}

add_action( 'plugins_loaded', array( Plugin::class, 'init' ) );
