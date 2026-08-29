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
- Core Table / Flexible Table Blockの正式v1主要E2E
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
- #574でDnD InteractionとReorder Sessionを成立させる際に、更新後ArchitectureのReorder operation boundaryと共通abortを実装上の中心へ置く。
- #575以降は各責務を通常経路へ接続するだけでなく、処理不能または内部不整合がReorder operation boundaryへ合流し、共通abortで終了できる経路を段階的に完成させる。
- `src/reorder/AGENTS.md`に従い、Reorder内部のContract / Invariant違反と外部環境による正常な利用不能を実装上も区別し、独自の局所recoverや重複logを増やさない。
- DOM / Web APIを利用するIssueではEditor DOM Context経由の実装を前提とし、`QR-02`の保証対象となるEditor環境差を横断validationで確認する。
- `QR-01`は主要DnD経路が揃った後に#582で計測する。ただし性能上の回帰リスクは各Phaseでもfocused test、実装レビュー、必要な計測で早期に確認する。
- `QR-02`と`QR-03`は単一の既存Issueだけでは完了判定しにくいため、主要実装後に横断validation用の追加Issueを設ける。
- #583はFunctional Requirementsだけでなく、Quality Requirementsを含む正式v1の統合結果を確認する最終E2Eとして位置づける。
- 実装時の恒久ルールは`src/AGENTS.md`と`src/reorder/AGENTS.md`を正本とし、Planへ複製しない。

## Architecture impact

このPlanは現在の`docs/architecture/reorder-v1-architecture.md`を変更しない前提で実装順へ反映する。

特に後続実装では、次のArchitecture参照を実装順とvalidationへ接続する。

- `RESP_DND_INTERACTION`とReorder operation boundary
- Reorder Input Failure and Recovery
- Reorder Drop Target Failure and Recovery
- Reorder Data Update Failure and Recovery
- `RESP_INPUT_INTERACTION`
- `RESP_REORDER_PRESENTATION`
- `RESP_AUTO_SCROLL`
- `RESP_DATA_UPDATE`

実装中にこれらのArchitecture決定そのものを変更する必要が判明した場合は、Architectureを先に更新してからPlanまたはIssueを追随させる。

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

- Outcome: #574が完了し、通常のDnD進行と共通abortを同じReorder operation boundaryで扱える実装基盤が成立する。
- Issue:
  - #574 DnD InteractionとReorder Sessionを実装する。
- Implementation dependency:
  - #573までのbaselineを利用する。
- Validation:
  - 通常のstart / progress / complete / cancelをfocused testで確認する。
  - Reorder SessionがDnD終了後へ持ち越されないことを確認する。
  - Operation boundaryへ到達した内部エラーが共通abortへ合流し、safe idleへ戻れる実装経路を確認する。
  - `src/reorder/AGENTS.md`に沿ってerror propagation / catch / logの境界を確認する。

### Phase 3: Data Updateと更新失敗の合流

- Outcome: #575が完了し、確定済み並び替えをTableへ反映でき、更新失敗をReorder operation boundaryへ返せる。
- Issue:
  - #575 Data Updateを実装する。
- Implementation dependency:
  - #574のReorder operation boundaryと確定経路を利用できること。
  - baselineのTable Integration更新境界を利用できること。
- Validation:
  - 正常な行・列更新、重複適用防止、Undoに関係する主要ケースをfocused testまたは必要な実環境確認で確認する。
  - Reorder Data Update Failure and Recoveryへ接続できることを確認する。
  - 開始済み更新に対してabortが独自retry / rollbackを行わないことを確認する。

### Phase 4: PC / タッチInput Interaction

- Outcome: #576と#577が完了し、PCとタッチの入力が共通DnD経路へ接続され、入力側で継続不能になった操作も共通abortへ合流できる。
- Issues:
  - #576 PC向けInput Interactionを実装する。
  - #577 タッチ向けInput Interactionを実装する。
- Implementation dependency:
  - #574の共通DnD経路を利用できること。
- Validation:
  - PC / タッチの主要入力フローをJest / Playwrightで確認する。
  - DOM / Web API利用がEditor DOM Contextを通ることを確認する。
  - Reorder Input Failure and Recoveryの入口となる継続不能ケースを確認する。
  - タッチでは通常スクロールとの競合を実環境で確認する。

### Phase 5: Reorder Presentationとabort cleanup

- Outcome: #578が完了し、正式v1のDnD表示を共通DnD経路へ接続し、cancel / abortでも一時表示を安全に終了できる。
- Issue:
  - #578 Reorder Presentationを実装する。
- Implementation dependency:
  - #574のDnD状態と終了結果を利用できること。
  - #576 / #577で主要入力経路が利用できること。
- Validation:
  - DnD開始不可、開始、progress、complete、cancelの主要表示を確認する。
  - abort時にDnD表示の一時状態が残らないことを確認する。
  - 主要な視覚フィードバックとアニメーションが`QR-01`を阻害しない実装形になっているか確認する。
  - Editor context変更後にstaleなDOM参照を保持しないことを確認する。

### Phase 6: Auto Scrollとabort cleanup

- Outcome: #579が完了し、行・列DnD中のAuto Scrollが共通DnD経路へ接続され、DnD終了またはabortで一時状態を破棄できる。
- Issue:
  - #579 Auto Scrollを実装する。
- Implementation dependency:
  - #574のDnD状態と終了結果を利用できること。
  - #578の主要DnD表示経路と組み合わせて確認できること。
- Validation:
  - 行・列の主要Auto ScrollをJest / Playwrightまたは実環境で確認する。
  - abort時にtimer、listener、animation frameその他の一時的な実行状態が残らないことを確認する。
  - Editor環境差を直接扱わずEditor DOM Contextを利用していることを確認する。

### Phase 7: Guidance

- Outcome: #580と#581が完了し、First-use GuidanceとReorder Rediscoveryが正式v1の操作経路へ統合される。
- Issues:
  - #580 First-use Guidanceを実装する。
  - #581 Reorder Rediscoveryを実装する。
- Implementation dependency:
  - 正式v1の主要入力・表示経路を確認できること。
- Validation:
  - PC / タッチの主要案内フローをJest / Playwrightで確認する。
  - DOM / Web API利用がEditor DOM Contextを通ることを確認する。
  - 通常編集を妨げないことを主要フローで確認する。

### Phase 8: QR-01 Performance validation

- Outcome: #582が完了し、`QR-01`の保証対象で主要DnD経路のPerformanceを評価し、必要な調整が完了する。
- Issue:
  - #582 大規模TableのPerformanceを検証・調整する。
- Implementation dependency:
  - #574〜#581のうち計測対象となる主要経路が揃っていること。
- Validation:
  - `QR-01`の対象規模・保証範囲はQuality Requirementsを参照する。
  - DnD開始、progress、Presentation、Auto Scroll、常駐状態などの主要hot pathを計測する。
  - Architecture変更が必要な場合は先にArchitectureへ戻す。

### Phase 9: QR-02 Compatibility validation

- Outcome: 対応Table Blockと対応Editor環境の差によって正式v1の正しさ・利用可能性が損なわれないことを横断的に確認する。
- Issue:
  - 新規Issue: `QR-02 Compatibilityを横断検証する`。
- Implementation dependency:
  - #574〜#581の主要正式v1機能が利用できること。
- Validation:
  - 保証対象は`QR-02`を参照する。
  - Core Table / Flexible Table Blockの両方で主要経路を確認する。
  - 対応WordPress / Editor環境の代表構成でiframe / non-iframeを含むEditor context差を確認する。
  - 不整合が個別責務の実装不足かArchitecture不足かを切り分ける。

### Phase 10: QR-03 Reliability / Robustness validation

- Outcome: 主要な異常経路で共通abortとcleanupが成立し、その後もTable編集を継続できることを横断的に確認する。
- Issue:
  - 新規Issue: `QR-03 Reliability / Robustnessを横断検証する`。
- Implementation dependency:
  - #574〜#579でReorder operation boundaryとcleanup対象が接続されていること。
- Validation:
  - 保証対象は`QR-03`を参照する。
  - Reorder Input Failure and Recoveryを確認する。
  - Reorder Drop Target Failure and Recoveryを確認する。
  - Reorder Data Update Failure and Recoveryを確認する。
  - abort後にReorder Session、Presentation、Auto Scroll、Input Interactionの一時状態が残らず、Table編集を継続できることを確認する。
  - 内部エラーのlogがoperation boundaryで重複しないことを確認する。

### Phase 11: 正式v1主要E2E完成

- Outcome: #583が完了し、Functional RequirementsとQuality Requirementsを含む正式v1の主要統合フローを継続的に検証できる。
- Issue:
  - #583 Core TableとFlexible Table Blockの正式v1主要E2Eを完成させる。
- Implementation dependency:
  - Phase 8〜10の横断validation結果を反映済みであること。
- Validation:
  - Core Table / Flexible Table Block、行 / 列、PC / タッチの主要フローをPlaywrightで確認する。
  - commit / cancel / invalid operation / persistenceに加え、必要なCompatibility / Reliability回帰シナリオをCIで継続確認できる形にする。

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

- #574でReorder operation boundaryと共通DnD経路を成立させてから、その境界へ後続責務を接続する。
- #575は#574の確定経路とbaselineのTable Integration更新境界を接続する。
- #576 / #577は#574の共通DnD経路を利用する。
- #578 / #579は#574のDnD状態と終了結果へ接続し、abort時cleanupまで確認する。
- #580 / #581は主要な正式v1入力・表示経路が利用できる状態で統合する。
- #582は主要実装が揃った後に`QR-01`を横断計測する。
- `QR-02`横断validationは対応Table BlockとEditor環境をまたいで主要機能を検証できる状態を前提にする。
- `QR-03`横断validationは#574〜#579の異常経路とcleanup対象が接続された状態を前提にする。
- #583は`QR-01` / `QR-02` / `QR-03`の横断validation結果を反映した後に完成させる。

## Decisions and validation questions

### Decide before implementation

- #574で、Reorder Sessionの具体的な状態表現とReorder operation boundaryの具体的な実装境界を確定する。
- #575で、確定済み並び替えをTable Integrationへ渡す具体的な更新表現を確定する。
- #576 / #577で、入力イベントから共通DnD操作へ変換する具体的な実装方式をそれぞれ確定する。
- #578で、DesignとArchitectureを満たす具体的なDOM更新・アニメーション方式を確定する。
- #579で、Auto Scrollの具体的なtimer / animation frame / event接続方式を確定する。
- 横断validation Issue作成時に、`QR-02`と`QR-03`の検証マトリクスをIssue単位でreview可能な範囲へ具体化する。

Architecture決定が必要になる事項はここで決めず、Architectureへ戻す。

### Validate during implementation

- #574のoperation boundaryが同期処理だけでなく、必要な非同期callback境界からも同じ共通abortへ合流できるか。
- #575の更新失敗を、開始済み更新への独自retry / rollbackを導入せず安全にoperation boundaryへ返せるか。
- PC / タッチの入力継続不能を、内部Invariant違反と混同せず扱えるか。
- PresentationとAuto Scrollのcleanupがcancel / abortの両方で確実に完了するか。
- Editor context変更時にstaleなDOM参照、listener、observer、timerその他の一時状態が残らないか。
- `QR-01`の保証対象規模で視覚フィードバックを含む主要DnDが実用的か。
- `QR-02`の保証対象でTable Block差・Editor環境差による分岐漏れがないか。
- `QR-03`の代表failureからabort後もTable編集を継続できるか。

## Issue breakdown

### Existing issues

| Issue | Plan上の扱い | 必要な対応 |
| --- | --- | --- |
| #574 DnD Interaction / Reorder Session | 維持・修正 | Reorder operation boundary、共通abort、`src/reorder/AGENTS.md`のerror handlingを反映する。 |
| #575 Data Update | 維持・修正 | Data Update failureのoperation boundaryへの返却と`QR-03`観点を反映する。 |
| #576 PC Input Interaction | 維持・修正 | Reorder Input Failure and Recovery、`QR-02`観点、`src/reorder/AGENTS.md`参照を反映する。 |
| #577 Touch Input Interaction | 維持・修正 | Reorder Input Failure and Recovery、`QR-02`観点、`src/reorder/AGENTS.md`参照を反映する。 |
| #578 Reorder Presentation | 維持・修正 | abort cleanup、`QR-01` / `QR-02`観点、`src/reorder/AGENTS.md`参照を反映する。 |
| #579 Auto Scroll | 維持・修正 | abort cleanup、`QR-01` / `QR-02`観点、`src/reorder/AGENTS.md`参照を反映する。 |
| #580 First-use Guidance | 維持 | 現在のIssue境界を基本的に維持する。必要なら`QR-02`validation観点だけ追記する。 |
| #581 Reorder Rediscovery | 維持 | 現在のIssue境界を基本的に維持する。必要なら`QR-02`validation観点だけ追記する。 |
| #582 Performance | 維持・修正 | Quality Requirementsの`QR-01`を正本として明示し、保証範囲の再定義をIssue内で行わない。 |
| #583 正式v1主要E2E | 維持・修正 | `QR-02` / `QR-03`の横断validation結果を受けた最終E2Eとして整理する。 |

### Additional issues

- [ ] `QR-02 Compatibilityを横断検証する`
  - #574〜#581の実装後、対応Table BlockとEditor環境をまたいだ正式v1の主要経路を検証する。
  - Quality Requirementsを正本として参照し、保証範囲をIssue内で再定義しない。
- [ ] `QR-03 Reliability / Robustnessを横断検証する`
  - #574〜#579で接続したfailure / recovery経路とcleanupを横断検証する。
  - Quality RequirementsとArchitectureのFailure / Recovery Viewsを参照し、異常処理ルールをIssue内で再定義しない。

これらの追加Issueと既存Issue本文の修正は、再作成したPlanのレビュー後に#539へ反映する。

## Validation

Plan自体の変更はdocumentation-onlyとし、`docs/development/testing.md`に従ってrepository checkを適用する。

後続実装では各Issueの変更範囲に応じて、`docs/development/testing.md`に定義された最小のfocused checkから開始し、handoff前に適用されるnon-mutating checksを実行する。

正式v1全体では次を組み合わせる。

- Jest: 責務単位のlogic、state、failure分岐、cleanupを確認する。
- Playwright: 実際のWordPress Editor、PC / タッチ入力、iframe / non-iframe、対応Table Blockを含む統合挙動を確認する。
- Performance measurement: `QR-01`の保証対象で主要hot pathを評価する。
- Reliability validation: ArchitectureのFailure / Recovery Viewsに対応する代表failureとabort後の継続編集を確認する。

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
