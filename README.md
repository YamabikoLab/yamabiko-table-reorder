# Yamabiko Table Reorder

WordPressブロックエディターのTable並び替えを扱うプラグインです。

## 現在の状態

0.5.0では、WordPress Core TableとFlexible Table Blockの**行並び替え**を提供します。

Tableツールバーから行並び替えモードへ切り替え、Mouse / TouchによるDnDでtbodyの行を並び替えられます。DnD中は移動対象・移動先・周囲の行の移動を視覚的に確認でき、結合セルを含むTableでは構造を壊さない範囲だけを移動先として扱います。

列並び替えは0.5.0には含まれません。現在、次の機能として開発中です。

## Prototype v0.4.0 デモ

既に共有済みのWordPress Playgroundデモは、**YTR Prototype v0.4.0の保存済みデモ**として引き続き利用できます。

[▶ Prototype v0.4.0のデモを開く](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/YamabikoLab/yamabiko-table-reorder/main/demo/blueprint.json)

このデモはv0.4.0 releaseを明示的にインストールします。0.5.0の現在の実装を示すものではありません。Prototypeの実装や設計を参照する場合は`prototype-final` tagを使用してください。

## Versioning

0.4.0までの配布履歴はそのまま維持しています。formal v1は新しい設計・実装世代を表す呼称であり、配布バージョンを`1.0.0`へ変更する意味ではありません。

0.5.0はformal v1 Row Reorderの最初の公開版です。

## 動作環境

- WordPress 6.8以上
- PHP 8.1以上

## インストール

公開済みreleaseを利用する場合は、[GitHub Releases](https://github.com/YamabikoLab/yamabiko-table-reorder/releases)から配布用ZIPを取得してください。

## 不具合・要望の報告

不具合報告と機能要望は[GitHub Issues](https://github.com/YamabikoLab/yamabiko-table-reorder/issues)で受け付けています。

セキュリティ上の問題は公開Issueへ投稿せず、[セキュリティポリシー](SECURITY.md)に従って非公開で報告してください。

現時点では、外部からのPull Requestは受け付けていません。

## ライセンス

[GNU General Public License v2.0 or later](LICENSE)で公開します。

## 開発者向け

formal v1のactive sourceは[`src/`](src/)にあります。Prototypeの実装を参照するときは`prototype-final` tagを使用してください。

### 依存関係をインストール

```bash
npm ci
composer install
```

### 開発モードを開始

```bash
npm start
```

ローカルWordPress開発環境の設定、起動手順、プラグイン配置は、別リポジトリの[YamabikoLab/wp-dev](https://github.com/YamabikoLab/wp-dev)で管理しています。

### 本番ビルドを作成

```bash
npm run build
```

ビルド結果は`build/`に出力されます。

### コードを検証

```bash
npm test
```

PHPのチェックは別に実行します。

```bash
composer lint:php
composer analyse:php
```

詳細な検証方法は[`docs/development/testing.md`](docs/development/testing.md)を参照してください。

### 開発ドキュメント

- [開発方針](docs/development/foundation.md)
- [検証方法](docs/development/testing.md)
- [GitHub CLI](docs/development/github-cli.md)
- [i18n](docs/development/i18n.md)
- [セキュリティ](docs/development/security.md)
- [リリース方法](docs/development/releasing.md)
