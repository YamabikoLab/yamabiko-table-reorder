# PLAN-422: 列並べ替え実装

## 参照

- 設計起点 Issue: #422
- 実装親 Issue: #458
- 実装 Issue: #459〜#466
- 要件: #422 の議論および現在の列並べ替えに関する設計判断
- 実装ルール: `src/AGENTS.md`。特に Table Reorder implementation rules
- 設計: `docs/development/source-organization.md`。特に現在の `common` / `row-reorder` / `column-reorder` の責務境界

## 目的

Core Table / Flexible Table Block へアクセシブルな列並べ替えを追加するための段階的な実装経路を定義する。

このプランは、実装親 Issue #458 と子 Issue #459〜#466 が参照する design source of truth とし、各フェーズの責務・依存関係・検証方針を現在の実装へ追随させる。

## スコープ

### 対象

- 列並べ替えを `src/column-reorder/` feature boundary として追加する。
- `head` / `body` / `foot` を横断して1列を移動する canonical data transformation を定義する。
- 列 UI に必要な DOM / context 境界を定義する。
- Pointer / Keyboard / single pointer / Touch に対応する column control と interaction flow を定義する。
- `src/common/` の既存 SortableJS runtime loader を利用する。
- 結合セル対応は後続の logical grid フェーズとして分離する。
- unit / integration / E2E の検証方針を定義する。
- 実装 Issue #459〜#466 の進捗と責務境界を、このプラン上の各フェーズと対応付ける。

### 対象外

- このプラン更新タスク内で列並べ替えを実装すること。
- SortableJS の置き換え。
- 複数列の選択・同時移動。
- 複数列にまたがる結合領域を1単位として移動すること。
- 列幅リサイズ。
- 行と列の同時 drag。
- Flexible Table Block 本体への変更。
- 任意の table block に対応する汎用 adapter framework の構築。
- editor browsing-context discovery の再導入。

## 方針

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

列実装で最初から利用する既存共通基盤は次のとおり。

- `src/common/sortable-runtime-loader.ts`

editor DOM context は feature 自身が current editor canvas reference から DOM-local に解決し、browsing-context discovery を共通基盤として持たない。

最初の実装 milestone では結合セルを対象外とする。これにより、最初の data transformation を単純に保ち、logical grid の複雑さを導入する前に UI / controller が依存できる安定した基盤を作る。

## アーキテクチャ

### Plugin entry

列並べ替え実装後は `src/index.tsx` から row / column の両 feature adapter を compose する。

### `src/common/`

列実装で利用する既存責務は次のとおり。

- `sortable-runtime-loader.ts`: owning editor window での SortableJS runtime の load / reuse

Table DOM context や editor browsing-context discovery は `common/` の既存責務としない。row / column の両実装から同一 contract が確認できるまでは、各 feature が自身の DOM context resolution を所有する。

### `src/row-reorder/`

少なくとも初期段階では、次の row 固有責務を変更対象にしない。

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

column feature 側で、実際に必要な DOM context だけを定義する。想定されるのは、block element、table element、editor document / window、および control 配置に必要な section / cell geometry である。

DOM context は Table Reorder が current editor canvas 内に所有する reference element を起点に、DOM-local に解決する。

- `referenceElement.ownerDocument` を現在の editor document とする。
- editor window はその `ownerDocument.defaultView` から取得する。
- `clientId` は同じ document 内の対象 Table block を特定するためにのみ利用する。
- `iframe[name="editor-canvas"]` の探索や `contentDocument` / `contentWindow` fallback は行わない。
- `defaultView` が利用できない場合は、有効な DOM context として扱わない。
- editor `document` / `window` は lifecycle をまたいで cache しない。current reference element から必要な時点で再解決する。

row / column の両実装が揃った後、この DOM-local table-context resolution に実際の同一 contract が確認できた場合のみ、Phase 6 で狭い責務の抽出を検討する。

```text
common/table-context.ts
    ↓
DOM-local な共通 contract が確認できた最小責務のみ

row-reorder/table-context.ts
    ↓
row-specific context

column-reorder/table-context.ts
    ↓
column-specific context / geometry resolution
```

editor browsing-context discovery を共通基盤として再導入しない。

### Block support

既存の row-owned support type へ `colspanProperty` を追加することは前提にしない。

block schema 差分が必要であれば、column implementation は独自の block-specific support boundary から開始する。row / column の両実装が揃った後、supported-block recognition や property mapping に実際の共通責務が確認できた場合は Phase 6 で抽出を検討する。

### Column control layer

実際の `td` / `th` node を SortableJS の sibling list にしない。

table geometry から配置する column-control layer を作成する。SortableJS を使用する場合、実 table cell は Gutenberg / React が所有したままとし、control のみを水平方向へ並べ替える。

commit 時に、確定した `oldColumnIndex` / `newColumnIndex` を1回の attribute transformation へ変換する。

control 実装では少なくとも次を扱う必要がある。

- table position と column width
- current editor canvas reference が属する document / window
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

Keyboard focus、announcement、guidance、invalid move feedback は feature completeness の一部として扱う。

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
- DOM-local table-context resolution のうち実装上同一と確認できた狭い責務

Phase 6 では、各候補について row / column の contract と behavior が実際に一致しているかを確認する。editor browsing-context discovery は共通化候補に含めず、current editor canvas reference を起点とする DOM-local contract を維持する。

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

**進捗: 完了（#459 / PR #467）**

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

**進捗: 実装中（#460 / PR #470）**

- 成果: editor が対応 table を解決し、DOM mutation によって移動を commit せずに、結合セルのない列へ安定した column control を配置できる。
- 作業:
  - column reorder に実際に必要な block-support / table-context 能力だけを追加する。
  - table-context は current editor canvas reference の `ownerDocument` / `defaultView` から DOM-local に解決し、`clientId` は同じ document 内の Table block 特定にのみ利用する。
  - iframe discovery / `contentDocument` / `contentWindow` fallback を行わず、editor context を lifecycle をまたいで cache しない。
  - 薄い plugin entry から feature を接続する。
  - column control を render / position する。
  - row control との共存ルールを定義する。
  - geometry refresh と focus ownership を確立する。
- 検証:
  - deterministic に確認できる範囲は focused jsdom test を追加する。
  - iframe / non-iframe editor で manual verification を行う。
  - row-reorder の behavior regression がないことを確認する。

Phase 2 で現在実装中の geometry refresh、column control、結合セルを prototype 対象外とする方針、row / column feature 分離は変更しない。DOM context resolution のみ DOM-local contract へ追随させる。

`table-context` 実装自体の DOM-local contract 追随は #460 / PR #470 で行い、このプラン更新では実装コードを変更しない。

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

- 成果: row / column の実装を比較し、共通化できる責務を確認する。
- 作業:
  - 実装済みの row / column context、block support、controller lifecycle、focus、status、guidance、scroll を比較する。
  - DOM-local table-context resolution は、row / column で同一 contract が実装から確認できた場合のみ、狭い責務として共通化を検討する。
  - editor browsing-context discovery を共通基盤として再導入しない。
  - 共通化候補ごとに contract と behavior の一致を確認する。
  - 共通化する場合は狭い責務単位で抽出する。
- 検証:
  - 既存 row test が変わらない、またはより単純になることを確認する。
  - column test が引き続き feature contract を証明することを確認する。
  - `common/` が feature implementation に依存しないことを確認する。

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

子 Issue の前提となる column-reorder 固有の architecture decision は次のとおり。

- 最初の実装では `rowSpan` / `colSpan` を対象外とする。
- logical-grid parsing は結合セルフェーズまで導入しない。
- 実 table cell を SortableJS の sortable sibling list にしない。
- 列実装で最初から利用する既存共通基盤は SortableJS runtime loading とする。
- editor DOM context は current editor canvas reference の `ownerDocument` / `defaultView` から feature 内で DOM-local に解決する。
- `clientId` は同じ document 内の対象 Table block 特定にのみ利用し、iframe discovery は行わない。
- editor `document` / `window` は lifecycle をまたいで cache しない。
- 既存の row-owned block support / table context を column 対応のために変更することは前提にしない。

### 実装中に確認する事項

次は先回りして固定せず、実装結果を根拠に判断する。

- 必要十分で信頼できる column-control DOM structure は何か。
- editor / table resize と horizontal scroll に対して、どの geometry refresh mechanism が必要か。
- 最初の control layer は logical column ごとに1 control とするか、handle / destination を分けるか。
- row control と column control が同時表示される場合、hover / activation の優先関係をどうするか。
- guidance / live-status / focus のどこまでが row reorder と同一責務か。
- base block recognition は共有できるほど同一か、それとも row / column の support contract は別のままか。
- row / column 両方が存在した後、DOM-local table-context resolution のどこまでが同一 contract として共通化できるか。
- horizontal auto-scroll のどこまでを row scrolling mechanics から再利用できるか。
- cell editing を妨げず、最も分かりやすい touch interaction は何か。

## 実装 Issue

実装親 Issue は #458 とし、各フェーズは次の子 Issue で追跡する。

- [x] #459: Phase 1 Pure column-order 基盤（PR #467 で完了）
- [ ] #460: Phase 2 Column integration boundary と control prototype（PR #470 で実装中）
- [ ] #461: Phase 3 Keyboard / single-pointer 列並べ替え
- [ ] #462: Phase 4 SortableJS による Pointer drag
- [ ] #463: Phase 5 Touch interaction
- [ ] #464: Phase 6 共通責務レビュー
- [ ] #465: Phase 7 結合セル logical grid と制約
- [ ] #466: Phase 8 E2E 完成

実装上、1つの子 Issue が広すぎる、または2つの子 Issue が強く結合していることが分かった場合は、既存のフェーズ構成を不用意に変更せず、該当 Issue の責務と実装結果を根拠に必要な調整を検討する。

## 検証

このプラン更新のみの変更では次を確認する。

- `git diff --check origin/main...HEAD`
- rendered Markdown を確認し、#458 / #459〜#466 の実装責務とこのプランが矛盾していないことを確認する。
- `src/AGENTS.md` と `docs/development/source-organization.md` の DOM-local context / source boundary と矛盾していないことを確認する。

今後の実装では `docs/development/testing.md` を command source of truth とする。各フェーズで想定する検証は次のとおり。

- pure / controller / UI logic の開発中は focused Jest test を使用する。
- product source 変更の handoff 前に `npm test` と `npm run build` を実行する。
- `git diff --check origin/main...HEAD` を実行する。
- real WordPress / browser interaction、iframe / non-iframe、SortableJS、Touch、保存・再読込、Undo が関係する場合は Playwright E2E を使用する。

## 完了条件

このプランは次を満たす。

- `src/AGENTS.md` の Table Reorder implementation rules を参照し、同じ実装ルールをこのプランへ重複して正本化していない。
- `docs/development/source-organization.md` の現在の source boundary と DOM-local context contract を前提に、column-reorder の実装経路が整理されている。
- 削除済み Editor Environment を利用する前提がなく、既存共通基盤は SortableJS runtime loader のみとして整理されている。
- Column DOM context が current editor canvas reference の `ownerDocument` / `defaultView` を使う DOM-local contract として定義されている。
- iframe discovery を再導入しない方針が Phase 6 を含めて一貫している。
- Phase 1 完了、Phase 2 実装中という現在の進捗が反映されている。
- 結合セルなしの最小実装と、後続の結合セル対応が明確に分離されている。
- column data、DOM、controller、UI、accessibility、validation の責務が、各実装 Issue を進められる粒度で定義されている。
- 未確定の実装詳細が hidden assumption ではなく、実装中の確認事項として明示されている。
- 実装親 Issue #458 と子 Issue #459〜#466 が、このプランを design source of truth として参照できる。

## 補足

実装フェーズは、data correctness から interaction complexity へ進む順番としている。各フェーズを必ず1 PR に対応させる必要はないが、各子 Issue は個別にレビュー可能な成果を持つ。
