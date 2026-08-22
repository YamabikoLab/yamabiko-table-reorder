module.exports = {
	presets: [ '@wordpress/babel-preset-default' ],
	plugins: [
		[
			'@wordpress/babel-plugin-makepot',
			{
				output: 'languages/.yamabiko-table-reorder-js.pot',
			},
		],
	],
};
