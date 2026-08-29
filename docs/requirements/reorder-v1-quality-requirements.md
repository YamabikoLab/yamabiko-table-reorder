# Reorder v1 Quality Requirements

## 1. 目的

本書は、Yamabiko Table Reorder 正式 v1 が満たす必要のある Quality Requirements を定義する。

正式 v1 の Quality Requirements の正本は本書とする。

本書では、利用者および製品から見た品質上の結果と保証範囲を定義し、具体的な実現方法は扱わない。

Accessibility Requirements は本書とは別の要件定義書で管理する。

## 2. Quality Requirements

| ID | 項目 | 要件 |
| --- | --- | --- |
| QR-01 | Performance | Reorder v1 で想定する最大規模までの Table においても、視覚フィードバックやアニメーションを含む行・列 DnD を、利用者の操作を妨げない応答性で利用できる。 |
| QR-02 | Compatibility | 対応する Table Block および Editor 環境の違いによって、Reorder v1 で定義された並び替え機能の正しさや利用可能性が損なわれない。 |
| QR-03 | Reliability / Robustness | Reorder 操作を継続できない状態または内部エラーが発生した場合でも、Table や Editor を不正な状態にせず、Reorder 操作を安全に終了し、その後も Table 編集を継続できる。 |

## 3. QR-01 Performance

### 3.1 大規模 Table の対象範囲

次のいずれかを満たし、かつ後述の想定最大規模以下である Table を大規模 Table として扱う。

- 400 行以上
- 12 列以上
- 2,000 セル以上

### 3.2 想定する最大規模

Reorder v1 で想定する現実的な最大規模は次とする。

- 1,000 行
- 20 列
- 20,000 セル

QR-01 の性能保証対象は、行数、列数、セル数の各指標が上記の最大規模以内に収まる Table までとする。

上記を超える Table は QR-01 の性能保証対象には含めない。

### 3.3 設計との境界

本書では、利用者の操作を妨げない応答性と、その品質保証の対象規模を定義する。

性能を実現するための内部処理上の制約や構造は Architecture で管理する。

現時点では共通の benchmark に基づく根拠がないため、`16ms 以内`などの固定された性能数値は Quality Requirement として定義しない。

## 4. QR-02 Compatibility

### 4.1 対応する Table Block

正式 v1 では、次の Table Block を Compatibility の保証対象とする。

- WordPress Core Table
- Flexible Table Block

どの Table Block を正式 v1 の機能対象とするかは、Functional Requirements の `FR-13` で定義する。

QR-02 では、対応する Table Block の違いによって、正式 v1 で定義された並び替え機能の正しさや利用可能性が損なわれないことを品質として定義する。

### 4.2 対応する Editor 環境

正式 v1 で対応する Editor 環境の正本は本書とする。

QR-02 の Compatibility 保証対象は、WordPress 6.8 以上の Block Editor において、対応する Table Block を編集できる Editor 環境とする。

WordPress version や Editor 環境の違いによって、編集領域が iframe / non-iframe のいずれになる場合も Compatibility 保証対象に含める。

WordPress 6.8 未満、および Block Editor 以外の編集環境は正式 v1 の Compatibility 保証対象には含めない。

### 4.3 設計との境界

本書では、対応する Table Block や Editor 環境の違いがあっても、正式 v1 で定義された機能の正しさや利用可能性が保たれることを定義する。

環境差をどのように吸収するか、どの責務がその差を扱うかなどの実現方法は Architecture で管理する。

## 5. QR-03 Reliability / Robustness

### 5.1 保証する品質

外部環境の変化などによって Reorder 操作を継続できなくなった場合や、Reorder 内部のエラーが発生した場合でも、次を満たす。

- Table や Editor を不正な状態にしない。
- 継続できない Reorder 操作を安全に終了する。
- その後も Table 編集を継続できる。

通常の Reorder 操作における成立条件、データ保持、構造保持、キャンセル時の扱いなどは Functional Requirements で定義し、本書には重複して定義しない。

### 5.2 設計との境界

本書では、異常な状況でも安全に操作を終了し、その後の編集を継続できることを品質上の結果として定義する。

異常状態の分類、検出、処理、復旧、記録などの具体的な実現方法は Architecture で管理する。

## 6. Maintainability と Security の扱い

### Maintainability

Maintainability は、正式 v1 の現時点では独立した Quality Requirement として定義しない。

保守性に関する具体的な制約は Architecture および source code guidelines で管理する。

抽象的な「保守しやすいこと」を追加しても新しい受け入れ基準にならないため、本書では独立した QR を設けない。

### Security

Security も、正式 v1 の現時点では独立した Quality Requirement として定義しない。

現在の製品範囲に必要な security boundary と再評価条件は development documentation で管理する。

将来、製品の attack surface が変化する機能を追加する場合は、Security の Quality Requirement が必要かを再評価する。

## 7. Accessibility Requirements との分離

Accessibility Requirements は本書では定義しない。

Keyboard、ドラッグを必要としない操作、focus、announcement、支援技術への情報提供など、アクセシビリティ上必要な要件は独立した要件定義書で管理する。

本書では Accessibility Requirements の内容を重複して定義しない。

## 関連

- #546 DnD の performance architecture を整理する
- #582 大規模 Table の performance 要件を整理する
- #605 Reorder の例外処理・異常状態の扱いを整理する
- #606 Reorder v1 の Quality Requirements 専用要件定義書を作成する
