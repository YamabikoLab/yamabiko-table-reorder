# Reorder Form v1 Architecture

## 1. Introduction and Goals

本書は、Reorder Form（RF）v1と、そのKeyboard / Assistive Technology経路を実現するための内部責務、境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義するArchitectureの正本である。

入力は`docs/requirements/reorder-form-v1-requirements.md`、`docs/design/reorder-form-v1-design.md`、`docs/requirements/accessibility-v1-requirements.md`、`docs/design/accessibility-v1-design.md`、および既存のRow / Column Reorder Architectureとする。利用者向けの操作、focus遷移、メッセージ、通知条件は各Basic Designを正本とし、本書ではそれらを実現する責務配置とContractを扱う。

RFはDnDの補助機能ではなく、対応Tableの行または列をフォーム指定から直接並び替える独立した操作手段であり、Accessibility v1 Phase 1ではRFをKeyboardと支援技術から利用できる正式な並び替え経路として成立させる。Accessibilityを独立した並び替えSubsystemにはせず、RF / Reorder責務が所有する入力意味、構造診断、Apply結果、最終位置を利用して、WordPress接続境界にSemantics、Focus Coordination、Announcement Deliveryを加える。

ArchitectureはRF全体を一つの文書で扱う一方、Row / Columnの位置意味、構造制約、確定更新は方向固有責務として分離する。source file、function、hook、component、Store、DOM手順等が変化しても維持すべき責務、状態所有、Contract、依存方向、Lifecycle、Invariantを本書の正本とする。

Accessibility v1 Phase 1の対象はIssue #1047のKeyboard / Semantics、Focus Management、Announcementである。Row / Column DnDのKeyboard操作、WCAG全面対応、WordPress Component自体の改善等、同Issueで対象外とされた内容へ責務を広げない。

## 2. Architecture Constraints

- RFは一つの入口と一つの入力Lifecycleを持ち、Row / ColumnをRF Interaction内の選択として扱う。
- Row / Columnの方向固有ResolutionとTable Integrationは分離し、方向固有処理を新しいshared reorder abstractionへ統合しない。
- Reorder Modeは`edit | row | column`の排他状態を維持し、RFを新しい方向として所有しない。
- RF開始時は同一TableのRow / Column Reorder Modeを終了し、RF終了時に以前のDnDモードを自動復元しない。
- RF open中は同一TableのRow / Column DnDを同時に活動させない。
- RF SessionはPresentation instanceの寿命ではなく、対象Tableと利用者操作Lifecycleに結び付く。同じ対象Tableの表示境界が再生成されても、それだけではRF Sessionを終了しない。一方、対象TableがEditorの操作対象から外れたopen Sessionは終了する。
- RF Interactionは対象Table、選択方向、利用者入力、現在評価、および未提示のApply結果を所有する。blocked / no-op等の現在評価について差分判定・重複抑制用状態を所有しない。Table構造、方向固有制約、更新対象セル数、WordPress表示状態は所有しない。
- RF open中に対象Tableが変化した場合、保持中の入力を現在Tableへ再評価する。過去のTable snapshotを成立保証として扱わない。
- RF Input Interpretationは入力成立性のみを扱い、初期の未入力と修正が必要な入力を区別して、問題の対象と現在有効な入力条件を返す。Table構造制約、no-op、確定更新を所有しない。
- Row / Column RF Resolutionは要求時点の現在Tableへ指定を照合し、成立候補、no-op、構造拒否、利用不能を区別する。候補はApply時点の成立保証ではない。
- RFで扱う行・列位置は要求時点のcurrent logical positionであり、永続Row / Column Identityではない。
- Table IntegrationはCore TableとFlexible Table Blockの保存表現差を吸収し、方向固有の構造解釈、診断、Apply再照合、確定更新、および確定後位置の最終権威を持つ。
- RF Apply CoordinationはApply要求時に現在Tableへ候補を再照合し、Reorder Apply Policyにより通常反映または確認付き大規模反映を選択する。
- Apply preparation前の再照合不成立または更新不能では、Tableを変更せず、表示復帰Lifecycleへ入らずにRFへ戻れる。
- Apply preparationまたは反映中Presentation成立後にfailureとなった場合は、Table未変更を維持したままediting surfaceを復帰してからfailureを確定する。RF復帰後のfocusはWordPress / Reactの標準挙動を優先する。
- 通常反映でも、確定更新に成功した場合はWordPress側のediting surfaceを再成立させ、確定済み最終位置への結果確認focusを一回適用してからApply Lifecycleを終了する。
- 確認付き大規模反映では確認、反映中表示、確定更新、表示復帰を一つのLifecycleとして調停する。
- WordPress Reorder Apply Integrationは確認、反映中表示、表示復帰、accessible Presentation、focusを接続するが、Move意味、Table構造、候補成立性、最終位置を再解釈しない。
- Row / Column / RFのactive Apply Lifecycleは同時に高々一つとする。WordPress Reorder Apply Integrationは複数Lifecycleの優先順位付けや仲裁を所有しない。
- Cancel、not-ready、no-op、構造拒否、利用不能、Apply再照合不成立、更新不能では不完全なTable変更を残さない。
- 成立した一回のRF並び替えは一回のWordPress更新および一回のUndo単位とする。
- Apply成功後はRFを終了する。Apply失敗では入力を保持したRFへ戻る。確認CancelはApply failureとは区別する。
- RFの操作はnative semanticsおよびWordPress Componentの標準Keyboard Contractを優先し、YTR固有のKeyboard state machineを設けない。
- Accessibility PresentationはRF / Apply状態を重複所有せず、入力成立性、no-op、構造可否、確定結果を再判定しない。
- Focus CoordinationはDesignで定義されたfocus要求を要求時点の現在Editor contextへ一回適用し、RF / Apply Lifecycle、validation結果、Table構造、DOM nodeを別正本として保持しない。
- RF側・Apply側ともfocusは要求時点の現在targetへ一回適用し、target不成立時は無介入で終了する。Apply successの表示再成立待ちは既存Apply Lifecycleが所有し、Focus Coordinationはpending / retry / stale reasonを保持しない。
- 入力問題、no-op、構造拒否、結果通知を知らせることだけを理由にfocusを移動しない。
- Announcement Deliveryは通知手段だけを所有する。blocked / no-op等はRF Interactionの現在評価をそのまま受け、success / failureの一回性は未提示Apply結果のContractに従う。Delivery自身は差分判定・重複抑制状態を持たない。
- success announcementと成功後focusは、方向固有Table Integrationが確定更新後に返し、RF Apply Coordinationが保持した最終位置だけを利用する。
- Wide / Narrow、iframe / non-iframe、Core Table / Flexible Table Blockの差によって、RFの操作意味、状態意味、focus方針、announcement意味を変えない。
- Accessibility Presentation、Focus Coordination、Announcement DeliveryはTableデータを変更せず、追加のWordPress更新またはUndo単位を生成しない。
- 対象Table以外のブロック操作をRFの確認または反映Lifecycleによって不必要に妨げない。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | 対応Tableの入口、RF入力画面、確認、反映中表示、editing surface、通知、および通常編集環境を提供する。 |
| EXT_WORDPRESS_COMPONENTS | WordPress Components | External Capability | RFとApply Presentationで利用できる標準的な操作、Keyboard、focus、およびsemantic Contractを提供する。 |
| EXT_BROWSER_ACCESSIBILITY | Browser Accessibility Platform | External System | native controlのKeyboard動作、focus、accessibility tree、および支援技術への状態変化伝達を提供する。 |
| EXT_ASSISTIVE_TECHNOLOGY | Assistive Technology | External System | Browserが公開する操作部品、状態、入力問題、およびannouncementを利用者へ伝える。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | Core TableまたはFlexible Table Blockとして、方向固有Table Integrationが構造解釈と確定更新を行う対象を提供する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した一回のRF並び替えを一回のUndoで戻せる更新単位を提供する。 |
| EXT_WORDPRESS_PREFERENCES | WordPress Preferences | External Capability | PC / タッチごとの共通初回案内表示済み状態を永続化する。 |

RFはWordPress Editorから開始されるが、入力意味、方向固有Resolution、Table保存表現、Apply LifecycleをWordPress UIへ混在させない。WordPress EditorとWordPress Componentsは標準的なEditor操作とUI primitiveのContractを提供し、Browser Accessibility Platformはnative semantics、focus、支援技術への伝達を担う。

YTRはAssistive Technology製品へ直接依存せず、Browser Accessibility Platformに一貫した意味と状態変化を公開するところまでを責務境界とする。対応Table Block固有の保存表現差は方向固有Table Integrationで吸収し、Accessibility側では解析しない。

## 4. Solution Strategy

RFは、共通Reorder状態、WordPress接続、RF Interaction、入力解釈、方向固有Resolution、方向固有Table Integration、共通Apply Policy、RF Apply Coordinationを分離する。その上でWordPress Reorder接続境界へAccessibility Presentation、Focus Coordination、Announcement Deliveryを加える。

RF Interactionは対象Tableと利用者入力を所有し、入力時および対象Table変更時に現在Tableを基準として入力成立性とResolution結果を再評価する。Row / Column RF Resolutionは解釈済み指定をcurrent logical positionとして扱い、現在Tableへ安全に照合できない場合は候補を推測せず利用不能として返す。

解決済み候補は入力時点の候補にすぎない。RF Apply CoordinationはApply要求時に方向固有Table Integrationへ再照合と更新対象セル数取得を要求し、Reorder Apply Policyで反映経路を選択する。Table Integrationは確定更新直前にも現在Tableを最終確認する。

通常反映では、Apply preparation前の評価または確定更新が成立しない場合は表示復帰Lifecycleへ入らずfailureを返せる。確定更新成功後はexisting Apply Lifecycleでediting surfaceを再成立させ、その時点の現在DOMへ結果確認focusを一回適用してからsuccessを確定する。

確認付き大規模反映では、確認中はTableを変更しない。Continue後は反映中表示を成立させてから現在Tableを再照合し、成立する場合だけ確定更新する。反映中Presentation成立後にfailureとなった場合もediting surfaceを復帰してから結果を確定し、RF復帰後のfocusはWordPress / Reactの標準挙動を優先する。CancelはTableを変更せず入力画面へ戻る。

Accessibility Presentationは既存RF / Apply状態を標準UI primitiveの名前、意味、状態、入力問題との関係へ接続する。Focus CoordinationはRF open / explicit closeと、既存Apply Lifecycleの表示再成立後に要求されるsuccess結果確認focusを現在Editor contextへ一回適用する。confirmation / applying / CancelはWordPress Componentsの標準focus Contractを優先する。Announcement DeliveryはRF Interactionが公開する現在評価または未提示Apply結果をfocusから独立してBrowser Accessibility Platformへ渡す。

### Process Flow Views

#### RF Reorder End-to-End {#PV_RF_REORDER_END_TO_END kind=normal}

RF開始から入力解釈、現在Table上の指定解決、Apply、accessible Presentation、focus復帰、結果通知へ進む主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | normal | 対応TableのRF操作がWordPress接続境界へ入る。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | normal | RF開始前に同一Tableの方向固有Reorder Modeを終了する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | normal | 対象Tableと標準入力を同じRF Sessionへ接続する。 |
| RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | normal | 現在入力を方向固有Resolution向けの内部指定へ解釈する。 |
| RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | normal | Row指定を要求時点の現在Tableへ解決する。 |
| RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | normal | Column指定を要求時点の現在Tableへ解決する。 |
| RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | normal | Row構造と診断を現在Tableから取得する。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | normal | Column構造と診断を現在Tableから取得する。 |
| RESP_RF_INTERACTION | RESP_ACCESSIBILITY_PRESENTATION | normal | 現在入力、評価、操作可否をaccessible Presentationへ渡す。 |
| RESP_ACCESSIBILITY_PRESENTATION | EXT_WORDPRESS_COMPONENTS | normal | RF / Apply状態を標準UI primitiveへ接続する。 |
| RESP_ACCESSIBILITY_PRESENTATION | EXT_BROWSER_ACCESSIBILITY | normal | native semanticsを補足する意味と関係を公開する。 |
| RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | normal | 成立した候補の反映を要求する。 |
| RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | normal | 更新対象セル数から反映経路を選択する。 |
| RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | normal | Row候補の再照合と確定更新を要求する。 |
| RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | normal | Column候補の再照合と確定更新を要求する。 |
| RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | normal | Apply状態、最終位置、表示復帰要求を公開する。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | normal | Apply Lifecycleに対応するfocus intentを調停へ渡す。 |
| RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | normal | 現在Editor contextで確定したtargetへfocusを適用する。 |
| RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | normal | 表示復帰後に確定したsuccess / failureをRF Lifecycleへ返す。 |
| RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | normal | 未提示のApply結果をWordPress接続へ公開する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | normal | WordPress接続が確保した確定済みApply結果を通知境界へ渡す。 |
| RESP_ANNOUNCEMENT_DELIVERY | EXT_BROWSER_ACCESSIBILITY | normal | 結果意味をfocusから独立した状態変化として公開する。 |
| EXT_BROWSER_ACCESSIBILITY | EXT_ASSISTIVE_TECHNOLOGY | normal | 公開された操作意味、focus、announcementを支援技術へ伝える。 |

#### RF Rejection and Recovery {#PV_RF_REJECTION_RECOVERY kind=failure-recovery}

入力問題、構造拒否、no-op、利用不能、Cancel、Apply failureから安定したRF状態へ戻る処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_TABLE_INTEGRATION | RESP_RF_ROW_RESOLUTION | failure | Row指定の構造拒否または現在Tableでの利用不能を返す。 |
| RESP_RF_ROW_RESOLUTION | RESP_RF_INTERACTION | recovery | Rowのno-op、構造拒否、利用不能を現在RF評価へ戻す。 |
| RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_COLUMN_RESOLUTION | failure | Column指定の構造拒否または現在Tableでの利用不能を返す。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_RF_INTERACTION | recovery | Columnのno-op、構造拒否、利用不能を現在RF評価へ戻す。 |
| RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | failure | Apply時のRow再照合不成立または更新不能を返す。 |
| RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | failure | Apply時のColumn再照合不成立または更新不能を返す。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | recovery | Cancelまたは必要な表示復帰完了を返す。 |
| RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | recovery | Tableを不完全に変更しないfailureまたはCancelをRFへ返す。 |
| RESP_RF_INTERACTION | RESP_ACCESSIBILITY_PRESENTATION | recovery | 現在の入力問題または指定全体の結果をaccessible Presentationへ渡す。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | recovery | 明示的終了の場合だけ、RF入口への復帰intentを渡す。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | recovery | 確定済みの一回性failure / recovery意味を通知境界へ渡す。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | edit / row / columnの排他状態と対象Tableを所有する共通状態責務。 |
| RESP_REORDER_GUIDANCE | Reorder Guidance | 現在どのTableへどの操作環境の共通入口案内を表示しているかという一時状態を所有する。 |
| RESP_REORDER_APPLY_POLICY | Reorder Apply Policy | 更新対象セル数から通常反映か確認付き大規模反映かを選択する共通方針責務。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のEditor基準から同じ表示環境のDOM / focus / Accessibility platform contextを要求時点で解決する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | WordPress Reorder Integration | Row / Column / RF入口、RF入力画面、現在Table、相互排他、標準Keyboard入力、および現在RF Sessionの表示専用状態をWordPress Editorへ接続する。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | WordPress Reorder Apply Integration | Reorder Apply状態を確認、反映中表示、表示復帰、accessible Presentation、およびfocusへ接続する。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | Reorder Guidance Integration | 共通初回案内をEditor環境、Preferences、および各Reorder入口へ接続する。 |
| RESP_ACCESSIBILITY_PRESENTATION | Accessibility Presentation | 既存RF / Apply状態を標準操作部品の意味、状態、案内、および入力問題との関係として表現する。 |
| RESP_FOCUS_COORDINATION | Focus Coordination | Designで定義されたRF / Apply Lifecycleのfocus維持・移動・復帰intentを現在Editor contextへ適用する。 |
| RESP_ANNOUNCEMENT_DELIVERY | Announcement Delivery | RF Interactionが公開する現在評価または一回性Apply結果をfocusから独立してBrowser Accessibility Platformへ伝える。 |
| RESP_RF_INTERACTION | RF Interaction | RF Session、対象Table、方向、利用者入力、現在評価、Apply要求、および未提示Apply結果を所有する。 |
| RESP_RF_INPUT_INTERPRETATION | RF Input Interpretation | 利用者入力と現在入力範囲 / 選択肢を解釈し、未入力、修正が必要な入力、または方向固有Resolution向け内部指定を返す。 |
| RESP_RF_ROW_RESOLUTION | Row RF Resolution | Row指定を現在Tableへ照合し、成立候補、no-op、構造拒否、利用不能を解決する。 |
| RESP_RF_COLUMN_RESOLUTION | Column RF Resolution | Column指定を現在Tableへ照合し、成立候補、no-op、構造拒否、利用不能を解決する。 |
| RESP_RF_APPLY_COORDINATION | RF Apply Coordination | 候補再照合、反映経路、確認、確定更新、表示復帰、結果、および成功時の最終位置を所有する。 |
| RESP_ROW_TABLE_INTEGRATION | Row Table Integration | 現在のRow構造、診断、Apply評価、確定行移動、および確定後位置の最終権威を提供する。 |
| RESP_COLUMN_TABLE_INTEGRATION | Column Table Integration | 現在のColumn構造、列記述、診断、Apply評価、確定列移動、および確定後位置の最終権威を提供する。 |

### Ownership Boundaries

| ID | Name | Includes |
| --- | --- | --- |
| BOUNDARY_REORDER_COMMON | Reorder Common | RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_REORDER_APPLY_POLICY |
| BOUNDARY_EDITOR_INTEGRATION | Editor Integration | RESP_EDITOR_DOM_CONTEXT |
| BOUNDARY_WORDPRESS_REORDER | WordPress Reorder Integration | RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY |
| BOUNDARY_REORDER_FORM | Reorder Form | RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION |
| BOUNDARY_ROW_REORDER | Row Reorder | RESP_ROW_TABLE_INTEGRATION |
| BOUNDARY_COLUMN_REORDER | Column Reorder | RESP_COLUMN_TABLE_INTEGRATION |
| BOUNDARY_WORDPRESS_EXTERNAL | WordPress External | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES |
| BOUNDARY_ACCESSIBILITY_PLATFORM | Accessibility Platform | EXT_BROWSER_ACCESSIBILITY EXT_ASSISTIVE_TECHNOLOGY |

Accessibility Presentation、Focus Coordination、Announcement Deliveryは`BOUNDARY_WORDPRESS_REORDER`の内部に置く。三責務を分離するのは状態所有とLifecycleを明確にするためであり、AccessibilityをRF / Reorderから独立したSubsystemとして扱うためではない。

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のEditor基準と同じ表示環境のcontextを解決するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | Reorder入口、RF入力画面、終了、および現在TableのEditor接続に必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_COMPONENTS | RFの標準操作とKeyboard Contractを利用するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | RF開始時のDnDモード終了と入口排他に必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | RF Session、現在入力、評価、Apply結果をEditorへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | RF状態を操作意味、状態、案内、入力問題との関係へ表現するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | RF open / explicit closeのfocus Contractに必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | blocked / no-opの現在評価と未提示success / failure結果を支援技術へ伝えるために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 確認、反映中表示、表示復帰をEditorへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_COMPONENTS | 確認と反映中状態の標準操作・semantic Contractを利用するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | Apply状態、確認summary、確定結果、最終位置を利用するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 確認と反映中状態をaccessible Presentationへ表現するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | Apply successでediting surface再成立後に結果確認focusを一回適用するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | EXT_WORDPRESS_EDITOR | 初回案内をEditorへ接続するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | EXT_WORDPRESS_PREFERENCES | 操作環境別の案内済み状態を永続化するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_EDITOR_DOM_CONTEXT | 現在の操作環境を解決するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_REORDER_GUIDANCE | 現在の共通案内状態を開始・終了するために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_REORDER_MODE | Row / Column入口選択を案内終了条件として扱うために必要とする。 |
| RESP_REORDER_GUIDANCE_INTEGRATION | RESP_RF_INTERACTION | RF入口選択を案内終了条件として扱うために必要とする。 |
| RESP_ACCESSIBILITY_PRESENTATION | EXT_WORDPRESS_COMPONENTS | WordPressの標準操作部品のsemantic Contractを優先して利用するために必要とする。 |
| RESP_ACCESSIBILITY_PRESENTATION | EXT_BROWSER_ACCESSIBILITY | native semanticsを補足する意味、状態、関係を公開するために必要とする。 |
| RESP_FOCUS_COORDINATION | RESP_EDITOR_DOM_CONTEXT | focus targetと同じEditor表示環境を要求時点で解決するために必要とする。 |
| RESP_FOCUS_COORDINATION | EXT_WORDPRESS_EDITOR | 要求時点の現在Editor表示環境でfocus targetの存在を確認するために必要とする。 |
| RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | 現在targetへのfocus適用と維持に必要とする。 |
| RESP_ANNOUNCEMENT_DELIVERY | EXT_BROWSER_ACCESSIBILITY | 現在評価またはApply結果の通知を支援技術へ公開するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 現在入力を入力問題または内部指定へ解釈するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | Row指定を現在Tableへ解決するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | Column指定を現在Tableへ解決するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | 成立候補を反映し、Apply結果と最終位置を受けるために必要とする。 |
| RESP_RF_INTERACTION | RESP_ROW_TABLE_INTEGRATION | Row入力範囲を現在Tableから取得するために必要とする。 |
| RESP_RF_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | Column入力選択肢と列記述を現在Tableから取得するために必要とする。 |
| RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 現在のRow構造と診断を利用するために必要とする。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 現在のColumn構造と診断を利用するために必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | 更新対象セル数から反映経路を選択するために必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Row候補の再照合、確定更新、確定後位置に必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Column候補の再照合、確定更新、確定後位置に必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在のRow構造取得と確定行移動に必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 一回の成立した行移動を一回のUndo単位として維持するために必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在のColumn構造取得と確定列移動に必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 一回の成立した列移動を一回のUndo単位として維持するために必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_RF_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY EXT_ASSISTIVE_TECHNOLOGY EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_REORDER_APPLY_POLICY RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION |
| DV_RF_EDITOR_INTEGRATION | Editor Integration | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION |
| DV_RF_RESOLUTION | RF Resolution | EXT_SUPPORTED_TABLE_BLOCK RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION |
| DV_RF_APPLY | RF Apply | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_FOCUS_COORDINATION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION |
| DV_RF_ACCESSIBILITY | Keyboard, Focus and Announcement | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY EXT_ASSISTIVE_TECHNOLOGY RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION |

### Responsibility Details

#### Reorder Mode {#RESP_REORDER_MODE}

##### Responsibility

通常編集、Row DnD、Column DnDの排他状態と対象Tableを所有する。RF状態は所有しない。

##### State ownership

`edit | row | column`と方向固有モードが関連付くTable Identityを所有する。RF Session、RF入力、Apply Lifecycleを所有しない。

##### Contract

WordPress Reorder Integrationから入口選択とRF開始前のモード終了を受ける。RF開始時は同一Tableの方向固有モードを`edit`へ戻す。

##### Lifecycle

既存の`edit ↔ row | column`Lifecycleを維持する。RF終了時に過去モードを復元しない。

##### Invariants

- 同時に有効な方向固有モードは一つだけとする。
- RFを新しいReorder Mode方向として保持しない。

#### Reorder Guidance {#RESP_REORDER_GUIDANCE}

##### Responsibility

現在表示中の共通入口案内について対象Tableと操作環境だけを所有する。

##### State ownership

現在表示中のTable Identityと操作環境を所有する。永続的な表示済み状態やRF Sessionは所有しない。

##### Contract

Reorder Guidance Integrationから案内開始・終了を受け、現在表示中状態だけを更新する。

##### Lifecycle

利用者による案内終了、Row / Column入口選択、またはRF入口選択で終了する。

##### Invariants

- 永続状態を所有しない。
- Row / Column / RF固有状態を共通案内状態へ保持しない。

#### Reorder Apply Policy {#RESP_REORDER_APPLY_POLICY}

##### Responsibility

更新対象セル数から通常反映または確認付き大規模反映を選択する。

##### State ownership

状態を所有しない。Table構造、方向固有Move、Apply Lifecycleを保持しない。

##### Contract

RF Apply Coordinationから更新対象セル数を受け、共通性能Policyに従って反映経路を返す。

##### Lifecycle

一回のApply評価ごとに同期的に経路を選択する。

##### Invariants

- RF固有または方向固有のMove意味を解釈しない。
- Apply状態を所有しない。
- 閾値を利用者向け固定要件として扱わない。

#### Editor DOM Context {#RESP_EDITOR_DOM_CONTEXT}

##### Responsibility

現在のEditor基準から同じ表示環境に属するDOM / focus / Accessibility platform contextを解決する。

##### State ownership

解決結果をEditor Lifecycleをまたぐ正本として保持しない。focus intent、RF Session、Apply Lifecycleを所有しない。

##### Contract

現在の基準と同じEditor表示環境のcontextを安全に提供できる場合だけ返す。

##### Lifecycle

DOM / Web APIまたはfocus targetを必要とする時点で現在contextを解決する。

##### Invariants

- iframe / non-iframeというEditor方式を利用側へ状態として持ち出さない。
- 現在の基準と異なるEditor contextへfallbackしない。

#### WordPress Reorder Integration {#RESP_WORDPRESS_REORDER_INTEGRATION}

##### Responsibility

Row / Column / RFの入口、RF入力画面、現在Table、相互排他、標準Keyboard入力、および通常RF状態のaccessible PresentationをWordPress Editorへ接続する。

##### State ownership

WordPress接続に必要な一時参照と、現在RF Sessionの折りたたみ / 展開等の表示専用状態だけを扱う。RF入力、方向、現在評価、Apply結果、focus intentを別正本として所有しない。

##### Contract

RF入口選択時は同一TableのReorder Modeを終了してRF Interactionを開始する。WordPress Editor / Componentsの標準操作をRF Interactionへ接続し、現在RF状態をAccessibility Presentationへ渡す。Designが要求するRF open / explicit closeのfocus要求だけをFocus Coordinationへ渡す。explicit closeではWordPress Reorder Integrationが現在保持しているRF入口をそのまま復帰先として渡し、Focus Coordinationで同じ入口をDOM再検索しない。

blocked / no-op等の現在評価はRF Interactionから受けた評価をそのままAnnouncement Deliveryへ渡し、差分判定や重複抑制を追加しない。未提示のsuccess / failure Apply結果はOutcome全体を一度確保した時点でRF Interaction側を提示済みにし、同じOutcomeをVisual PresentationとAnnouncement Deliveryへfan-outする。

方向切替と折りたたみ / 展開では標準操作の現在focusを維持する。別TableまたはEditor操作への移動によるRF終了では古いRF入口への復帰を要求しない。Wide / Narrow切替では同じRF Sessionの現在操作を維持する。

RF open中に対象Tableが変化した場合、現在Tableを基準とする入力範囲 / 選択肢の再取得と再評価をRF Interactionへ要求する。同じ対象TableのPresentation境界の再生成だけではSessionを終了しない。

##### Lifecycle

対象TableのEditor接続が存在する間、現在Reorder ModeとRF Interactionを表示へ接続する。対象Tableから操作対象が外れた場合はopen RF Sessionと表示専用状態を終了する。

##### Invariants

- 独自Keyboard state machineまたはRF専用shortcutを所有しない。
- RF入力、構造診断、Apply結果を再判定しない。
- 表示専用状態をRF入力、方向、現在評価、Apply結果の正本にしない。
- RF終了時に過去のDnDモードを自動復元しない。
- 通知のためだけにfocus intentを生成しない。

#### WordPress Reorder Apply Integration {#RESP_WORDPRESS_REORDER_APPLY_INTEGRATION}

##### Responsibility

RFを含むReorder Apply状態をWordPress Editorの確認、反映中表示、editing surface restoration、accessible Presentation、およびfocusへ接続する。

##### State ownership

表示接続に必要な一時状態だけを扱う。Apply Lifecycle、Move意味、確定後位置、focus intent、Table構造を別正本として所有しない。

##### Contract

RF Apply Coordinationが公開する確認summary、Apply状態、確定結果、最終位置を利用する。確認と反映中状態はAccessibility Presentationへ渡し、confirmation / applying / Cancel / failureのfocusはWordPress Componentsの標準focus Contractを優先する。Focus CoordinationはApply successでediting surfaceが再成立した後の結果確認focusにだけ利用する。

成功後はRF Apply Coordinationが確定した最終位置をそのままWordPress Reorder Apply Integrationへ渡す。既存Apply Lifecycleの描画待ちでediting surfaceが再成立した後、Focus Coordinationへ結果確認focusを一回要求する。最終位置を安全に適用できない場合は対象Tableの安定した操作位置だけをfallbackとして試し、その後RF Apply Coordinationへ表示復帰完了を返す。

Apply preparationまたは反映中Presentation成立後にfailureとなった場合は、Table未変更のediting surfaceを再成立させ、その表示復帰完了をRF Apply Coordinationへ返す。failure後のRF復帰focusはWordPress標準挙動を優先し、実ユーザー操作上の問題が確認された場合だけ具体的ケースに対する最小補完を検討する。

##### Lifecycle

通常反映では確定更新後の表示復帰、確認付き反映では確認から反映中、表示復帰までを接続する。success側はexisting Apply Lifecycleの描画待ち後に結果確認focusを一回適用して完了する。

##### Invariants

- Move意味、Table構造、候補成立性、最終位置を再解釈しない。
- 複数のactive Apply Lifecycleを仲裁または優先順位付けしない。
- Table更新またはUndo履歴を追加しない。
- 対象Table以外のEditor操作を不必要に抑止しない。
- success後の結果確認focusはediting surface再成立後に一回適用してから表示復帰完了を通知する。

#### Reorder Guidance Integration {#RESP_REORDER_GUIDANCE_INTEGRATION}

##### Responsibility

共通初回案内をWordPress Editor、Editor DOM Context、WordPress Preferences、Reorder Mode、およびRF入口へ接続する。

##### State ownership

永続的な表示済み状態はWordPress Preferencesへ委ね、現在表示中状態はReorder Guidanceへ委ねる。

##### Contract

現在の操作環境で未表示の場合だけReorder Guidanceを開始する。案内終了または各Reorder入口選択時に現在の操作環境を表示済みとして保存する。

##### Lifecycle

表示条件を現在のEditor環境で評価し、Row / Column DnDまたはRFが活動中に新しい案内を開始しない。

##### Invariants

- RFだけ別の初回案内永続状態を作らない。
- WordPress Preferencesの永続状態をReorder Guidanceへ持ち込まない。

#### Accessibility Presentation {#RESP_ACCESSIBILITY_PRESENTATION}

##### Responsibility

RF / Apply責務から受け取る操作意味、状態、入力条件、現在評価を、WordPress ComponentsとBrowser Accessibility Platformが公開できるPresentationへ変換する。

##### State ownership

RF / Applyのdomain stateを所有しない。方向、選択、入力値、入力範囲、実行可否、展開状態、validation結果、構造診断をAccessibility専用状態として保持しない。

##### Contract

WordPress Reorder IntegrationからRF入口、現在方向、入力descriptor、入力問題、指定全体の評価、操作可否、表示状態を受ける。WordPress Reorder Apply Integrationから確認summaryと反映中状態を受ける。標準UI primitiveが提供する意味を利用し、不足する名前、状態、案内、入力と問題の関係だけを補う。

##### Lifecycle

RF / Apply Presentationの生成ごとに現在状態から導出する。方向切替、Wide / Narrow切替、Presentation再生成では同じ意味状態から同じsemantic Contractを再成立させる。

##### Invariants

- native semanticsまたはWordPress Componentの既存semantic Contractを不必要に重複させない。
- input validation、no-op、構造制約、最終位置を独自に判定しない。
- Row / Column別のAccessibility状態modelを持たない。

#### Focus Coordination {#RESP_FOCUS_COORDINATION}

##### Responsibility

Designで定義されたRF / Apply Lifecycle上のfocus維持・移動・復帰intentを、現在Editor contextと現在存在するsemantic targetへ適用する。

##### State ownership

focus状態を所有しない。RF open状態、Apply phase、入力問題、Table構造、最終位置、長寿命DOM参照、pending request、retry状態を所有しない。

##### Contract

WordPress Reorder Integrationから受けるRF側requestは、要求時点の現在Editor contextでtargetを解決し、成立すれば即時focusし、成立しなければ無介入で終了する。

WordPress Reorder Apply Integrationから受けるsuccess requestも、既存Apply Lifecycleがediting surface成立を待った後の現在Editor contextで一回だけ適用する。結果確認targetが成立しない場合は対象Table自体だけをfallbackとして試し、どちらも成立しなければ無介入で終了する。

##### Lifecycle

RF側・Apply success側とも、一回の要求で即時適用または無介入として完了する。表示再成立待ちはFocus CoordinationのLifecycleにしない。

##### Invariants

- Designで定義されない自動focus移動を追加しない。
- Presentation再生成、remount、Wide / Narrow切替のためだけのpending stateを持たない。
- 通知を聞かせるためだけにfocusを移動しない。
- 確定後位置または代替位置をTable構造から推測しない。
- pending / retry / stale reason / Lifecycle世代を追加しない。

#### Announcement Delivery {#RESP_ANNOUNCEMENT_DELIVERY}

##### Responsibility

RF Interactionが公開する現在評価または一回性Apply結果を、focusから独立した状態変化としてBrowser Accessibility Platformへ伝える。

##### State ownership

入力、現在評価、Apply結果、Table構造、移動前後位置、表示通知状態を所有しない。通知意味の履歴、差分判定、重複抑制状態をdomain stateとして保持せず、受け取った通知のdeliveryだけを扱う。

##### Contract

WordPress Reorder Integrationから、blocked / no-op等の現在評価と、WordPress接続が一度確保したsuccess / failureのApply Outcomeを受ける。文言と位置情報はBasic Designおよび既存意味責務が提供する確定済み内容を利用し、別のAccessibility用結果へ再解釈しない。

##### Lifecycle

通知入力の受領ごとに公開して完了する。blocked / no-opは同じ評価でもRF Interactionの再評価ごとに通知対象になり得る。success / failureは同一未提示Apply結果を複数回deliveryしない。Presentation再生成だけではApply結果のdelivery Lifecycleを開始しない。

##### Invariants

- focus状態を所有または変更しない。
- Table構造、方向固有Move、確定後位置を計算しない。
- 視覚Noticeのmountを通知発行条件にしない。
- 特定Assistive Technology向け分岐を持たない。

#### RF Interaction {#RESP_RF_INTERACTION}

##### Responsibility

一つの対象Tableに対するRF Sessionを所有し、open / close、方向選択、利用者入力、現在評価、Apply要求、およびApply結果の一度だけの引き渡しを管理する。

##### State ownership

closedまたは一つのopen RF Sessionを所有する。open Sessionは対象Table Identity、現在方向、方向ごとの入力、現在評価を保持する。success / failureはPresentationとAnnouncementへ安全にfan-outできる一回性の未提示結果として保持できる。blocked / no-opの差分判定・重複抑制用状態は保持しない。Table構造、WordPress表示状態、focus intent、announcement surfaceは所有しない。

##### Contract

WordPress Reorder Integrationから対象Table Identityを受けてRFを開始する。Rowでは現在行数、Columnでは現在列記述を方向固有Table Integrationから取得してInput Interpretationへ渡し、入力が成立した場合だけResolutionを要求する。

RF open中に対象Tableが変化した場合、現在入力範囲 / 選択肢を再取得して保持中入力を現在Tableへ再評価する。過去のResolution結果を成立保証として利用しない。

blocked / no-op等の現在評価はWordPress接続境界へそのまま公開する。success / failureは未提示Apply結果として、WordPress接続がOutcome全体を一度確保できるまで保持する。

Resolutionが成立候補を返した場合だけApply要求を受理する。Apply中は同じSessionの入力変更や別Apply要求を受理しない。Apply成功ではRF Sessionを終了し、failure / Cancelでは入力を保持したopen状態へ戻る。Cancelはfailure通知にしない。

##### Lifecycle

`closed → open(row) ↔ open(column) → applying`を主Lifecycleとする。successでは`closed`へ進み、failure / Cancelでは`open`へ戻る。not-ready、no-op、構造拒否、利用不能は`open`内の評価結果でありApply Lifecycleを開始しない。

##### Invariants

- open RF Sessionは同時に一つだけ存在する。
- RF Sessionの寿命をPresentation instanceの寿命に一致させない。
- Table構造を永続snapshotとして保持しない。
- success / failureの同一未提示Apply結果を複数回提示対象として公開しない。
- blocked / no-opの通知可否を判定するための差分状態を追加しない。

#### RF Input Interpretation {#RESP_RF_INPUT_INTERPRETATION}

##### Responsibility

利用者入力と現在入力範囲 / 選択肢を、未入力、修正が必要な入力、または方向固有Resolutionが扱える内部指定へ解釈する。

##### State ownership

状態を所有しない。利用者入力、Table構造、方向固有制約、Presentation状態を保持しない。

##### Contract

Rowでは利用者向け行番号と配置位置を現在行範囲へ安全に変換できる場合だけ内部位置を返す。Columnでは選択されたcurrent logical positionが現在列選択肢に存在する場合だけ内部指定を返す。初期の未入力は修正問題と区別し、不正値は対象入力と現在有効な条件を構造化して返す。

##### Lifecycle

入力変更または現在入力範囲 / 選択肢変更ごとに独立して解釈する。

##### Invariants

- Table Integrationを直接参照しない。
- Table構造上の移動可否やno-opを判定しない。
- 解釈不能入力からMove candidateを推測しない。

#### Row RF Resolution {#RESP_RF_ROW_RESOLUTION}

##### Responsibility

解釈済みRow指定を要求時点の現在`tbody`へ照合し、成立候補、no-op、構造拒否、利用不能を解決する。

##### State ownership

状態を所有しない。Table構造、入力、解決結果を要求間でcacheしない。

##### Contract

移動元、移動先、配置位置をcurrent logical positionとして受け、Row Table Integrationの現在構造へ照合する。現在Tableを安全に取得・解析できない場合は利用不能を返す。並び順が変わらない場合はno-opを優先し、実際に移動する候補だけ構造制約を評価する。

##### Lifecycle

入力成立時および現在Table再評価時に要求時点のTableへ解決する。

##### Invariants

- `tbody`以外の行を対象にしない。
- 行位置を永続Identityとして追跡しない。
- no-opを成立候補として返さない。
- Apply直前再照合の最終権威にならない。

#### Column RF Resolution {#RESP_RF_COLUMN_RESOLUTION}

##### Responsibility

解釈済みColumn指定を要求時点の現在論理列構造へ照合し、成立候補、no-op、構造拒否、利用不能を解決する。

##### State ownership

状態を所有しない。Table構造、列記述、入力、解決結果を要求間でcacheしない。

##### Contract

移動元、移動先、配置位置をcurrent logical positionとして受け、Column Table Integrationの現在構造へ照合する。現在Tableを安全に取得・解析できない場合は利用不能を返す。並び順が変わらない場合はno-opを優先し、実際に移動する候補だけ構造制約を評価する。

##### Lifecycle

入力成立時および現在Table再評価時に要求時点のTableへ解決する。

##### Invariants

- Table全体で整合する論理列だけを対象にする。
- 列位置を永続Identityとして追跡しない。
- no-opを成立候補として返さない。
- Apply直前再照合の最終権威にならない。

#### RF Apply Coordination {#RESP_RF_APPLY_COORDINATION}

##### Responsibility

RF候補について現在Table再照合、更新対象セル数取得、反映経路選択、確認、確定更新、表示復帰、success / failure、および成功時の確定Move summaryを所有する。

##### State ownership

一つのactive RF Applyについて、対象Table、方向、候補、Apply phase、確認用Move summary、成功時の確定Move summary、結果をLifecycle完了まで保持できる。RF入力値、Table構造snapshot、focus element、announcement surfaceは所有しない。

##### Contract

RF Interactionから成立候補を受け、方向固有Table Integrationへ現在Table上のApply評価を要求する。成立する場合だけReorder Apply Policyで反映経路を選択する。

通常反映では、Apply preparation前の再照合不成立または更新不能なら表示復帰を開始せずfailureを返せる。確定更新成功時は表示復帰状態へ進み、editing surface再成立後に結果確認focusを一回適用してから、確定Move summaryを含むsuccessを確定する。

確認付き大規模反映ではTableを変更せず確認待ちへ進む。Continue時は確認用Move summaryを確定結果として保持せず、反映準備完了後に現在Tableを再評価してから一回の確定更新を要求する。反映中Presentation成立後のsuccess / failureは必要な表示復帰完了後に確定する。CancelではTableを変更せずCancel結果を返す。

##### Lifecycle

通常反映は`idle → apply → restoring → idle`を意味上のLifecycleとし、preparation前failureはrestoringを経由せず戻れる。確認付き大規模反映は`idle → confirming → applying → restoring → idle`とし、Cancelは`confirming → idle`とする。

##### Invariants

- 一つのRF Apply Lifecycleで複数候補を同時に保持しない。
- 確認中はTableを変更しない。
- Table Integrationによる現在Table再照合なしに確定しない。
- successは確定更新成功だけでは確定せず、必要な表示復帰完了後に確定する。
- success用の確定Move summaryをRF入力の移動先番号または確認時summaryから推測しない。
- 確認Cancelをfailureとして公開しない。

#### Row Table Integration {#RESP_ROW_TABLE_INTEGRATION}

##### Responsibility

対応Table Block固有の保存表現差を吸収し、Row入力範囲、現在構造、構造診断、Apply評価、確定行移動、および確定後位置を提供する。

##### State ownership

Tableデータや解析結果を要求間の成立保証としてcacheしない。

##### Contract

要求時点の`tbody`構造を解釈し、RF入力範囲とResolution用制約を提供する。Apply評価では現在候補を再照合し、成立時に更新対象セル数と確定後位置を提供する。確定更新時も現在Tableを最終確認し、成立した行移動だけを一回のWordPress更新として反映する。

##### Lifecycle

入力範囲取得、Resolution、Apply評価、確定更新の各要求時点で現在Tableを参照する。

##### Invariants

- Table保存表現をRF / Accessibility責務へ公開しない。
- DnDとRFで異なるRow構造ルールを持たない。
- Apply時のRow構造成立性と確定後位置について最終権威を持つ。
- Accessibility Presentationまたはannouncementのために追加更新を生成しない。

#### Column Table Integration {#RESP_COLUMN_TABLE_INTEGRATION}

##### Responsibility

対応Table Block固有の保存表現差を吸収し、RF用列記述、現在論理列構造、構造診断、Apply評価、確定列移動、および確定後位置を提供する。

##### State ownership

Tableデータや論理列解析結果を要求間の成立保証としてcacheしない。

##### Contract

要求時点のTableを論理列構造として解釈し、RF入力選択肢とResolution用制約を提供する。Apply評価では現在候補を再照合し、成立時に更新対象セル数と確定後位置を提供する。確定更新時も現在Tableを最終確認し、成立した列移動だけを一回のWordPress更新として反映する。

##### Lifecycle

列記述取得、Resolution、Apply評価、確定更新の各要求時点で現在Tableを参照する。

##### Invariants

- Table保存表現をRF / Accessibility責務へ公開しない。
- DnDとRFで異なるColumn構造ルールを持たない。
- Apply時のColumn構造成立性と確定後位置について最終権威を持つ。
- Row固有処理と共通抽象化しない。
- Accessibility Presentationまたはannouncementのために追加更新を生成しない。

## 6. Runtime View

### RF open and Keyboard continuation {#RV_RF_OPEN}

RFを開始し、同一TableのDnDモードを終了してRF Sessionを開始し、accessible Presentationと初期focusを成立させる。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者が対象TableのRF入口を選択する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | 同一Tableで方向固有モードが有効なら通常編集へ戻す。 |
| 3 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 対象TableでRF Sessionを開始する。 |
| 4 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 初期方向を含む現在RF状態のPresentationを要求する。 |
| 5 | RESP_ACCESSIBILITY_PRESENTATION | EXT_WORDPRESS_COMPONENTS | 標準操作部品のKeyboardとsemantic Contractを利用してRFを提示する。 |
| 6 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | RF open後の意味上の初期focus targetを渡す。 |
| 7 | RESP_FOCUS_COORDINATION | RESP_EDITOR_DOM_CONTEXT | 現在RFと同じEditor contextを要求する。 |
| 8 | RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | 現在存在する初期targetへfocusを適用する。 |

### RF Row current-table reevaluation {#RV_RF_ROW_CURRENT_TABLE_REEVALUATION}

RF open中にRow方向の対象Tableが変化した場合、保持中入力を現在Table基準で再評価する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_SUPPORTED_TABLE_BLOCK | RESP_WORDPRESS_REORDER_INTEGRATION | 対象Tableの現在内容または構造が変化する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在Tableを基準とするRow評価更新を要求する。 |
| 3 | RESP_RF_INTERACTION | RESP_ROW_TABLE_INTEGRATION | 現在行範囲を再取得する。 |
| 4 | RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 保持中Row入力を現在行範囲へ再解釈する。 |
| 5 | RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | Row ready指定を現在Tableへ再解決する。 |
| 6 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 再評価後の実行可否と理由を提示する。 |

### RF Column current-table reevaluation {#RV_RF_COLUMN_CURRENT_TABLE_REEVALUATION}

RF open中にColumn方向の対象Tableが変化した場合、保持中入力を現在Table基準で再評価する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_SUPPORTED_TABLE_BLOCK | RESP_WORDPRESS_REORDER_INTEGRATION | 対象Tableの現在内容または構造が変化する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在Tableを基準とするColumn評価更新を要求する。 |
| 3 | RESP_RF_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | 現在列記述を再取得する。 |
| 4 | RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 保持中Column入力を現在選択肢へ再解釈する。 |
| 5 | RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | Column ready指定を現在Tableへ再解決する。 |
| 6 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 再評価後の実行可否と理由を提示する。 |

### RF Row input and structural result {#RV_RF_ROW_INPUT_RESULT}

Row入力成立性とRow構造結果を同じ意味正本から視覚Presentationと支援技術へ提示する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者がRow方向または入力を変更する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在のRow方向または入力を同じRF Sessionへ渡す。 |
| 3 | RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | Row入力成立性を要求する。 |
| 4 | RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | Row ready指定を現在Tableへ解決する。 |
| 5 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 入力問題または指定全体の現在評価をPresentationへ渡す。 |
| 6 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | blocked / no-op等の現在評価をそのまま公開する。 |
| 7 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 現在評価をfocus移動要求なしで渡す。 |

### RF Column input and structural result {#RV_RF_COLUMN_INPUT_RESULT}

Column入力成立性とColumn構造結果を同じ意味正本から視覚Presentationと支援技術へ提示する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者がColumn方向または入力を変更する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在のColumn方向または入力を同じRF Sessionへ渡す。 |
| 3 | RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | Column入力成立性を要求する。 |
| 4 | RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | Column ready指定を現在Tableへ解決する。 |
| 5 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 入力問題または指定全体の現在評価をPresentationへ渡す。 |
| 6 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | blocked / no-op等の現在評価をそのまま公開する。 |
| 7 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 現在評価をfocus移動要求なしで渡す。 |

### RF Row normal apply success {#RV_RF_ROW_NORMAL_APPLY_SUCCESS}

Row通常反映でApply評価、Policy選択、確定更新直前の最終再照合を順に行い、表示復帰と成功後focusを完了してからsuccessを確定する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | 成立したRow候補を渡す。 |
| 2 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | 現在TableでRow候補のApply評価を要求する。 |
| 3 | RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | 成立したRow候補の更新対象セル数を返す。 |
| 4 | RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | 更新対象セル数から反映経路を要求する。 |
| 5 | RESP_REORDER_APPLY_POLICY | RESP_RF_APPLY_COORDINATION | 通常反映経路を選択する。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | 現在Tableを最終再照合し、成立する場合だけ一回の確定行移動を要求する。 |
| 7 | RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | 確定更新成功と確定済み最終位置を返す。 |
| 8 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 更新成功後の表示復帰と確定済み最終位置を公開する。 |
| 9 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 更新後の対象Table editing surfaceを再成立させる。 |
| 10 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | editing surface成立後、確定後位置に対応する結果確認focusを一回要求する。 |
| 11 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 結果確認focus適用後、表示復帰完了を返す。 |
| 12 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | 確定済みMove summaryを持つsuccessを返す。 |
| 13 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 一度だけ提示可能なsuccessを提供する。 |
| 14 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 確定済みsuccess通知を渡す。 |

### RF Column normal apply success {#RV_RF_COLUMN_NORMAL_APPLY_SUCCESS}

Column通常反映でApply評価、Policy選択、確定更新直前の最終再照合を順に行い、表示復帰と成功後focusを完了してからsuccessを確定する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | 成立したColumn候補を渡す。 |
| 2 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | 現在TableでColumn候補のApply評価を要求する。 |
| 3 | RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | 成立したColumn候補の更新対象セル数を返す。 |
| 4 | RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | 更新対象セル数から反映経路を要求する。 |
| 5 | RESP_REORDER_APPLY_POLICY | RESP_RF_APPLY_COORDINATION | 通常反映経路を選択する。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | 現在Tableを最終再照合し、成立する場合だけ一回の確定列移動を要求する。 |
| 7 | RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | 確定更新成功と確定済み最終位置を返す。 |
| 8 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 更新成功後の表示復帰と確定済み最終位置を公開する。 |
| 9 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 更新後の対象Table editing surfaceを再成立させる。 |
| 10 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | editing surface成立後、確定後位置に対応する結果確認focusを一回要求する。 |
| 11 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 結果確認focus適用後、表示復帰完了を返す。 |
| 12 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | 確定済みMove summaryを持つsuccessを返す。 |
| 13 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 一度だけ提示可能なsuccessを提供する。 |
| 14 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 確定済みsuccess通知を渡す。 |

### RF Row large apply continue {#RV_RF_ROW_LARGE_APPLY_CONTINUE}

Rowの確認付き大規模反映で、Apply評価とPolicy選択から確認、Continue、反映準備、最終再照合と確定更新、表示復帰、success結果確認focus、結果通知までを一つの成功経路として成立させる。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | 成立したRow候補を渡す。 |
| 2 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | 現在TableでRow候補のApply評価を要求する。 |
| 3 | RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | 成立したRow候補の更新対象セル数を返す。 |
| 4 | RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | 更新対象セル数から反映経路を要求する。 |
| 5 | RESP_REORDER_APPLY_POLICY | RESP_RF_APPLY_COORDINATION | 確認付き大規模反映経路を選択する。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 確認状態と確認用Move summaryを公開する。 |
| 7 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 確認内容と選択肢のaccessible Presentationを要求する。 |
| 8 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_COMPONENTS | 確認Modalの標準mount focusを利用する。 |
| 9 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 利用者がContinueを選択する。 |
| 10 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | Continueを返す。 |
| 11 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 反映準備状態を公開する。 |
| 12 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 反映中状態のaccessible Presentationを要求する。 |
| 13 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_COMPONENTS | 反映中Modalの標準mount focusを利用する。 |
| 14 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableの競合編集を抑止し、反映中Presentationを成立させる。 |
| 15 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 反映準備完了を返す。 |
| 16 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | 現在Tableを最終再照合し、成立する場合だけ一回の確定行移動を要求する。 |
| 17 | RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | 確定更新成功と確定済み最終位置を返す。 |
| 18 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 更新成功後の表示復帰と確定済み最終位置を公開する。 |
| 19 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 更新後の対象Table editing surfaceを再成立させる。 |
| 20 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | editing surface成立後、確定後位置に対応する結果確認focusを一回要求する。 |
| 21 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 結果確認focus適用後、表示復帰完了を返す。 |
| 22 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | 確定済みMove summaryを持つsuccessを返す。 |
| 23 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 一度だけ提示可能なsuccessを提供する。 |
| 24 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 確定済みsuccess通知を渡す。 |

### RF Column large apply continue {#RV_RF_COLUMN_LARGE_APPLY_CONTINUE}

Columnの確認付き大規模反映で、Apply評価とPolicy選択から確認、Continue、反映準備、最終再照合と確定更新、表示復帰、success結果確認focus、結果通知までを一つの成功経路として成立させる。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | 成立したColumn候補を渡す。 |
| 2 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | 現在TableでColumn候補のApply評価を要求する。 |
| 3 | RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | 成立したColumn候補の更新対象セル数を返す。 |
| 4 | RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | 更新対象セル数から反映経路を要求する。 |
| 5 | RESP_REORDER_APPLY_POLICY | RESP_RF_APPLY_COORDINATION | 確認付き大規模反映経路を選択する。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 確認状態と確認用Move summaryを公開する。 |
| 7 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 確認内容と選択肢のaccessible Presentationを要求する。 |
| 8 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_COMPONENTS | 確認Modalの標準mount focusを利用する。 |
| 9 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 利用者がContinueを選択する。 |
| 10 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | Continueを返す。 |
| 11 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 反映準備状態を公開する。 |
| 12 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 反映中状態のaccessible Presentationを要求する。 |
| 13 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_COMPONENTS | 反映中Modalの標準mount focusを利用する。 |
| 14 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableの競合編集を抑止し、反映中Presentationを成立させる。 |
| 15 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 反映準備完了を返す。 |
| 16 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | 現在Tableを最終再照合し、成立する場合だけ一回の確定列移動を要求する。 |
| 17 | RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | 確定更新成功と確定済み最終位置を返す。 |
| 18 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 更新成功後の表示復帰と確定済み最終位置を公開する。 |
| 19 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 更新後の対象Table editing surfaceを再成立させる。 |
| 20 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | editing surface成立後、確定後位置に対応する結果確認focusを一回要求する。 |
| 21 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 結果確認focus適用後、表示復帰完了を返す。 |
| 22 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | 確定済みMove summaryを持つsuccessを返す。 |
| 23 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 一度だけ提示可能なsuccessを提供する。 |
| 24 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 確定済みsuccess通知を渡す。 |

### RF Row pre-preparation apply failure {#RV_RF_ROW_PREPARATION_FAILURE}

Row Apply preparation前に現在TableでのApply評価が成立しない、または更新不能と評価された場合、表示復帰Lifecycleへ入らずTable未変更でRFへ戻る。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | 現在TableでRow候補のApply評価を要求する。 |
| 2 | RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | Row候補が現在Tableで成立しない、または更新不能であることをTable未変更で返す。 |
| 3 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | restorationなしでfailureを返す。 |
| 4 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 入力を保持したRF状態と一回性failureを提供する。 |

### RF Column pre-preparation apply failure {#RV_RF_COLUMN_PREPARATION_FAILURE}

Column Apply preparation前に現在TableでのApply評価が成立しない、または更新不能と評価された場合、表示復帰Lifecycleへ入らずTable未変更でRFへ戻る。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | 現在TableでColumn候補のApply評価を要求する。 |
| 2 | RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | Column候補が現在Tableで成立しない、または更新不能であることをTable未変更で返す。 |
| 3 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | restorationなしでfailureを返す。 |
| 4 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 入力を保持したRF状態と一回性failureを提供する。 |

### RF Row prepared apply failure and recovery {#RV_RF_ROW_PREPARED_FAILURE}

Row反映準備または反映中Presentation成立後に確定更新を完了できない場合、Table未変更のediting surfaceを復帰してfailureを確定する。RF復帰focusはWordPress標準挙動を優先し、実ユーザー操作上の問題が確認された場合だけ最小補完を検討する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | 反映準備後の現在Tableを最終再照合し、成立する場合だけ一回の確定行移動を要求する。 |
| 2 | RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | Row Applyの再照合不成立または更新不能をTable未変更で返す。 |
| 3 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | Table未変更のediting surface restorationを要求する。 |
| 4 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Table editing surfaceを再成立させる。 |
| 5 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 必要な表示復帰完了を返す。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | failureを返して現在入力の再評価へ戻す。 |
| 7 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 入力を保持したRF状態、現在評価、一回性failureを提供する。 |
| 8 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | Table未変更を含むfailure通知を渡す。 |

### RF Column prepared apply failure and recovery {#RV_RF_COLUMN_PREPARED_FAILURE}

Column反映準備または反映中Presentation成立後に確定更新を完了できない場合、Table未変更のediting surfaceを復帰してfailureを確定する。RF復帰focusはWordPress標準挙動を優先し、実ユーザー操作上の問題が確認された場合だけ最小補完を検討する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | 反映準備後の現在Tableを最終再照合し、成立する場合だけ一回の確定列移動を要求する。 |
| 2 | RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | Column Applyの再照合不成立または更新不能をTable未変更で返す。 |
| 3 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | Table未変更のediting surface restorationを要求する。 |
| 4 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Table editing surfaceを再成立させる。 |
| 5 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 必要な表示復帰完了を返す。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | failureを返して現在入力の再評価へ戻す。 |
| 7 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 入力を保持したRF状態、現在評価、一回性failureを提供する。 |
| 8 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | Table未変更を含むfailure通知を渡す。 |

### RF confirmation and cancel {#RV_RF_CONFIRMATION_CANCEL}

確認付き大規模反映で確認表示へfocusを移し、CancelではTableを変更せず入力を保持したRFへ戻る。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 確認状態と確認用Move summaryを公開する。 |
| 2 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 確認内容と選択肢のaccessible Presentationを要求する。 |
| 3 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_COMPONENTS | 確認Modalの標準mount focusを利用する。 |
| 4 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 利用者がCancelを選択する。 |
| 5 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | Table未変更のCancelを返す。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | 入力を保持したopen RF状態へ戻す。 |
| 7 | EXT_WORDPRESS_COMPONENTS | EXT_WORDPRESS_EDITOR | Cancel後はModalの標準focus returnを利用する。 |

### RF close and focus protection {#RV_RF_CLOSE}

明示的終了ではRF入口へ戻し、別の操作対象への移動による終了では利用者の新しいfocus位置を優先する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 明示的終了または別操作対象への移動がRF終了条件となる。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在RF Sessionを終了する。 |
| 3 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | 明示的終了の場合だけ、現在保持しているRF入口を復帰先として渡す。 |
| 4 | RESP_FOCUS_COORDINATION | EXT_WORDPRESS_EDITOR | 渡された現在のRF入口へfocusを戻す。別操作対象への移動時は要求自体を発行しない。 |

## 8. Crosscutting Concepts

### Current Table Authority

RFはTable snapshotや永続Row / Column IDを成立保証として保持しない。Input Interpretation、Resolution、Apply評価、確定更新はそれぞれ要求時点の現在Tableを正本とする。

Row / Column位置はcurrent logical positionとして扱う。入力後にTableが変化しても過去対象との同一性を内容比較等で追跡せず、現在位置として安全に解釈できるかを再評価する。現在Tableへ安全に照合できない場合は候補を推測しない。

### UI Position and Internal Position

利用者入力とTable構造判定では内部位置を正本とする。入力時の1-based位置はInput Interpretation境界で内部位置へ変換する。確認Presentation向けにはRF Apply Coordinationが確定済みMove意味から最小限の利用者向け位置summaryを公開できる。

### Destination Target Semantics

移動先指定は並び替え前Table上の対象行・対象列を意味する。方向固有Resolutionが配置指定を移動前基準の境界へ変換し、移動元除去後indexを入力意味へ逆流させない。

### Resolution Outcome Boundary

方向固有Resolutionは、入力成立後の結果として成立候補、no-op、構造拒否、利用不能を区別する。利用不能は対象Table不在、現在構造解析不能、source / targetを現在位置として照合不能等をArchitecture上で集約した意味であり、内部原因を利用者向けContractへ細分化しない。

### State ownership and derivation

RF / Accessibilityは一つの意味状態に一つの正本を維持する。RF open / closed、対象Table、方向、入力、現在評価、未提示Apply結果はRF Interaction、入力成立性はRF Input Interpretation、構造意味は方向固有Resolution / Table Integration、Apply phase・確認summary・成功時の確定Move summary・結果はRF Apply Coordinationを正本とする。

Accessibility Presentationはこれらを保存用modelへ複製しない。Focus CoordinationもRF / Apply状態やpending intentを保存せず、要求時点の現在Editor contextだけを利用する。

### Validation and Accessibility Presentation boundary

入力成立性はRF Input Interpretation、Table構造上の成立性は方向固有RF ResolutionとTable Integration、Apply時の最終成立性は方向固有Table Integrationが所有する。

Accessibility Presentationは判定結果を受け取り、入力問題なら対象入力と修正情報の関係として、no-op・構造拒否・利用不能なら現在指定全体の結果として表現する。表示上の制約から独自validation結果を生成しない。

### Apply Revalidation and Restoration

Resolution結果はApply時の確定権威ではない。RF Apply CoordinationはApply要求時にTable Integrationへ現在候補の再評価を要求し、Table Integrationは確定更新直前にも現在Tableを最終確認する。

Apply preparation前のfailureはrestorationを必要としない。一方、反映準備または反映中Presentation成立後のfailureは、Table未変更のediting surfaceを復帰してからfailureを確定する。failure後のRF内focusはWordPress標準挙動を優先し、実ユーザー操作上の問題が確認された場合だけ最小補完を追加する。

成功時は通常反映と確認付き大規模反映を共通の表示復帰契約へ合流させる。Table更新成功後、既存Apply Lifecycleがediting surface再成立を待ち、その後現在DOMへ結果確認focusを一回適用してからsuccessを確定する。Focus Coordination自身はbarrierを所有しない。

### Reorder Apply Exclusivity

Row / Column / RFのactive Apply Lifecycleは同時に高々一つとする。製品入口の排他接続がこのInvariantを保証し、WordPress Reorder Apply Integrationは競合時の優先順位付け、fallback、仲裁を所有しない。

### Completion Outcome

RF Interactionはsuccess / failureを一回性の未提示Apply結果として、WordPress接続境界がOutcome全体を一度確保できるまで保持する。successは確定Move summaryを含み、failureはMove summaryを要求しない。WordPress接続は確保した同じOutcomeをVisual PresentationとAnnouncement Deliveryへfan-outする。no-op、構造拒否、利用不能等は現在評価をそのまま公開し、差分判定・重複抑制・一回性通知状態を持たない。確認Cancelはfailure通知と同一視しない。

### Structural Rejection Diagnostics

結合セルによる構造拒否は方向固有Table Integrationから診断データとして提供し、PresentationがTableを再解析しない。診断はRF専用文言ではなく、方向固有構造から導かれる意味として扱う。

### Minimal Table Read Contract

RF InteractionはSupported Table Blockの保存表現を直接解釈しない。Rowでは現在行数、Columnでは論理列位置、利用者向け列番号、利用可能な見出し等、入力成立に必要な最小情報だけを方向固有Table Integrationから受け取る。

### No-op and Undo Boundary

指定が成立していても順序が変わらない場合は方向固有Resolutionがno-opとして解決し、Apply Coordinationへ渡さず、Table更新およびUndo履歴を発生させない。

成立した一回のRF移動は方向固有Table Integrationが一回のWordPress更新として反映し、一回のUndo単位を維持する。確認、反映中表示、表示復帰、focus、成功 / 失敗通知は追加のTableデータ更新を生成しない。

### Direction-independent Accessibility meaning

Row / Columnの差は、RF Interactionの現在方向、方向固有入力descriptor、Resolution結果、Table Integrationが返す診断・列記述・確定後位置として既存Contractから渡される。

Accessibility Presentation、Focus Coordination、Announcement Deliveryは方向固有Table構造を解釈しない。Row / Column DnDのInput Interaction、DnD Interaction、Reorder PresentationはAccessibility v1のKeyboard経路に含めない。

### WordPress and native semantics boundary

Browserはnative controlの標準Keyboard操作とfocus動作を提供する。WordPress ComponentsはEditorと整合する標準操作部品とsemantic Contractを提供する。YTRは要件を満たすprimitiveの選択、利用者向け意味の供給、現在状態との接続、RF / Apply固有focus遷移、結果announcementを所有する。

外部Componentの不備がBasic DesignのContractを阻害する場合は、外部問題とYTR責務を切り分けて評価し、独自WidgetやComponent全面置換を自動的なfallbackにしない。

### Focus intent and current Editor context

focusはDOM位置ではなく、RF入口、方向選択、確定後セル、対象Tableの安定位置等の意味上のtargetとして責務間を渡す。confirmation / applyingはWordPress Componentsの標準focus Contractを利用する。

Focus Coordinationは現在Editor contextだけを利用する。RF openでは要求時点の現在targetだけを解決し、不成立時に後続Presentationを待たない。RF explicit closeではWordPress Reorder Integrationが保持する現在のRF入口をそのままfocusし、同じ入口を再検索しない。Apply success側も既存Apply Lifecycleの描画待ち後に現在targetを一回だけ解決し、Focus Coordination自身は再評価Lifecycleを持たない。

### Announcement source and delivery

通知意味の生成条件は結果の所有責務に置く。RF Interactionはblocked / no-op等の現在評価をそのまま公開し、success / failureは未提示Apply結果として公開する。RF Apply Coordinationはsuccessに確定Move summaryを提供する。方向固有Table Integrationは診断と確定位置を提供するがAnnouncementを直接発行しない。

Announcement Deliveryは視覚Noticeとは独立したdelivery境界である。blocked / no-opの差分判定・重複抑制を所有せず、視覚Noticeのmount / unmountやfocus移動とsuccess / failure Apply結果の一回性を結び付けない。

### Architecture-wide invariants

- 一つの意味状態に一つの正本を維持し、Accessibility用StoreへRF / Apply / Row / Column状態を複製しない。
- Accessibility責務はTable構造、移動可否、no-op、確定結果、確定後位置を再解釈しない。
- Keyboard inputは既存RF / Apply Contractへ合流し、pointerとは別の並び替え結果modelを作らない。
- native semanticsとWordPress Componentの標準Contractを優先し、独自Keyboard state machineを導入しない。
- focusはDesignで定義されたLifecycle境界でだけ移動し、通知または再描画だけでは移動しない。
- Focus Coordinationはpending focus intentを持たない。
- successは既存Apply Lifecycleの描画待ち後に結果確認focusを一回適用してから確定する。
- 成功後focusとannouncementは確定済み最終位置だけを利用し、指定した移動先や隣接位置から結果を推測しない。
- 同じsuccess / failure Apply結果をPresentation再生成によって繰り返し通知しない。
- blocked / no-opの通知可否を判定するための差分状態または重複抑制状態を追加しない。
- Wide / Narrow、iframe / non-iframe、Core Table / Flexible Table Blockの差は操作意味、focus方針、announcement意味を変えない。
- Row / Column DnDへKeyboard DnDまたはAccessibility v1固有状態を追加しない。

## 9. Architecture Decisions

### RF Architecture is Unified, Direction Logic is Separate

RFは一つの入口・入力Lifecycleを持つためArchitecture文書をRow / Columnへ分割しない。一方、方向固有の位置意味、構造制約、Table更新は独立責務として維持する。

### Accessibility is Part of the RF Architecture

Accessibilityを別Architectureまたは独立Subsystemにせず、Accessibility Presentation、Focus Coordination、Announcement DeliveryをRF ArchitectureのWordPress Reorder接続境界へ置く。RF / Apply / Tableの意味責務を再利用し、Accessibility側に並び替えCoreを作らない。

### RF is not a Reorder Mode Direction

Reorder Modeは既存の`edit | row | column`を維持する。RFはフォーム入力を伴う独立Workflowであり、新しいReorder Mode方向を追加しない。

### Reuse Table Integration, not DnD Interaction

RFはRow / Column Table Integrationの構造解釈・更新能力を再利用するが、DnD Session、物理入力、DnD Interactionを経由しない。

### Current Table is the Authority

RF入力中の候補は過去snapshotや永続Row / Column Identityとして扱わない。ResolutionとApplyは要求時点の現在Tableを正本とし、Table Integrationを確定更新の最終権威とする。

### RF Owns its Apply Coordination

RFは入力保持、確認Cancel後のフォーム復帰、通常反映を含む表示復帰、成功時終了、失敗時再実行というLifecycleを持つため、RF Apply Coordinationを独立責務とする。共通Reorder Apply PolicyとWordPress Reorder Apply Integrationは重複させず再利用する。

### Platform-first Keyboard and Semantics

RFのKeyboard操作はnative semanticsとWordPress Componentsの標準Contractを利用する。YTRは現在状態との接続と不足する意味だけを補い、独自Widget、shortcut、Keyboard state machineをPhase 1へ導入しない。

### Focus Coordination is a Stateless Application Boundary

Focus Coordinationは、既存Lifecycleから確定した意味上のtargetを要求時点の現在Editor contextへ一回適用する境界とする。RF / Apply phase、Table位置、pending request、retry状態を複製せず、表示再成立待ちは既存Apply Lifecycleへ委ねる。

### Announcement Meaning Remains Source-owned

Announcement Deliveryはdeliveryだけを所有する。blocked / no-opはRF Interactionの現在評価をそのまま利用し、差分判定・重複抑制状態を追加しない。success / failureの一回性はRF Interactionの未提示Apply結果を正本とし、成功時の確定Move summaryはRF Apply Coordinationと方向固有Table Integrationを正本とする。

### Apply Failure Recovery Depends on Lifecycle Stage

Apply preparation前のfailureと、反映準備または反映中Presentation成立後のfailureを区別する。前者はrestoration不要、後者はTable未変更のediting surfaceを復帰してからfailureを確定する。failure後のRF内focusはWordPress / Reactの標準挙動を優先し、専用のFocus Coordination Lifecycleは設けない。

## 10. Quality Requirements

- **Correctness**: Resolution結果だけで更新せず、Table IntegrationがApply時の現在Tableへ再照合して成立する移動だけを確定する。
- **Data integrity**: not-ready、no-op、構造拒否、利用不能、Cancel、再照合不成立、更新不能では不完全なTable変更を残さない。
- **Keyboard operability**: RF開始から結果確認までplatform標準のKeyboard Contractを通じて既存RF / Apply Lifecycleを完了できる。
- **Semantic consistency**: 視覚Presentationと支援技術向けPresentationが同じRF / Apply / Table意味状態を利用する。
- **Focus continuity**: RF open / explicit closeはYTRの即時focus Contractで扱い、confirmation / applying / CancelはWordPress標準focusを優先し、successは既存描画待ち後に結果確認focusを一回適用する。
- **Notification correctness**: success / failureは同じ未提示Apply結果から一度だけ通知し、構造拒否 / no-opは現在評価をそのまま利用して追加の差分判定・重複抑制を行わず、focus移動をdelivery手段にしない。
- **Lifecycle correctness**: preparation前failureでは不要なrestorationを開始せず、prepared failureではediting surfaceの表示復帰後にfailureを確定する。successではexisting Apply Lifecycleの表示復帰後に結果確認focusを一回適用して結果を確定する。
- **State minimality**: Focus Coordinationへpending / retry / stale reason / Lifecycle世代を追加せず、既存状態と既存Apply Lifecycleから必要なfocus要求を導出する。
- **Consistency**: Row / Column DnDとRFは方向固有Table Integrationの同じ構造ルールと更新意味を利用する。
- **Maintainability**: RF domain責務、WordPress接続、Accessibility責務、方向固有構造を分離し、現在のsource tree形状へArchitectureを固定しない。
- **Editor continuity**: 対象Tableの競合編集を防ぎつつ、対象Table以外の操作を不必要に妨げない。
- **Compatibility**: Core Table / Flexible Table Blockおよびiframe / non-iframeの差を既存境界で吸収し、操作意味を分岐させない。
- **Scope control**: Accessibility v1 Phase 1のRF baselineに必要な責務だけを扱い、Keyboard DnD、全面的WCAG監査、screen reader固有対応へ拡張しない。

## 11. Risks and Technical Debt

- Row / Column / RFのApply Lifecycle排他は製品入口のInvariantに依存する。新しいReorder入口を追加する場合は、WordPress Reorder Apply Integrationへ仲裁責務を追加するのではなく、入口側で同Invariantを維持する必要がある。
- current logical positionは永続Identityではないため、RF open中の外部変更後に以前選択した内容そのものを追跡するContractは持たない。
- WordPress EditorまたはWordPress Componentsのversion差により、標準Keyboard / semantic / focus Contractの実際の挙動が異なる可能性がある。外部能力とYTR接続のどちらに原因があるかを分離して評価する必要がある。
- Table更新時のediting surface再生成ではfocus target成立時点がEditor Lifecycleに依存するため、既存Apply Lifecycleの描画待ち後に一回だけfocusする。Focus Coordinationへ別のpending Lifecycleを追加しない。
- BrowserとAssistive Technologyの組み合わせによりannouncement伝達挙動が異なる可能性がある。Phase 1では特定製品向け分岐を設けない。
- 成功後の正確なセルを現在Tableで特定できない場合がある。推測focusを禁止し、対象Tableの安定位置へのfallbackに限定する。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| RF | Reorder Form。DnDを必要とせず、行または列と移動先を指定して並び替える独立した操作手段。 |
| RF Session | 一つの対象Tableに対してRFがopenしている間の入力Lifecycle。Presentation instanceの寿命とは独立する。 |
| Reorder Mode | 通常編集、Row DnD、Column DnDの排他状態。RF状態は含まない。 |
| Current logical position | 要求時点の現在Table上の0-based論理位置。永続Row / Column Identityではない。 |
| Move candidate | 方向固有Resolutionで要求時点の現在Tableに成立すると解決された候補。Apply時はTable Integrationが現在Tableへ再照合する。 |
| Unavailable | 現在Tableまたは指定位置を安全にResolution対象として利用できず、候補を生成しない状態。 |
| RF Apply Coordination | RF候補の再照合、反映経路選択、確認、確定更新、表示復帰、結果確定を所有するLifecycle責務。 |
| Accessibility Presentation | 既存RF / Apply状態を標準操作部品の意味、状態、案内、入力問題との関係として表現する責務。 |
| Focus intent | Lifecycle上の遷移理由と意味上のfocus targetを表す一時的な要求。DOM nodeやRF / Apply phaseの複製ではない。 |
| Announcement | focusを移動せず、RF Interactionの現在評価または確定したApply結果を支援技術へ伝える通知。blocked / no-opは差分判定・重複抑制を持たず、success / failureは未提示Apply結果の一回性に従う。 |
| Input problem | RF Input Interpretationが特定入力について修正を必要とすると解釈した結果。構造拒否またはno-opとは異なる。 |
| Structural result | Row / Column RF ResolutionとTable Integrationが現在指定全体について返すno-op、構造拒否、または利用不能。 |
| Semantic target | RF入口、方向選択、確定後セル、対象Tableの安定位置等、具体的DOM構造から独立したfocus先の意味。 |
| Browser Accessibility Platform | native Keyboard動作、focus、accessibility tree、支援技術への状態変化伝達を提供するbrowser能力。 |
