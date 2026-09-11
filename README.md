# Yamabiko Table Reorder

A WordPress block editor plugin for reordering Table rows and columns.

<img width="1897" height="824" alt="demo" src="https://github.com/user-attachments/assets/f7439db3-4524-4a8c-93be-c032eb41787e" />

## Current Status

Version 0.8.2 provides **Row Reorder and Column Reorder** for WordPress Core Table and Flexible Table Block.

Switch to Row Reorder or Column Reorder mode from the Table toolbar, then reorder `tbody` rows or Table columns with Mouse or Touch drag-and-drop. During DnD, the plugin shows the moving row or column and the current destination. During Row Reorder, surrounding rows are displaced to preview the result before it is committed. During Column Reorder, surrounding columns are displaced in iframe editors. In non-iframe editors, surrounding column displacement is intentionally omitted to preserve responsiveness, while the moving column and insertion line continue to show the source and destination.

For Tables with merged cells, only destinations that preserve the supported Table structure are accepted. Rows or columns that cannot be moved because of merged-cell constraints are identified in advance, and a short message explains the reason when a drag is attempted. Row and Column Reorder also support automatic scrolling in the active reorder direction when needed.

When a reorder affects enough cells that applying the change may take some time, the plugin shows a confirmation before applying it. If continued, only the target Table enters a temporary applying state, and editing resumes after the update completes.

## Demo

Try the **currently released Yamabiko Table Reorder Row / Column Reorder** in WordPress Playground.

[▶ Open the demo](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/YamabikoLab/yamabiko-table-reorder/main/demo/blueprint.json)

The demo includes WordPress Core Table and Flexible Table Block examples for Mouse / Touch row and column DnD, including movement constraints for Tables with merged cells. Yamabiko Table Reorder uses the latest stable release in the demo.

Use the `prototype-final` tag when you need to refer to the Prototype v0.4.0 implementation or design.

## Versioning

The distribution history through 0.4.0 is preserved as-is. The term formal v1 describes a new design and implementation generation and does not mean the distribution version changes to `1.0.0`.

0.5.0 was the first formal v1 Row Reorder release. 0.7.0 added formal v1 Column Reorder. 0.8.0 added a confirmation flow for reorders whose affected range may take time to apply. 0.8.1 fixed a conflict between Column Reorder Touch long-presses and cell editing. 0.8.2 improves Column Reorder responsiveness in non-iframe editors, fixes first-use Touch guidance focus behavior, and corrects moving-column feedback when an iframe editor has a horizontal offset.

## Requirements

- WordPress 6.8 or later
- PHP 8.1 or later

## Installation

For a released version, download the distribution ZIP from [GitHub Releases](https://github.com/YamabikoLab/yamabiko-table-reorder/releases).

## Reporting Bugs and Requests

Please use [GitHub Issues](https://github.com/YamabikoLab/yamabiko-table-reorder/issues) for bug reports and feature requests.

Do not post security issues in a public Issue. Follow the [security policy](SECURITY.md) to report them privately.

External Pull Requests are not currently accepted.

## License

Released under the [GNU General Public License v2.0 or later](LICENSE).

## Development

The active formal v1 source is in [`src/`](src/). Use the `prototype-final` tag when referring to the Prototype implementation.

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
