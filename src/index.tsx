import { addFilter } from '@wordpress/hooks';

import './row-reorder/editor.scss';
import { withTableReorder } from './row-reorder/with-table-reorder';

addFilter( 'editor.BlockEdit', 'yamabiko-table-reorder/table-reorder', withTableReorder, 20 );
