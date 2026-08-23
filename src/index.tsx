import { addFilter } from '@wordpress/hooks';

import './column-reorder/editor.scss';
import { withColumnReorder } from './column-reorder/with-column-reorder';
import './row-reorder/editor.scss';
import { withTableReorder } from './row-reorder/with-table-reorder';

addFilter( 'editor.BlockEdit', 'yamabiko-table-reorder/table-reorder', withTableReorder, 20 );
addFilter(
	'editor.BlockEdit',
	'yamabiko-table-reorder/column-reorder',
	withColumnReorder,
	21
);
