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

Use drag-and-drop when it is convenient, or use Reorder with form when you prefer not to drag. Both approaches work with WordPress Core Table and Flexible Table Block and apply a move only when it preserves the supported Table structure.

= Reorder rows and columns directly =

Choose Reorder rows or Reorder columns from the Table toolbar, then move body rows or Table columns with Mouse or Touch. The moving item and insertion line show the active move and destination while the surrounding Table remains in place.

After a valid drop, the destination area is outlined briefly so the new position remains easy to find.

= Reorder without drag-and-drop =

Choose Reorder with form from the same Table toolbar to move a row or column by selecting the source, destination, and destination side. The form shows the available row and logical-column choices, including column headings when available.

= Built for real tables =

Yamabiko Table Reorder takes merged cells into account and rejects moves that would break the supported Table structure. When a form-based move is blocked, it identifies the merged-cell location that prevents the move.

Column drag-and-drop starts only when the current editor view provides a reliable horizontal column layout. If cells are stacked or reflowed, the toolbar explains the limitation and Reorder with form remains available for column moves.

For larger changes that may take noticeable time to apply, the plugin asks for confirmation first. Only the target Table enters a temporary applying state, and editing resumes after the update is complete.

Reorder with form adapts to the available editor space: it uses a movable Popover when space allows and a collapsible, vertically resizable bottom dock in narrow editor areas.

A WordPress Playground demo is available from the GitHub repository and uses the current latest stable release.

Source code and development documentation are available on GitHub:
https://github.com/YamabikoLab/yamabiko-table-reorder

To install dependencies and build a release ZIP from source:

`npm ci`
`npm run plugin-zip`

The generated archive is `yamabiko-table-reorder.zip`.

== Installation ==

1. In WordPress, go to Plugins > Add New Plugin.
2. Search for `Yamabiko Table Reorder`.
3. Select Install Now.
4. Activate Yamabiko Table Reorder.

For manual installation, upload a released `yamabiko-table-reorder.zip` from GitHub Releases using Plugins > Add New Plugin > Upload Plugin.

== Changelog ==

= 1.0.0 =

* Added: Completed the WordPress.org registration baseline accessibility work for Reorder Form, including keyboard operation, validation semantics, responsive collapsed-state semantics, focus handling, and accessible result announcements.
* Changed: Improved Reorder Form focus behavior across open, cancel, confirmation, applying, and successful completion so keyboard operation resumes at the relevant control or reordered result.
* Changed: Added accessible blocked, no-op, success, and failure announcements for Reorder Form and aligned Row / Column reorder completion feedback with the shared accessibility presentation.
* Fixed: Added the missing Column Reorder safe-termination notice presentation so interrupted or invalid drag endings are reported consistently with Row Reorder.

= 0.9.8 =

* Fixed: Kept Column Reorder cell highlighting visible in Flexible Table Block after click or touch by separating the highlight from block-owned cell classes.
* Fixed: Improved Row and Column Reorder responsiveness on large Flexible Table Block tables by avoiding unnecessary cell-selection updates while Reorder Mode is active.

= 0.9.7 =

* Changed: Updated first-use guidance to explain that rows and columns can be reordered by drag-and-drop or Reorder Form on both PC and Touch devices.
* Fixed: Grouped the three reorder toolbar entries into one first-use highlight and kept the highlight within the toolbar to prevent overlapping or clipped guidance visuals.

= 0.9.6 =

* Fixed: Prevented Flexible Table Block editor controls from being duplicated into Row and Column Reorder moving overlays during drag-and-drop.

= 0.9.5 =

* Changed: Simplified Row and Column Reorder drag feedback by removing surrounding row/column displacement, insertion gaps, and drop animations while keeping the moving overlay and insertion line focused on the active move and destination.
* Changed: Added a short-lived outline after valid Row and Column drops so the selected destination remains visible after the drag ends.
* Changed: Simplified the moving row and column displays and made their backgrounds transparent so destination table content remains visible during drag-and-drop.

= 0.9.4 =

* Fixed: Prevented Column Reorder layout-availability monitoring from triggering ResizeObserver loop errors while editing tables.

= 0.9.3 =

* Fixed: Prevented Column Reorder drag-and-drop from starting when the current table layout does not provide reliable horizontal column geometry, including stacked or reflow-style layouts.
* Changed: When Column Reorder drag-and-drop is unavailable for the current layout, the toolbar now explains the limitation and points to Reorder Form as the alternative while Row Reorder remains unaffected.

= 0.9.2 =

* Changed: Moved reorder completion notices to the bottom-right of the editor so they are less likely to cover the table or Reorder Form, with reduced-motion support.
* Changed: Improved merged-cell rejection feedback for Row / Column Reorder by showing the affected row or column range more clearly.
* Fixed: Prevented intermittent Row / Column DnD lifecycle errors when a drag attempt ends before its reorder session has started.

= 0.9.1 =

* Changed: Improved Reorder Form narrow layouts by allowing the bottom dock height to be adjusted and the form content to scroll within the available space.
* Fixed: Prevented result focus after confirmed reorders from automatically entering cell editing or opening the software keyboard on mobile devices.

= 0.9.0 =

* Added: Added Reorder Form v1 for WordPress Core Table and Flexible Table Block, allowing rows and columns to be moved by specifying source and destination positions without drag-and-drop.
* Changed: Improved Reorder Form feedback for merged-cell constraints, apply results, and narrow editor layouts, including a collapsible bottom dock when space is limited.
* Changed: Unified user-facing completion feedback for Row Reorder, Column Reorder, and Reorder Form, and reduced unnecessary Table subtree updates when switching Reorder Mode on large Tables.

= 0.8.5 =

* Changed: Improved first-use guidance for Row / Column Reorder by showing PC- and Touch-specific instructions, including long-press guidance for Touch drag-and-drop.

= 0.8.4 =

* Fixed: Prevented browser text selection, search, and long-press callout actions from interfering with touch Row / Column Reorder while Reorder Mode is active.

= 0.8.3 =

* Fixed: Prevented Gutenberg's native block dragging from competing with Row / Column Reorder while Reorder Mode is active.

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
