/**
 * WordPress dependencies
 */
const wordpress = require( '@wordpress/eslint-plugin' );

const unitTestFiles = [ 'src/**/*.test.{js,jsx,ts,tsx}' ];
const e2eTestFiles = [ 'tests/e2e/**/*.{js,jsx,ts,tsx}' ];

module.exports = [
	{
		ignores: [
			'build/**',
			'vendor/**',
			'.playwright/**',
			'playwright-report/**',
			'test-results/**',
		],
	},
	{
		linterOptions: {
			reportUnusedDisableDirectives: 'error',
		},
	},
	...wordpress.configs.recommended,
	{
		files: [ 'src/**/*.{js,jsx,ts,tsx}' ],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							regex: '^\\.\\./',
							message: 'Use the @/ alias instead of a parent-relative import.',
						},
					],
				},
			],
		},
	},
	{
		files: [ '**/*.ts', '**/*.tsx' ],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: __dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-deprecated': 'error',
		},
	},
	...wordpress.configs[ 'test-unit' ].map( ( config ) => ( {
		...config,
		files: unitTestFiles,
	} ) ),
	...wordpress.configs[ 'test-playwright' ].map( ( config ) => ( {
		...config,
		files: e2eTestFiles,
	} ) ),
	{
		files: [ 'scripts/version.mjs' ],
		rules: {
			'no-console': 'off',
		},
	},
];
