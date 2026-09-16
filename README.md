# Yamabiko Table Reorder

[![Latest Release](https://img.shields.io/github/v/release/YamabikoLab/yamabiko-table-reorder?label=version)](https://github.com/YamabikoLab/yamabiko-table-reorder/releases)
![WordPress](https://img.shields.io/badge/WordPress-6.8%2B-21759b)
![PHP](https://img.shields.io/badge/PHP-8.1%2B-777bb4)
[![License](https://img.shields.io/badge/license-GPLv2%20or%20later-blue)](LICENSE)

Reorder rows and columns in supported WordPress Table blocks with drag-and-drop or a form.

Yamabiko Table Reorder adds Row Reorder, Column Reorder, and Reorder Form to WordPress Core Table and [Flexible Table Block](https://wordpress.org/plugins/flexible-table-block/) while preserving supported Table structure, including merged-cell constraints.

<img width="1647" height="705" alt="demo" src="https://github.com/user-attachments/assets/251ac0a1-92e7-4d52-b19b-cc3cfc13836a" />

## Quick Start

1. Select a supported Table block.
2. Choose **Reorder rows**, **Reorder columns**, or **Reorder with form** from the Table toolbar.
3. Move the row or column to its new position.

[▶ Try Yamabiko Table Reorder in WordPress Playground](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/YamabikoLab/yamabiko-table-reorder/main/demo/blueprint.json)

The Playground demo uses the latest stable release and includes WordPress Core Table and [Flexible Table Block](https://wordpress.org/plugins/flexible-table-block/) examples.

## Key Features

- **Row Reorder** — Move `tbody` rows with Mouse or Touch drag-and-drop.
- **Column Reorder** — Move Table columns with Mouse or Touch drag-and-drop when the current editor view provides a reliable horizontal column layout.
- **Reorder Form** — Move a row or column without drag-and-drop by choosing the source, destination, and destination side.
- **Merged-cell aware** — Prevents moves that would break the supported Table structure and identifies blocked rows or columns in advance.
- **Large-table handling** — Keeps drag interactions lightweight and confirms reorders that may take noticeable time to apply.
- **Responsive Reorder Form** — Uses a movable Popover when space allows and a collapsible, vertically resizable, internally scrollable bottom dock in narrow editor areas.

## Supported Table Blocks

> [!IMPORTANT]
> Yamabiko Table Reorder currently supports only:
>
> - WordPress **Core Table**
> - [**Flexible Table Block**](https://wordpress.org/plugins/flexible-table-block/)
>
> Other Table blocks provided by plugins or themes are not currently supported.

## How It Works

### Row Reorder

Choose **Reorder rows** from the Table toolbar, then drag a `tbody` row with Mouse or Touch. During the drag, the moving row and insertion line show the source and destination while the surrounding Table remains in place. After a valid drop, the destination row area is outlined briefly so you can confirm where the row was dropped.

### Column Reorder

Choose **Reorder columns** from the Table toolbar, then drag a Table column with Mouse or Touch. During the drag, the moving column and insertion line show the source and destination while the surrounding Table remains in place. After a valid drop, the destination column area is outlined briefly so you can confirm where the column was dropped.

Column drag-and-drop is available only when the current editor view exposes the Table as a reliable horizontal column layout. If the current view stacks or reflows cells so that Column Reorder cannot resolve horizontal column positions safely, the toolbar explains the limitation and you can still reorder columns with **Reorder with form**.

### Reorder Form

Choose **Reorder with form** when you want to reorder without drag-and-drop. Select whether to move a row or column, choose the source and destination, specify the destination side, and apply the move.

Row inputs use 1-based row numbers. Column inputs use the currently available logical columns and include column headings when available. A move is applied only when the request is valid and changes the order.

## Merged Cells and Large Tables

For Tables with merged cells, only destinations that preserve the supported Table structure are accepted. Rows or columns that cannot be moved because of merged-cell constraints are identified in advance. Reorder Form also explains structural rejections using the location of the merged cell that prevents the move.

When a reorder affects enough cells that applying the change may take noticeable time, Yamabiko Table Reorder shows a confirmation first. If you continue, only the target Table enters a temporary applying state, and editing resumes after the update completes.

Row Reorder, Column Reorder, and Reorder Form share user-facing completion feedback after the result is known.

## Demo

Try Row Reorder, Column Reorder, Reorder Form, Touch interaction, and merged-cell constraints in WordPress Playground.

[▶ Open the demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/YamabikoLab/yamabiko-table-reorder/main/demo/blueprint.json)

## Requirements

- WordPress 6.8 or later
- PHP 8.1 or later

## Installation

Download the latest distribution ZIP from [GitHub Releases](https://github.com/YamabikoLab/yamabiko-table-reorder/releases), then install it from **Plugins → Add Plugin → Upload Plugin** in WordPress.

## FAQ

### Which Table blocks are supported?

WordPress Core Table and [Flexible Table Block](https://wordpress.org/plugins/flexible-table-block/) are currently supported. Other Table blocks provided by plugins or themes are not supported.

### Can I reorder Tables with merged cells?

Yes, when the requested move preserves the supported Table structure. Destinations blocked by merged-cell constraints are rejected rather than applying an invalid reorder.

### Does it work on touch devices?

Yes. Row Reorder and Column Reorder support Touch drag-and-drop as well as Mouse input when the current layout supports the corresponding drag operation.

### Can I reorder without drag-and-drop?

Yes. **Reorder with form** lets you choose the row or column to move and its destination without using drag-and-drop.

### What happens with large Tables?

Drag interactions avoid applying the actual Table reorder while the drag is in progress. If applying the final reorder may take noticeable time, the plugin shows a confirmation before updating the target Table.

## Reporting Bugs and Requests

Please use [GitHub Issues](https://github.com/YamabikoLab/yamabiko-table-reorder/issues) for bug reports and feature requests.

Do not post security issues in a public Issue. Follow the [security policy](SECURITY.md) to report them privately.

External Pull Requests are not currently accepted.

## License

Released under the [GNU General Public License v2.0 or later](LICENSE).

## Development

The plugin source is in [`src/`](src/).

### Install dependencies

```bash
npm ci
composer install
```

### Start development mode

```bash
npm start
```

Local WordPress development environment setup, startup instructions, and plugin placement are maintained in the separate [YamabikoLab/wp-dev](https://github.com/YamabikoLab/wp-dev) repository.

### Create a production build

```bash
npm run build
```

Build output is written to `build/`.

### Validate the code

```bash
npm test
```

Run the PHP checks separately.

```bash
composer lint:php
composer analyse:php
```

See [`docs/development/testing.md`](docs/development/testing.md) for detailed validation guidance.

### Development documentation

- [Development principles](docs/development/foundation.md)
- [Testing](docs/development/testing.md)
- [GitHub CLI](docs/development/github-cli.md)
- [i18n](docs/development/i18n.md)
- [Security](docs/development/security.md)
- [Releasing](docs/development/releasing.md)
