=== Yamabiko Table Reorder ===
Tags: block editor, gutenberg, table
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 0.9.7
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Reorder table rows and columns in supported blocks in the WordPress block editor.

== Description ==

Yamabiko Table Reorder 0.9.7 provides Row Reorder, Column Reorder, and Reorder Form for WordPress Core Table and Flexible Table Block.

Use Row Reorder or Column Reorder mode from the Table toolbar, then drag body rows or Table columns with Mouse or Touch. During DnD, the moving row or column and insertion line show the active move and destination while the surrounding Table remains in place. After a valid drop, the destination row or column area is outlined briefly so the selected position remains visible after the drag ends.

Column drag-and-drop is available only when the current editor view provides a reliable horizontal column layout. If the current view stacks or reflows cells so that horizontal column positions cannot be resolved safely, Column Reorder drag-and-drop does not start. The toolbar explains the limitation, and columns can still be reordered with Reorder Form. Row Reorder remains independent from this Column DnD availability check.

Use Reorder with form from the same Table toolbar to move a row or column without drag-and-drop. Choose the source and destination, select the destination side, and apply the move when it is valid and changes the order. RF shows current row limits and available logical columns, including column headings when available.

Row Reorder, Column Reorder, and RF preserve supported Table structure, including merged-cell constraints, and update the order only when the requested move is valid. RF reports structural rejection using the location of the merged cell that prevents the move.

When a reorder affects enough cells that applying it may take some time, the plugin shows a confirmation before applying the change. If continued, only the target Table enters a temporary applying state, and editing resumes after the update is complete. Reorder operations also provide shared success and failure feedback after the result is known.

RF uses a movable Popover when enough editor space is available. In a narrow editor area it switches to a bottom dock that can be collapsed, resized vertically, and scrolled internally so the target Table and required form controls remain easier to inspect and reach.

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
