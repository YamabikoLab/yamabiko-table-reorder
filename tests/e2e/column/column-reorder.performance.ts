import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { expect, test } from '@wordpress/e2e-test-utils-playwright';

import {
	COLUMN_BUTTON,
	insertTable,
	moveMouse,
	pointIn,
	setPreferences,
	startMouseDrag,
	tableAttributes,
	type TableName,
} from './column-reorder';

const REPRESENTATIVE_TABLE_SIZE = { rows: 100, columns: 5 } as const;
const STRESS_TABLE_SIZE = { rows: 1000, columns: 20 } as const;
const IS_STRESS_MEASUREMENT = process.env.E2E_PERFORMANCE_STRESS === '1';
const TABLE_SIZE = IS_STRESS_MEASUREMENT ? STRESS_TABLE_SIZE : REPRESENTATIVE_TABLE_SIZE;
const DESTINATION_COLUMN_INDEX = 3;
const CPU_SAMPLING_INTERVAL_US = 1000;

type CpuProfile = {
	nodes: {
		id: number;
		callFrame: { url: string; functionName: string };
	}[];
	samples?: number[];
	timeDeltas?: number[];
};

test.use( { viewport: { width: 1920, height: 1080 } } );

/**
 * CPU profileのsampleを、性能確認で比較する大まかな実行主体へ分類する。
 * script self timeは処理全体の責任割合ではなく、調査対象を絞るためのsample evidenceとして扱う。
 *
 * @param frame              Chrome Profilerが返すcall frame。
 * @param frame.url
 * @param frame.functionName
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

/**
 * CPU profileのsample時間を実行主体ごとに集計する。
 * Profilerが未知のsampleを返した場合は集計対象外とし、計測本体の成立条件にはしない。
 *
 * @param profile Chrome Profilerの計測結果。
 * @return 実行主体ごとのself time。
 */
function cpuSelfTimeByOwner( profile: CpuProfile ) {
	const nodes = new Map( profile.nodes.map( ( node ) => [ node.id, node ] ) );
	const cpuSelfMs: Record< string, number > = {};
	for ( const [ index, sample ] of ( profile.samples ?? [] ).entries() ) {
		const frame = nodes.get( sample )?.callFrame;
		if ( ! frame ) {
			continue;
		}
		const owner = frameOwner( frame );
		cpuSelfMs[ owner ] =
			( cpuSelfMs[ owner ] ?? 0 ) + ( profile.timeDeltas?.[ index ] ?? 0 ) / 1000;
	}
	return cpuSelfMs;
}

for ( const name of [ 'core/table', 'flexible-table-block/table' ] as TableName[] ) {
	/**
	 * 対応Table Blockで列DnDの各段階と通常のBlock更新を分離して計測できることを確認する。
	 *
	 * 事前条件:
	 * - 性能計測対象のTable規模が選択されている。
	 * - 列の並び替えモードを利用できる。
	 *
	 * 操作:
	 * - 同じTable全体の列移動を通常のBlock更新で実行して基準値を計測する。
	 * - 列の並び替えモード開始、DnD開始、移動中、確定をそれぞれ計測する。
	 *
	 * 期待結果:
	 * - 各段階の経過時間とCPU profileを個別に記録できる。
	 * - DnD確定後に対象列が指定した位置へ移動する。
	 */
	test( `when ${ name } is measured at ${ TABLE_SIZE.rows } x ${ TABLE_SIZE.columns }, should separate the block-update baseline from YTR column drag phases`, async ( {
		admin,
		page,
		editor,
		browser,
	}, testInfo ) => {
		test.setTimeout( 360_000 );
		await admin.createNewPost();
		await setPreferences( page );
		const { canvas, block, rows } = await insertTable(
			page,
			editor,
			name,
			tableAttributes( TABLE_SIZE.rows, TABLE_SIZE.columns )
		);
		await expect( rows ).toHaveCount( TABLE_SIZE.rows );
		const firstRowCells = rows.first().locator( ':scope > td' );
		await expect( firstRowCells ).toHaveCount( TABLE_SIZE.columns );
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
				const cpuSelfMs = cpuSelfTimeByOwner( profile );
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
			// 同じTable全体の同じ列移動を公開WordPress更新だけで行い、Block本体のbaselineを得る。
			await measure( 'baseline-block-update', async () => {
				await page.evaluate(
					( { identity, destinationIndex } ) => {
						const store = window.wp.data.select( 'core/block-editor' );
						const attributes = store.getBlockAttributes( identity );
						const body = attributes.body.map( ( row: { cells: Record< string, unknown >[] } ) => {
							const cells = [ ...row.cells ];
							const [ source ] = cells.splice( 0, 1 );
							cells.splice( destinationIndex, 0, source );
							return { ...row, cells };
						} );
						window.wp.data
							.dispatch( 'core/block-editor' )
							.updateBlockAttributes( identity, { body } );
					},
					{ identity: clientId, destinationIndex: DESTINATION_COLUMN_INDEX }
				);
				await expect( firstRowCells.nth( DESTINATION_COLUMN_INDEX ) ).toContainText( 'R1C1' );
			} );
			// Undoは計測外で同じ開始データへ戻す。
			await page.getByRole( 'button', { name: /^(Undo|元に戻す)$/ } ).click();
			await expect( firstRowCells.first() ).toContainText( 'R1C1' );
			const destination = await pointIn( firstRowCells.nth( DESTINATION_COLUMN_INDEX ), 0.8 );
			await measure( 'mode-entry', async () => {
				await page.getByRole( 'button', { name: COLUMN_BUTTON } ).click();
				await expect( page.getByRole( 'button', { name: COLUMN_BUTTON } ) ).toHaveAttribute(
					'aria-pressed',
					'true'
				);
			} );
			await measure( 'drag-start', async () => {
				await startMouseDrag( page, firstRowCells.first() );
				await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeVisible();
			} );
			await measure( 'drag-progress', async () => {
				await moveMouse( page, destination );
				await expect(
					canvas.locator( '.yamabiko-table-reorder-column-insertion-line' )
				).toBeVisible();
			} );
			await measure( 'drag-commit', async () => {
				await page.mouse.up();
				await expect( firstRowCells.nth( DESTINATION_COLUMN_INDEX ) ).toContainText( 'R1C1' );
				await expect( canvas.locator( '.yamabiko-table-reorder-moving-column' ) ).toBeHidden();
			} );
		} finally {
			await session.detach();
			const summaryPath = testInfo.outputPath( 'performance-summary.json' );
			await writeFile(
				summaryPath,
				JSON.stringify(
					{
						block: name,
						scenario: IS_STRESS_MEASUREMENT ? 'stress' : 'representative',
						rows: TABLE_SIZE.rows,
						columns: TABLE_SIZE.columns,
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
