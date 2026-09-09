import { defineConfig } from '@playwright/test';

const baseURL = process.env.WP_BASE_URL ?? process.env.WORDPRESS_URL ?? 'http://127.0.0.1:8080';
const isPerformance = process.env.E2E_PERFORMANCE === '1';

/**
 * 通常E2Eと専用Performance計測を、同じ方向別projectから排他的に選択する。
 * @param suite E2E契約を所有する責務単位。
 * @return 現在の実行目的に対応するtestMatch。
 */
const suiteMatch = ( suite: 'common' | 'row' | 'column' ) => {
	const extension = isPerformance ? 'performance' : 'spec';
	return `**/${ suite }/**/*.${ extension }.ts`;
};

const authenticatedUse = {
	browserName: 'chromium' as const,
	channel: 'chromium',
	storageState: '.playwright/.auth/admin.json',
};

export default defineConfig( {
	testDir: './tests/e2e',
	outputDir: 'test-results',
	timeout: 30_000,
	fullyParallel: false,
	workers: 1,
	reporter: [ [ 'html', { open: 'never', outputFolder: 'playwright-report' } ], [ 'list' ] ],
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	projects: [
		{
			name: 'setup',
			testMatch: '**/auth.setup.ts',
			use: {
				browserName: 'chromium',
				channel: 'chromium',
			},
		},
		{
			name: 'common',
			testMatch: suiteMatch( 'common' ),
			dependencies: [ 'setup' ],
			use: authenticatedUse,
		},
		{
			name: 'row',
			testMatch: suiteMatch( 'row' ),
			dependencies: [ 'setup' ],
			use: authenticatedUse,
		},
		{
			name: 'column',
			testMatch: suiteMatch( 'column' ),
			dependencies: [ 'setup' ],
			use: authenticatedUse,
		},
	],
} );
