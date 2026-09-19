<?php
/**
 * Plugin Name: Yamabiko Table Reorder
 * Description: Table reordering for supported blocks in the WordPress block editor.
 * Version: 1.0.0
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

use WordPress\AiClient\AiClient;
use WordPress\AiClient\Providers\Models\DTO\ModelRequirements;
use WordPress\AiClient\Providers\Models\DTO\RequiredOption;
use WordPress\AiClient\Providers\Models\Enums\CapabilityEnum;
use WordPress\AiClient\Providers\Models\Enums\OptionEnum;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Initializes the plugin.
 */
final class Plugin {

	private const MCP_CONTRACT_ABILITY = 'yamabiko-table-reorder/get-reorder-contract';
	private const CHAT_MODELS_ABILITY = 'yamabiko-table-reorder/get-chat-models';
	private const NORMALIZE_REORDER_COMMAND_ABILITY = 'yamabiko-table-reorder/normalize-reorder-command';
	private const CHAT_MAX_TOKENS = 48;
	private const CHAT_SYSTEM_INSTRUCTION = 'Return exactly one line: row <n> <before|after> <n>, column <#n|"label"> <before|after> <#n|"label">, or ask "<short clarification>". Decide row/column, preserve column labels, use 1-based numbers, and return no explanation. Do not decide whether the move is valid for the current table; only normalize the user request.';

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
			array( self::class, 'register_abilities' )
		);
		add_action(
			'mcp_adapter_init',
			array( self::class, 'register_mcp_server' )
		);
	}

	/**
	 * Registers the YTR Abilities API category.
	 */
	public static function register_ability_category(): void {
		wp_register_ability_category(
			'yamabiko-table-reorder',
			array(
				'label'       => __( 'Yamabiko Table Reorder', 'yamabiko-table-reorder' ),
				'description' => __( 'Yamabiko Table Reorder integration abilities.', 'yamabiko-table-reorder' ),
			)
		);
	}

	/**
	 * Registers server-side abilities used by YTR integrations and Chat Reorder.
	 */
	public static function register_abilities(): void {
		self::register_reorder_contract_ability();
		self::register_chat_models_ability();
		self::register_normalize_reorder_command_ability();
	}

	/**
	 * Registers the read-only RF command contract used by the focused MCP server.
	 */
	private static function register_reorder_contract_ability(): void {
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
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
				),
			)
		);
	}

	/**
	 * Registers the read-only model discovery boundary used by Chat Reorder.
	 */
	private static function register_chat_models_ability(): void {
		wp_register_ability(
			self::CHAT_MODELS_ABILITY,
			array(
				'label'               => __( 'Get chat models', 'yamabiko-table-reorder' ),
				'description'         => __( 'Returns the configured AI models available to Chat Reorder.', 'yamabiko-table-reorder' ),
				'category'            => 'yamabiko-table-reorder',
				'input_schema'        => array(
					'type'                 => 'object',
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'properties'           => array(
						'models' => array(
							'type'  => 'array',
							'items' => array(
								'type'                 => 'object',
								'properties'           => array(
									'provider'     => array( 'type' => 'string' ),
									'providerName' => array( 'type' => 'string' ),
									'id'           => array( 'type' => 'string' ),
									'name'         => array( 'type' => 'string' ),
								),
								'required'             => array( 'provider', 'providerName', 'id', 'name' ),
								'additionalProperties' => false,
							),
						),
					),
					'required'             => array( 'models' ),
					'additionalProperties' => false,
				),
				'execute_callback'    => array( self::class, 'get_chat_models' ),
				'permission_callback' => static fn (): bool => current_user_can( 'edit_posts' ),
				'meta'                => array(
					'annotations' => array(
						'readonly'    => true,
						'destructive' => false,
						'idempotent'  => true,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Returns configured AI models that can execute the Chat Reorder prompt contract.
	 *
	 * Provider configuration and model capability discovery remain owned by the WordPress AI Client.
	 *
	 * @return array{models:list<array{provider:string,providerName:string,id:string,name:string}>} Chat model options.
	 */
	public static function get_chat_models(): array {
		$requirements = new ModelRequirements(
			array( CapabilityEnum::textGeneration() ),
			array(
				new RequiredOption( OptionEnum::systemInstruction(), self::CHAT_SYSTEM_INSTRUCTION ),
				new RequiredOption( OptionEnum::maxTokens(), self::CHAT_MAX_TOKENS ),
			)
		);
		$provider_models = AiClient::defaultRegistry()->findModelsMetadataForSupport( $requirements );
		$models          = array();

		foreach ( $provider_models as $provider_models_metadata ) {
			$provider = $provider_models_metadata->getProvider();
			foreach ( $provider_models_metadata->getModels() as $model ) {
				$models[] = array(
					'provider'     => $provider->getId(),
					'providerName' => $provider->getName(),
					'id'           => $model->getId(),
					'name'         => $model->getName(),
				);
			}
		}

		return array( 'models' => $models );
	}

	/**
	 * Registers the server-side AI normalization boundary used by Chat Reorder.
	 */
	private static function register_normalize_reorder_command_ability(): void {
		wp_register_ability(
			self::NORMALIZE_REORDER_COMMAND_ABILITY,
			array(
				'label'               => __( 'Normalize reorder command', 'yamabiko-table-reorder' ),
				'description'         => __( 'Normalizes a natural-language reorder request into the strict RF command text accepted by Yamabiko Table Reorder.', 'yamabiko-table-reorder' ),
				'category'            => 'yamabiko-table-reorder',
				'input_schema'        => array(
					'type'                 => 'object',
					'properties'           => array(
						'input'   => array( 'type' => 'string' ),
						'context' => array( 'type' => 'string' ),
						'model'   => array(
							'type'                 => 'object',
							'properties'           => array(
								'provider' => array( 'type' => 'string' ),
								'id'       => array( 'type' => 'string' ),
							),
							'required'             => array( 'provider', 'id' ),
							'additionalProperties' => false,
						),
					),
					'required'             => array( 'input', 'context' ),
					'additionalProperties' => false,
				),
				'output_schema'       => array(
					'type'                 => 'object',
					'properties'           => array(
						'command' => array( 'type' => 'string' ),
					),
					'required'             => array( 'command' ),
					'additionalProperties' => false,
				),
				'execute_callback'    => array( self::class, 'normalize_reorder_command' ),
				'permission_callback' => static fn (): bool => current_user_can( 'edit_posts' ),
				'meta'                => array(
					'annotations' => array(
						'readonly'    => false,
						'destructive' => false,
						'idempotent'  => false,
					),
					'show_in_rest' => true,
				),
			)
		);
	}

	/**
	 * Normalizes one natural-language request through the WordPress AI Client.
	 *
	 * The AI receives only the user request and compact Table context. It cannot update
	 * Table data and does not decide RF validation, resolution, no-op, or apply results.
	 *
	 * @param array<string, mixed> $input Ability input containing request text and compact Table context.
	 * @return array{command:string}|\WP_Error Normalized untrusted RF Command Text or an AI Client error.
	 */
	public static function normalize_reorder_command( array $input ): array|\WP_Error {
		$request_text = isset( $input['input'] ) && is_string( $input['input'] )
			? trim( $input['input'] )
			: '';
		$context      = isset( $input['context'] ) && is_string( $input['context'] )
			? trim( $input['context'] )
			: '';

		$prompt  = "Request:\n{$request_text}\nTable context:\n{$context}";
		$builder = wp_ai_client_prompt( $prompt )
			->using_system_instruction( self::CHAT_SYSTEM_INSTRUCTION )
			->using_max_tokens( self::CHAT_MAX_TOKENS );

		if ( isset( $input['model'] ) && is_array( $input['model'] ) ) {
			$provider_id = isset( $input['model']['provider'] ) && is_string( $input['model']['provider'] )
				? trim( $input['model']['provider'] )
				: '';
			$model_id    = isset( $input['model']['id'] ) && is_string( $input['model']['id'] )
				? trim( $input['model']['id'] )
				: '';

			if ( '' !== $provider_id && '' !== $model_id ) {
				try {
					$model = AiClient::defaultRegistry()->getProviderModel( $provider_id, $model_id );
				} catch ( \Throwable ) {
					return new \WP_Error(
						'yamabiko_table_reorder_chat_model_unavailable',
						__( 'The selected AI model is unavailable.', 'yamabiko-table-reorder' )
					);
				}
				$builder->using_model( $model );
			}
		}

		$result = $builder->generate_text();

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return array( 'command' => trim( $result ) );
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
			array(
				'in_footer'           => true,
				'module_dependencies' => array(
					'@wordpress/core-abilities',
					'@wordpress/abilities',
				),
			)
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
