<?php
require_once '/wordpress/wp-load.php';

$page_id      = 100;
$is_japanese  = str_starts_with( get_locale(), 'ja' );

if ( get_post( $page_id ) ) {
	wp_delete_post( $page_id, true );
}

$core_rows = [
	[ 1, 'Mount Everest', 'エベレスト', '8,848.86 m', 'Nepal / China', 'ネパール / 中国' ],
	[ 2, 'K2', 'K2', '8,611 m', 'Pakistan / China', 'パキスタン / 中国' ],
	[ 3, 'Kangchenjunga', 'カンチェンジュンガ', '8,586 m', 'Nepal / India', 'ネパール / インド' ],
	[ 4, 'Lhotse', 'ローツェ', '8,516 m', 'Nepal / China', 'ネパール / 中国' ],
	[ 5, 'Makalu', 'マカルー', '8,485 m', 'Nepal / China', 'ネパール / 中国' ],
	[ 6, 'Cho Oyu', 'チョ・オユー', '8,188 m', 'Nepal / China', 'ネパール / 中国' ],
	[ 7, 'Dhaulagiri I', 'ダウラギリ I', '8,167 m', 'Nepal', 'ネパール' ],
	[ 8, 'Manaslu', 'マナスル', '8,163 m', 'Nepal', 'ネパール' ],
	[ 9, 'Nanga Parbat', 'ナンガ・パルバット', '8,126 m', 'Pakistan', 'パキスタン' ],
	[ 10, 'Annapurna I', 'アンナプルナ I', '8,091 m', 'Nepal', 'ネパール' ],
	[ 11, 'Gasherbrum I', 'ガッシャーブルム I', '8,080 m', 'Pakistan / China', 'パキスタン / 中国' ],
	[ 12, 'Broad Peak', 'ブロード・ピーク', '8,051 m', 'Pakistan / China', 'パキスタン / 中国' ],
	[ 13, 'Gasherbrum II', 'ガッシャーブルム II', '8,035 m', 'Pakistan / China', 'パキスタン / 中国' ],
	[ 14, 'Shishapangma', 'シシャパンマ', '8,027 m', 'China', '中国' ],
	[ 15, 'Gyachung Kang', 'ギャチュンカン', '7,952 m', 'Nepal / China', 'ネパール / 中国' ],
	[ 16, 'Annapurna II', 'アンナプルナ II', '7,937 m', 'Nepal', 'ネパール' ],
	[ 17, 'Gasherbrum IV', 'ガッシャーブルム IV', '7,932 m', 'Pakistan', 'パキスタン' ],
	[ 18, 'Himalchuli', 'ヒマルチュリ', '7,893 m', 'Nepal', 'ネパール' ],
	[ 19, 'Distaghil Sar', 'ディスタギール・サール', '7,885 m', 'Pakistan', 'パキスタン' ],
	[ 20, 'Ngadi Chuli', 'ンガディ・チュリ', '7,871 m', 'Nepal', 'ネパール' ],
	[ 21, 'Nuptse', 'ヌプツェ', '7,861 m', 'Nepal', 'ネパール' ],
	[ 22, 'Khunyang Chhish', 'クンヤン・チッシュ', '7,852 m', 'Pakistan', 'パキスタン' ],
	[ 23, 'Masherbrum', 'マッシャーブルム', '7,821 m', 'Pakistan', 'パキスタン' ],
	[ 24, 'Nanda Devi', 'ナンダ・デヴィ', '7,816 m', 'India', 'インド' ],
	[ 25, 'Chomo Lonzo', 'チョモ・ロンゾ', '7,804 m', 'China', '中国' ],
	[ 26, 'Batura Sar', 'バトゥーラ・サール', '7,795 m', 'Pakistan', 'パキスタン' ],
	[ 27, 'Rakaposhi', 'ラカポシ', '7,788 m', 'Pakistan', 'パキスタン' ],
	[ 28, 'Namcha Barwa', 'ナムチャ・バルワ', '7,782 m', 'China', '中国' ],
	[ 29, 'Kanjut Sar', 'カンジュット・サール', '7,760 m', 'Pakistan', 'パキスタン' ],
	[ 30, 'Kamet', 'カメット', '7,756 m', 'India', 'インド' ],
];

$core_vertical_note   = $is_japanese ? '縦結合（所在地）' : 'Vertical merge (location)';
$core_horizontal_note = $is_japanese ? '横結合（山名 + 標高）' : 'Horizontal merge (mountain + elevation)';

function yamabiko_table_reorder_demo_build_core_table_rows( array $rows, bool $is_japanese, string $vertical_note, string $horizontal_note ) {
	$table_rows = '';

	foreach ( $rows as $row ) {
		[ $number, $mountain_en, $mountain_ja, $height, $location_en, $location_ja ] = $row;
		$mountain = $is_japanese ? $mountain_ja : $mountain_en;
		$location = $is_japanese ? $location_ja : $location_en;

		if ( 7 === $number ) {
			$table_rows .= sprintf(
				'<tr><td>%d</td><td>%s</td><td>%s</td><td rowspan="2">%s</td><td>%s</td></tr>',
				$number,
				esc_html( $mountain ),
				esc_html( $height ),
				esc_html( $location ),
				esc_html( $vertical_note )
			);
			continue;
		}

		if ( 8 === $number ) {
			$table_rows .= sprintf(
				'<tr><td>%d</td><td>%s</td><td>%s</td><td>%s</td></tr>',
				$number,
				esc_html( $mountain ),
				esc_html( $height ),
				esc_html( $vertical_note )
			);
			continue;
		}

		if ( 14 === $number ) {
			$table_rows .= sprintf(
				'<tr><td>%d</td><td colspan="2"><strong>%s</strong> / %s</td><td>%s</td><td>%s</td></tr>',
				$number,
				esc_html( $mountain ),
				esc_html( $height ),
				esc_html( $location ),
				esc_html( $horizontal_note )
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

$core_table_rows = yamabiko_table_reorder_demo_build_core_table_rows(
	$core_rows,
	$is_japanese,
	$core_vertical_note,
	$core_horizontal_note
);
$core_headers = $is_japanese
	? '<thead><tr><th scope="col">No.</th><th scope="col">山名</th><th scope="col">標高</th><th scope="col">所在地</th><th scope="col">メモ</th></tr></thead>'
	: '<thead><tr><th scope="col">No.</th><th scope="col">Mountain</th><th scope="col">Elevation</th><th scope="col">Location</th><th scope="col">Notes</th></tr></thead>';
$core_caption = $is_japanese
	? '世界の山 30 / WordPress Core Table デモ'
	: '30 Mountains of the World / WordPress Core Table Demo';
$core_table =
	'<!-- wp:table {"align":"wide"} -->' .
	'<figure class="wp-block-table alignwide"><table class="has-fixed-layout">' .
	$core_headers .
	'<tbody>' . $core_table_rows . '</tbody>' .
	'</table><figcaption class="wp-element-caption">' . esc_html( $core_caption ) . '</figcaption></figure>' .
	'<!-- /wp:table -->';

$flexible_rows = [
	[ 1, '<strong>Mount Fuji</strong>', '<strong>富士山</strong>', '3,776 m', 'Yamanashi / Shizuoka', '山梨 / 静岡' ],
	[ 2, '<em>Mount Kita</em>', '<em>北岳</em>', '3,193 m', 'Yamanashi', '山梨' ],
	[ 3, '<a href="https://en.wikipedia.org/wiki/Mount_Hotaka">Mount Okuhotaka</a>', '<a href="https://ja.wikipedia.org/wiki/%E7%A9%82%E9%AB%98%E5%B2%B3">奥穂高岳</a>', '3,190 m', 'Nagano / Gifu', '長野 / 岐阜' ],
	[ 4, '<code>Mount Aino</code>', '<code>間ノ岳</code>', '3,190 m', 'Yamanashi / Shizuoka', '山梨 / 静岡' ],
	[ 5, '<s>Mount Yari</s>', '<s>槍ヶ岳</s>', '3,180 m', 'Nagano / Gifu', '長野 / 岐阜' ],
	[ 6, 'Mount Akaishi<br>Akaishi-dake', '赤石岳<br>あかいしだけ', '3,121 m', 'Nagano / Shizuoka', '長野 / 静岡' ],
	[ 7, 'Mount Karasawa', '涸沢岳', '3,110 m', 'Nagano / Gifu', '長野 / 岐阜' ],
	[ 8, 'Mount Kitahotaka', '北穂高岳', '3,106 m', 'Nagano / Gifu', '長野 / 岐阜' ],
	[ 9, 'Mount Obami', '大喰岳', '3,101 m', 'Nagano / Gifu', '長野 / 岐阜' ],
	[ 10, 'Mount Maehotaka', '前穂高岳', '3,090 m', 'Nagano', '長野' ],
	[ 11, 'Mount Naka', '中岳', '3,084 m', 'Nagano / Gifu', '長野 / 岐阜' ],
	[ 12, 'Mount Arakawa-Naka', '荒川中岳', '3,084 m', 'Shizuoka', '静岡' ],
	[ 13, 'Mount Ontake', '御嶽山', '3,067 m', 'Nagano / Gifu', '長野 / 岐阜' ],
	[ 14, 'Mount Shiomi', '塩見岳', '3,052 m', 'Nagano / Shizuoka', '長野 / 静岡' ],
	[ 15, 'Mount Minami', '南岳', '3,033 m', 'Nagano / Gifu', '長野 / 岐阜' ],
	[ 16, 'Mount Senjo', '仙丈ヶ岳', '3,033 m', 'Yamanashi / Nagano', '山梨 / 長野' ],
	[ 17, 'Mount Norikura', '乗鞍岳', '3,026 m', 'Nagano / Gifu', '長野 / 岐阜' ],
	[ 18, 'Mount Notori', '農鳥岳', '3,026 m', 'Yamanashi / Shizuoka', '山梨 / 静岡' ],
	[ 19, 'Mount Tate (Onanji)', '立山（大汝山）', '3,015 m', 'Toyama', '富山' ],
	[ 20, 'Mount Hijiri', '聖岳', '3,013 m', 'Nagano / Shizuoka', '長野 / 静岡' ],
	[ 21, 'Mount Tsurugi', '剱岳', '2,999 m', 'Toyama', '富山' ],
	[ 22, 'Mount Suisho', '水晶岳', '2,986 m', 'Toyama', '富山' ],
	[ 23, 'Mount Kaikoma', '甲斐駒ヶ岳', '2,967 m', 'Yamanashi / Nagano', '山梨 / 長野' ],
	[ 24, 'Mount Kisokoma', '木曽駒ヶ岳', '2,956 m', 'Nagano', '長野' ],
	[ 25, 'Mount Shirouma', '白馬岳', '2,932 m', 'Nagano / Toyama', '長野 / 富山' ],
	[ 26, 'Mount Yakushi', '薬師岳', '2,926 m', 'Toyama', '富山' ],
	[ 27, 'Mount Washiba', '鷲羽岳', '2,924 m', 'Nagano / Toyama', '長野 / 富山' ],
	[ 28, 'Mount Otensho', '大天井岳', '2,922 m', 'Nagano', '長野' ],
	[ 29, 'Mount Nishihotaka', '西穂高岳', '2,909 m', 'Nagano / Gifu', '長野 / 岐阜' ],
	[ 30, 'Mount Kashimayari', '鹿島槍ヶ岳', '2,889 m', 'Nagano / Toyama', '長野 / 富山' ],
];

$flexible_vertical_note   = $is_japanese ? '縦結合（所在地、7〜8行目）' : 'Vertical merge (location, rows 7-8)';
$flexible_horizontal_note = $is_japanese ? '横結合（山名 + 標高）' : 'Horizontal merge (mountain + elevation)';

function yamabiko_table_reorder_demo_build_flexible_table_rows( array $rows, bool $is_japanese, string $vertical_note, string $horizontal_note ) {
	$table_rows = '';

	foreach ( $rows as $row ) {
		[ $number, $mountain_en, $mountain_ja, $height, $location_en, $location_ja ] = $row;
		$mountain = $is_japanese ? $mountain_ja : $mountain_en;
		$location = $is_japanese ? $location_ja : $location_en;

		if ( 7 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td>%s</td><td>%s</td><td rowspan="2">%s</td><td>%s</td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $location ),
				esc_html( $vertical_note )
			);
			continue;
		}

		if ( 8 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td>%s</td><td>%s</td><td>%s</td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $vertical_note )
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
				'<tr><th scope="row">%d</th><td colspan="2" class="demo-merged-cell"><strong>%s</strong> / %s</td><td>%s</td><td>%s</td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $location ),
				esc_html( $horizontal_note )
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

$flexible_table_rows = yamabiko_table_reorder_demo_build_flexible_table_rows(
	$flexible_rows,
	$is_japanese,
	$flexible_vertical_note,
	$flexible_horizontal_note
);
$flexible_headers = $is_japanese
	? '<thead><tr><th scope="col" style="width:64px">No.</th><th scope="col">山名</th><th scope="col">標高</th><th scope="col">所在地</th><th scope="col">メモ</th></tr></thead>'
	: '<thead><tr><th scope="col" style="width:64px">No.</th><th scope="col">Mountain</th><th scope="col">Elevation</th><th scope="col">Location</th><th scope="col">Notes</th></tr></thead>';
$flexible_caption = $is_japanese
	? '日本の山 30 / Flexible Table Block デモ'
	: '30 Mountains of Japan / Flexible Table Block Demo';
$flexible_table =
	'<!-- wp:flexible-table-block/table {"align":"wide"} -->' .
	'<figure class="wp-block-flexible-table-block-table alignwide">' .
	'<table class="has-fixed-layout">' .
	$flexible_headers .
	'<tbody>' . $flexible_table_rows . '</tbody>' .
	'</table><figcaption>' . esc_html( $flexible_caption ) . '</figcaption>' .
	'</figure>' .
	'<!-- /wp:flexible-table-block/table -->';

if ( $is_japanese ) {
	$content = implode(
		'',
		[
			'<!-- wp:paragraph --><p>WordPress Core Table と Flexible Table Block で行・列のドラッグ＆ドロップを試せます。Table を選択し、ツールバーの「行を並び替え」または「列を並び替え」から並び替えモードに切り替えてください。</p><!-- /wp:paragraph -->',
			'<!-- wp:heading --><h2 class="wp-block-heading">行 / 列 並び替えチャレンジ</h2><!-- /wp:heading -->',
			'<!-- wp:list {"ordered":true} --><ol class="wp-block-list"><li>通常の行を別の位置へドラッグしてください。</li><li>通常の列を別の位置へドラッグしてください。</li><li>「元に戻す」で元の順序へ戻してください。</li><li>行の並び替えでは、7〜8行目の所在地セルが縦結合されているため、その間へドロップできないことを確認してください。</li><li>列の並び替えでは、14行目の横結合によって対象列と移動先が制約されることを確認してください。</li></ol><!-- /wp:list -->',
			'<!-- wp:separator --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator -->',
			'<!-- wp:heading --><h2 class="wp-block-heading">WordPress Core Table: 世界の山 30</h2><!-- /wp:heading -->',
			'<!-- wp:paragraph --><p>基本的な行・列の並び替えを試せます。7〜8行目の所在地セルは縦結合、14行目の山名 + 標高セルは横結合されており、それぞれ行・列の並び替え制約も確認できます。</p><!-- /wp:paragraph -->',
			$core_table,
			'<!-- wp:separator --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator -->',
			'<!-- wp:heading --><h2 class="wp-block-heading">Flexible Table Block: 日本の山 30</h2><!-- /wp:heading -->',
			'<!-- wp:paragraph --><p>装飾セルや結合セルを含む Table で行・列の並び替えを試せます。7〜8行目の所在地セルは縦結合、14行目の山名 + 標高セルは横結合されています。RichText、リンク、インラインコード、改行、scope 属性、class、セルスタイルも含まれます。</p><!-- /wp:paragraph -->',
			$flexible_table,
			'<!-- wp:paragraph --><p>不具合や予期しない動作がありましたら、<a href="https://github.com/YamabikoLab/yamabiko-table-reorder/issues">GitHub Issues</a> からお知らせください。</p><!-- /wp:paragraph -->',
			'<!-- wp:paragraph {"align":"right","fontSize":"small"} --><p class="has-text-align-right has-small-font-size">Yamabiko Table Reorder</p><!-- /wp:paragraph -->',
		]
	);
	$post_title = '行・列並び替えデモ：世界と日本の山';
} else {
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
	$post_title = 'Row and Column Reordering Demo: Mountains of the World and Japan';
}

$result = wp_insert_post(
	[
		'import_id'    => $page_id,
		'post_type'    => 'page',
		'post_status'  => 'publish',
		'post_title'   => $post_title,
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
