# PLAN-422: 列並べ替え実装

## 参照

- 親 Issue: #422
- 要件: #422 の議論および現在の列並べ替えに関する設計判断
- 設計: `docs/development/source-organization.md`。特に #449 / PR #450 で確立した `common` / `row-reorder` の責務境界

## 目的

既存の行並べ替え実装へ列固有の振る舞いを結合せず、また実際の再利用が確認される前に共通 abstraction を導入せずに、Core Table / Flexible Table Block へアクセシブルな列並べ替えを追加するための段階的な実装経路を定義する。

このプランは、実装親 Issue と、境界が安定し個別にレビュー可能な少数の子 Issue を作成できる粒度まで具体化する。

## スコープ

### 対象

- 列並べ替えを独立した `src/column-reorder/` feature boundary として追加する。
- `head` / `body` / `foot` を横断して1列を移動する canonical data transformation を定義する。
- 行専用 context を先回りして変更せず、列 UI に必要な DOM / context 境界を定義する。
- Pointer / Keyboard / single pointer / Touch に対応する column control と interaction flow を定義する。
- `src/common/` の既存 Editor Environment と SortableJS runtime loader を再利用する。
- row / column 間の重複を feature 内に残す条件と、`common/` へ移す条件を定義する。
- 結合セル対応は後続の logical grid フェーズとして分離する。
- unit / integration / E2E の検証方針を定義する。
- このプランのレビュー後に、子 Issue の分割案を確定する。

### 対象外

- このプラン作成タスク内で列並べ替えを実装すること。
- 列実装が存在する前に、行並べ替えを汎用 row / column controller へリファクタリングすること。
- 既存の行実装へ `axis: 'row' | 'column'` abstraction を導入すること。
- 将来の再利用を見越して、行固有の block support、table context、guidance、live status、scroll、drag UI、controller lifecycle を `common/` へ移すこと。
- SortableJS の置き換え。
- 複数列の選択・同時移動。
- 複数列にまたがる結合領域を1単位として移動すること。
- 列幅リサイズ。
- 行と列の同時 drag。
- Flexible Table Block 本体への変更。
- 任意の table block に対応する汎用 adapter framework の構築。

## 方針

まず列並べ替えを独立 feature として実装し、行・列の実装が両方存在してから共通コードを比較・抽出する。

初期の依存関係は次とする。

```text
                   src/index.tsx
                   /           \
                  ↓             ↓
          row-reorder/    column-reorder/
                  \             /
                   ↓           ↓
                      common/
```

`column-reorder/` から `row-reorder/` の実装詳細へ依存させない。

最初から共有するのは、すでに feature-neutral かつ責務が安定している次のものだけとする。

- `src/common/editor-environment.ts`
- `src/common/sortable-runtime-loader.ts`

その他については、不明瞭な abstraction より小さな重複を許容する。共通化は、row / column の両 consumer が同じ安定した責務を必要とすることを実装上確認してから検討する。

列移動では Gutenberg attributes を canonical data source とする。最終的な列順について、実 table DOM を authoritative state としない。

最初の実装 milestone では結合セルを対象外とする。これにより、最初の data transformation を単純に保ち、logical grid の複雑さを導入する前に UI / controller が依存できる安定した基盤を作る。

## アーキテクチャ

### Plugin entry

`src/index.tsx` は plugin 全体の薄い entry のまま維持する。列並べ替え実装後は row / column の両 feature adapter を compose してよいが、feature logic 自体は持たせない。

### `src/common/`

既存の共通 environment / runtime 責務を維持する。

- `editor-environment.ts`: stale な lifecycle state を cache せず、現在の iframe / non-iframe editor browsing context を解決する。
- `sortable-runtime-loader.ts`: owning editor window で SortableJS runtime を load / reuse する。

row と column のコードが似ているという理由だけで、初期フェーズ中に `common/` を拡張しない。

### `src/row-reorder/`

実際の column implementation により安定した共通責務が確認されない限り変更しない。

少なくとも初期段階では、次を row 側の責務として維持する。

- row block support
- row table context
- `rowspan` 制約
- row order
- row control / move target
- row message / style
- row controller lifecycle
- row guidance / live status / scroll behavior

### `src/column-reorder/`

実装開始時にこの boundary を作成する。想定責務は次のとおり。

```text
src/column-reorder/
├── column-order.ts
├── column-order.test.ts
├── block-support.ts              # 実実装で必要になった場合のみ
├── table-context.ts              # 実実装で必要になった場合のみ
├── messages.ts                   # user-visible な列 UI が必要になった時点
├── editor.scss                   # 列 UI が必要になった時点
├── use-column-reorder*.ts(x)     # 実際の integration pressure に応じて決定
└── controller/
    ├── sortable-controller.ts    # column-owned controller
    └── reorder-ui/               # 必要な column control / destination / status
```

これは責務の概略であり、placeholder file を作成したり、row 側の tree をそのまま再現したりすることを要求するものではない。

### 列データ変換

最初の pure function では、既存の各 table section に対して、0-based の1つの column index を別の位置へ決定的に移動する。

概念的には次の形とする。

```ts
moveColumn( attributes, oldColumnIndex, newColumnIndex )
```

実際の public API は異なってよいが、振る舞いは次を満たす必要がある。

- 存在する `head` / `body` / `foot` を処理する。
- 各 row で同じ column index を移動する。
- 存在しない section はそのまま維持する。
- cell object と cell data を保持し、配列順だけを変更する。
- caption data 等の無関係な attributes を変更しない。
- 対象 row が一貫した利用可能な列構造を持たない場合は、安全に変換を拒否する。
- 保存・再読込・Undo が Gutenberg の1回の `setAttributes()` commit として自然に成立する data を返す。

この pure transformation は DOM、SortableJS、React、WordPress editor context に依存させない。

### Column DOM context

column code が存在する前に `row-reorder/table-context.ts` を拡張しない。

column feature 側で、実際に必要な DOM context だけを最初に定義する。想定されるのは、block element、table element、editor document / window、および control 配置に必要な section / cell geometry である。

後に row / column の context が同じ安定した base discovery を重複して持つことが確認された場合は、例えば次のような狭い common table context の抽出を検討する。

```text
common/table-context.ts
    ↓
blockElement
table
document
window

row-reorder/table-context.ts
    ↓
common base + tbody

column-reorder/table-context.ts
    ↓
common base + column-specific section/geometry resolution
```

この抽出は任意であり、実際に存在する consumer によって正当化される必要がある。

### Block support

既存の row-owned support type へ、先回りして `colspanProperty` を追加しない。

block schema 差分が必要であれば、column implementation は独自の block-specific support boundary から始めてよい。後に row / column が同じ supported-block recognition や property mapping 責務を共有すると確認できた場合に、その安定した部分だけを抽出する。

### Column control layer

実際の `td` / `th` node を SortableJS の sibling list にしない。

table geometry から配置する column-control layer を作成する。SortableJS を使用する場合、実 table cell は Gutenberg / React が所有したままとし、control のみを水平方向へ並べ替える。

commit 時に、確定した `oldColumnIndex` / `newColumnIndex` を1回の attribute transformation へ変換する。

control 実装では少なくとも次を扱う必要がある。

- table position と column width
- editor iframe / non-iframe の owning context
- table の horizontal scroll
- editor / table の変化後の control geometry refresh
- row control との共存
- commit / cancel 後の focus restoration

geometry 更新の具体的な仕組みはこのプランで固定せず、実装時に必要十分で信頼できる最小の方法を選ぶ。

### Interaction model

column 固有の mechanics は許容しつつ、可能な範囲で row reorder と同じ user-facing mental model を維持する。

想定する振る舞いは次のとおり。

- Pointer drag: column control を水平方向へ drag する。
- Single pointer: column control を activate し、移動先を選択する。
- Keyboard: `Enter` / `Space` で開始・確定、`ArrowLeft` / `ArrowRight` で移動、`Escape` で cancel する。
- Touch: column reorder mode に入り、実装した interaction design に応じて destination tap および / または long-press drag を使用する。

Keyboard focus、announcement、guidance、invalid move feedback は optional polish ではなく feature completeness の一部として扱う。

### 共通化レビューのタイミング

基本的な column pointer / keyboard behavior が成立した後、row / column 実装を比較する。

共通化候補には次が含まれる。

- live status / announcement plumbing
- guidance lifecycle
- scroll-target logic
- focus restoration helper
- controller setup / cleanup の共通部分
- interaction state の共通部分
- supported-block recognition
- base table-context discovery

2つの実装が同じ contract と behavior を必要とする場合にのみ `common/` へ移動する。名前や見た目が似ているだけでは共通化の根拠にしない。

### 結合セルと logical grid

最初の結合セルなし実装には logical grid code を導入しない。

`rowSpan` / `colSpan` 対応を開始する段階で、各 cell について次を解決できる pure logical table / column grid を追加する。

- section
- row index
- attribute / DOM cell index
- logical start column
- `colSpan` により占有する logical column
- `rowSpan` により占有する logical row

結合セルに関する制約は次のとおり。

- 複数列にまたがる `colSpan` 領域内部の logical column を単独で移動できない。
- `colSpan` 領域内部の insertion boundary は無効とする。
- 無効な移動では attributes を変更しない。
- 結合された複数列領域全体を1単位で移動する機能は対象外とする。
- `rowSpan` 自体は列を無効化する理由ではないが、physical cell index が row ごとに異なる場合でも grid が正しい column position を解決する必要がある。

`row-reorder/rowspan.ts` は row-specific のまま維持し、whole-table grid parser へ拡張しない。

## 実装フェーズ

### Phase 1: Pure column-order 基盤

- 成果: column movement を DOM / UI から独立して定義し、結合セルのない Core Table / Flexible Table Block 形状の attributes を安全に変換できる。
- 作業:
  - `src/column-reorder/` を作成する。
  - `column-order.ts` と focused test を実装する。
  - 存在する `head` / `body` / `foot` を処理する。
  - 無関係な attributes と cell object を保持する。
  - 不整合な row shape を安全に拒否する。
  - feature boundary が実体化した時点で source organization を文書化する。
- 検証:
  - 通常移動、境界 index、section 不在、不整合 row、immutability expectation を focused Jest で確認する。
  - code 導入時は repository の Node / build checks を行う。

### Phase 2: Column integration boundary と control prototype

- 成果: editor が対応 table を解決し、DOM mutation によって移動を commit せずに、結合セルのない列へ安定した column control を配置できる。
- 作業:
  - column reorder に実際に必要な block-support / table-context 能力だけを追加する。
  - 薄い plugin entry から feature を接続する。
  - column control を render / position する。
  - row control との共存ルールを定義する。
  - geometry refresh と focus ownership を確立する。
- 検証:
  - deterministic に確認できる範囲は focused jsdom test を追加する。
  - iframe / non-iframe editor で manual verification を行う。
  - row-reorder の behavior regression がないことを確認する。

### Phase 3: Keyboard / single-pointer 列並べ替え

- 成果: drag を使わずに列を並べ替えられ、アクセシブルかつ決定的な state model が成立する。
- 作業:
  - activation、destination movement、commit、cancel、focus restoration を実装する。
  - `ArrowLeft` / `ArrowRight` による keyboard movement を実装する。
  - 必要な announcement / guidance を追加する。
  - single-pointer destination selection を実装する。
- 検証:
  - focused controller / UI Jest test を追加する。
  - keyboard / manual accessibility check を行う。
  - commit 後の保存・再読込・Undo を確認する。

### Phase 4: SortableJS による Pointer drag

- 成果: Pointer user が column control を水平方向に drag でき、drag 中も実 table cell DOM は変更されない。
- 作業:
  - `common/sortable-runtime-loader.ts` を利用する。
  - control layer 向けに horizontal SortableJS behavior を構成する。
  - old / new index を解決し、`column-order` 経由で commit する。
  - 必要な horizontal scrolling behavior を実装する。
  - cancel / focus behavior を維持する。
- 検証:
  - 有効な箇所では mocked SortableJS を使った focused controller test を追加する。
  - real browser で Pointer DnD E2E を行う。
  - drag 中に canonical table DOM ownership と競合しないことを確認する。

### Phase 5: Touch interaction

- 成果: Touch user が row reorder と同等の安全性・feedback expectation で列を並べ替えられる。
- 作業:
  - 必要十分で一貫した touch mode を定義する。
  - 実装結果に応じて destination tap および / または long-press drag をサポートする。
  - reorder interaction 中の意図しない table editing を防ぐ。
  - 必要に応じて touch-specific guidance / focus handling を追加する。
- 検証:
  - focused touch controller test を追加する。
  - real touch / pointer の Playwright coverage を追加する。

### Phase 6: 共通責務レビュー

- 成果: 実際に確認された安定した row / column の重複だけを `common/` へ抽出する。
- 作業:
  - 実装済みの row / column context、block support、controller lifecycle、focus、status、guidance、scroll を比較する。
  - contract が異なるものは feature-local のまま維持する。
  - row / column conditional を持ち込まずに重複を減らせる場合だけ、狭い common module を抽出する。
- 検証:
  - 既存 row test が変わらない、またはより単純になることを確認する。
  - column test が引き続き feature contract を証明することを確認する。
  - `common/` がどちらの feature にも依存しないことを確認する。

### Phase 7: 結合セル logical grid と制約

- 成果: table structure を壊さず、`rowSpan` / `colSpan` を正しく扱って列並べ替え可否を判断できる。
- 作業:
  - pure logical-grid resolution を実装する。
  - 無効な source column と insertion boundary を検出する。
  - grid を column-order validation と UI availability に統合する。
  - 結合セル data をすべて保持しつつ、構造的に安全な移動だけを許可する。
- 検証:
  - grid occupancy と valid / invalid boundary を網羅する unit case を追加する。
  - Core Table / Flexible Table Block の結合セルを real browser で確認する。
  - 保存・再読込・Undo を確認する。

### Phase 8: E2E 完成

- 成果: 対応する column-reorder workflow を、代表的な WordPress editor environment 全体で検証できる。
- 作業:
  - core user flow と data persistence の E2E を追加する。
  - 実装済み scope に応じて Pointer、Keyboard、Touch、保存・再読込、Undo、iframe / non-iframe、結合セル制約をカバーする。
  - deterministic な unit case を E2E へ重複させない。
- 検証:
  - 既存 PR Validation matrix の WordPress 6.8.3 / 7.0.4 / 7.1.0 で確認する。
  - E2E で安定して assertion しにくい behavior は focused manual check を行う。

## 設計判断と実装中の確認事項

### 実装前に確定する事項

子 Issue の前提となる architecture decision は次のとおり。

- `column-reorder/` は独立した feature boundary とする。
- `column-reorder/` から `row-reorder/` へ依存させない。
- Gutenberg attributes を canonical data source / commit target とする。
- 最初の実装では `rowSpan` / `colSpan` を対象外とする。
- logical-grid parsing は結合セルフェーズまで導入しない。
- 実 table cell を SortableJS の sortable sibling list にしない。
- 既存責務のうち、最初から共有前提とするのは Editor Environment と SortableJS runtime loading のみとする。
- 既存の row-owned block support / table context を column 対応のために先回りして拡張しない。
- 実際の重複が確認される前に generic row / column controller や `axis` abstraction を導入しない。

### 実装中に確認する事項

次は先回りして固定せず、実装結果を根拠に判断する。

- 必要十分で信頼できる column-control DOM structure は何か。
- editor / table resize と horizontal scroll に対して、どの geometry refresh mechanism が必要か。
- 最初の control layer は logical column ごとに1 control とするか、handle / destination を分けるか。
- row control と column control が同時表示される場合、hover / activation の優先関係をどうするか。
- guidance / live-status / focus のどこまでが row reorder と本当に同一責務か。
- base block recognition は共有できるほど同一か、それとも row / column の support contract は別のままか。
- row / column 両方が存在した後、base table DOM discovery は `common/` へ抽出できるほど安定しているか。
- horizontal auto-scroll のどこまでを row scrolling mechanics からそのまま再利用できるか。
- cell editing を妨げず、最も分かりやすい touch interaction は何か。

## Issue 分割案

実装親 Issue と子 Issue は、このプランのレビュー後に作成する。初期案は次のとおり。

- [ ] 親: 対応 Table block に列並べ替えを実装する。
- [ ] 子: `column-reorder` boundary と結合セルなしの pure `column-order` transformation を追加する。
- [ ] 子: column block / context integration と column-control UI を追加する。
- [ ] 子: Keyboard / single-pointer 列並べ替えを実装する。
- [ ] 子: SortableJS による Pointer drag と horizontal scrolling を実装する。
- [ ] 子: Touch 列並べ替えを実装する。
- [ ] 子: row / column の重複をレビューし、確認できた共通責務だけを抽出する。
- [ ] 子: logical grid と結合セルの列制約を追加する。
- [ ] 子: column-reorder E2E と保存・Undo scenario を完成させる。

実装上、1つの子 Issue が広すぎる、または2つの子 Issue が強く結合していることが分かった場合は、この暫定リストへ無理に合わせず、該当 Issue を作成する前に分割を調整する。

## 検証

このプラン作成のみの変更では次を確認する。

- `git diff --check origin/main...HEAD`
- rendered Markdown を確認し、#422 がこの document と詳細設計を重複せず、簡潔な plan-creation Issue として成立することを確認する。

今後の実装では `docs/development/testing.md` を command source of truth とする。各フェーズで想定する検証は次のとおり。

- pure / controller / UI logic の開発中は focused Jest test を使用する。
- product source 変更の handoff 前に `npm test` と `npm run build` を実行する。
- `git diff --check origin/main...HEAD` を実行する。
- real WordPress / browser interaction、iframe / non-iframe、SortableJS、Touch、保存・再読込、Undo が関係する場合は Playwright E2E を使用する。

## 完了条件

この planning Issue は次を満たしたときに完了とする。

- #449 / PR #450 で確立した source boundary がこのプランへ反映されている。
- 結合セルなしの最小実装と、後続の結合セル対応が明確に分離されている。
- 第2の実 consumer が存在しない row-owned code を shared として扱っていない。
- column data、DOM、controller、UI、accessibility、validation の責務が、実装 Issue を作成できる粒度で定義されている。
- 未確定の実装詳細が hidden assumption ではなく、実装中の確認事項として明示されている。
- レビュー後、このプランから安定した親子 Issue 分割を作成できる。
- #422 が詳細設計を重複せず、このプランを design source of truth として参照できる。

## 補足

実装フェーズは、data correctness から interaction complexity へ進む順番としている。各フェーズを必ず1 PR に対応させる必要はないが、各子 Issue は個別にレビュー可能な成果を持ち、feature 実装へ無関係な将来の abstraction work を混在させない。

最も重要な guardrail は、実装上の必要性から共通責務を発見することである。row reorder を永遠に重複実装することが目的ではない。column reorder という実例が存在する前に、PR #450 で明確化した `common` boundary を speculative shared bucket へ戻さないことを優先する。
