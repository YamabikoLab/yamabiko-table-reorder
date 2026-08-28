# PLAN-499: Reorder v1実装

## References

- Parent issue: #499
- Reconstruction issue: #569
- Implementation parent: #539
- Requirements: `docs/requirements/reorder-v1-requirements.md`
- Design: `docs/design/reorder-v1-design.md`
- Architecture: `docs/architecture/reorder-v1-architecture.md`

## Goal

確定したReorder v1 Architectureを、現在の実装状態から先へ進められる実装順、レビュー可能な実装単位、検証方法、Issue分割へ落とし込む。

Core TableとFlexible Table Blockの行・列DnDを、Architectureで定義された責務境界を維持したまま段階的に完成させる。

## Current implementation baseline

以下は実装済みで、現在のArchitectureと一致しているため維持する。

- Editor DOM Context
- Reorder Mode
- `src/reorder/reorder-mode.ts`までの現在のsource状態

Reorder Constraint Resolutionは独立責務として実装しない。以降の実装順は現在のArchitectureから再構成する。

## Scope

### Included

- Table Integration
- Reorder Target Resolution
- Drop Target Resolution
- DnD InteractionとReorder Session
- Data Update
- PC / タッチのInput Interaction
- Reorder Presentation
- Auto Scroll
- First-use Guidance
- Reorder Rediscovery
- Core Table / Flexible Table Blockの統合
- 大規模TableのPerformance検証
- 正式v1の主要E2E

### Not included

- Keyboard操作、ドラッグを必要としない操作、focus、announcementなど、別要件として扱うアクセシビリティ実装
- Requirements、Design、Architectureの再定義
- Reorder Constraint Resolution、DnDをまたぐconstraint cache、structure revision、cache invalidation、Table構造監視
- PrototypeまたはArchitecture確定前のformal v1実装構造の復元

## Approach

- `docs/architecture/reorder-v1-architecture.md`をArchitectureの正本として扱い、Planでは責務、Contract、Dependency、Lifecycle、Invariantを再定義しない。
- 実装は現在の`src/reorder/reorder-mode.ts`までの状態から継続する。
- `src/`の配置は`src/AGENTS.md`と確定済みのsource境界に従う。
- Table plugin固有の構造取得とデータ更新はTable Integrationの実装境界に閉じ込める。
- Reorder Target ResolutionはDnD開始試行時に現在の共通Table structureを利用し、移動対象判定とそのDnDで使う制約情報の導出を成立させる。
- 導出した制約情報は成立したReorder Sessionで1回のDnD中だけ保持し、完了またはキャンセル時に破棄する。
- Drop Target ResolutionはDnD Interactionから渡された判定入力だけで移動先を判定できる実装とする。
- Data Updateは確定済みの並び替えだけをTable Integration経由で反映する。
- Input Interaction、Presentation、Auto Scroll、Guidanceは共通DnD基盤の成立後に統合する。
- 実装中にArchitecture変更が必要になった場合は、Planで解決せずArchitectureを先に更新する。

## Implementation phases

### Phase 1: 実装済み基盤

- Outcome: 後続実装が利用するEditor DOM ContextとReorder Modeが利用可能である。
- Status: 完了。
- Completed Issues:
  - #547 sourceの共通・行・列モジュール境界
  - #540 Editor DOM Context
  - #541 Reorder Mode
  - #542 Reorder Constraint Resolutionは独立責務として実装しないため終了
- Validation:
  - 既存のJest coverageを維持する。

### Phase 2: Table境界と開始時判定

- Outcome: 対応Tableから現在の共通Table structureを取得し、DnD開始試行時に移動対象とそのDnD用制約情報を解決できる。
- Issues:
  - #571 Table Integrationを実装する。
  - #572 Reorder Target Resolutionを実装する。
- Validation:
  - Table plugin固有表現がReorder coreへ漏れないことをJestまたはレビューで確認する。
  - 対応不能Tableでは不完全な共通structureを返さないことを確認する。
  - 行・列の移動対象判定と制約情報導出をJestで確認する。

### Phase 3: Drop判定と共通DnD Session

- Outcome: 1回のDnDについて、開始、進行、移動先判定、完了、キャンセルを共通Reorder Sessionで管理できる。
- Issues:
  - #573 Drop Target Resolutionを実装する。
  - #574 DnD InteractionとReorder Sessionを実装する。
- Validation:
  - Drop Target ResolutionがTable IntegrationやTable全体構造を参照しないことを確認する。
  - Session開始条件、destination更新、完了、キャンセル、Session破棄をJestで確認する。
  - DnD完了またはキャンセル後に制約情報を持ち越さないことを確認する。

### Phase 4: 確定更新

- Outcome: 有効な移動先で完了した並び替えだけを対象Tableへ1回反映できる。
- Issue:
  - #575 Data Updateを実装する。
- Validation:
  - commitだけで更新され、cancel / invalid completionでは更新されないことを確認する。
  - Core Table / Flexible Table Blockの行・列更新とデータ保持を確認する。
  - Undo単位を確認する。

### Phase 5: Input Interaction

- Outcome: PCとタッチ端末の入力が共通DnD Interactionへ接続される。
- Issues:
  - #576 PC向けInput Interactionを実装する。
  - #577 タッチ向けInput Interactionを実装する。
- Validation:
  - 入力方式固有の状態がDnD Interactionへ漏れないことをJestまたはレビューで確認する。
  - PC / タッチの主要入力フローをPlaywrightで確認する。

### Phase 6: Reorder Presentation

- Outcome: 並び替えモード、移動不可、DnD進行、確定、キャンセルの主要な視覚フィードバックが成立する。
- Issue:
  - #578 Reorder Presentationを実装する。
- Validation:
  - TableデータをDnD中に変更せず主要な表示が成立することをPlaywrightまたは実環境で確認する。
  - 大規模Tableで無関係な行・列まで一斉更新しない実装になっていることを確認する。

### Phase 7: Auto Scroll

- Outcome: 画面内に収まらないTableでもDnDを継続できる。
- Issue:
  - #579 Auto Scrollを実装する。
- Validation:
  - 行では横、列では縦へ不要なAuto Scrollを行わないことを確認する。
  - 対応editor環境でPlaywrightまたは実環境確認を行う。

### Phase 8: Guidance

- Outcome: First-use GuidanceとReorder Rediscoveryが正式v1の操作へ統合される。
- Issues:
  - #580 First-use Guidanceを実装する。
  - #581 Reorder Rediscoveryを実装する。
- Validation:
  - PC / タッチの主要案内フローをPlaywrightで確認する。
  - 通常編集を妨げないことを確認する。

### Phase 9: Performanceと統合E2E

- Outcome: 正式v1全体が対応Tableと想定最大規模で実用的に利用できることを確認する。
- Issues:
  - #582 大規模TableのPerformanceを検証・調整する。
  - #583 Core TableとFlexible Table Blockの正式v1主要E2Eを完成させる。
- Validation:
  - Core Table / Flexible Table Block、行 / 列、PC / タッチの主要フローをPlaywrightで確認する。
  - 400行以上、12列以上、または2,000セル以上の大規模Tableで主要DnD経路を計測する。
  - 最大1,000行・20列・20,000セルを想定した負荷で、開始時解析、Drop判定、Presentation更新、常駐状態を確認する。
  - DnD中の高頻度処理がTable全体の規模に比例する走査・DOM計測・DOM更新を前提としていないことを計測またはレビューで確認する。

## Implementation order

現在の実装状態から、基本順は次とする。

1. #571 Table Integration
2. #572 Reorder Target Resolution
3. #573 Drop Target Resolution
4. #574 DnD Interaction / Reorder Session
5. #575 Data Update
6. #576 PC Input Interaction
7. #577 Touch Input Interaction
8. #578 Reorder Presentation
9. #579 Auto Scroll
10. #580 First-use Guidance
11. #581 Reorder Rediscovery
12. #582 Performance検証・調整
13. #583 正式v1主要E2E完成

この順序はArchitecture上のDependency図をそのまま複製するものではなく、後続Issueが必要とする実装成果を先に成立させるための実装順である。

次に着手する実装Issueは#571とする。

## Decisions and validation questions

### Decide before implementation

- 共通Table structureの具体的なTypeと、Core Table / Flexible Table Blockからの変換方法。
- Table Integrationで対応Tableを選択する最小限の実装方法。
- Reorder Target Resolutionが返す移動対象解決結果と制約情報の具体的なType。
- Reorder Sessionの具体的な状態表現。
- Reorder Presentationの表示更新とアニメーションの具体的な実装方式。

### Validate during implementation

- DnD開始試行時の共通Table structure取得と制約情報導出が想定最大規模で実用的か。
- DnD中のDrop Target ResolutionとReorder Presentationのどこが実測上のhot pathになるか。
- Presentationの更新範囲と実装方式が大規模Tableで実用的か。
- PC / タッチの入力が共通DnD経路へ安定して接続できるか。
- Reorder Rediscoveryの具体的な実装値が通常編集と競合しないか。

## Issue breakdown

### Completed baseline

- [x] #547 Reorder v1 sourceの共通・行・列のモジュール境界を確定する。
- [x] #540 Editor DOM Contextを実装する。
- [x] #541 Reorder Modeを実装する。
- [x] #542 Reorder Constraint Resolutionを実装しない方針で終了する。

### Remaining implementation

- [ ] #571 Table Integrationを実装する。
- [ ] #572 Reorder Target Resolutionを実装する。
- [ ] #573 Drop Target Resolutionを実装する。
- [ ] #574 DnD InteractionとReorder Sessionを実装する。
- [ ] #575 Data Updateを実装する。
- [ ] #576 PC向けInput Interactionを実装する。
- [ ] #577 タッチ向けInput Interactionを実装する。
- [ ] #578 Reorder Presentationを実装する。
- [ ] #579 Auto Scrollを実装する。
- [ ] #580 First-use Guidanceを実装する。
- [ ] #581 Reorder Rediscoveryを実装する。
- [ ] #582 大規模TableのPerformanceを検証・調整する。
- [ ] #583 Core TableとFlexible Table Blockの正式v1主要E2Eを完成させる。

Issue本文ではPlanやArchitectureを複製せず、そのIssueのscope、completion conditions、validationだけを記載する。

## Validation

検証コマンドと環境は`docs/development/testing.md`に従う。

- DocumentationのみのPlan変更では、repository rulesに従うdocumentation向け確認を行う。
- TypeScript、CSSなどの実装変更では、対象変更に適用される自動テストとbuildを実行する。
- WordPress / Gutenberg統合やmouse・touch・pointer操作を含む変更では、対応するPlaywright E2Eを実行する。
- Performance変更または大規模Tableに関する変更では、対象規模で計測する。

本Planの再構成自体の手動検証はユーザーが実施する。

## Completion criteria

- 現在のArchitectureに存在しないReorder Constraint Resolutionを実装前提としていない。
- `src/reorder/reorder-mode.ts`までの実装済み状態を維持したまま、残りの正式v1実装が完了している。
- Table Integrationを通じてCore TableとFlexible Table Blockの構造取得・データ更新を扱えている。
- Reorder Target ResolutionがDnD開始時の移動対象と制約情報を解決し、Reorder Sessionがその制約情報を1回のDnD中だけ保持している。
- Drop Target Resolutionが渡された判定入力だけから移動先を判定している。
- Core Table / Flexible Table Blockについて、PC・タッチの行・列DnD主要フローをPlaywright E2Eで確認できている。
- 大規模Tableの計測を完了し、ArchitectureのPerformance条件を満たしている。

## Notes

- #569により、Architecture確定後の現在状態からPlanとIssue構成を再構成した。
- #540と#541の実装は現在のArchitectureと一致しているため維持する。
- #542で扱っていたReorder Constraint Resolutionは独立責務として継続しない。
- 過去のformal v1実装はGit履歴から、Prototypeの知見は`prototype-final` tagから参照する。
