# Yamabiko Table Reorder

WordPress ブロックエディターの Table 並べ替えを扱うプラグインです。

> [!IMPORTANT]
> `main` は現在、正式な Requirements / Design / Architecture / Plan に基づいて **formal YTR v1** を実装している段階です。0.4.0 までの実装は **YTR Prototype** として `prototype-final` tag に保存されています。

## 現在の状態

formal v1 は Prototype の実装構造を引き継がず、操作仕様・アクセシビリティ・性能要件から再設計しています。

そのため、`main` の active source / E2E / docs は意図的に最小構成です。Prototype の具体的な操作モデルや内部実装は formal v1 の現行仕様として扱いません。

## Prototype v0.4.0 デモ

既に共有済みの WordPress Playground デモは、**YTR Prototype v0.4.0 の保存済みデモ**として引き続き利用できます。

[▶ Prototype v0.4.0 のデモを開く](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/YamabikoLab/yamabiko-table-reorder/main/demo/blueprint.json)

このデモは v0.4.0 release を明示的にインストールします。formal v1 の現在の `main` 実装を示すものではありません。

## Versioning

0.4.0 までの配布履歴はそのまま維持します。formal v1 の開発後も配布バージョンは既存履歴から継続し、次の release は **0.5.0** とします。

`formal v1` は新しい設計・実装世代を表す呼称であり、配布バージョンを `1.0.0` へ変更する意味ではありません。

## 動作環境

- WordPress 6.8 以上
- PHP 8.1 以上

## インストール

公開済み release を利用する場合は、[GitHub Releases](https://github.com/YamabikoLab/yamabiko-table-reorder/releases) から配布用 ZIP を取得してください。

## 不具合・要望の報告

不具合報告と機能要望は [GitHub Issues](https://github.com/YamabikoLab/yamabiko-table-reorder/issues) で受け付けています。

セキュリティ上の問題は公開 Issue へ投稿せず、[セキュリティポリシー](SECURITY.md)に従って非公開で報告してください。

現時点では、外部からの Pull Request は受け付けていません。

## ライセンス

[GNU General Public License v2.0 or later](LICENSE) で公開します。

## 開発者向け

formal v1 の active source は [`src/`](src/) にあります。Prototype の実装を参照するときは `prototype-final` tag を使用してください。

### 依存関係をインストール

```bash
npm ci
composer install
```

### 開発モードを開始

```bash
npm start
```

ローカル WordPress 開発環境の設定、起動手順、プラグイン配置は、別リポジトリの [YamabikoLab/wp-dev](https://github.com/YamabikoLab/wp-dev) で管理しています。

### 本番ビルドを作成

```bash
npm run build
```

ビルド結果は `build/` に出力されます。

### コードを検証

```bash
npm test
```

PHP のチェックは別に実行します。

```bash
composer lint:php
composer analyse:php
```

詳細な検証方法は [`docs/development/testing.md`](docs/development/testing.md) を参照してください。

### 開発ドキュメント

- [開発方針](docs/development/foundation.md)
- [検証方法](docs/development/testing.md)
- [GitHub CLI](docs/development/github-cli.md)
- [i18n](docs/development/i18n.md)
- [セキュリティ](docs/development/security.md)
- [リリース方法](docs/development/releasing.md)
