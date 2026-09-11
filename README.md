# Yamabiko Table Reorder

WordPressブロックエディターのTable並び替えを扱うプラグインです。

<img width="1897" height="824" alt="demo" src="https://github.com/user-attachments/assets/f7439db3-4524-4a8c-93be-c032eb41787e" />

## 現在の状態

0.8.1では、WordPress Core TableとFlexible Table Blockの**行・列並び替え**を提供します。

Tableツールバーから行または列の並び替えモードへ切り替え、Mouse / TouchによるDnDでtbodyの行やTableの列を並び替えられます。DnD中は移動対象と移動先を視覚的に確認でき、通常は位置が変わる周囲の行または列も移動します。WordPress Editorがiframeを使わない環境で列を並び替える場合は、操作性能を保つため周囲列の移動表示を省略し、移動対象と挿入線で移動先を示します。結合セルを含むTableでは構造を壊さない範囲だけを移動先として扱います。

結合セル制約により移動できない行または列は事前に識別でき、DnD開始を試みた場合は理由を短時間表示します。行・列のDnDでは、対応する方向に必要な自動スクロールを利用できます。

影響範囲が大きく、反映に時間がかかる可能性がある並び替えでは、反映前に移動内容を確認できます。続行した場合は対象Tableだけを一時的な反映中状態にし、更新完了後に編集へ戻ります。

## デモ

WordPress Playgroundで、**現在公開中のYamabiko Table ReorderのRow / Column Reorder**を試せます。

[▶ デモを開く](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/YamabikoLab/yamabiko-table-reorder/main/demo/blueprint.json)

デモではWordPress Core TableとFlexible Table Blockを用意しており、Mouse / Touchによる行・列のDnDと、結合セルを含むTableでの移動制約を確認できます。Yamabiko Table Reorderは公開中のlatest stable releaseを利用します。

Prototype v0.4.0の実装や設計を参照する場合は`prototype-final` tagを使用してください。

## Versioning

0.4.0までの配布履歴はそのまま維持しています。formal v1は新しい設計・実装世代を表す呼称であり、配布バージョンを`1.0.0`へ変更する意味ではありません。

0.5.0はformal v1 Row Reorderの最初の公開版です。0.7.0はformal v1 Column Reorderを追加した最初の公開版です。0.8.0では、影響範囲が大きい並び替えに確認付きの反映フローを追加しました。0.8.1では、Column ReorderのTouch長押しがセル編集と競合する問題を修正しました。

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
