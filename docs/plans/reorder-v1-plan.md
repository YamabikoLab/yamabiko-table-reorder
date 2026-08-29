# PLAN-620: Reorder v1実装

## References

- Parent issue: #539
- Reconstruction issue: #620
- Current implementation baseline: #573完了時点
- Requirements: `docs/requirements/reorder-v1-requirements.md`
- Quality Requirements: `docs/requirements/reorder-v1-quality-requirements.md`
- Design: `docs/design/reorder-v1-design.md`
- Architecture: `docs/architecture/reorder-v1-architecture.md`
- Plan instructions: `docs/plans/AGENTS.md`
- Plan template: `docs/plans/TEMPLATE.md`
- Source guidelines: `src/AGENTS.md`, `src/reorder/AGENTS.md`

## Goal

#573完了時点の実装をbaselineとして維持し、現在のRequirements / Quality Requirements / Design / Architecture / source guidelinesを入力に、正式v1を完成させるための実装方向、実装Phase、実装順、実装依存、validation、Issue分割を定める。

Planでは正本文書の内容を複製・再定義せず、現在の実装状態から残りの実装をどの順序と単位で進めるかに集中する。

## Current implementation baseline

#573までに成立している以下の実装を、Plan再作成時の出発点とする。

- Editor DOM Context
- Reorder Mode
- common Table structure
- Table Integration
- Reorder Target Resolution
- Drop Target Resolution

これらを再実装することは目的としない。後続実装中に現在の正本との不整合が見つかった場合は、その影響を該当Issueへ反映する。Requirements / Design / Architecture / source guidelines側の決定変更が必要な場合は、Plan内で新しい決定を抱え込まず、該当する正本文書を先に更新する。

## Scope

### Included

- #574以降の正式v1実装
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
- #574〜#583のIssue境界を維持・修正・追加の観点で整理すること

### Not included

- #573までのbaseline実装を作り直すこと
- Requirementsの機能要件・受け入れ条件の再定義
- Quality Requirementsの保証範囲・基準値の再定義
- Designの利用者向け操作・表示・状態・メッセージの再定義
- Architectureの責務、境界、状態所有、Contract、Dependency、Lifecycle、Invariant、Runtime Flowの再定義
- `src/AGENTS.md`または`src/reorder/AGENTS.md`に属する恒久的source ruleの再定義
- Keyboard操作、ドラッグを必要としない操作、focus、announcementなど、別要件として扱うアクセシビリティ実装

## Approach

- #573完了時点を固定したbaselineとし、次の実装再開地点を#574とする。
- #574ではDnD InteractionとReorder Sessionを、ArchitectureのReorder operation boundaryおよび関連するFailure / Recovery Viewへ実装・validation上で接続する。
- #575以降では、各Issueに対応するArchitecture responsibility / Lifecycle / Failure・Recovery Viewを参照し、実装とvalidationへ接続する。
- error handlingは`src/reorder/AGENTS.md`への準拠を各該当Issueで確認する。
- DOM / Web APIを扱う実装はsource guidelinesを参照し、Compatibilityの保証対象は`QR-02`を参照して横断validationする。
- `QR-01`は主要実装が揃った後に#582で検証し、必要な調整を行う。
- `QR-02`と`QR-03`は主要実装後に横断validation用の追加Issueを設ける。
- #583はRequirementsとQuality Requirementsを参照した正式v1の最終E2Eとして位置づける。
- 実装時の恒久ルールは`src/AGENTS.md`と`src/reorder/AGENTS.md`を正本とし、Planへ複製しない。

## Architecture impact

このPlanは現在の`docs/architecture/reorder-v1-architecture.md`を変更しない前提で実装順へ反映する。

後続実装では、主に次のArchitecture参照を実装順とvalidationへ接続する。

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

- Outcome: #573までの実装が後続作業の出発点として利用できる。
- Status: 完了。
- Baseline:
  - Editor DOM Context
  - Reorder Mode
  - common Table structure
  - Table Integration
  - Reorder Target Resolution
  - Drop Target Resolution
- Validation:
  - 後続Issueで不整合を発見した場合だけ影響を切り分ける。baseline全体の再実装は行わない。

### Phase 2: Reorder operation boundaryと共通DnD

- Outcome: #574が完了し、DnD InteractionとReorder SessionがArchitectureのReorder operation boundaryおよび関連Viewへ接続される。
- Issue:
  - #574 DnD InteractionとReorder Sessionを実装する。
- Implementation dependency:
  - #573までのbaselineを利用する。
- Validation:
  - DnD InteractionとReorder Sessionの主要経路をfocused testで確認する。
  - Reorder operation boundaryおよび関連するLifecycle / Failure・Recovery Viewとの整合を確認する。
  - error handlingは`src/reorder/AGENTS.md`への準拠を確認する。

### Phase 3: Data Update

- Outcome: #575が完了し、Data Updateが共通DnD経路と関連Architecture Viewへ接続される。
- Issue:
  - #575 Data Updateを実装する。
- Implementation dependency:
  - #574の確定経路を利用できること。
  - baselineのTable Integration更新境界を利用できること。
- Validation:
  - Data Updateの主要ケースをRequirements / Designに対して確認する。
  - Reorder Data Update Failure and Recoveryとの接続を確認する。
  - error handlingは`src/reorder/AGENTS.md`への準拠を確認する。

### Phase 4: PC / タッチInput Interaction

- Outcome: #576と#577が完了し、PCとタッチのInput Interactionが共通DnD経路と関連Architecture Viewへ接続される。
- Issues:
  - #576 PC向けInput Interactionを実装する。
  - #577 タッチ向けInput Interactionを実装する。
- Implementation dependency:
  - #574の共通DnD経路を利用できること。
- Validation:
  - 各入力方式の主要フローをRequirements / Designに対して確認する。
  - Reorder Input Failure and Recoveryとの接続を確認する。
  - source guidelinesへの準拠を確認する。
  - Compatibilityの保証対象は`QR-02`を参照する。

### Phase 5: Reorder Presentation

- Outcome: #578が完了し、Reorder Presentationが正式v1のDnD経路と関連Architecture Viewへ接続される。
- Issue:
  - #578 Reorder Presentationを実装する。
- Implementation dependency:
  - #574のDnD状態と終了結果を利用できること。
  - #576 / #577で主要入力経路が利用できること。
- Validation:
  - 表示とフィードバックはDesignを参照して確認する。
  - Lifecycle / Failure・Recoveryに関する確認はArchitectureを参照する。
  - PerformanceとCompatibilityに関する保証対象は`QR-01` / `QR-02`を参照する。
  - source guidelinesへの準拠を確認する。

### Phase 6: Auto Scroll

- Outcome: #579が完了し、Auto Scrollが正式v1のDnD経路と関連Architecture Viewへ接続される。
- Issue:
  - #579 Auto Scrollを実装する。
- Implementation dependency:
  - #574のDnD状態と終了結果を利用できること。
  - #578の主要DnD表示経路と組み合わせて確認できること。
- Validation:
  - Auto Scrollの主要フローはRequirements / Designを参照して確認する。
  - Lifecycle / Failure・Recoveryに関する確認はArchitectureを参照する。
  - PerformanceとCompatibilityに関する保証対象は`QR-01` / `QR-02`を参照する。
  - source guidelinesへの準拠を確認する。

### Phase 7: Guidance

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

### Phase 8: QR-01 Performance validation

- Outcome: #582が完了し、`QR-01`に対する主要実装の横断検証と必要な調整が完了する。
- Issue:
  - #582 大規模TableのPerformanceを検証・調整する。
- Implementation dependency:
  - #574〜#581のうち検証対象となる主要経路が揃っていること。
- Validation:
  - 保証対象と基準値はQuality Requirementsの`QR-01`を参照する。
  - 検証対象と計測方法を#582のreviewable unitとして具体化する。
  - Architecture変更が必要な場合は先にArchitectureへ戻す。

### Phase 9: QR-02 Compatibility validation

- Outcome: `QR-02`に対する正式v1主要実装の横断検証が完了する。
- Issue:
  - 新規Issue: `QR-02 Compatibilityを横断検証する`。
- Implementation dependency:
  - #574〜#581の主要正式v1機能が利用できること。
- Validation:
  - 保証対象はQuality Requirementsの`QR-02`を参照する。
  - 検証マトリクスと必要な実環境確認を追加Issueのreviewable unitとして具体化する。
  - 実装不足とArchitecture変更の必要性を切り分ける。

### Phase 10: QR-03 Reliability / Robustness validation

- Outcome: `QR-03`に対する正式v1主要実装とArchitectureのFailure / Recovery Viewsの横断検証が完了する。
- Issue:
  - 新規Issue: `QR-03 Reliability / Robustnessを横断検証する`。
- Implementation dependency:
  - #574〜#579で関連する実装とArchitecture Viewへの接続が完了していること。
- Validation:
  - 保証対象はQuality Requirementsの`QR-03`を参照する。
  - Reorder Input / Drop Target / Data UpdateのFailure and Recovery Viewsを参照して横断検証する。
  - error handlingは`src/reorder/AGENTS.md`への準拠を確認する。

### Phase 11: 正式v1主要E2E完成

- Outcome: #583が完了し、RequirementsとQuality Requirementsを含む正式v1の主要統合フローを継続的に検証できる。
- Issue:
  - #583 Core TableとFlexible Table Blockの正式v1主要E2Eを完成させる。
- Implementation dependency:
  - Phase 8〜10の横断validation結果を反映済みであること。
- Validation:
  - 対象フローと保証範囲はRequirements / Quality Requirementsを参照する。
  - Phase 8〜10で得たvalidation結果を必要な回帰シナリオへ接続する。

## Implementation order

現在の基本順は次とする。

1. #574 DnD InteractionとReorder Session
2. #575 Data Update
3. #576 PC向けInput Interaction
4. #577 タッチ向けInput Interaction
5. #578 Reorder Presentation
6. #579 Auto Scroll
7. #580 First-use Guidance
8. #581 Reorder Rediscovery
9. #582 QR-01 Performance検証・調整
10. 新規Issue: QR-02 Compatibility横断検証
11. 新規Issue: QR-03 Reliability / Robustness横断検証
12. #583 正式v1主要E2E完成

この順序はArchitecture上の責務Dependencyを転載したものではなく、後続Issueが必要とする具体的な実装成果とvalidation対象を先に成立させるための実装順である。

## Implementation dependencies

- #574で共通DnD経路を成立させ、Reorder operation boundaryと関連Architecture Viewへ接続してから後続責務を進める。
- #575は#574の確定経路とbaselineのTable Integration更新境界を接続する。
- #576 / #577は#574の共通DnD経路を利用する。
- #578 / #579は#574のDnD状態と終了結果を利用できる状態で統合する。
- #580 / #581は主要な正式v1入力・表示経路が利用できる状態で統合する。
- #582は主要実装が揃った後に`QR-01`を横断検証する。
- `QR-02`横断validationは主要実装をCompatibility観点で検証できる状態を前提にする。
- `QR-03`横断validationは関連する実装とFailure / Recovery Viewsへの接続が完了した状態を前提にする。
- #583は`QR-01` / `QR-02` / `QR-03`の横断validation結果を反映した後に完成させる。

## Decisions and validation questions

### Decide before implementation

- #574で、Reorder Sessionの具体的な状態表現とReorder operation boundaryの具体的な実装方式を確定する。
- #575で、確定済み並び替えをTable Integrationへ渡す具体的な更新表現を確定する。
- #576 / #577で、入力イベントから共通DnD操作へ変換する具体的な実装方式をそれぞれ確定する。
- #578で、DesignとArchitectureを満たす具体的なDOM更新・アニメーション方式を確定する。
- #579で、Auto Scrollの具体的な実装方式を確定する。
- 横断validation Issue作成時に、`QR-02`と`QR-03`の検証内容をQuality Requirementsからreviewable unitへ具体化する。

Architecture決定が必要になる事項はここで決めず、Architectureへ戻す。

### Validate during implementation

- #574の実装がDnD Interaction / Reorder Sessionと参照先Architectureを満たすか。
- #575の実装がData UpdateとReorder Data Update Failure and Recoveryを満たすか。
- #576 / #577の実装がInput InteractionとReorder Input Failure and Recoveryを満たすか。
- #578 / #579の実装が各responsibilityのLifecycle / Failure・Recovery Viewを満たすか。
- 各該当Issueが`src/AGENTS.md` / `src/reorder/AGENTS.md`へ準拠しているか。
- `QR-01` / `QR-02` / `QR-03`の横断validationで、各Quality Requirementの完了判定に必要な証拠が揃うか。

## Issue breakdown

### Existing issues

| Issue | Plan上の扱い | 必要な対応 |
| --- | --- | --- |
| #574 DnD Interaction / Reorder Session | 維持・修正 | Reorder operation boundary、関連するFailure / Recovery View、`src/reorder/AGENTS.md`への参照を反映する。 |
| #575 Data Update | 維持・修正 | `RESP_DATA_UPDATE`、Reorder Data Update Failure and Recovery、`QR-03`への参照を反映する。 |
| #576 PC Input Interaction | 維持・修正 | `RESP_INPUT_INTERACTION`、Reorder Input Failure and Recovery、`QR-02`、source guidelinesへの参照を反映する。 |
| #577 Touch Input Interaction | 維持・修正 | `RESP_INPUT_INTERACTION`、Reorder Input Failure and Recovery、`QR-02`、source guidelinesへの参照を反映する。 |
| #578 Reorder Presentation | 維持・修正 | `RESP_REORDER_PRESENTATION`、関連するLifecycle / Failure・Recovery View、`QR-01` / `QR-02`への参照を反映する。 |
| #579 Auto Scroll | 維持・修正 | `RESP_AUTO_SCROLL`、関連するLifecycle / Failure・Recovery View、`QR-01` / `QR-02`への参照を反映する。 |
| #580 First-use Guidance | 維持 | 現在のIssue境界を基本的に維持し、必要な正本参照だけを追記する。 |
| #581 Reorder Rediscovery | 維持 | 現在のIssue境界を基本的に維持し、必要な正本参照だけを追記する。 |
| #582 Performance | 維持・修正 | Quality Requirementsの`QR-01`を参照し、検証・調整のreviewable unitとして整理する。 |
| #583 正式v1主要E2E | 維持・修正 | Requirementsと`QR-02` / `QR-03`の横断validation結果を参照した最終E2Eとして整理する。 |

### Additional issues

- [ ] `QR-02 Compatibilityを横断検証する`
  - #574〜#581の主要実装後に、Quality Requirementsの`QR-02`を参照して横断validationする。
  - 保証対象をIssue内で再定義せず、検証マトリクスと必要な証拠をreviewable unitとして具体化する。
- [ ] `QR-03 Reliability / Robustnessを横断検証する`
  - #574〜#579の主要実装後に、Quality Requirementsの`QR-03`とArchitectureのFailure / Recovery Viewsを参照して横断validationする。
  - 異常処理ルールをIssue内で再定義せず、検証対象と必要な証拠をreviewable unitとして具体化する。

これらの追加Issueと既存Issue本文の修正は、再作成したPlanのレビュー後に#539へ反映する。

## Validation

Plan自体の変更はdocumentation-onlyとし、`docs/development/testing.md`に従ってrepository checkを適用する。

後続実装のvalidationは各Issueの変更範囲に応じて、Requirements / Design / Architecture / Quality Requirements / source guidelinesを参照して必要な確認を定める。repository-wideな実行手順は`docs/development/testing.md`を正本とし、Planへ複製しない。

- #574〜#581: 各実装Issueの責務と参照先に対するfocused validationを行う。
- #582: `QR-01`を参照したPerformance validationを行う。
- 追加Issue: `QR-02` / `QR-03`を参照した横断validationを行う。
- #583: Requirementsと横断validation結果を参照した正式v1主要E2Eを完成させる。

手動検証は利用者が実施する。

## Completion criteria

- `docs/plans/reorder-v1-plan.md`が#573完了時点をbaselineとして再作成されている。
- #574以降のImplementation phases、Implementation order、Implementation dependenciesが現在のArchitectureを入力として整理されている。
- `QR-01`、`QR-02`、`QR-03`がvalidationとIssue分割へ接続されている。
- Reorder operation boundary、共通abort、Failure / Recovery、cleanupが実装計画から漏れていない。
- #574〜#583について維持・修正・追加の必要性が整理されている。
- Requirements / Quality Requirements / Design / Architecture / source guidelinesの内容をPlan内で再定義していない。
- 正本の内容が必要な箇所では文書名、要件ID、Architecture responsibility / viewへの参照で接続している。
- #539をこのPlanへ追随させるための残りIssue構成と順序が明確になっている。

## Notes

- このPlanの再作成だけでは#539、#574〜#583のIssue本文は変更しない。Planレビュー後に追随させる。
- 追加する`QR-02` / `QR-03`横断validation Issueは、実装責務を新設するIssueではなく、既存実装をQuality Requirementsに対して横断確認するreviewable unitとする。
- Prototypeの実装・testは参考資料としてのみ利用し、現在のRequirements / Quality Requirements / Design / Architectureを上書きする根拠にはしない。
