=== Yamabiko Table Reorder ===
Contributors: yamabiko
Tags: block editor, gutenberg, table
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reorder rows and columns without rebuilding your WordPress tables.

== Description ==

Reordering an existing table should not mean rebuilding it. Yamabiko Table Reorder adds row and column reordering directly to supported Table blocks in the WordPress block editor.

= Row Reordering =

Choose Reorder rows from the Table toolbar, then drag body rows with Mouse or Touch. Valid moves change the row order while preserving the supported Table structure.

= Column Reordering =

Choose Reorder columns from the Table toolbar, then drag Table columns with Mouse or Touch.

When the current editor layout does not provide reliable horizontal column positions, column drag-and-drop stays unavailable and Reorder with form remains available instead.

= Reorder Without Drag-and-Drop =

Choose Reorder with form from the Table toolbar to move a row or column by selecting the source, destination, and destination side.

= Supported Table Blocks =

Yamabiko Table Reorder supports the WordPress Core Table block and [Flexible Table Block](https://wordpress.org/plugins/flexible-table-block/).

= Built for Real Tables =

Merged cells are taken into account, and moves that would break the supported Table structure are rejected. For larger changes that may take noticeable time to apply, the plugin asks for confirmation before updating the Table.

A WordPress Playground demo is available from the GitHub repository and uses the current latest stable release.

Source code and development documentation are available on GitHub:
https://github.com/YamabikoLab/yamabiko-table-reorder

To install dependencies and build a release ZIP from source:

`npm ci`
`npm run plugin-zip`

The generated archive is `yamabiko-table-reorder.zip`.

== Screenshots ==

1. Row Reordering changes the order of table body rows directly in the WordPress block editor.
2. Column Reordering changes the order of table columns directly in the WordPress block editor.
3. Reorder Without Drag-and-Drop moves a row or column with Reorder with form by selecting the source, destination, and destination side.

== Installation ==

1. In WordPress, go to Plugins > Add New Plugin.
2. Search for `Yamabiko Table Reorder`.
3. Select Install Now.
4. Activate Yamabiko Table Reorder.

For manual installation, upload a released `yamabiko-table-reorder.zip` from GitHub Releases using Plugins > Add New Plugin > Upload Plugin.

== Frequently Asked Questions ==

= Which Table blocks are supported? =

Yamabiko Table Reorder supports the WordPress Core Table block and [Flexible Table Block](https://wordpress.org/plugins/flexible-table-block/).

= Can I reorder a Table that contains merged cells? =

Yes, when the requested move preserves the supported Table structure. Moves that would break merged-cell constraints are rejected and the Table is left unchanged.

= Does it support Touch? =

Yes. Row and Column Reorder support drag-and-drop with both Mouse and Touch.

= Can I reorder without drag-and-drop? =

Yes. Reorder with form lets you choose the source, destination, and destination side without dragging.

= How does it behave with larger Tables? =

For reorders that affect enough cells to take noticeable time, Yamabiko Table Reorder asks for confirmation before applying the change. Only the target Table enters a temporary applying state, and editing resumes when the update is complete.

== Changelog ==

= 1.0.0 =

* Added: Completed the WordPress.org registration baseline accessibility work for Reorder Form, including keyboard operation, validation semantics, responsive collapsed-state semantics, focus handling, and accessible result announcements.
* Changed: Improved Reorder Form focus behavior across open, cancel, confirmation, applying, and successful completion so keyboard operation resumes at the relevant control or reordered result.
* Changed: Added accessible blocked, no-op, success, and failure announcements for Reorder Form and aligned Row / Column reorder completion feedback with the shared accessibility presentation.
* Fixed: Added the missing Column Reorder safe-termination notice presentation so interrupted or invalid drag endings are reported consistently with Row Reorder.

Earlier release history is available in `changelog.txt`.
