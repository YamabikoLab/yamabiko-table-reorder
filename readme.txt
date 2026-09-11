=== Yamabiko Table Reorder ===
Tags: block editor, gutenberg, table
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 0.8.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reorder table rows and columns in supported blocks in the WordPress block editor.

== Description ==

Yamabiko Table Reorder 0.8.2 provides Row Reorder and Column Reorder for WordPress Core Table and Flexible Table Block.

Use Row Reorder or Column Reorder mode from the Table toolbar, then drag body rows or Table columns with Mouse or Touch. During DnD, the plugin shows the moving row or column and the current destination. In iframe editors, surrounding rows or columns are displaced to preview the result before it is committed. In non-iframe editors, surrounding column displacement is intentionally omitted during Column Reorder to preserve responsiveness, while the moving column and insertion line continue to show the source and destination.

Row and Column Reorder preserve supported Table structure, including merged-cell constraints, and update the order only when the drop is valid. Rows or columns that cannot be moved because of merged-cell constraints are identified in advance, and a short message explains the reason when a drag is attempted. Automatic scrolling follows the active reorder direction when needed.

When a reorder affects enough cells that applying it may take some time, the plugin shows a confirmation before applying the change. If continued, only the target Table enters a temporary applying state, and editing resumes after the update is complete.

A WordPress Playground demo is available from the GitHub repository and uses the current latest stable release.

Source code and development documentation are available on GitHub:
https://github.com/YamabikoLab/yamabiko-table-reorder

To install dependencies and build a release ZIP from source:

`npm ci`
`npm run plugin-zip`

The generated archive is `yamabiko-table-reorder.zip`.

== Installation ==

1. Download a released `yamabiko-table-reorder.zip` from the GitHub Releases page.
2. In WordPress, go to Plugins > Add New Plugin > Upload Plugin.
3. Upload the ZIP file and install it.
4. Activate Yamabiko Table Reorder.

== Changelog ==

= 0.8.2 =

* Fixed: Improved Column Reorder responsiveness in non-iframe editors by omitting costly surrounding-column displacement while preserving the moving column and destination feedback.
* Fixed: Prevented first-use Touch guidance from leaving editable Table content focused or keeping the software keyboard active.
* Fixed: Corrected Column Reorder moving-column feedback in iframe editors so the dragged source column is identified correctly when the editor frame has a horizontal offset.

= 0.8.1 =

* Fixed: Prevented Column Reorder touch long-presses on editable Table content from entering cell editing before column DnD starts.

= 0.8.0 =

* Added: Added a confirmation flow for Row and Column Reorder operations whose affected range may take time to apply, showing the intended move before the update starts.
* Changed: During confirmed reorders, only the target Table enters a temporary applying state and returns to editing after the update completes.
* Changed: Revalidated the current Table immediately before applying a confirmed reorder and left Table data unchanged when the move could no longer be applied safely.
* Changed: Restored scroll and focus near the reordered result after the confirmed update completes.

= 0.7.0 =

* Added: Added Column Reorder for WordPress Core Table and Flexible Table Block with Mouse and Touch DnD.
* Added: Added visual feedback for the moving column, current destination, surrounding column displacement, and horizontal automatic scrolling during Column Reorder DnD.
* Changed: Preserved supported Table structure by preventing column moves that would break merged-cell constraints and by committing Table data only for valid drops.
* Added: Added Undo support for Column Reorder so one committed column move can be reverted with one Undo operation.

= 0.6.2 =

* Fixed: Prevented supported Tables from remounting their existing block subtree when selection changes, reducing the delay before the Table toolbar appears on large Tables.

= 0.6.1 =

* Fixed: Prevented Row Reorder automatic scrolling from changing the horizontal scroll position while dragging toward an offscreen destination; automatic scrolling is now vertical only.

= 0.6.0 =

* Added: Added clearer feedback for rows that cannot be moved because of merged-cell constraints, including an unavailable row state and a short message when a drag is attempted.
* Fixed: Preserved the source row and cell background colors in the moving row during Row Reorder DnD.
* Changed: Refined the internal Row Reorder responsibility boundaries and source organization, including Reorder Target Resolution.

= 0.5.0 =

* Changed: Redesigned and reimplemented Row Reorder as the formal v1 generation instead of extending the Prototype implementation structure.
* Added: Added Mouse and Touch DnD for Row Reorder in WordPress Core Table and Flexible Table Block.
* Added: Added visual feedback for the moving row, current destination, surrounding row displacement, and automatic scrolling during DnD.
* Changed: Preserved supported Table structure by preventing moves that would break merged-cell constraints.
* Changed: Column Reorder is not included in 0.5.0 and is currently under development.
* Changed: Prototype Keyboard and single-pointer reorder interactions are not included in 0.5.0.

= 0.4.0 =

* Changed: Renamed the standalone plugin identity to Yamabiko Table Reorder and aligned its release artifact, text domain, and development tooling with the new identity.
* Fixed: Improved row reordering in non-iframe editors by resolving the actual scroll container for keyboard, mouse drag, and Touch interactions instead of assuming the browser window scrolls.
* Changed: Kept Touch operation guidance within the browser viewport while preserving swipe-direction-based top and bottom placement.
* Changed: Expanded automated E2E coverage across representative iframe and non-iframe WordPress environments, including Flexible Table Block, merged-cell constraints, data preservation, Undo, and persistence.

= 0.3.3 =

* Changed: Improved keyboard navigation between Table Reorder row controls and clarified the first-use keyboard guidance.
* Changed: Improved the first-use Touch guidance by focusing the Table Reorder toolbar control instead of entering cell editing.

= 0.3.2 =

* Changed: Shortened the Table Reorder operation guidance and improved it with a compact pill-style UI.
* Changed: Moved PC and Keyboard operation guidance to the right side of the screen to reduce overlap with editor toolbars.
* Changed: Hide operation guidance when the target table moves outside the viewport and show it again when the table returns.

= 0.3.1 =

* Fixed: Prevented the initial Keyboard coachmark from being permanently dismissed before it was actually displayed.
* Changed: Unified the Table Reorder guidance panel design for Keyboard and Touch interactions and added icons that match the current operation.
* Changed: Improved coachmark positioning on narrow viewports.
* Changed: Moved Touch guidance between the top and bottom of the viewport based on swipe direction so destination rows remain easier to see.

= 0.3.0 =

* Added: Added Table Reorder support for Flexible Table Block.
* Changed: Consolidated Core Table and Flexible Table Block-specific differences behind a thin block support boundary.
* Changed: Integrated Flexible Table Block `rowSpan` handling into the existing merged-cell movement constraints.
* Changed: Removed the Core Table-specific selector dependency from the temporary horizontal-scroll adjustment used by touch reorder mode.

= 0.2.0 =

* Changed: Refined the internal Table Reorder design by clarifying responsibilities around operation state, commit handling, controller lifecycle, UI behavior, and runtime loading.
* Changed: Avoid running Table Reorder-specific hooks for unsupported blocks.
* Changed: Removed unused compatibility APIs, arguments, calculations, and controller-specific test fixtures.
* Fixed: Prevented row-reorder handles from overlapping content in a narrow first column on mobile by expanding only when needed and allowing horizontal scrolling temporarily.

= 0.1.0 =

* Initial release of Yamabiko Editor Tools.
* Add Table Reorder for reordering Core Table body rows in the block editor.
