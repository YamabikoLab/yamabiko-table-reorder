# PLAN-1047: Accessibility v1 Phase 1 implementation

## References

- Parent issue: #1047
- Parent accessibility initiative: #1046
- Requirements: `docs/requirements/accessibility-v1-requirements.md`
- Design: `docs/design/accessibility-v1-design.md`
- Architecture: `docs/architecture/reorder-form-v1-architecture.md`
- Related Reorder Form documents:
  - `docs/requirements/reorder-form-v1-requirements.md`
  - `docs/design/reorder-form-v1-design.md`
  - `docs/plans/reorder-form-v1-plan.md`
- Related Reorder documents:
  - `docs/requirements/reorder-v1-requirements.md`
  - `docs/design/reorder-v1-design.md`
- Plan guidelines:
  - `docs/plans/AGENTS.md`
  - `docs/plans/TEMPLATE.md`
- Validation: `docs/development/testing.md`

## Goal

確定済みのAccessibility v1 Requirements / Basic Design / Architectureを、現在のReorder Form（RF）とReorder Apply実装へ依存関係順に接続し、WordPress.org登録前のAccessibility baselineをレビュー可能な単位で実装できる順序を定める。

Phase 1ではRFをKeyboardと支援技術から利用できる正式な並び替え経路として完成させる。Row / Column DnDへKeyboard DnDを追加せず、既存RF / Apply / Table Integrationが所有する入力意味、構造診断、確定更新、最終位置を正本として維持する。その上でWordPress接続境界へAccessibility Presentation、Focus Coordination、Announcement Deliveryを追加する。

実装順は、後続責務が利用する意味情報とsemantic targetを先に成立させ、次にfocus lifecycle、最後にannouncementと横断validationを接続する。特に成功後のfocusはRF Apply Coordinationの表示復帰完了条件に含まれるため、success announcementより先に完成させる。

## Scope

### Included

- Issue #1047のPhase 1-3 Keyboard / Semantics、Phase 1-4 Focus Management、Phase 1-5 Announcement、Phase 1-6 Validation
- 既存RF / Apply責務からAccessibility Presentationへ渡す入力descriptor、入力問題、現在評価、実行可否、確認summary、反映中状態の接続
- 通常反映 / 確認付き大規模反映の両経路で、success時の移動前位置と確定後位置を確定済みMove summaryとして引き渡す結果Contract
- native semantics / WordPress Componentsの標準Keyboard Contractを利用したRF主要経路のKeyboard操作
- RF toolbar入口、方向選択、入力、位置関係、実行、cancel / close、狭い表示の折りたたみ / 展開に必要なsemantic Presentation
- 入力問題と対象入力・修正情報の関連付け
- no-op、構造拒否、利用不能を特定入力のvalidationとは分離した指定全体の結果として提示する接続
- Focus Coordinationとsemantic focus targetの実装
- RF open / explicit closeの即時focusと、Apply success時の結果確認focus接続
- confirmation / applying / CancelではWordPress Componentsの標準focus Contractを優先する接続
- Apply successでは既存Apply Lifecycleの描画待ち後に現在DOMへ一回focusする接続
- Announcement Deliveryと一回性通知の接続
- blocked / no-op / success / failureをfocusから独立して支援技術へ通知する実装
- Row / Column両方向、Core Table / Flexible Table Block、iframe / non-iframe、Wide / Narrow、通常反映 / 確認付き大規模反映を含むvalidation
- 実装責務に対応するJestとPlaywright E2Eの追加・更新

### Not included

- Requirements / Design / Architectureの再定義
- Row / Column DnDへのKeyboard DnD追加
- RF専用shortcut、独自Keyboard state machine、独自Widgetの導入
- RF Popover移動または高さ調整のKeyboard代替
- WCAG 2.2 AA全体の監査
- contrast、target size、zoom / reflow、motion等の全面監査
- 特定screen reader / OS向け分岐
- WordPress Core / WordPress Component自体のAccessibility不備の一般的な置き換え
- Accessibility専用のTable parser、Row / Column構造model、Apply結果model、永続Store
- Accessibilityのための追加Table更新またはUndo単位
- version更新、release、WordPress.org申請作業

## Current implementation gap

現在の`main`にはRFの入力解釈、Row / Column Resolution、RF Interaction、RF Apply Coordination、Row / Column Table Integration、Reorder Apply Policy、Editor DOM Context、およびWordPress側のRF / Apply Presentationが実装済みである。RF Apply Coordinationは通常反映と確認付き大規模反映を扱い、表示復帰用の確定済み`destinationIndex`も保持している。

また、WordPress側にはRF toolbar入口、Wide / Narrow Presentation、確認表示、反映中表示、表示復帰、視覚的な完了通知、Playwrightの`form` projectが存在する。このためPhase 1は新しい並び替えCoreを作る作業ではなく、既存状態とLifecycleへ統合済みReorder Form Architectureで定義した三つの狭いAccessibility責務を接続する作業となる。

現在のRF Apply結果はsuccess / failure / cancelledの状態を中心に公開しており、通常反映では確認用summaryを保持しない。そのため、success announcementが必要とする移動前位置と確定後位置をLifecycle完了後に利用するには、確定済みMove summaryを結果Contractとして明示的に引き渡せるようにする必要がある。Announcement側でcandidate、入力値、cleanup済みApply Lifecycleから位置を再計算・推測しないことをPhase 1で成立させる。

一方、Architectureを満たすためには主に次の実装差分が残る。

- 既存RF / Apply状態からName / Role / State、入力条件、入力問題との関係を一貫して導出するAccessibility Presentation
- Accessibility Presentationが再validationせずに利用できる、対象入力と修正情報を含む入力問題の公開境界
- blocked / no-op等の現在評価をそのままAnnouncementへ渡し、RF Interactionへ差分判定・重複抑制・一回性通知状態を追加しない接続
- 通常反映 / 確認付き大規模反映の両方で、success時の移動前位置と確定後位置をLifecycle完了時に引き渡す確定Move summary Contract
- RF open / explicit closeでDesignどおりにfocusを移動し、方向切替やWide / Narrow切替では標準focus維持を優先する接続
- RF open / explicit closeを即時適用するFocus Coordinationと、Apply success時の一回focus接続
- confirmation / applying / CancelでWordPress標準focusを利用する接続
- Apply successで既存Apply Lifecycleの描画待ちを再利用し、確定済み最終位置へ一回focusする接続
- 視覚Noticeのmount / unmountとは独立したAnnouncement Delivery
- success / failureの一回性結果とblocked / no-opの現在評価をfocus移動なしで通知する接続
- Keyboard、semantic、focus、announcementを実ブラウザーとWordPress Editorで検証するE2E coverage

## Approach

実装は「意味の正本 → semantic Presentation → focus調停 → Apply focus lifecycle → announcement → 横断validation」の順に進める。

最初に、Accessibility PresentationとAnnouncement Deliveryが既存RF状態を再解釈せず利用できるよう、RF Input Interpretation、RF Interaction、RF Apply Coordination、Row / Column Table Integrationがすでに所有する意味情報の公開形を確認し、不足する最小Contractだけを補う。ここではAccessibility専用状態を追加せず、入力問題の対象、現在評価、確定済み最終位置、およびsuccess時の移動前位置 + 確定後位置を持つMove summaryを既存責務から値として渡せる状態にする。blocked / no-opは既存の現在評価をそのまま利用し、RF Interactionへ差分判定・重複抑制・一回性通知状態を追加しない。確定Move summaryは通常反映と確認付き大規模反映の両経路でLifecycle完了時に結果として引き渡し、RF Interactionが一回性結果としてPresentation / Announcementへ安全にfan-outできる形にする。

次にAccessibility PresentationをWordPress Reorder Integration / WordPress Reorder Apply Integrationへ接続する。標準UI primitiveが提供するKeyboard / semantic Contractを優先し、YTRは操作名、選択状態、入力条件、実行可否、展開状態、入力問題との関係等の不足分だけを補う。この段階でRFの主要経路がKeyboardだけで操作可能であることと、focus対象として利用するsemantic targetが安定して識別できることを成立させる。

その後、Focus Coordinationを独立した狭い責務として実装する。具体的DOM nodeやpending requestを保持せず、RF入口、方向選択、確定後セル、対象Tableの安定位置等、YTRが補完する必要のある最小semantic targetだけを扱う。confirmation / applying / CancelはWordPress Componentsの標準focus Contractへ委ね、Editor DOM Contextはfocus適用時点の現在context解決に利用する。

Focus Coordinationの基盤成立後、まずRF open / explicit closeだけを即時focusとして通常RF lifecycleへ接続する。方向切替、Wide / Narrow切替、折りたたみ / 展開、入力問題では標準focus維持を優先し、専用pendingを追加しない。次に確認付き大規模反映と通常反映のApply lifecycleへ接続し、既存Apply Lifecycleの描画待ち後にsuccess結果確認focusを一回適用する。Focus Coordination自身にpending / retry / settlement barrierは追加しない。

focus lifecycleが確定してからAnnouncement Deliveryを接続する。通知意味はRF Interaction / RF Apply Coordination / 方向固有Resolution・Table Integrationを正本とし、Announcement Deliveryはdeliveryだけを担当する。blocked / no-opはRF Interactionの現在評価が発生するたびに通知対象として扱い、差分判定・重複抑制は追加しない。success / failureは一回だけ取得する未提示結果から通知する。successの位置情報はPhase 1で引き渡された確定Move summaryだけを利用し、candidateや入力値から再計算しない。視覚Noticeの存在やfocus移動をdelivery条件にしない。

各PhaseではJestで純粋な意味変換、状態遷移、一回性等を検証し、WordPress / browser固有のKeyboard、focus、iframe、accessibility treeへの公開はPlaywright E2Eで検証する。実ユーザー操作で再現しないremount専用focus対策は追加しない。最終PhaseではCore Table / Flexible Table Blockとiframe / non-iframeの代表環境を横断する。

実装中に新しい状態所有、責務境界、Lifecycle、Invariantが必要になった場合はPlan内でArchitectureを変更せず、`docs/architecture/reorder-form-v1-architecture.md`を先に更新してから本Planを追従させる。

## Architecture impact

本Planは`docs/architecture/reorder-form-v1-architecture.md`のAccessibility責務を現在実装へ写像するものであり、新しいArchitecture責務を追加しない。

実装時に影響する既存責務は次のとおりとする。

- RF Input Interpretationは入力成立性と修正対象の正本を維持し、Accessibility Presentation用にvalidationを複製しない。
- RF InteractionはRF Session、現在評価、未提示Apply結果の正本を維持する。blocked / no-opは現在評価をそのまま公開し、差分判定・重複抑制・一回性通知状態を所有しない。確定済みsuccess結果はPresentationとAnnouncementが競合して消費しない形で一回性結果として保持する。
- Row / Column RF ResolutionとTable Integrationはno-op、構造拒否、利用不能、方向固有診断、確定後位置の正本を維持する。
- RF Apply CoordinationはApply Lifecycle、確認summary、結果、確定後位置を維持し、通常反映 / 確認付き大規模反映の両方で、移動前位置と確定後位置を持つ確定Move summaryをLifecycle完了時のsuccess結果へ引き渡す。success側では既存Apply Lifecycleの描画待ち後に結果確認focusを一回適用してから完了する。
- WordPress Reorder Integration / WordPress Reorder Apply IntegrationはAccessibility Presentation、Focus Coordination、Announcement Deliveryへの接続を追加するが、RF / Apply意味を別状態として所有しない。
- Editor DOM Contextは現在のEditor context解決を再利用し、iframe / non-iframe別のfocus状態を保持しない。
- 既存の視覚通知は利用者向けPresentationとして維持し、Announcement Deliveryの発行条件や履歴の正本にはしない。

Plan作成時点でArchitecture変更を必要とする事項は確認されていない。

## Implementation phases

### Phase 1: Accessibility input and result contract readiness

- Dependencies: なし。後続すべての意味入力となるため最初に実施する。
- Outcome: Accessibility Presentation、Focus Coordination、Announcement Deliveryが、既存RF / Apply / Table責務を再解釈せず必要な意味情報を利用できる。
- Tasks:
  - RF Input Interpretationの現在結果から、入力問題の対象と修正情報をPresentationへ渡せる境界を確認し、不足する最小の構造化情報を追加する。
  - RF Interactionから、現在方向、方向固有入力descriptor、現在評価、実行可否をWordPress接続が一貫して参照できるよう既存React境界を整理する。
  - blocked / no-op等は既存のRF Interactionが公開する現在評価をそのままAnnouncement入力として利用し、差分判定・重複抑制・一回性通知状態を追加しない。
  - 通常反映 / 確認付き大規模反映の両方で、RF Apply Coordinationが確定した移動前位置と確定後位置を持つMove summaryをsuccess結果としてLifecycle完了時に引き渡せるContractへ拡張する。
  - successは確定Move summaryを含む一回性の未提示Apply結果として保持し、RF InteractionからPresentationとAnnouncementへ二重消費なしで安全にfan-outできる公開方法を整理する。
  - failureも一回性の未提示Apply結果として同じfan-out境界から公開するが、確定Move summaryは要求しない。
  - 確認時summaryは`confirming`中だけ利用し、Continue時に破棄する。以降はContinue後の再assessmentで得た確定Move summaryを移動結果の正本とする。Focus / 表示復帰で必要な`destinationIndex`は確定Move summaryから接続境界で表現変換し、Announcementは確定Move summaryを直接利用する。candidate、入力値、cleanup済みLifecycleから位置を再計算しない。
  - Row / Column Table Integrationの既存確定後位置・診断ContractをAccessibility用に再計算しない。
- Validation:
  - Jestで入力問題の対象と現在評価を検証し、blocked / no-op用の差分判定・重複抑制・一回性通知状態を追加していないことを確認する。
  - Jestで通常反映と確認付き大規模反映の両経路について、Apply Lifecycle cleanup後にRF Interactionへ引き渡される一回性success結果が移動前位置と確定後位置のMove summaryを含むことを検証する。
  - failureが一回性結果として保持・公開される一方、確定Move summaryを要求しないことを検証する。
  - PresentationとAnnouncementの双方が同じ確定済みsuccess / failure意味を利用でき、どちらかの消費によって他方が欠落しないことを検証する。
  - Row / Column差を値として扱い、Accessibility専用の方向別状態modelが増えていないことを確認する。

### Phase 2: Keyboard path and Accessibility Presentation

- Dependencies: Phase 1。
- Outcome: RFの主要操作を標準Keyboard Contractだけで完了でき、支援技術へ操作名・状態・入力条件・問題との関係を公開できる。
- Tasks:
  - RF toolbar入口をKeyboardから到達・実行できる既存WordPress toolbar contractへ接続する。
  - 行 / 列選択、移動元、移動先、上 / 下または左 / 右、キャンセル、並び替えをnative semantics / WordPress Componentsの標準操作で利用できるようにする。
  - 初期方向、現在選択、入力範囲、列の識別情報、実行可否を現在RF状態から導出して提示する。
  - 入力問題を該当入力と関連付け、修正情報を支援技術から確認できるようにする。問題発生だけを理由にfocusを移動しない。
  - no-op、構造拒否、利用不能を特定入力のvalidationへ変換せず、現在指定全体の状態として提示する。
  - 狭い表示の折りたたみ / 展開をKeyboardで操作でき、現在状態を認識できるようにする。
  - Wide / NarrowのPresentation差によってsemantic意味を分岐させない。
- Validation:
  - Jest / React testでName / Role / State、実行可否、入力問題との関係、方向切替、折りたたみ状態を検証する。
  - PlaywrightでTab / Shift+Tabと各標準control操作によりRow / Column両方向のRF主要入力から実行まで到達できることを確認する。

### Phase 3: Focus Coordination foundation

- Dependencies: Phase 2でfocus対象となるsemantic Presentationが成立していること。
- Outcome: Designで定義されたfocus intentを、要求時点の現在Editor contextへ一回だけ安全に適用する共通調停責務が成立する。
- Tasks:
  - semantic focus targetと遷移理由を受け取るFocus Coordinationの実装境界を追加する。
  - Editor DOM Contextを利用し、要求時点の現在Editor context内だけでtargetを解決する。
  - targetが成立すればfocusし、成立しなければ無介入で終了する。
  - Focus Coordination自身はpending / retry / stale reason / Lifecycle世代を所有しない。
  - 長寿命DOM参照、RF open状態、Apply phase、Table構造、最終位置をFocus Coordinationへ複製しない。
- Validation:
  - Jestで即時適用、target不成立時の無介入、許可されたfallbackだけを検証する。
  - iframe / non-iframe差をFocus Coordination内部の意味状態として保持しないことを確認する。

### Phase 4: RF lifecycle focus integration

- Dependencies: Phase 2、Phase 3。
- Outcome: Apply前の通常RF操作では実ユーザー操作として必要なfocusだけを即時適用し、標準focus維持を不要な調停で上書きしない。
- Tasks:
  - RF open後、現在DOMに成立した行 / 列選択へ即時focusする。
  - RFの明示的Cancelでは`rf-explicit-close`を要求し、現在DOMに対象Tableのtoolbar入口が成立する場合だけfocusを戻す。
  - toolbar入口の再操作によるcloseではfocus requestを生成せず、現在入口focusを維持する。
  - 別Table / 別Editor操作へ移動したことによるexternal closeでは古い入口への復帰intentを生成しない。
  - Row / Column切替ではnative radioのfocusを維持し、次のTab順序を標準操作へ委ねる。
  - Wide / Narrow切替では専用focus requestを生成せず、React / browserの標準focus維持を優先する。
  - 折りたたみ / 展開ではdisclosure button自身の標準focusを維持する。
  - 入力問題、no-op、構造拒否、利用不能の提示だけを理由にfocusを移動しない。
  - RF側の`presentation-regeneration`、pending state、`reconcileReorderFocus()`、`abandonReorderFocus()`を削除する。
  - remount対策のためだけのSession世代、追加Store、一回性管理、Toolbar→Presentation専用橋渡し状態を追加しない。
- Validation:
  - React / Jestでopen、explicit close、target不成立時の無介入と、RF側pending APIが存在しないことを検証する。
  - Playwrightでopen、explicit close、方向切替、Wide / Narrow、折りたたみ / 展開の実ユーザー操作Contractを確認する。

### Phase 5: Apply lifecycle focus integration

- Dependencies: Phase 1、Phase 3、Phase 4。確定済み最終位置とFocus Coordinationの両方が必要。
- Outcome: Apply success後、既存Apply Lifecycleの表示再成立待ちを利用して、確定済み最終位置へ一回だけ結果確認focusを適用できる。
- Tasks:
  - confirmation開始時はWordPress Modalの標準focusを利用し、Focus Coordination専用requestを追加しない。
  - confirmation Cancel後はWordPress Modalの標準focus returnを優先し、実ユーザー操作上の問題が確認されない限りRF側補完Contractを追加しない。
  - applying中はWordPress Modalの標準focusを利用し、Focus Coordination専用requestを追加しない。
  - Table更新後は既存Apply Lifecycleの描画待ちを利用し、editing surface成立後に確定Move summaryの`destinationIndex`へ`requestApplyFocus()`を一回適用する。
  - 結果確認targetが成立しない場合は対象Table自体だけをfallbackとして試し、隣接位置や別セルを推測しない。
  - Focus Coordination側にpending / retry / reconcile / abandon / Promise settlementを追加しない。
  - Apply failure後は入力を保持したRFと既存の一時通知へ戻し、focusはWordPress / Reactの標準挙動を優先する。failure専用Contractは追加せず、実ユーザー操作上の問題が確認された場合だけ最小補完を検討する。
  - confirmation Cancelをfailureとして扱わない。
- Validation:
  - JestでRow / Column successの結果確認focus、Table fallback、target不成立時の無介入を検証する。
  - Playwrightで通常Table / 大規模Table、Row / Column、iframe / non-iframeの代表経路において、既存描画待ち後の一回focusで実ユーザー操作上focusが成立することを確認する。

### Phase 6: Announcement Delivery and source-owned result events

- Dependencies: Phase 1。success / failure通知についてはPhase 5完了後に接続する。
- Outcome: blocked / no-opの現在評価とsuccess / failureの一回性結果を、視覚Noticeやfocus移動に依存せず支援技術へ公開できる。
- Tasks:
  - Announcement DeliveryをWordPress接続境界へ追加し、deliveryだけを所有させる。
  - blocked / no-opはRF Interactionが公開する現在評価をそのまま通知入力として利用し、その評価が発生するたびにAnnouncement対象として扱う。
  - success / failureはPhase 1で成立させた未提示Apply結果を利用し、Apply結果をAnnouncement側で再判定しない。
  - success文言の移動前位置 / 移動後位置は、RF Apply CoordinationがLifecycle完了時に引き渡した確定Move summaryだけを利用し、candidate、入力値、確認summary、隣接位置から再計算・推測しない。
  - failureはTable未変更であることを既存結果意味から通知し、確定Move summaryを要求せず、入力修正位置をAnnouncement側で決定しない。
  - 視覚的な`ReorderCompletionNotice`と意味情報を必要に応じて共有しても、success / failure Announcementの一回性をNoticeのmount / unmountへ結び付けない。
  - Presentation再生成やWide / Narrow切替そのものを新しい評価やApply結果として扱わない。
  - 通知を聞かせるためのfocus移動を追加しない。
- Validation:
  - Jestでblocked / no-opの現在評価を追加状態なしで通知入力に利用できること、確定Move summaryを含むsuccessの一回取得、およびsummaryを要求しないfailureの一回取得を検証する。
  - React / browser testでPresentation再生成自体が新しい評価やApply結果を生成しないことを確認する。
  - Playwrightでfocusを維持したまま結果通知を観測できることを確認する。

### Phase 7: End-to-end accessibility validation

- Dependencies: Phase 2〜6。
- Outcome: Issue #1047のWordPress.org登録前baselineを、既存対応環境で一つの利用者経路として検証できる。
- Tasks:
  - `tests/e2e/form/`へKeyboard / semantics / focus / announcementの主要契約を追加または整理する。
  - Row / Column両方向について、RF開始 → 入力 → 実行 → 結果確認 → 継続または終了をKeyboardだけで完了する経路を検証する。
  - validation input problem、no-op、構造拒否、success、failureを代表ケースとして検証する。
  - 通常反映と確認付き大規模反映について、confirmation、Cancel、success focusをE2Eで検証する。短時間だけ存在するapplying PresentationのARIA semanticsはPhase 2〜6のfocused React testを正本とし、PlaywrightではconfirmationからContinueを経てsuccessまで完走できる横断経路を検証する。
  - Core Table / Flexible Table Blockの代表経路を検証する。
  - iframe / non-iframeでEditor DOM Contextとfocus復帰が同じ意味Contractを満たすことを検証する。
  - Wide / Narrow切替でRF Session、semantic意味、focus、announcement一回性が維持されることを検証する。
  - 手動確認ではbrowser accessibility treeと代表的な支援技術でName / Role / State、入力問題、blocked / success / failure通知を確認する。
- Validation:
  - focused Jest / React testを実行し、Applying Presentationのdialog / status / `aria-busy` semanticsを確認する。
  - `npm run test:e2e:form`でRF browser contractを確認する。
  - 最終的なコード変更時は`docs/development/testing.md`に従って適用可能なNode.js quality gateとproduction buildを確認する。
  - 代表環境の手動Accessibility確認結果を実装IssueまたはPRへ記録する。

## Dependency order

実装依存は次の順序を正本とする。

```text
Phase 1  Meaning / result contract readiness
   ↓
Phase 2  Keyboard path / Accessibility Presentation
   ↓
Phase 3  Focus Coordination foundation
   ↓
Phase 4  RF lifecycle focus
   ↓
Phase 5  Apply lifecycle focus + restoration barrier
   ↓
Phase 6  Announcement Delivery
   ↓
Phase 7  End-to-end validation
```

Phase 6のblocked / no-op delivery基盤はPhase 1後に先行実装できるが、success / failureはPhase 5の結果確定順序に依存するため、同Phase内の完成条件はPhase 5後とする。実装順を単純に保つため、原則としてPhase 5完了後にPhase 6をまとめて実施する。

Phase 2〜6では各Phaseの責務に対応するfocused testを同時に追加し、Phase 7へテスト実装をすべて後回しにしない。Phase 7は不足する横断E2Eと代表環境の最終確認を担当する。

## Decisions and validation questions

### Decide before implementation

- Accessibility Presentationで利用するWordPress Componentは、Basic Designの操作意味を標準Keyboard / semantic Contractで満たせる既存primitiveを優先する。独自Widgetが必要になる場合は実装判断だけで導入せず、Architectureへの影響を先に確認する。
- Focus targetはDOM selectorやnodeではなくsemantic targetとして責務間を渡す。具体的なDOM解決方法はWordPress接続内の実装詳細とする。
- success結果の具体的な型構成はPlanで固定しない。`RfApplyResult`自体を構造化するか同等の結果Contractを追加するかにかかわらず、通常反映 / 確認付き大規模反映の両方で確定Move summaryをLifecycle cleanup前に結果へ移し、RF Interactionの一回性結果として利用できることを必須とする。failureは一回性結果として扱うが、確定Move summaryを要求しない。
- Announcementの具体的delivery primitiveは、WordPress / browserで一回性とfocus独立性を満たせるものを選ぶ。通知意味・発行条件はdelivery primitiveへ移さない。

### Validate during implementation

- 現在利用しているWordPress Componentsだけで、Basic Designが要求するName / Role / State、入力問題との関係、確認時のfocus contractを十分に公開できるか。
- Wide / Narrow切替時に現在focused controlがDOM再生成されるケースで、標準browser behaviorだけでfocus維持できる範囲とFocus Coordinationが補う必要のある範囲はどこか。
- Table表示再生成後、確定済みRow / Column最終位置を現在editing surface上のsemantic targetへ安定して解決できるか。解決不能ケースではArchitectureで定義したfallbackだけで十分か。
- Announcement deliveryがWordPressのPresentation再生成によって重複発火しないか。
- 代表的なWordPress version / iframe差で標準ComponentのKeyboard / focus挙動に差がある場合、それがYTR接続の問題か外部Component contractの差か。

これらの検証でArchitecture変更が必要になった場合は、該当Phaseを進める前にArchitectureを更新する。

## Issue breakdown

Planレビュー後、境界が安定したら次の順序で子Issueへ分割する。

- [ ] Phase 1: Accessibility向けRF入力・結果Contract readiness
- [ ] Phase 2: RF Keyboard / SemanticsとAccessibility Presentation
- [ ] Phase 3: Focus Coordination基盤
- [ ] Phase 4: RF open / close / validation / responsive focus
- [ ] Phase 5: Apply confirmation / restoration / success / failure focus
- [ ] Phase 6: blocked / no-op / success / failure Announcement Delivery
- [ ] Phase 7: Accessibility v1 Phase 1 E2E / representative environment validation

各Issueは一つのreviewable implementation unitに限定し、上位Requirements / Design / Architectureを再記述せず本Planを参照する。Phase 5が大きくなりすぎる場合は、`confirmation / applying`と`restoration / success barrier`へ分割してよいが、後者が前者に依存する順序を維持する。

## Validation

Plan自体はdocumentation-only変更のため、アプリケーションbuildやlintを必須としない。実装Phaseでは`docs/development/testing.md`を正本として、変更範囲に応じて次を使い分ける。

- Jest: 入力意味、semantic derivation、focus intent状態遷移、一回性、stale防止、Apply barrier等の決定的なロジック
- React / WordPress integration tests: Component state、semantic接続、focus intent生成条件、Announcement接続、短時間だけ存在するApplying PresentationのARIA semantics
- Playwright `form` project: 実WordPress EditorでのKeyboard操作、iframe / non-iframe、confirmationからContinueを経たsuccessまでのfocus・announcement・end-to-end結果
- 手動Accessibility確認: browser accessibility treeと代表的な支援技術によるName / Role / State、入力問題、blocked / success / failureの認識
- 最終コード変更: repository-wide quality gateとproduction buildのうち適用されるもの

## Completion criteria

- Keyboardだけで対応TableのRFを開始し、Row / Columnの入力、実行、結果確認、継続または終了まで完了できる。
- RF主要操作のName / Role / State、入力条件、実行可否を支援技術から認識できる。
- 入力問題と対象入力の関係および修正情報を認識できる。
- no-op / 構造拒否を指定全体の現在結果として認識できる。
- RF open / close、方向切替、Wide / Narrow切替、確認、Cancel、反映中、success / failureでBasic Designどおりにfocusを維持・復帰できる。
- Table表示再生成中にfocusが意図せず`body`へ落ちたままにならず、stale intentが利用者の新しいfocusを奪わない。
- successは確定済み最終位置へのfocus適用、明示されたfallback、対象Table消失、または利用者の別位置への移動でintentがsettleした後だけ確定する。
- 通常反映 / 確認付き大規模反映の両方で、success結果が移動前位置と確定後位置を持つ確定Move summaryを含み、Lifecycle cleanup後もRF Interactionの一回性結果として利用できる。
- failureはTable未変更を表す一回性結果として利用でき、確定Move summaryを要求しない。
- blocked / no-opは既存の現在評価が発生するたびに通知対象として利用でき、success / failureは同じ確定結果を二重消費せず一回だけ通知できる。
- success focusは確定Move summaryから接続境界で表現変換した`destinationIndex`を、success announcementは確定Move summaryを利用し、移動先入力、candidate、確認summary、隣接位置から結果を推測・再計算しない。
- 視覚Noticeの再mountやWide / Narrow切替だけで同じsuccess / failure結果を再通知しない。
- Core Table / Flexible Table Block、iframe / non-iframeの代表経路で主要contractを確認できる。
- Row / Column DnDへKeyboard DnDまたはAccessibility v1固有状態を追加していない。
- Accessibility専用のTable構造model、Apply結果model、永続Storeを追加していない。
- Issue #1047で定義したScope外の改善を不必要に取り込んでいない。

## Notes

- 実装の中心は既存RF / Applyへの接続であり、Accessibilityという名前の大きなsubsystemを新設しない。
- Phase 1でsuccess用の確定Move summaryの引き渡しを成立させ、Phase 6がcleanup済みApply Lifecycleや入力値へ逆依存しないようにする。failureには確定Move summaryを要求しない。
- Phase 5はsuccess確定順序に影響するため、Announcementより先に完成させる。ここが本Planの主要な依存関係である。
- 既存の`ReorderCompletionNotice`は視覚通知として維持できるが、支援技術向けAnnouncementのlifecycleを同Componentのmount状態へ従属させない。
- Accessibility v1 Phase 1はWordPress.org登録前baselineであり、後続の包括的Accessibility改善とはIssue境界を分ける。
