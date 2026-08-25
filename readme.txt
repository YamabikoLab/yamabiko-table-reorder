=== Yamabiko Table Reorder ===
Tags: block editor, gutenberg, table
Requires at least: 6.8
Tested up to: 7.0
Requires PHP: 8.1
Stable tag: 0.4.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Table reordering for supported blocks in the WordPress block editor.

== Description ==

The stable 0.4.0 release is the final YTR Prototype release.

Development on `main` is now redesigning formal YTR v1 from the interaction, accessibility, and performance requirements rather than extending the Prototype implementation structure. The active source on `main` is intentionally minimal while that work proceeds.

The existing release history is preserved. The release after 0.4.0 will continue the sequence as 0.5.0; "formal v1" names the new design and implementation generation and does not change the package version to 1.0.0.

The previously shared WordPress Playground demo remains available as a YTR Prototype v0.4.0 demo from the GitHub repository. It installs the 0.4.0 release explicitly and does not represent the current `main` implementation.

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
