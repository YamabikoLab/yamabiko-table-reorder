import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';

import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	insertTable,
	moveMouse,
	pointIn,
	ROW_BUTTON,
	setPreferences,
	startMouseDrag,
	tableAttributes,
	type TableName,
} from './row-reorder';

const TABLE_ROWS = 100;
const TABLE_COLUMNS = 5;
const DESTINATION_ROW_INDEX = 3;
const CPU_SAMPLING_INTERVAL_US = 1000;

test.use( { viewport: { width: 1920, height: 1080 } } );

/**
 * CPU profileのsampleを、性能確認で比較する大まかな実行主体へ分類する。
 * script self timeは処理全体の責任割合ではなく、調査対象を絞るためのsample evidenceとして扱う。
 *
 * @param frame Chrome Profilerが返すcall frame。
 * @return 集計先の実行主体。
 */
function frameOwner( frame: { url: string; functionName: string } ) {
	if ( frame.url.includes( '/yamabiko-table-reorder/' ) ) {
		return 'YTR including bundled dnd-kit';
	}
	if (
		frame.url.includes( '/flexible-table-block/' ) ||
		frame.url.includes( '/wp-includes/js/dist/block-library' )
	) {
		return 'Table Block';
	}
	if ( frame.functionName === '(idle)' ) {
		return 'idle';
	}
	return 'WordPress / browser / other';
}

for ( const name of [ 'core/table', 'flexible-table-block/table' ] as TableName[] ) {
	test( `${ name } ${ TABLE_ROWS } x ${ TABLE_COLUMNS } separates block updates from YTR drag phases`, async ( {
		admin,
		page,
		editor,
		browser,
	}, testInfo ) => {
		test.setTimeout( 240_000 );
		await admin.createNewPost();
		await setPreferences( page );
		const { canvas, block, rows } = await insertTable(
			page,
			editor,
			name,
			tableAttributes( TABLE_ROWS, TABLE_COLUMNS )
		);
		await expect( rows ).toHaveCount( TABLE_ROWS );
		const clientId = ( await block.getAttribute( 'data-block' ) )!;
		const session = await page.context().newCDPSession( page );
		await session.send( 'Profiler.enable' );
		await session.send( 'Profiler.setSamplingInterval', {
			interval: CPU_SAMPLING_INTERVAL_US,
		} );
		const measurements: {
			phase: string;
			wallMs: number;
			cpuSelfMs: Record< string, number >;
		}[] = [];

		async function measure( phase: string, operation: () => Promise< void > ) {
			await session.send( 'Profiler.start' );
			const started = performance.now();
			try {
				await operation();
			} finally {
				const wallMs = performance.now() - started;
				const { profile } = await session.send( 'Profiler.stop' );
				const nodes = new Map( profile.nodes.map( ( node ) => [ node.id, node ] ) );
				const cpuSelfMs: Record< string, number > = {};
				for ( const [ index, sample ] of ( profile.samples ?? [] ).entries() ) {
					const frame = nodes.get( sample )?.callFrame;
					if ( ! frame ) {
						continue;
					}
					const owner = frameOwner( frame );
					cpuSelfMs[ owner ] =
						( cpuSelfMs[ owner ] ?? 0 ) +
						( profile.timeDeltas?.[ index ] ?? 0 ) / 1000;
				}
				measurements.push( { phase, wallMs, cpuSelfMs } );
				const profilePath = testInfo.outputPath( `${ phase }.cpuprofile` );
				await writeFile( profilePath, JSON.stringify( profile ) );
				await testInfo.attach( `${ phase }.cpuprofile`, {
					path: profilePath,
					contentType: 'application/json',
				} );
			}
		}

		try {
			// 同じTableの同じ行移動を公開WordPress更新だけで行い、Block本体のbaselineを得る。
			await measure( 'baseline-block-update', async () => {
				await page.evaluate( ( identity ) => {
					const store = window.wp.data.select( 'core/block-editor' );
					const body = [ ...store.getBlockAttributes( identity ).body ];
					const [ source ] = body.splice( 0, 1 );
					body.splice( 3, 0, source );
					window.wp.data
						.dispatch( 'core/block-editor' )
						.updateBlockAttributes( identity, { body } );
				}, clientId );
				await expect( rows.nth( DESTINATION_ROW_INDEX ) ).toContainText( 'Row 1' );
			} );
			// Undoは計測外で同じ開始データへ戻す。
			await page.getByRole( 'button', { name: /^(Undo|元に戻す)$/ } ).click();
			await expect( rows.first() ).toContainText( 'Row 1' );
			const destination = await pointIn( rows.nth( DESTINATION_ROW_INDEX ), 0.8 );
			await measure( 'mode-entry', async () => {
				await page.getByRole( 'button', { name: ROW_BUTTON } ).click();
				await expect( page.getByRole( 'button', { name: ROW_BUTTON } ) ).toHaveAttribute(
					'aria-pressed',
					'true'
				);
			} );
			await measure( 'drag-start', async () => {
				await startMouseDrag( page, rows.first() );
				await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeVisible();
			} );
			await measure( 'drag-progress', async () => {
				await moveMouse( page, destination );
				await expect( canvas.locator( '.yamabiko-table-reorder-insertion-line' ) ).toBeVisible();
			} );
			await measure( 'drag-commit', async () => {
				await page.mouse.up();
				await expect( rows.nth( DESTINATION_ROW_INDEX ) ).toContainText( 'Row 1' );
				await expect( canvas.locator( '.yamabiko-table-reorder-moving-row' ) ).toBeHidden();
			} );
		} finally {
			await session.detach();
			const summaryPath = testInfo.outputPath( 'performance-summary.json' );
			await writeFile(
				summaryPath,
				JSON.stringify(
					{
						block: name,
						rows: TABLE_ROWS,
						columns: TABLE_COLUMNS,
						cpuSamplingIntervalUs: CPU_SAMPLING_INTERVAL_US,
						browser: browser.version(),
						editorMode:
							( await page.locator( 'iframe[name="editor-canvas"]' ).count() ) > 0
								? 'iframe'
								: 'non-iframe',
						measurements,
					},
					null,
					2
				)
			);
			await testInfo.attach( 'performance-summary.json', {
				path: summaryPath,
				contentType: 'application/json',
			} );
		}
	} );
}
