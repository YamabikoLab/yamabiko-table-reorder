# PLAN-620: Reorder v1実装

## References

- Parent issue: #539
- Reconstruction issue: #620
- Restart issue: #652
- Restart PR: #653
- Current implementation baseline: Table Integration完了状態
- Requirements: `docs/requirements/reorder-v1-requirements.md`
- Quality Requirements: `docs/requirements/reorder-v1-quality-requirements.md`
- Design: `docs/design/reorder-v1-design.md`
- Architecture: `docs/architecture/reorder-v1-architecture.md`
- Plan instructions: `docs/plans/AGENTS.md`
- Plan template: `docs/plans/TEMPLATE.md`
- Source guidelines: `src/AGENTS.md`, `src/reorder/AGENTS.md`

## Goal

Table Integration完了状態をbaselineとして維持し、現在のRequirements / Quality Requirements / Design / Architecture / source guidelinesを入力に、Reorder Target Resolutionから正式v1実装を再開するための実装方向、実装Phase、実装順、実装依存、validation、Issue分割を定める。

Planでは正本文書の内容を複製・再定義せず、現在の実装状態から残りの実装をどの順序と単位で進めるかに集中する。

## Current implementation baseline

#652 / #653で整理した以下の実装を、再開後の出発点とする。

- Editor DOM Context
- Reorder Mode
- common Table structure
- Table Integration

Reorder Target Resolution以降の旧実装はbaselineに含めず、現在のArchitecture / source guidelinesに従って再実装する。旧実装や完了済みIssueは必要に応じて参考にできるが、現在の実装構造やType表現を再実装の前提にはしない。

後続実装中にRequirements / Design / Architecture / source guidelines側の決定変更が必要と判明した場合は、Plan内で新しい決定を抱え込まず、該当する正本文書を先に更新する。

## Scope

### Included

- Reorder Target Resolution以降の正式v1実装
- Reorder Target Resolution
- Drop Target Resolution
- DnD InteractionとReorder Session
- Data Update
- PC / タッチのInput Interaction
- Reorder Presentation
- Auto Scroll
- First-use Guidance
- Reorder Rediscovery
- `QR-01` Performanceの検証・必要な調整
- `QR-02` Compatibilityの横断検証
- `QR-03` Reliability / Robustnessの横断検証
- #583の正式v1主要E2E
- Reorder Target Resolution以降のIssue境界を新規作成・維持・修正の観点で整理すること

### Not included

- Editor DOM Contextの再実装
- Reorder Modeの再実装
- common Table structureの再実装
- Table Integrationの再実装
- Requirementsの機能要件・受け入れ条件の再定義
- Quality Requirementsの保証範囲・基準値の再定義
- Designの利用者向け操作・表示・状態・メッセージの再定義
- Architectureの責務、境界、状態所有、Contract、Dependency、Lifecycle、Invariant、Runtime Flowの再定義
- `src/AGENTS.md`または`src/reorder/AGENTS.md`に属する恒久的source ruleの再定義
- Keyboard操作、ドラッグを必要としない操作、focus、announcementなど、別要件として扱うアクセシビリティ実装

## Approach

- Table Integration完了状態を固定したbaselineとし、Reorder Target Resolutionから実装を再開する。
- Reorder Target Resolution、Drop Target Resolution、DnD Interaction / Reorder Sessionは、旧実装を前提にせず現在のArchitecture / source guidelinesから改めて実装する。
- 共通Typeや抽象化を将来利用のために先行して作らず、各Phaseで実際に必要になった責務と利用経路から具体化する。
- 行・列固有の意味・型・規則・解釈と共通責務の境界は`src/reorder/AGENTS.md`への準拠を各該当Issueで確認する。
- #575以降は、再実装された前段の成果へ依存関係を付け替えたうえで現在のIssueを利用する。
- error handlingは`src/reorder/AGENTS.md`への準拠を各該当Issueで確認する。
- DOM / Web APIを扱う実装はsource guidelinesを参照し、Compatibilityの保証対象は`QR-02`を参照して横断validationする。
- `QR-01`は主要実装が揃った後に#582で検証し、必要な調整を行う。
- `QR-02`と`QR-03`は主要実装後に横断validation用の追加Issueを設ける。
- #583はRequirementsとQuality Requirementsを参照した正式v1の最終E2Eとして位置づける。
- 実装時の恒久ルールは`src/AGENTS.md`と`src/reorder/AGENTS.md`を正本とし、Planへ複製しない。

## Architecture impact

このPlanは現在の`docs/architecture/reorder-v1-architecture.md`を変更しない前提で実装順へ反映する。

後続実装では、主に次のArchitecture参照を実装順とvalidationへ接続する。

- `RESP_REORDER_TARGET_RESOLUTION`
- `RESP_DROP_TARGET_RESOLUTION`
- `RESP_DND_INTERACTION`とReorder operation boundary
- Reorder Input Failure and Recovery
- Reorder Drop Target Failure and Recovery
- Reorder Data Update Failure and Recovery
- `RESP_INPUT_INTERACTION`
- `RESP_REORDER_PRESENTATION`
- `RESP_AUTO_SCROLL`
- `RESP_DATA_UPDATE`

実装中にArchitecture決定そのものを変更する必要が判明した場合は、Architectureを先に更新してからPlanまたはIssueを追随させる。

## Implementation phases

### Phase 1: 完了済みbaseline

- Outcome: Table Integration完了状態が後続作業の出発点として利用できる。
- Status: 完了。
- Baseline:
  - Editor DOM Context
  - Reorder Mode
  - common Table structure
  - Table Integration
- Validation:
  - 後続Issueで不整合を発見した場合だけ影響を切り分ける。baseline全体の再実装は行わない。

### Phase 2: Reorder Target Resolution

- Outcome: Reorder Target Resolutionが現在のArchitecture / source guidelinesに沿って再実装され、後続処理が利用できる対象解決結果を提供できる。
- Issue:
  - 新規Issue: `Reorder Target Resolutionを実装する`。
- Implementation dependency:
  - Phase 1のTable Integrationを利用できること。
- Validation:
  - 行・列の主要な開始対象解決をfocused testで確認する。
  - `RESP_REORDER_TARGET_RESOLUTION`との整合を確認する。
  - 行・列固有型と共通責務の境界が`src/reorder/AGENTS.md`に準拠していることを確認する。

### Phase 3: Drop Target Resolution

- Outcome: Drop Target ResolutionがPhase 2で成立した対象解決結果を利用して再実装され、DnD進行中の移動先判定に利用できる。
- Issue:
  - 新規Issue: `Drop Target Resolutionを実装する`。
- Implementation dependency:
  - Phase 2のReorder Target Resolutionで後続処理に必要なType / 表現が成立していること。
- Validation:
  - 行・列の主要な移動先判定をfocused testで確認する。
  - `RESP_DROP_TARGET_RESOLUTION`およびReorder Drop Target Failure and Recoveryとの整合を確認する。
  - 行・列固有型と共通責務の境界が`src/reorder/AGENTS.md`に準拠していることを確認する。

### Phase 4: Reorder operation boundaryと共通DnD

- Outcome: DnD InteractionとReorder Sessionが再実装され、Reorder Target Resolution / Drop Target ResolutionとReorder operation boundaryへ接続される。
- Issue:
  - 新規Issue: `DnD InteractionとReorder Sessionを実装する`。
- Implementation dependency:
  - Phase 2 / 3の対象解決・移動先判定経路を利用できること。
- Validation:
  - DnD InteractionとReorder Sessionの主要経路をfocused testで確認する。
  - Reorder operation boundaryおよび関連するLifecycle / Failure・Recovery Viewとの整合を確認する。
  - Request / Target / Session / Result / Destinationの方向対応が必要な呼び出し経路で維持されていることを確認する。
  - error handlingは`src/reorder/AGENTS.md`への準拠を確認する。

### Phase 5: Data Update

- Outcome: #575が完了し、Data Updateが共通DnD経路と関連Architecture Viewへ接続される。
- Issue:
  - #575 Data Updateを実装する。
- Implementation dependency:
  - Phase 4の確定経路を利用できること。
  - baselineのTable Integration更新境界を利用できること。
- Validation:
  - Data Updateの主要ケースをRequirements / Designに対して確認する。
  - Reorder Data Update Failure and Recoveryとの接続を確認する。
  - error handlingは`src/reorder/AGENTS.md`への準拠を確認する。

### Phase 6: PC / タッチInput Interaction

- Outcome: #576と#577が完了し、PCとタッチのInput Interactionが共通DnD経路と関連Architecture Viewへ接続される。
- Issues:
  - #576 PC向けInput Interactionを実装する。
  - #577 タッチ向けInput Interactionを実装する。
- Implementation dependency:
  - Phase 4の共通DnD経路を利用できること。
- Validation:
  - 各入力方式の主要フローをRequirements / Designに対して確認する。
  - Reorder Input Failure and Recoveryとの接続を確認する。
  - source guidelinesへの準拠を確認する。
  - Compatibilityの保証対象は`QR-02`を参照する。

### Phase 7: Reorder Presentation

- Outcome: #578が完了し、Reorder Presentationが正式v1のDnD経路と関連Architecture Viewへ接続される。
- Issue:
  - #578 Reorder Presentationを実装する。
- Implementation dependency:
  - Phase 4のDnD状態と終了結果を利用できること。
  - #576 / #577で主要入力経路が利用できること。
- Validation:
  - 表示とフィードバックはDesignを参照して確認する。
  - Lifecycle / Failure・Recoveryに関する確認はArchitectureを参照する。
  - PerformanceとCompatibilityに関する保証対象は`QR-01` / `QR-02`を参照する。
  - source guidelinesへの準拠を確認する。

### Phase 8: Auto Scroll

- Outcome: #579が完了し、Auto Scrollが正式v1のDnD経路と関連Architecture Viewへ接続される。
- Issue:
  - #579 Auto Scrollを実装する。
- Implementation dependency:
  - Phase 4のDnD状態と終了結果を利用できること。
  - #578の主要DnD表示経路と組み合わせて確認できること。
- Validation:
  - Auto Scrollの主要フローはRequirements / Designを参照して確認する。
  - Lifecycle / Failure・Recoveryに関する確認はArchitectureを参照する。
  - PerformanceとCompatibilityに関する保証対象は`QR-01` / `QR-02`を参照する。
  - source guidelinesへの準拠を確認する。

### Phase 9: Guidance

- Outcome: #580と#581が完了し、First-use GuidanceとReorder Rediscoveryが正式v1の操作経路へ統合される。
- Issues:
  - #580 First-use Guidanceを実装する。
  - #581 Reorder Rediscoveryを実装する。
- Implementation dependency:
  - 正式v1の主要入力・表示経路を確認できること。
- Validation:
  - Guidanceの主要フローはRequirements / Designを参照して確認する。
  - Compatibilityの保証対象は`QR-02`を参照する。
  - source guidelinesへの準拠を確認する。

### Phase 10: QR-01 Performance validation

- Outcome: #582が完了し、`QR-01`に対する主要実装の横断検証と必要な調整が完了する。
- Issue:
  - #582 大規模TableのPerformanceを検証・調整する。
- Implementation dependency:
  - Phase 2〜9のうち検証対象となる主要経路が揃っていること。
- Validation:
  - 保証対象と基準値はQuality Requirementsの`QR-01`を参照する。
  - 検証対象と計測方法を#582のreviewable unitとして具体化する。
  - Architecture変更が必要な場合は先にArchitectureへ戻す。

### Phase 11: QR-02 Compatibility validation

- Outcome: `QR-02`に対する正式v1主要実装の横断検証が完了する。
- Issue:
  - 新規Issue: `QR-02 Compatibilityを横断検証する`。
- Implementation dependency:
  - Phase 2〜9の主要正式v1機能が利用できること。
- Validation:
  - 保証対象はQuality Requirementsの`QR-02`を参照する。
  - 検証マトリクスと必要な実環境確認を追加Issueのreviewable unitとして具体化する。
  - 実装不足とArchitecture変更の必要性を切り分ける。

### Phase 12: QR-03 Reliability / Robustness validation

- Outcome: `QR-03`に対する正式v1主要実装とArchitectureのFailure / Recovery Viewsの横断検証が完了する。
- Issue:
  - 新規Issue: `QR-03 Reliability / Robustnessを横断検証する`。
- Implementation dependency:
  - Phase 2〜8で関連する実装とArchitecture Viewへの接続が完了していること。
- Validation:
  - 保証対象はQuality Requirementsの`QR-03`を参照する。
  - Reorder Input / Drop Target / Data UpdateのFailure and Recovery Viewsを参照して横断検証する。
  - error handlingは`src/reorder/AGENTS.md`への準拠を確認する。

### Phase 13: 正式v1主要E2E完成

- Outcome: #583が完了し、RequirementsとQuality Requirementsを含む正式v1の主要統合フローを継続的に検証できる。
- Issue:
  - #583 Core TableとFlexible Table Blockの正式v1主要E2Eを完成させる。
- Implementation dependency:
  - Phase 10〜12の横断validation結果を反映済みであること。
- Validation:
  - 対象フローと保証範囲はRequirements / Quality Requirementsを参照して確認する。
  - Phase 10〜12で得たvalidation結果を必要な回帰シナリオへ接続する。

## Implementation order

現在の基本順は次とする。

1. 新規Issue: Reorder Target Resolutionを実装する
2. 新規Issue: Drop Target Resolutionを実装する
3. 新規Issue: DnD InteractionとReorder Sessionを実装する
4. #575 Data Update
5. #576 PC向けInput Interaction
6. #577 タッチ向けInput Interaction
7. #578 Reorder Presentation
8. #579 Auto Scroll
9. #580 First-use Guidance
10. #581 Reorder Rediscovery
11. #582 QR-01 Performance検証・調整
12. 新規Issue: QR-02 Compatibility横断検証
13. 新規Issue: QR-03 Reliability / Robustness横断検証
14. #583 正式v1主要E2E完成

この順序はArchitecture上の責務Dependencyを転載したものではなく、後続Issueが必要とする具体的な実装成果とvalidation対象を先に成立させるための実装順である。

## Implementation dependencies

- Reorder Target ResolutionはbaselineのTable Integrationから現在のTable structureを利用できる状態で実装する。
- Drop Target ResolutionはReorder Target Resolutionで後続処理に必要なType / 表現が成立した後に実装する。
- DnD Interaction / Reorder SessionはReorder Target ResolutionとDrop Target Resolutionの実装成果を利用してReorder operation boundaryへ接続する。
- #575は新しいDnD Interaction / Reorder Sessionの確定経路とbaselineのTable Integration更新境界を接続する。
- #576 / #577は新しい共通DnD経路を利用する。
- #578 / #579は新しいDnD状態と終了結果を利用できる状態で統合する。
- #580 / #581は主要な正式v1入力・表示経路が利用できる状態で統合する。
- #582は主要実装が揃った後に`QR-01`を横断検証する。
- `QR-02`横断validationは主要実装をCompatibility観点で検証できる状態を前提にする。
- `QR-03`横断validationは関連する実装とFailure / Recovery Viewsへの接続が完了した状態を前提にする。
- #583は`QR-01` / `QR-02` / `QR-03`の横断validation結果を反映した後に完成させる。

## Decisions and validation questions

### Decide before implementation

- Reorder Target Resolutionの新規Issueで、現在のArchitecture / source guidelinesを実現するために必要な具体的なType / 実装構造を確定する。
- Drop Target Resolutionの新規Issueで、Phase 2の実装成果を利用する具体的なType / APIを確定する。
- DnD Interaction / Reorder Sessionの新規Issueで、Reorder Sessionの具体的な状態表現とReorder operation boundaryの具体的な実装方式を確定する。
- #575で、確定済み並び替えをTable Integrationへ渡す具体的な更新表現を確定する。
- #576 / #577で、入力イベントから共通DnD操作へ変換する具体的な実装方式をそれぞれ確定する。
- #578で、DesignとArchitectureを満たす具体的なDOM更新・アニメーション方式を確定する。
- #579で、Auto Scrollの具体的な実装方式を確定する。
- 横断validation Issue作成時に、`QR-02`と`QR-03`の検証内容をQuality Requirementsからreviewable unitへ具体化する。

Architecture決定が必要になる事項はここで決めず、Architectureへ戻す。

### Validate during implementation

- Reorder Target Resolution / Drop Target Resolutionの再実装が各Architecture responsibilityと`src/reorder/AGENTS.md`を満たすか。
- DnD Interaction / Reorder Sessionの再実装がReorder operation boundaryと参照先Architectureを満たすか。
- #575の実装がData UpdateとReorder Data Update Failure and Recoveryを満たすか。
- #576 / #577の実装がInput InteractionとReorder Input Failure and Recoveryを満たすか。
- #578 / #579の実装が各responsibilityのLifecycle / Failure・Recovery Viewを満たすか。
- 各該当Issueが`src/AGENTS.md` / `src/reorder/AGENTS.md`へ準拠しているか。
- `QR-01` / `QR-02` / `QR-03`の横断validationで、各Quality Requirementの完了判定に必要な証拠が揃うか。

## Issue breakdown

### Historical completed issues

| Issue | Plan上の扱い |
| --- | --- |
| #599 Reorder Target ResolutionのTypeと制約表現 | 閉じたまま履歴として保持し、新しいReorder Target Resolution実装の前提にはしない。 |
| #572 Reorder Target Resolution | 閉じたまま旧実装の履歴として保持し、新しい実装Issueを作成する。 |
| #573 Drop Target Resolution | 閉じたまま旧実装の履歴として保持し、新しい実装Issueを作成する。 |
| #574 DnD Interaction / Reorder Session | 閉じたまま旧実装の履歴として保持し、新しい実装Issueを作成する。 |

### Existing issues

| Issue | Plan上の扱い | 必要な対応 |
| --- | --- | --- |
| #575 Data Update | 維持・修正 | 新しいDnD Interaction / Reorder Sessionの確定経路へImplementation dependencyを付け替える。 |
| #576 PC Input Interaction | 維持・修正 | 新しい共通DnD経路への依存と現在の正本参照へ更新する。 |
| #577 Touch Input Interaction | 維持・修正 | 新しい共通DnD経路への依存と現在の正本参照へ更新する。 |
| #578 Reorder Presentation | 維持・修正 | 新しいDnD状態・終了結果への依存と現在の正本参照へ更新する。 |
| #579 Auto Scroll | 維持・修正 | 新しいDnD状態・終了結果への依存と現在の正本参照へ更新する。 |
| #580 First-use Guidance | 維持 | 現在のIssue境界を基本的に維持し、必要な正本参照だけを追記する。 |
| #581 Reorder Rediscovery | 維持 | 現在のIssue境界を基本的に維持し、必要な正本参照だけを追記する。 |
| #582 Performance | 維持・修正 | Quality Requirementsの`QR-01`を参照し、検証・調整のreviewable unitとして整理する。 |
| #583 正式v1主要E2E | 維持・修正 | Requirementsと`QR-02` / `QR-03`の横断validation結果を参照した最終E2Eとして整理する。 |

### Additional issues

- [ ] `Reorder Target Resolutionを実装する`
  - Table Integration完了状態から再開する最初の実装Issueとする。
  - 旧#572 / #599を前提にせず、現在のArchitecture / source guidelinesから実装する。
- [ ] `Drop Target Resolutionを実装する`
  - 新しいReorder Target Resolutionの実装成果を入力として実装する。
  - 旧#573を再オープンせず、新しいreviewable unitとする。
- [ ] `DnD InteractionとReorder Sessionを実装する`
  - 新しいReorder Target Resolution / Drop Target Resolutionを共通DnD経路へ接続する。
  - 旧#574を再オープンせず、新しいreviewable unitとする。
- [ ] `QR-02 Compatibilityを横断検証する`
  - 主要実装後に、Quality Requirementsの`QR-02`を参照して横断validationする。
  - 保証対象をIssue内で再定義せず、検証マトリクスと必要な証拠をreviewable unitとして具体化する。
- [ ] `QR-03 Reliability / Robustnessを横断検証する`
  - 関連する主要実装後に、Quality Requirementsの`QR-03`とArchitectureのFailure / Recovery Viewsを参照して横断validationする。
  - 異常処理ルールをIssue内で再定義せず、検証対象と必要な証拠をreviewable unitとして具体化する。

新規Issue作成と既存Issue本文の修正は、このPlanを基準として順番に行う。

## Validation

Plan自体の変更はdocumentation-onlyとし、`docs/development/testing.md`に従って必要な確認を適用する。

後続実装のvalidationは各Issueの変更範囲に応じて、Requirements / Design / Architecture / Quality Requirements / source guidelinesを参照して必要な確認を定める。repository-wideな実行手順は`docs/development/testing.md`を正本とし、Planへ複製しない。

- Phase 2〜9: 各実装Issueの責務と参照先に対するfocused validationを行う。
- #582: `QR-01`を参照したPerformance validationを行う。
- 追加Issue: `QR-02` / `QR-03`を参照した横断validationを行う。
- #583: Requirementsと横断validation結果を参照した正式v1主要E2Eを完成させる。

手動検証は利用者が実施する。

## Completion criteria

- `docs/plans/reorder-v1-plan.md`がTable Integration完了状態をbaselineとして更新されている。
- Reorder Target Resolutionから再開するImplementation phases、Implementation order、Implementation dependenciesが整理されている。
- 旧#599 / #572 / #573 / #574を履歴として保持し、新しい実装Issueへ置き換える方針が整理されている。
- #575以降の既存Issueを新しい前段実装へ接続する方針が整理されている。
- `QR-01`、`QR-02`、`QR-03`がvalidationとIssue分割へ接続されている。
- Reorder operation boundary、共通abort、Failure / Recovery、cleanupが実装計画から漏れていない。
- Requirements / Quality Requirements / Design / Architecture / source guidelinesの内容をPlan内で再定義していない。
- 正本の内容が必要な箇所では文書名、要件ID、Architecture responsibility / viewへの参照で接続している。
- #539をこのPlanへ追随させるための残りIssue構成と順序が明確になっている。

## Notes

- #652 / #653でReorder Target Resolution以降の旧実装をbaselineから外し、Table Integration完了状態へ戻した。
- 旧#599 / #572 / #573 / #574は削除された実装と当時の判断を追跡する履歴として保持する。
- 新しいReorder Target Resolution / Drop Target Resolution / DnD Interaction・Reorder Sessionは、旧Issueを再オープンせず新規Issueとして作成する。
- #575〜#583は必要な依存・参照を更新して現在のIssueを利用する。
- 追加する`QR-02` / `QR-03`横断validation Issueは、実装責務を新設するIssueではなく、既存実装をQuality Requirementsに対して横断確認するreviewable unitとする。
- Prototypeの実装・testは参考資料としてのみ利用し、現在のRequirements / Quality Requirements / Design / Architectureを上書きする根拠にはしない。
