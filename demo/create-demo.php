<?php
require_once '/wordpress/wp-load.php';

$page_id = 100;

if ( get_post( $page_id ) ) {
	wp_delete_post( $page_id, true );
}

$core_rows = [
	[ 1, 'Mount Everest', '8,848.86 m', 'Nepal / China' ],
	[ 2, 'K2', '8,611 m', 'Pakistan / China' ],
	[ 3, 'Kangchenjunga', '8,586 m', 'Nepal / India' ],
	[ 4, 'Lhotse', '8,516 m', 'Nepal / China' ],
	[ 5, 'Makalu', '8,485 m', 'Nepal / China' ],
	[ 6, 'Cho Oyu', '8,188 m', 'Nepal / China' ],
	[ 7, 'Dhaulagiri I', '8,167 m', 'Nepal' ],
	[ 8, 'Manaslu', '8,163 m', 'Nepal' ],
	[ 9, 'Nanga Parbat', '8,126 m', 'Pakistan' ],
	[ 10, 'Annapurna I', '8,091 m', 'Nepal' ],
	[ 11, 'Gasherbrum I', '8,080 m', 'Pakistan / China' ],
	[ 12, 'Broad Peak', '8,051 m', 'Pakistan / China' ],
	[ 13, 'Gasherbrum II', '8,035 m', 'Pakistan / China' ],
	[ 14, 'Shishapangma', '8,027 m', 'China' ],
	[ 15, 'Gyachung Kang', '7,952 m', 'Nepal / China' ],
	[ 16, 'Annapurna II', '7,937 m', 'Nepal' ],
	[ 17, 'Gasherbrum IV', '7,932 m', 'Pakistan' ],
	[ 18, 'Himalchuli', '7,893 m', 'Nepal' ],
	[ 19, 'Distaghil Sar', '7,885 m', 'Pakistan' ],
	[ 20, 'Ngadi Chuli', '7,871 m', 'Nepal' ],
	[ 21, 'Nuptse', '7,861 m', 'Nepal' ],
	[ 22, 'Khunyang Chhish', '7,852 m', 'Pakistan' ],
	[ 23, 'Masherbrum', '7,821 m', 'Pakistan' ],
	[ 24, 'Nanda Devi', '7,816 m', 'India' ],
	[ 25, 'Chomo Lonzo', '7,804 m', 'China' ],
	[ 26, 'Batura Sar', '7,795 m', 'Pakistan' ],
	[ 27, 'Rakaposhi', '7,788 m', 'Pakistan' ],
	[ 28, 'Namcha Barwa', '7,782 m', 'China' ],
	[ 29, 'Kanjut Sar', '7,760 m', 'Pakistan' ],
	[ 30, 'Kamet', '7,756 m', 'India' ],
];

function yamabiko_table_reorder_demo_build_core_table_rows( array $rows ) {
	$table_rows = '';

	foreach ( $rows as $row ) {
		[ $number, $mountain, $height, $location ] = $row;

		if ( 7 === $number ) {
			$table_rows .= sprintf(
				'<tr><td>%d</td><td>%s</td><td>%s</td><td rowspan="2">%s</td><td>Vertical merge (location)</td></tr>',
				$number,
				esc_html( $mountain ),
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		if ( 8 === $number ) {
			$table_rows .= sprintf(
				'<tr><td>%d</td><td>%s</td><td>%s</td><td>Vertical merge (location)</td></tr>',
				$number,
				esc_html( $mountain ),
				esc_html( $height )
			);
			continue;
		}

		if ( 14 === $number ) {
			$table_rows .= sprintf(
				'<tr><td>%d</td><td colspan="2"><strong>%s</strong> / %s</td><td>%s</td><td>Horizontal merge (mountain + elevation)</td></tr>',
				$number,
				esc_html( $mountain ),
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		$table_rows .= sprintf(
			'<tr><td>%d</td><td>%s</td><td>%s</td><td>%s</td><td></td></tr>',
			$number,
			esc_html( $mountain ),
			esc_html( $height ),
			esc_html( $location )
		);
	}

	return $table_rows;
}

$core_table_rows = yamabiko_table_reorder_demo_build_core_table_rows( $core_rows );
$core_table      =
	'<!-- wp:table {"align":"wide"} -->' .
	'<figure class="wp-block-table alignwide"><table class="has-fixed-layout">' .
	'<thead><tr><th scope="col">No.</th><th scope="col">Mountain</th><th scope="col">Elevation</th><th scope="col">Location</th><th scope="col">Notes</th></tr></thead>' .
	'<tbody>' . $core_table_rows . '</tbody>' .
	'</table><figcaption class="wp-element-caption">30 Mountains of the World / WordPress Core Table Demo</figcaption></figure>' .
	'<!-- /wp:table -->';

$flexible_rows = [
	[ 1, '<strong>Mount Fuji</strong>', '3,776 m', 'Yamanashi / Shizuoka' ],
	[ 2, '<em>Mount Kita</em>', '3,193 m', 'Yamanashi' ],
	[ 3, '<a href="https://en.wikipedia.org/wiki/Mount_Hotaka">Mount Okuhotaka</a>', '3,190 m', 'Nagano / Gifu' ],
	[ 4, '<code>Mount Aino</code>', '3,190 m', 'Yamanashi / Shizuoka' ],
	[ 5, '<s>Mount Yari</s>', '3,180 m', 'Nagano / Gifu' ],
	[ 6, 'Mount Akaishi<br>Akaishi-dake', '3,121 m', 'Nagano / Shizuoka' ],
	[ 7, 'Mount Karasawa', '3,110 m', 'Nagano / Gifu' ],
	[ 8, 'Mount Kitahotaka', '3,106 m', 'Nagano / Gifu' ],
	[ 9, 'Mount Obami', '3,101 m', 'Nagano / Gifu' ],
	[ 10, 'Mount Maehotaka', '3,090 m', 'Nagano' ],
	[ 11, 'Mount Naka', '3,084 m', 'Nagano / Gifu' ],
	[ 12, 'Mount Arakawa-Naka', '3,084 m', 'Shizuoka' ],
	[ 13, 'Mount Ontake', '3,067 m', 'Nagano / Gifu' ],
	[ 14, 'Mount Shiomi', '3,052 m', 'Nagano / Shizuoka' ],
	[ 15, 'Mount Minami', '3,033 m', 'Nagano / Gifu' ],
	[ 16, 'Mount Senjo', '3,033 m', 'Yamanashi / Nagano' ],
	[ 17, 'Mount Norikura', '3,026 m', 'Nagano / Gifu' ],
	[ 18, 'Mount Notori', '3,026 m', 'Yamanashi / Shizuoka' ],
	[ 19, 'Mount Tate (Onanji)', '3,015 m', 'Toyama' ],
	[ 20, 'Mount Hijiri', '3,013 m', 'Nagano / Shizuoka' ],
	[ 21, 'Mount Tsurugi', '2,999 m', 'Toyama' ],
	[ 22, 'Mount Suisho', '2,986 m', 'Toyama' ],
	[ 23, 'Mount Kaikoma', '2,967 m', 'Yamanashi / Nagano' ],
	[ 24, 'Mount Kisokoma', '2,956 m', 'Nagano' ],
	[ 25, 'Mount Shirouma', '2,932 m', 'Nagano / Toyama' ],
	[ 26, 'Mount Yakushi', '2,926 m', 'Toyama' ],
	[ 27, 'Mount Washiba', '2,924 m', 'Nagano / Toyama' ],
	[ 28, 'Mount Otensho', '2,922 m', 'Nagano' ],
	[ 29, 'Mount Nishihotaka', '2,909 m', 'Nagano / Gifu' ],
	[ 30, 'Mount Kashimayari', '2,889 m', 'Nagano / Toyama' ],
];

function yamabiko_table_reorder_demo_build_flexible_table_rows( array $rows ) {
	$table_rows = '';

	foreach ( $rows as $row ) {
		[ $number, $mountain, $height, $location ] = $row;

		if ( 7 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td>%s</td><td>%s</td><td rowspan="2">%s</td><td>Vertical merge (location, rows 7-8)</td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		if ( 8 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td>%s</td><td>%s</td><td>Vertical merge (location, rows 7-8)</td></tr>',
				$number,
				$mountain,
				esc_html( $height )
			);
			continue;
		}

		if ( 9 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td class="demo-mountain-cell">%s</td><td>%s</td><td>%s</td><td></td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		if ( 10 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td style="font-weight:600;background-color:#f0f6fc">%s</td><td>%s</td><td>%s</td><td></td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		if ( 14 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td colspan="2" class="demo-merged-cell"><strong>%s</strong> / %s</td><td>%s</td><td>Horizontal merge (mountain + elevation)</td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		$table_rows .= sprintf(
			'<tr><th scope="row">%d</th><td>%s</td><td>%s</td><td>%s</td><td></td></tr>',
			$number,
			$mountain,
			esc_html( $height ),
			esc_html( $location )
		);
	}

	return $table_rows;
}

$flexible_table_rows = yamabiko_table_reorder_demo_build_flexible_table_rows( $flexible_rows );
$flexible_table      =
	'<!-- wp:flexible-table-block/table {"align":"wide"} -->' .
	'<figure class="wp-block-flexible-table-block-table alignwide">' .
	'<table class="has-fixed-layout">' .
	'<thead><tr><th scope="col" style="width:64px">No.</th><th scope="col">Mountain</th><th scope="col">Elevation</th><th scope="col">Location</th><th scope="col">Notes</th></tr></thead>' .
	'<tbody>' . $flexible_table_rows . '</tbody>' .
	'</table><figcaption>30 Mountains of Japan / Flexible Table Block Demo</figcaption>' .
	'</figure>' .
	'<!-- /wp:flexible-table-block/table -->';

$content = implode(
	'',
	[
		'<!-- wp:paragraph --><p>Try row and column drag-and-drop with the WordPress Core Table and Flexible Table Block. Select a Table, then use “Reorder rows” or “Reorder columns” in the toolbar to enter reorder mode.</p><!-- /wp:paragraph -->',
		'<!-- wp:heading --><h2 class="wp-block-heading">Row / Column Challenge</h2><!-- /wp:heading -->',
		'<!-- wp:list {"ordered":true} --><ol class="wp-block-list"><li>Drag a regular row to a new position.</li><li>Drag a regular column to a new position.</li><li>Use Undo to restore the original order.</li><li>For row reordering, confirm that you cannot drop a row between rows 7 and 8 because the location cell spans both rows.</li><li>For column reordering, confirm that the horizontal merge on row 14 blocks affected columns and destinations.</li></ol><!-- /wp:list -->',
		'<!-- wp:separator --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator -->',
		'<!-- wp:heading --><h2 class="wp-block-heading">WordPress Core Table: 30 Mountains of the World</h2><!-- /wp:heading -->',
		'<!-- wp:paragraph --><p>This area demonstrates basic row and column reordering. The location cells in rows 7-8 are vertically merged, and the mountain + elevation cells in row 14 are horizontally merged. These merged cells also demonstrate the corresponding row and column reorder constraints.</p><!-- /wp:paragraph -->',
		$core_table,
		'<!-- wp:separator --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator -->',
		'<!-- wp:heading --><h2 class="wp-block-heading">Flexible Table Block: 30 Mountains of Japan</h2><!-- /wp:heading -->',
		'<!-- wp:paragraph --><p>This area demonstrates row and column reordering in a Table with formatted and merged cells. The location cells in rows 7-8 are vertically merged, and the mountain + elevation cells in row 14 are horizontally merged. It also includes RichText, a link, inline code, a line break, scope attributes, a class, and cell styling.</p><!-- /wp:paragraph -->',
		$flexible_table,
		'<!-- wp:paragraph --><p>If you find a bug or notice anything unexpected, please let us know via <a href="https://github.com/YamabikoLab/yamabiko-table-reorder/issues">GitHub Issues</a>.</p><!-- /wp:paragraph -->',
		'<!-- wp:paragraph {"align":"right","fontSize":"small"} --><p class="has-text-align-right has-small-font-size">Yamabiko Table Reorder</p><!-- /wp:paragraph -->',
	]
);

$result = wp_insert_post(
	[
		'import_id'    => $page_id,
		'post_type'    => 'page',
		'post_status'  => 'publish',
		'post_title'   => 'Row and Column Reordering Demo: Mountains of the World and Japan',
		'post_name'    => 'table-reorder-demo',
		'post_content' => $content,
		'post_author'  => 1,
	],
	true
);

if ( is_wp_error( $result ) ) {
	throw new RuntimeException( $result->get_error_message() );
}

update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $page_id );

global $wpdb;

$user = get_user_by( 'login', 'admin' );

if ( $user ) {
	$meta_key    = $wpdb->get_blog_prefix() . 'persisted_preferences';
	$preferences = get_user_meta( $user->ID, $meta_key, true );

	if ( ! is_array( $preferences ) ) {
		$preferences = [];
	}

	if (
		! isset( $preferences['yamabiko-table-reorder'] ) ||
		! is_array( $preferences['yamabiko-table-reorder'] )
	) {
		$preferences['yamabiko-table-reorder'] = [];
	}

	$preferences['yamabiko-table-reorder']['initialGuidanceAcknowledgedPc']    = false;
	$preferences['yamabiko-table-reorder']['initialGuidanceAcknowledgedTouch'] = false;
	$preferences['_modified'] = gmdate( 'c' );

	update_user_meta( $user->ID, $meta_key, $preferences );
}
