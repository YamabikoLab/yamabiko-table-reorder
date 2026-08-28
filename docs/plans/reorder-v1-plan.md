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

Core TableとFlexible Table Blockの行・列DnDを、確定済みArchitectureを入力として段階的に完成させる。

## Current implementation baseline

以下は実装済みで、現在のArchitectureと一致しているため維持する。

- Editor DOM Context
- Reorder Mode
- `src/reorder/reorder-mode.ts`までの現在のsource状態

#542は完了済みとして扱い、残りの実装順には含めない。以降は現在のArchitectureから再構成した実装順で進める。

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
- PrototypeまたはArchitecture確定前のformal v1実装構造の復元

## Approach

- `docs/architecture/reorder-v1-architecture.md`をArchitectureの正本として扱い、Planでは責務、Contract、Dependency、Lifecycle、Invariantを再定義しない。
- 実装は現在の`src/reorder/reorder-mode.ts`までの状態から継続する。
- `src/`の配置は`src/AGENTS.md`と確定済みのsource境界に従う。
- #571〜#575で共通DnD基盤までを順に実装し、その後にInput Interaction、Presentation、Auto Scroll、Guidanceを統合する。
- Performance検証と正式v1主要E2Eは、主要実装が揃った後に実施する。
- 実装中にArchitecture変更が必要になった場合は、Planで解決せずArchitectureを先に更新する。

## Implementation phases

### Phase 1: 実装済み基盤

- Outcome: 後続実装を開始できるbaselineが揃っている。
- Status: 完了。
- Completed Issues:
  - #547 sourceの共通・行・列モジュール境界
  - #540 Editor DOM Context
  - #541 Reorder Mode
  - #542 Reorder Constraint Resolutionは独立責務として実装しないため終了
- Validation:
  - 既存のJest coverageを維持する。

### Phase 2: Table Integration / Reorder Target Resolution

- Outcome: #571と#572が完了し、#573以降を実装できる状態になる。
- Issues:
  - #571 Table Integrationを実装する。
  - #572 Reorder Target Resolutionを実装する。
- Validation:
  - #571と#572で追加・更新したJestを実行する。
  - 次Phaseへ進むための未解決な実装判断が残っていないことをレビューで確認する。

### Phase 3: Drop Target Resolution / DnD Interaction / Reorder Session

- Outcome: #573と#574が完了し、Data Updateを接続できる共通DnD実装が揃う。
- Issues:
  - #573 Drop Target Resolutionを実装する。
  - #574 DnD InteractionとReorder Sessionを実装する。
- Validation:
  - #573と#574で追加・更新したJestを実行する。
  - #575を開始できる実装状態になっていることをレビューで確認する。

### Phase 4: Data Update

- Outcome: #575が完了し、共通DnD実装から対象Tableへの更新まで接続できる状態になる。
- Issue:
  - #575 Data Updateを実装する。
- Validation:
  - #575で追加・更新したJestを実行する。
  - Core Table / Flexible Table Blockの対象更新経路を、Issueで定めた方法により確認する。

### Phase 5: Input Interaction

- Outcome: #576と#577が完了し、PCとタッチの主要入力を正式v1実装へ接続できる状態になる。
- Issues:
  - #576 PC向けInput Interactionを実装する。
  - #577 タッチ向けInput Interactionを実装する。
- Validation:
  - #576と#577で追加・更新した自動テストを実行する。
  - PC / タッチの主要入力フローをPlaywrightで確認する。

### Phase 6: Reorder Presentation

- Outcome: #578が完了し、正式v1の主要な表示を統合できる状態になる。
- Issue:
  - #578 Reorder Presentationを実装する。
- Validation:
  - #578で追加・更新した自動テストを実行する。
  - 主要な表示フローをPlaywrightまたは実環境で確認する。

### Phase 7: Auto Scroll

- Outcome: #579が完了し、長大Tableでの主要DnDフローを確認できる状態になる。
- Issue:
  - #579 Auto Scrollを実装する。
- Validation:
  - #579で追加・更新した自動テストを実行する。
  - 対応editor環境でPlaywrightまたは実環境確認を行う。

### Phase 8: Guidance

- Outcome: #580と#581が完了し、Guidance関連の正式v1実装が揃う。
- Issues:
  - #580 First-use Guidanceを実装する。
  - #581 Reorder Rediscoveryを実装する。
- Validation:
  - #580と#581で追加・更新した自動テストを実行する。
  - PC / タッチの主要案内フローをPlaywrightで確認する。

### Phase 9: Performanceと統合E2E

- Outcome: #582と#583が完了し、正式v1の実装・計測・主要E2Eが揃う。
- Issues:
  - #582 大規模TableのPerformanceを検証・調整する。
  - #583 Core TableとFlexible Table Blockの正式v1主要E2Eを完成させる。
- Validation:
  - Core Table / Flexible Table Block、行 / 列、PC / タッチの主要フローをPlaywrightで確認する。
  - Performanceに関する正本で定めた対象規模と条件に従って計測する。

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
- Reorder Target Resolutionが返す結果の具体的なType。
- Reorder Sessionの具体的な状態表現。
- Reorder Presentationの表示更新とアニメーションの具体的な実装方式。

### Validate during implementation

- 開始時処理が想定最大規模で実用的か。
- DnD中の処理とReorder Presentationのどこが実測上のhot pathになるか。
- Presentationの更新範囲と実装方式が大規模Tableで実用的か。
- PC / タッチの入力を正式v1の共通DnD経路へ安定して接続できるか。
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
- Performance変更または大規模Tableに関する変更では、正本で定めた対象条件に従って計測する。

本Planの再構成自体の手動検証はユーザーが実施する。

## Completion criteria

- `src/reorder/reorder-mode.ts`までの実装済みbaselineを維持した状態から、#571〜#583の実装単位が完了している。
- 各Issueで必要な自動テスト、E2E、実環境確認、Performance計測が完了している。
- Plan内に未解決の実装順・実装依存・Issue分割上の判断が残っていない。
- 実装中にArchitecture変更が必要になった場合、その変更がArchitectureへ先に反映されている。

## Notes

- #569により、Architecture確定後の現在状態からPlanとIssue構成を再構成した。
- #540と#541の実装は現在のArchitectureと一致しているため維持する。
- #542は完了済みとして、残りの実装順には含めない。
- 過去のformal v1実装はGit履歴から、Prototypeの知見は`prototype-final` tagから参照する。
