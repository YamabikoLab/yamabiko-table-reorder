# PLAN-661: 行並び替え v1 実装

## References

- Parent issue: #661
- Separation decision: #660
- Requirements: `docs/requirements/reorder-v1-requirements.md`
- Quality Requirements: `docs/requirements/reorder-v1-quality-requirements.md`
- Design: `docs/design/reorder-v1-design.md`
- Architecture: `docs/architecture/reorder-v1-architecture.md`
- Plan instructions: `docs/plans/AGENTS.md`
- Source guidelines: `src/AGENTS.md`, `src/reorder/AGENTS.md`

## Goal

行の並び替えだけを対象として、列の並び替えとの共通化を前提にせず、`editor-dom-context.ts`以外を`src/reorder/row-reorder/`内で完結する実装として段階的に完成させる。

このPlanでは列の並び替えを扱わない。列の並び替えは、行の並び替え完成後に別Plan・別Issue群で独立して設計・実装する。

## Scope

### Included

- 行並び替えモード
- 行用Table Integration
- 行のReorder Target Resolution
- 行のDrop Target Resolution
- 行のDnD Interaction / Reorder Session
- 行のData Update
- 行のPC Input Interaction
- 行のTouch Input Interaction
- 行のReorder Presentation
- 行のAuto Scroll
- 行並び替えに必要なGuidance / Rediscovery
- 行並び替えに対するPerformance / Compatibility / Reliability validation
- 行並び替えの主要E2E
- 行専用実装のIssue分割と実装順

### Not included

- 列の並び替え実装
- 行・列間の共通Reorder Type / API / abstraction
- 行・列共通Table Integration
- 列実装を見越した先行抽象化
- `editor-dom-context.ts`の再実装
- Requirements / Quality Requirements / Designの再定義
- Keyboard操作、ドラッグを必要としない操作、focus、announcementなど別要件として扱うアクセシビリティ実装

## Approach

- #660で定めた完全分離方針を前提とする。
- `src/reorder/editor-dom-context.ts`だけを共有し、行並び替えの実装は`src/reorder/row-reorder/`内で完結させる。
- 既存の行・列共通Reorder実装、共通型、共通Table structure、共通DnD経路は新実装の前提にしない。
- 各Phaseでは行の並び替えにその時点で必要なType / APIだけを具体化する。
- 列の並び替えへ再利用できるかどうかを、行実装中の設計判断基準にしない。
- 実装が将来の列実装と類似しても、行・列間の共通化は行わない。
- 旧Issueは履歴として参照できるが、新しい行実装のdependencyにはしない。
- 実装時の恒久ルールは`src/AGENTS.md`と`src/reorder/AGENTS.md`を正本とし、Planへ複製しない。

## Architecture impact

現行`docs/architecture/reorder-v1-architecture.md`は、共通Table Integration、共通DnD Interaction、共通Reorder coreなど、行・列共通処理を前提としている。

そのため、#660でArchitectureとsource guidelinesを完全分離方針へ更新し、行の並び替えを独立した責務群として実装できる状態にしてからPhase 1以降へ進む。

このPlanはArchitecture上の責務や境界を再定義しない。実装中にArchitecture変更が必要と判明した場合は、Architectureを先に更新してからPlanまたはIssueを追随させる。

## Implementation phases

### Phase 0: 完全分離方針への整合

- Outcome: 行の並び替えを列から独立して実装できるArchitecture / source構成が成立する。
- Issue:
  - #660 行・列並び替えを完全分離する構成へ仕切り直す。
- Validation:
  - `editor-dom-context.ts`以外の行・列共通Reorder abstractionを前提としないことを確認する。
  - Architecture、source guidelines、source構成が同じ方針を示していることを確認する。

### Phase 1: 行並び替えモード

- Outcome: 通常編集と行並び替えを切り替えるための行専用状態が成立する。
- Implementation dependency:
  - Phase 0が完了していること。
- Validation:
  - 行専用の状態として成立し、列方向を表すTypeや分岐を必要としないことを確認する。

### Phase 2: 行用Table Integration

- Outcome: 対応Table Blockから、行の並び替えに必要な現在のTable情報と行制約判定に必要な情報を取得できる。
- Implementation dependency:
  - Phase 1の行並び替え経路から利用できること。
- Validation:
  - Core Table / Flexible Table Blockの主要ケースをfocused testで確認する。
  - 列制約のための情報や行・列共通Table structureを保持しないことを確認する。

### Phase 3: 行のReorder Target Resolution

- Outcome: DnD開始試行時に、対象行の可否とそのDnDで必要な行制約情報を解決できる。
- Implementation dependency:
  - Phase 2の行用Table Integrationを利用できること。
- Validation:
  - `tbody`内の主要対象と`rowspan`に由来する主要制約をfocused testで確認する。

### Phase 4: 行のDrop Target Resolution

- Outcome: DnD中の行の移動先可否を、行専用の判定入力から解決できる。
- Implementation dependency:
  - Phase 3で行対象と制約情報の表現が成立していること。
- Validation:
  - `tbody`内の主要な移動先判定をfocused testで確認する。

### Phase 5: 行のDnD Interaction / Reorder Session

- Outcome: 行DnDの開始・進行・完了・キャンセルと一時状態が行専用経路として成立する。
- Implementation dependency:
  - Phase 3 / 4の解決結果を利用できること。
- Validation:
  - 行DnDの主要LifecycleとFailure / Recoveryをfocused testで確認する。
  - 列方向とのunionや方向復元のための分岐が存在しないことを確認する。

### Phase 6: 行のData Update

- Outcome: 有効な行DnD完了時だけ`tbody`の行順を1回の更新単位として反映できる。
- Implementation dependency:
  - Phase 5の確定結果を利用できること。
  - Phase 2の行用Table Integration更新境界を利用できること。
- Validation:
  - データ保持、構造保持、無効操作、Undoに関する行の主要ケースを確認する。

### Phase 7: 行のPC Input Interaction

- Outcome: PC入力を行DnDの開始・進行・完了・キャンセルへ接続できる。
- Implementation dependency:
  - Phase 5の行DnD経路を利用できること。
- Validation:
  - 行の主要PCフローをRequirements / Designに対して確認する。

### Phase 8: 行のTouch Input Interaction

- Outcome: タッチ入力を行DnDの開始・進行・完了・キャンセルへ接続でき、通常スクロールを不必要に妨げない。
- Implementation dependency:
  - Phase 5の行DnD経路を利用できること。
- Validation:
  - 行の主要Touchフローと通常スクロールをRequirements / Designに対して確認する。

### Phase 9: 行のReorder Presentation

- Outcome: 行DnDの移動対象、移動先、周囲の行の位置変化、移動不可理由を利用者が確認できる。
- Implementation dependency:
  - Phase 5の行DnD状態とPhase 7 / 8の入力経路を利用できること。
- Validation:
  - 行に関する表示とフィードバックをDesignに対して確認する。

### Phase 10: 行のAuto Scroll

- Outcome: 行DnD中の縦方向Auto Scrollが行専用経路へ統合される。
- Implementation dependency:
  - Phase 5の行DnD状態とPhase 9の表示経路を利用できること。
- Validation:
  - 行DnD中の主要Auto ScrollフローをRequirements / Designに対して確認する。

### Phase 11: 行のGuidance / Rediscovery

- Outcome: 行並び替え機能を初回および必要時に再発見できる。
- Implementation dependency:
  - 行の主要入力・表示経路が利用できること。
- Validation:
  - 行の入口と案内が通常編集を妨げないことをDesignに対して確認する。

### Phase 12: 行のQuality validation

- Outcome: 行並び替えについて`QR-01` / `QR-02` / `QR-03`に必要な横断validationと調整が完了する。
- Implementation dependency:
  - Phase 2〜11の主要行実装が利用できること。
- Validation:
  - Performance、Compatibility、Reliability / RobustnessをQuality Requirementsに対して確認する。

### Phase 13: 行並び替え主要E2E完成

- Outcome: Core Table / Flexible Table Blockで行並び替えの主要統合フローを継続的に検証できる。
- Implementation dependency:
  - Phase 12の横断validation結果を反映済みであること。
- Validation:
  - 行に関係するRequirementsとQuality Requirementsの主要フローをE2Eで確認する。

## Implementation order

1. #660 完全分離方針への整合
2. 行並び替えモード
3. 行用Table Integration
4. 行のReorder Target Resolution
5. 行のDrop Target Resolution
6. 行のDnD Interaction / Reorder Session
7. 行のData Update
8. 行のPC Input Interaction
9. 行のTouch Input Interaction
10. 行のReorder Presentation
11. 行のAuto Scroll
12. 行のGuidance / Rediscovery
13. 行のQuality validation
14. 行並び替え主要E2E

## Decisions and validation questions

### Decide before implementation

- 各Phaseで、そのPhaseの行実装に必要な具体的Type / API / implementation structureだけを確定する。
- 列実装との共通化可能性は、行実装の設計判断として扱わない。
- Architecture決定が必要になる事項はPlanまたはIssue内で決めず、Architectureへ戻す。

### Validate during implementation

- 各Phaseの実装が行だけの責務・Type・状態として理解できるか。
- 列方向のType、union、`kind`分岐、共通Reorder abstractionが行実装へ入り込んでいないか。
- 行用Table Integrationが行制約に不要な列情報を持たないか。
- 行のDnD経路がRequirements / Design / Architectureの行に関する決定を満たすか。
- `QR-01` / `QR-02` / `QR-03`について行実装の完了判定に必要な証拠が揃うか。

## Issue breakdown

#661配下の実装Issueは、このPlanのPhase 1〜13に対応して新規作成する。

旧Planに紐づく#654〜#658、#575〜#583、#623、#624などのIssueは、新しい行実装のdependencyとして再利用しない。必要な履歴は参照できるが、実装単位は新Issueとして作り直す。

## Validation

Plan変更自体はdocumentation-onlyとして扱う。

後続実装のvalidationは各Issueの変更範囲に応じてRequirements / Design / Architecture / Quality Requirements / source guidelinesを参照し、repository-wideな実行手順は`docs/development/testing.md`を正本とする。

## Completion criteria

- #660の完全分離方針がArchitecture / source guidelines / source構成へ反映されている。
- `editor-dom-context.ts`以外の行実装が`src/reorder/row-reorder/`内で完結している。
- 行並び替えの主要フローがPC / Touchの両方で成立する。
- 行の構造保持、データ保持、Undo、表示、Auto Scroll、GuidanceがRequirements / Designに従って成立する。
- 行のPerformance / Compatibility / Reliability validationが完了している。
- Core Table / Flexible Table Blockの行並び替え主要E2Eが成立している。
- 列並び替えの実装または行・列共通Reorder abstractionをこのPlanへ持ち込んでいない。

## Notes

- 旧`docs/plans/reorder-v1-plan.md`は、行・列共通実装を前提としていたため削除した。
- 列の並び替えは行の並び替え完成後に別Planを作成する。
- Prototypeおよび旧formal v1実装・Issueは参考資料としてのみ利用し、新しい行実装の構造を拘束しない。
