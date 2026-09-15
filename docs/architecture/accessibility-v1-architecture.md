# Accessibility v1 Architecture

## 1. Introduction and Goals

本書は、Accessibility v1 Phase 1を実現するための内部責務、境界、状態所有、Contract、依存関係、Lifecycle、Invariantを定義する。

入力は`docs/requirements/accessibility-v1-requirements.md`、`docs/design/accessibility-v1-design.md`、および既存のReorder Form / Row Reorder / Column Reorder Architectureとする。利用者向けのKeyboard操作、focus遷移、メッセージ、通知条件はBasic Designを正本とし、本書ではそれらを実現する責務配置だけを扱う。

既存Architectureと同じstable IDを持つ責務は、既存文書の責務定義を置き換えない。本書の記述はAccessibilityによって追加される接続とContractを累積的に示し、既存のState ownership、Contract、Lifecycle、Invariant、およびStructural Dependencyを引き続き成立させる。

Accessibility v1は、Reorder Form（RF）をKeyboardと支援技術から利用できる正式な並び替え経路として成立させる。新しい並び替えCoreや大きなAccessibility subsystemは設けず、既存RF / Reorder責務が所有する入力意味、構造診断、Apply結果、最終位置を利用して、WordPress接続境界に必要なSemantics、Focus Coordination、Announcement Deliveryを加える。

本書の対象はIssue #1047のPhase 1-3 Keyboard / Semantics、Phase 1-4 Focus Management、Phase 1-5 Announcementである。Row / Column DnDのKeyboard操作、WCAG全面対応、WordPress Component自体の改善等、同Issueで対象外とされた内容へ責務を広げない。

## 2. Architecture Constraints

- RFをKeyboardによる正式な並び替え経路とし、Row / Column DnDへKeyboard DnDを追加しない。
- RFの操作はnative semanticsおよびWordPress Componentの標準Keyboard Contractを優先し、YTR固有のKeyboard state machineを設けない。
- Accessibility固有責務は既存のWordPress Reorder接続境界へ置き、独立した並び替えSubsystem、Row専用Accessibility層、Column専用Accessibility層を設けない。
- RF Interactionを対象Table、方向、入力、現在評価、および未提示のApply結果の正本とする。Accessibility Presentationはそれらを重複所有しない。
- RF Input Interpretationを入力成立性の判定責務とし、Accessibility Presentationは入力値を再検証しない。
- Row / Column RF Resolutionと各Table Integrationをno-op、構造拒否、利用不能、および方向固有診断の正本とし、Accessibility責務はTable構造を再解析しない。
- RF Apply CoordinationをApply Lifecycle、確定済みMove summary、および成功時の最終位置の正本とし、Focus CoordinationとAnnouncement Deliveryは並び替え結果を推測しない。
- RF Apply Coordinationは既存のReorder Apply Policyに依存し、通常反映または確認付き大規模反映を選択する。Accessibilityは反映経路を置き換えない。
- Keyboard / SemanticsはRFおよびApplyのWordPress接続責務が標準UI primitiveとAccessibility Presentationを組み合わせて成立させる。入力意味やApply意味をWordPress UI内の別状態として持たない。
- Focus CoordinationはDesignで定義された遷移を意味上のfocus intentとして調停する。RF / Apply Lifecycle、validation結果、Table構造、DOM nodeを別正本として保持しない。
- focus targetが表示再生成中に一時的に存在しない場合だけ、Focus CoordinationはLifecycleに結び付いたpending intentを保持できる。成功側のApply Lifecycleはfocus適用、明示されたfallback、対象Table消失、または利用者による別位置への移動としてintentがsettleするまで終了しない。古いTableまたは終了済みLifecycleのintentは適用しない。
- 入力問題、no-op、構造拒否、結果通知を知らせることだけを理由にfocusを移動しない。
- Announcement Deliveryは通知手段を所有し、通知する意味と一回性は結果を所有する既存責務から受け取る。表示再生成を新しい結果として扱わない。
- 視覚Presentationと支援技術向けAnnouncementは同じ意味の正本を共有するが、同じ表示方式または同じ情報量であることを要求しない。
- success announcementの反映後位置と成功後focus targetは、方向固有Table Integrationが確定更新後に返し、RF Apply Coordinationが保持した最終位置だけを利用する。
- Wide / Narrowの表示形式、iframe / non-iframe Editor、Core Table / Flexible Table Blockの差によって、RFの操作意味、状態意味、focus方針、announcement意味を変えない。
- WordPress Editor、WordPress Component、browserが標準的に提供するKeyboard、focus、semantic Contractは外部能力として利用する。YTRは正しいprimitiveの選択、意味付与、状態接続、およびYTR Lifecycle固有の補足だけを所有する。
- WordPressまたは利用Component自体のAccessibility不備を、YTR独自Widgetやscreen reader固有分岐で一般的に置き換えない。
- Accessibility責務はTableデータを変更せず、追加のWordPress更新またはUndo単位を生成しない。

## 3. Context and Scope

### External Context

| ID | Name | Type | Summary |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | WordPress Editor | External System | 対応Tableの選択、toolbar、RF、確認、反映中表示、editing surface、およびEditor Lifecycleを提供する。 |
| EXT_WORDPRESS_COMPONENTS | WordPress Components | External UI Capability | RFとApply Presentationで利用できる標準的な操作、Keyboard、focus、およびsemantic Contractを提供する。 |
| EXT_BROWSER_ACCESSIBILITY | Browser Accessibility Platform | External Platform | native controlのKeyboard動作、focus、accessibility tree、および支援技術への状態変化伝達を提供する。 |
| EXT_ASSISTIVE_TECHNOLOGY | Assistive Technology | External Consumer | Browserが公開する操作部品、状態、入力問題、およびannouncementを利用者へ伝える。 |
| EXT_SUPPORTED_TABLE_BLOCK | Supported Table Block | External Block | Core TableまたはFlexible Table Blockとして、方向固有Table Integrationが構造解釈と確定更新を行う対象を提供する。 |
| EXT_WORDPRESS_UNDO | WordPress Undo | External Capability | 成立した一回のRF並び替えを一回のUndoで戻せる更新単位を提供する。 |

WordPress EditorとWordPress Componentsは、標準的なEditor操作とUI primitiveのContractを提供する。Browser Accessibility Platformはnative semantics、focus、および支援技術への伝達を担う。YTRはこれらの外部能力を置き換えず、RF / Reorderの現在状態を適切な操作意味へ接続し、YTR Lifecycleに固有なfocus復元と結果通知を補う。

YTRはAssistive Technology製品へ直接依存しない。Browser Accessibility Platformに一貫した意味と状態変化を公開するところまでを責務境界とし、特定のscreen readerまたはOS向けの分岐は持たない。

Supported Table Blockは並び替え構造と結果位置の正本であり、Accessibility側の解析対象ではない。Core TableとFlexible Table Blockの差は既存のRow / Column Table Integration境界に閉じる。

## 4. Solution Strategy

Accessibility v1は、既存の責務モデルへ三つの狭いPresentation責務を加える。

- Accessibility Presentationは、既存RF / Apply状態を標準UI primitiveの名前、意味、状態、入力問題との関係へ接続する。独自の操作modelやvalidation modelは持たない。
- Focus Coordinationは、RF open / close、確認、反映中、表示復帰、success / failureという既存Lifecycleからfocus intentを受け、現在のEditor contextで実行する。通常のKeyboard移動はplatformへ委ねる。
- Announcement Deliveryは、既存責務が確定した一回性の意味通知をBrowser Accessibility Platformへ渡す。結果意味や文言条件を再判定しない。

Keyboard inputはWordPress Reorder IntegrationまたはWordPress Reorder Apply Integrationから、pointer inputと同じ既存RF / Apply Contractへ入る。入力成立性はRF Input Interpretation、no-opと構造可否は方向固有RF Resolution、Table構造と確定結果は方向固有Table Integration、Apply状態と最終位置はRF Apply Coordinationが引き続き所有する。

Semanticsは、既存のdomain stateとWordPress接続が所有する表示専用状態から要求時点で導出する。方向、選択状態、入力範囲、実行可否、展開状態、確認状態、反映中状態等をAccessibility専用Storeへ複製しない。表示形式が再生成されても、同じRF Session、表示Lifecycle、Apply Lifecycleから同じ操作意味を再構成する。

Focus Coordinationは、platform標準のfocus移動で足りる間は介入しない。Designが明示するLifecycle境界でだけfocus intentを受け、対象が一時的に存在しない場合はpending intentとして表示復帰を待つ。移動後セルはTable Integrationが確定した最終位置を使用し、見つからない場合に隣接位置から推測しない。成功側の表示復帰は、Focus Coordinationが最終targetへの適用またはDesignで明示されたfallbackをsettleした後にだけ完了する。

Announcementはfocusから独立させる。RF Interactionが所有する現在評価の意味変化または未提示Apply結果を一回性の通知入力とし、Announcement Deliveryはその意味を支援技術へ伝える。Presentation再生成や同一状態の再評価だけでは新しい通知を発行しない。

### Process Flow Views

#### Accessible RF End-to-End {#PV_ACCESSIBLE_RF_END_TO_END kind=normal}

KeyboardによるRF開始から既存Resolution / Apply、accessible Presentation、focus復帰、結果announcementまでの主要な処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | normal | 対応TableのRF操作がWordPress接続境界へ入る。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | normal | RF開始前に同一Tableの方向固有Reorder Modeを終了する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | normal | Keyboardまたは他の標準入力を同じRF Sessionへ接続する。 |
| RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | normal | 現在入力を方向固有Resolution向けの内部指定へ解釈する。 |
| RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | normal | 成立したRow指定を現在Tableへ解決する。 |
| RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | normal | 成立したColumn指定を現在Tableへ解決する。 |
| RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | normal | Row構造と診断を既存の方向固有権威から取得する。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | normal | Column構造と診断を既存の方向固有権威から取得する。 |
| RESP_RF_INTERACTION | RESP_ACCESSIBILITY_PRESENTATION | normal | 現在の入力意味、評価、操作可否をaccessible Presentationへ渡す。 |
| RESP_ACCESSIBILITY_PRESENTATION | EXT_WORDPRESS_COMPONENTS | normal | 標準UI primitiveへRF / Applyの意味と状態を接続する。 |
| RESP_ACCESSIBILITY_PRESENTATION | EXT_BROWSER_ACCESSIBILITY | normal | native semanticsを補足する必要な意味と関係を公開する。 |
| RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | normal | 成立した候補の既存Apply Lifecycleへ進む。 |
| RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | normal | 確認、反映中、表示復帰に必要なApply状態と最終位置を公開する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | normal | RF openまたは明示的終了に対応するfocus intentを調停へ渡す。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | normal | Apply Lifecycleに対応するfocus intentを調停へ渡す。 |
| RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | normal | 現在のEditor contextで確定したfocus targetへ移動する。 |
| RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | normal | 新しく成立した一回性の結果意味をWordPress接続へ公開する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | normal | 確定済みの一回性結果意味を通知境界へ渡す。 |
| RESP_ANNOUNCEMENT_DELIVERY | EXT_BROWSER_ACCESSIBILITY | normal | 結果意味をfocusから独立した状態変化として公開する。 |
| EXT_BROWSER_ACCESSIBILITY | EXT_ASSISTIVE_TECHNOLOGY | normal | 公開された操作意味、状態、focus、announcementを支援技術へ伝える。 |

#### Input or Apply Failure and Recovery {#PV_ACCESSIBILITY_FAILURE_RECOVERY kind=failure-recovery}

入力問題、no-op、構造拒否、利用不能、Apply failureから、入力を修正または再実行できるaccessible RF状態へ戻る処理方向を示す。

| From | To | Kind | Meaning |
| --- | --- | --- | --- |
| RESP_ROW_TABLE_INTEGRATION | RESP_RF_ROW_RESOLUTION | failure | Row指定の構造拒否または現在Tableでの利用不能を返す。 |
| RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_COLUMN_RESOLUTION | failure | Column指定の構造拒否または現在Tableでの利用不能を返す。 |
| RESP_RF_ROW_RESOLUTION | RESP_RF_INTERACTION | recovery | Rowのno-op、構造拒否、利用不能を現在RF評価へ戻す。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_RF_INTERACTION | recovery | Columnのno-op、構造拒否、利用不能を現在RF評価へ戻す。 |
| RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | failure | Apply時のRow再照合不成立または更新不能を返す。 |
| RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | failure | Apply時のColumn再照合不成立または更新不能を返す。 |
| RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | recovery | Table未変更のfailureと現在入力の再評価へ戻す。 |
| RESP_RF_INTERACTION | RESP_ACCESSIBILITY_PRESENTATION | recovery | 現在の入力問題または指定全体の結果をaccessible Presentationへ渡す。 |
| RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | recovery | 新しく成立したblocked、no-op、またはfailure意味をWordPress接続へ公開する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | recovery | 確定済みの一回性failure / recovery意味を通知境界へ渡す。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | recovery | Designでfocus移動が必要なfailureまたは明示的終了だけを復帰intentへ変換する。 |
| RESP_FOCUS_COORDINATION | EXT_WORDPRESS_EDITOR | recovery | 現在存在する修正対象または安定したEditor操作位置へfocusを復帰する。 |

## 5. Building Block View

### Responsibility Inventory

| ID | Responsibility | Summary |
| --- | --- | --- |
| RESP_REORDER_MODE | Reorder Mode | edit / row / columnの排他状態と対象Tableを所有する共通状態責務。 |
| RESP_REORDER_APPLY_POLICY | Reorder Apply Policy | 更新対象セル数から通常反映か確認付き大規模反映かを選択する共通方針責務。 |
| RESP_EDITOR_DOM_CONTEXT | Editor DOM Context | 現在のEditor基準から同じ表示環境のfocusおよびAccessibility platform contextを要求時点で解決する。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | WordPress Reorder Integration | Row / Column / RF入口、RF入力画面、現在Table、相互排他、および現在RF Sessionの表示専用状態をWordPress Editorへ接続する。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | WordPress Reorder Apply Integration | RF Apply状態を確認、反映中表示、表示復帰、およびApply中のAccessibility責務へ接続する。 |
| RESP_ACCESSIBILITY_PRESENTATION | Accessibility Presentation | 既存RF / Apply状態を標準操作部品の意味、状態、案内、および入力問題との関係として表現する。 |
| RESP_FOCUS_COORDINATION | Focus Coordination | Designで定義されたRF / Apply Lifecycleのfocus維持・移動・復帰intentを現在のEditor contextへ適用する。 |
| RESP_ANNOUNCEMENT_DELIVERY | Announcement Delivery | 既存責務が確定した一回性の結果意味をfocusから独立してBrowser Accessibility Platformへ伝える。 |
| RESP_RF_INTERACTION | RF Interaction | RF Session、対象Table、方向、利用者入力、現在評価、現在評価で新しく成立した意味、Apply要求、および未提示のApply結果を所有する。 |
| RESP_RF_INPUT_INTERPRETATION | RF Input Interpretation | 利用者入力と現在入力範囲 / 選択肢を解釈し、未入力、修正が必要な入力、または方向固有Resolution向け内部指定を返す。 |
| RESP_RF_ROW_RESOLUTION | Row RF Resolution | Row指定を現在Tableへ照合し、成立候補、no-op、構造拒否、利用不能を解決する。 |
| RESP_RF_COLUMN_RESOLUTION | Column RF Resolution | Column指定を現在Tableへ照合し、成立候補、no-op、構造拒否、利用不能を解決する。 |
| RESP_RF_APPLY_COORDINATION | RF Apply Coordination | 候補再照合、反映経路、確認、確定更新、表示復帰、結果、および成功時の最終位置を所有する。 |
| RESP_ROW_TABLE_INTEGRATION | Row Table Integration | 現在のRow構造、診断、Apply評価、確定行移動、および確定後位置の最終権威を提供する。 |
| RESP_COLUMN_TABLE_INTEGRATION | Column Table Integration | 現在のColumn構造、列記述、診断、Apply評価、確定列移動、および確定後位置の最終権威を提供する。 |

### Ownership Boundaries

| ID | Name | Includes |
| --- | --- | --- |
| BOUNDARY_REORDER_COMMON | Reorder Common | RESP_REORDER_MODE RESP_REORDER_APPLY_POLICY |
| BOUNDARY_EDITOR_INTEGRATION | Editor Integration | RESP_EDITOR_DOM_CONTEXT |
| BOUNDARY_WORDPRESS_REORDER | WordPress Reorder Integration | RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY |
| BOUNDARY_REORDER_FORM | Reorder Form | RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION |
| BOUNDARY_ROW_REORDER | Row Reorder | RESP_ROW_TABLE_INTEGRATION |
| BOUNDARY_COLUMN_REORDER | Column Reorder | RESP_COLUMN_TABLE_INTEGRATION |
| BOUNDARY_WORDPRESS_EXTERNAL | WordPress External | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO |
| BOUNDARY_ACCESSIBILITY_PLATFORM | Accessibility Platform | EXT_BROWSER_ACCESSIBILITY EXT_ASSISTIVE_TECHNOLOGY |

Accessibility Presentation、Focus Coordination、Announcement Deliveryは`BOUNDARY_WORDPRESS_REORDER`の内部に置く。三責務を分離するのは状態所有とLifecycleを明確にするためであり、Accessibilityを既存RF / Reorderから独立したSubsystemとして扱うためではない。

### Dependencies

| Dependent | Depends on | Reason |
| --- | --- | --- |
| RESP_EDITOR_DOM_CONTEXT | EXT_WORDPRESS_EDITOR | 現在のEditor基準と同じ表示環境のcontextを解決するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_EDITOR | RF入口、入力画面、終了、および現在TableのEditor接続に必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | EXT_WORDPRESS_COMPONENTS | RFの標準操作とKeyboard Contractを利用するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_REORDER_MODE | RF開始時のDnDモード終了と入口排他に必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | RF Session、現在入力、評価、Apply結果をEditorへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | RF状態を操作意味、状態、案内、入力問題との関係へ表現するために必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | RF open / close、failure、および表示変更時のfocus Contractに必要とする。 |
| RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 新しいblocked、no-op、success、failure意味を支援技術へ伝えるために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 確認、反映中表示、表示復帰をEditorへ接続するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_COMPONENTS | 確認と反映中状態の標準操作・semantic Contractを利用するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | Apply状態、確認summary、確定結果、および最終位置を利用するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 確認と反映中状態をaccessible Presentationへ表現するために必要とする。 |
| RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | 確認、反映中、Cancel、表示復帰時のfocus Contractに必要とする。 |
| RESP_ACCESSIBILITY_PRESENTATION | EXT_WORDPRESS_COMPONENTS | WordPressが提供する標準操作部品のsemantic Contractを優先して利用するために必要とする。 |
| RESP_ACCESSIBILITY_PRESENTATION | EXT_BROWSER_ACCESSIBILITY | native semanticsを補足する意味、状態、関係を公開するために必要とする。 |
| RESP_FOCUS_COORDINATION | RESP_EDITOR_DOM_CONTEXT | focus targetと同じEditor表示環境を要求時点で解決するために必要とする。 |
| RESP_FOCUS_COORDINATION | EXT_WORDPRESS_EDITOR | 現在のTable、toolbar、RF、確認、反映中表示、editing surfaceの存在を確認するために必要とする。 |
| RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | 現在targetへのfocus適用と維持に必要とする。 |
| RESP_ANNOUNCEMENT_DELIVERY | EXT_BROWSER_ACCESSIBILITY | 一回性の意味通知を支援技術へ公開するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 現在入力を入力問題または内部指定へ解釈するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | Row指定を現在Tableへ解決するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | Column指定を現在Tableへ解決するために必要とする。 |
| RESP_RF_INTERACTION | RESP_RF_APPLY_COORDINATION | 成立候補を反映し、Apply結果と最終位置を受けるために必要とする。 |
| RESP_RF_INTERACTION | RESP_ROW_TABLE_INTEGRATION | Row入力範囲を現在Tableから取得するために必要とする。 |
| RESP_RF_INTERACTION | RESP_COLUMN_TABLE_INTEGRATION | Column入力選択肢と列記述を現在Tableから取得するために必要とする。 |
| RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 現在のRow構造と診断を利用するために必要とする。 |
| RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 現在のColumn構造と診断を利用するために必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_REORDER_APPLY_POLICY | 更新対象セル数から通常反映または確認付き大規模反映を選択するために必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Row候補の再照合、確定更新、および確定後位置に必要とする。 |
| RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Column候補の再照合、確定更新、および確定後位置に必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在のRow構造取得と確定行移動に必要とする。 |
| RESP_ROW_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 一回の成立した行移動を一回のUndo単位として維持するために必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_SUPPORTED_TABLE_BLOCK | 現在のColumn構造取得と確定列移動に必要とする。 |
| RESP_COLUMN_TABLE_INTEGRATION | EXT_WORDPRESS_UNDO | 一回の成立した列移動を一回のUndo単位として維持するために必要とする。 |

### Dependency Views

| ID | Name | Includes |
| --- | --- | --- |
| DV_ACCESSIBILITY_RESPONSIBILITY | Responsibility View | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY EXT_ASSISTIVE_TECHNOLOGY EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_REORDER_MODE RESP_REORDER_APPLY_POLICY RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION |
| DV_ACCESSIBILITY_PRESENTATION | Keyboard and Semantics | EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_RF_INTERACTION |
| DV_ACCESSIBILITY_FOCUS | Focus Management | EXT_WORDPRESS_EDITOR EXT_BROWSER_ACCESSIBILITY RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_FOCUS_COORDINATION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION |
| DV_ACCESSIBILITY_ANNOUNCEMENT | Announcement | EXT_BROWSER_ACCESSIBILITY EXT_ASSISTIVE_TECHNOLOGY RESP_WORDPRESS_REORDER_INTEGRATION RESP_ANNOUNCEMENT_DELIVERY RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION |
| DV_ACCESSIBILITY_MEANING | Validation and Reorder Meaning | EXT_SUPPORTED_TABLE_BLOCK RESP_REORDER_APPLY_POLICY RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION |

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

現在のEditor基準から同じ表示環境に属するfocusおよびAccessibility platform contextを解決する。

##### State ownership

解決結果をEditor Lifecycleをまたぐ正本として保持しない。focus intent、RF Session、Apply Lifecycleを所有しない。

##### Contract

Focus Coordinationから現在の基準を受け、同じEditor表示環境のcontextを安全に提供できる場合だけ返す。

##### Lifecycle

focus targetを確認または適用する時点で現在contextを解決する。

##### Invariants

- iframe / non-iframeの判定や過去contextをfocus状態として保持しない。
- 現在の基準と異なるEditor contextへfallbackしない。

#### WordPress Reorder Integration {#RESP_WORDPRESS_REORDER_INTEGRATION}

##### Responsibility

RF入口、入力画面、標準Keyboard入力、RF終了、および通常RF状態のaccessible PresentationをWordPress Editorへ接続する。

##### State ownership

WordPress接続に必要な一時参照と、RF Designが要求する現在Sessionの表示専用状態を所有する。表示形式自体は現在環境から導出し、表示専用状態をRF入力や方向の正本にしない。validation結果、構造診断、announcement履歴、focus intentは所有しない。

##### Contract

WordPress EditorとWordPress Componentsが提供する標準操作をRF Interactionへ接続する。現在のRF状態と表示専用状態をAccessibility Presentationへ渡し、Designが要求するopen / close / failureのfocus intentをFocus Coordinationへ渡す。RF Interactionが新しい一回性通知を提供した場合だけAnnouncement Deliveryへ渡す。

方向切替と折りたたみ / 展開では標準操作の現在focusを維持し、別targetへのintentを生成しない。別のTableまたはEditor操作へ利用者が移動したことによるRF終了では、Focus Coordinationへ古いRF入口への復帰を要求しない。Wide / Narrow切替では同じRF Sessionの現在操作を維持し、表示形式だけを理由に新しい状態意味または通知を生成しない。

##### Lifecycle

対象TableのEditor接続が存在する間、RF入口とopen RF Sessionを表示へ接続する。同じ対象TableのPresentation再生成ではRF Sessionを終了せず、再生成後も現在Sessionと表示専用状態からPresentationを導出する。RF終了時はSessionに結び付いた表示専用状態を終了する。

##### Invariants

- 独自Keyboard state machineまたはRF専用shortcutを所有しない。
- standard controlのKeyboard意味をYTR独自操作で置き換えない。
- RF状態、入力問題、構造診断、Apply結果を再判定しない。
- RFの表示専用状態をAccessibility Presentationへ重複保持させない。
- 表示形式ごとに異なるAccessibility意味を所有しない。
- 通知のためだけにfocus intentを生成しない。

#### WordPress Reorder Apply Integration {#RESP_WORDPRESS_REORDER_APPLY_INTEGRATION}

##### Responsibility

RF Apply状態をWordPress Editorの確認、反映中表示、editing surface restoration、および各段階のaccessible Presentationとfocusへ接続する。

##### State ownership

表示接続に必要な一時状態だけを扱う。Apply Lifecycle、Move意味、確定後位置、focus intent、Table構造を別正本として所有しない。

##### Contract

RF Apply Coordinationが公開する確認summary、Apply状態、確定結果、最終位置を利用する。確認と反映中状態をAccessibility Presentationへ渡し、確認開始、Cancel、反映準備、editing surface restorationの各Design境界でFocus Coordinationへ意味上のtargetを渡す。

成功後はRF Apply Coordinationが確定した最終位置をそのままFocus Coordinationへ渡す。最終位置を現在Tableへ安全に適用できない場合は、対象Tableの安定した操作位置へ限定してfallbackし、隣接行または列を移動結果として推測しない。Focus Coordinationから、最終targetへの適用、明示したfallbackへの適用、対象Table消失、または利用者による別位置への移動のいずれかでfocus intentがsettleした結果を受けた後にだけ、RF Apply Coordinationへ表示復帰完了を返す。

##### Lifecycle

通常反映では確定更新後の表示復帰、確認付き反映では確認から反映中、表示復帰までを接続する。editing surface再成立後もfocus targetが一時的に存在しない場合はFocus Coordinationのpending intentを利用する。成功側の表示復帰はpending intentのsettleまで継続し、その後に完了する。

##### Invariants

- Move意味、Table構造、候補成立性、最終位置を再解釈しない。
- 確認または反映中PresentationをAccessibility専用Apply状態の正本にしない。
- Table更新またはUndo履歴を追加しない。
- 対象Table以外のEditor操作を不必要に抑止しない。
- success後のfocus intentが未解決のまま表示復帰完了を通知しない。

#### Accessibility Presentation {#RESP_ACCESSIBILITY_PRESENTATION}

##### Responsibility

既存RF / Apply責務から受け取る操作意味、状態、入力条件、現在評価を、WordPress ComponentsとBrowser Accessibility Platformが公開できるPresentationへ変換する。

##### State ownership

RF / Applyのdomain stateを所有しない。方向、選択、入力値、入力範囲、実行可否、展開状態、validation結果、構造診断をAccessibility専用状態として保持しない。Presentation instanceに必要な一時接続は再生成可能な導出結果とする。

##### Contract

WordPress Reorder IntegrationからRF入口、現在方向、入力descriptor、入力問題、指定全体の評価、操作可否、表示状態を受ける。WordPress Reorder Apply Integrationから確認summaryと反映中状態を受ける。標準UI primitiveが提供する意味を利用し、不足する名前、状態、案内、入力と問題の関係だけを補う。

入力問題ではRF Input Interpretationが返した対象と修正情報を該当入力へ関連付ける。no-op、構造拒否、利用不能は特定入力の再validationへ変換せず、RF Interactionが所有する現在指定全体の結果として表現する。

##### Lifecycle

RF / Apply Presentationの生成ごとに現在状態から導出する。方向切替、Wide / Narrow切替、Presentation再生成では、同じ意味状態から同じsemantic Contractを再成立させる。

##### Invariants

- native semanticsまたはWordPress Componentの既存semantic Contractを不必要に重複させない。
- input validation、no-op、構造制約、最終位置を独自に判定しない。
- Row / Column別のAccessibility状態modelを持たない。
- semantic PresentationをTableデータまたはRF / Apply状態の正本にしない。
- 視覚表示の有無だけで支援技術へ公開する意味を変えない。

#### Focus Coordination {#RESP_FOCUS_COORDINATION}

##### Responsibility

Designで定義されたRF / Apply Lifecycle上のfocus維持・移動・復帰intentを、現在のEditor contextと現在存在するsemantic targetへ適用する。

##### State ownership

targetが一時的に存在しない表示復帰期間だけ、Lifecycleに結び付いたpending focus intentを所有できる。RF open状態、Apply phase、入力問題、Table構造、最終位置、現在focus elementの複製、長寿命のDOM参照は所有しない。

##### Contract

WordPress Reorder IntegrationまたはWordPress Reorder Apply Integrationから、遷移理由、現在Lifecycle、対象Table、および意味上のfocus targetを受ける。Editor DOM Contextから現在contextを解決し、targetが現在存在しDesign上適用可能な場合だけfocusを移す。

現在操作へfocusを残すDesign場面では何も移動しない。別の操作対象へ利用者が移動した終了では復帰intentを受理しない。表示復帰中のpending intentは同じLifecycleと対象Tableにだけ適用する。最終targetへの適用、明示されたfallbackへの適用、対象Table消失、または利用者による別位置への移動によってintentがsettleしたことを呼び出し元へ返す。

##### Lifecycle

通常はidleである。明示されたfocus遷移を即時適用できれば状態を保持しない。表示再生成によってtargetが一時的に存在しない場合だけpendingとなり、現在targetの成立、明示されたfallbackの成立、対象消失、または利用者による別位置への移動で完了・破棄する。成功側のApply Lifecycle終了はpending intentの破棄条件ではなく、intentのsettle後にだけ成立する。

##### Invariants

- Designで定義されない自動focus移動を追加しない。
- 通知を聞かせるためだけにfocusを移動しない。
- 入力問題や修正順序を独自に判定しない。
- 確定後位置または代替位置をTable構造から推測しない。
- stale intentで利用者の新しい操作位置を奪わない。
- success側のpending intentをApply Lifecycle終了によって先に破棄しない。
- Wide / Narrowまたはiframe / non-iframeの差をfocus意味の差にしない。

#### Announcement Delivery {#RESP_ANNOUNCEMENT_DELIVERY}

##### Responsibility

既存責務が通知対象として確定した意味を、focusから独立した一回性の状態変化としてBrowser Accessibility Platformへ伝える。

##### State ownership

入力、現在評価、Apply結果、Table構造、移動前後位置、表示通知状態を所有しない。通知意味の履歴をdomain stateとして保持せず、受け取った一回性通知のdeliveryだけを扱う。

##### Contract

WordPress Reorder Integrationから、RF Interactionが新しく成立したと判定したno-op、構造拒否、success、failure等の通知意味を受ける。文言と位置情報はBasic Designおよび既存の意味責務が提供する確定済み内容を利用し、別のAccessibility用結果へ再解釈しない。

Browser Accessibility Platformへ通知を公開し、focus移動を要求しない。同じ意味状態の再描画またはPresentation再生成は新しいdelivery入力として受け取らない。

##### Lifecycle

一回性通知の受領ごとに公開して完了する。公開surfaceの再生成は、結果を所有する責務から新しい通知がない限りLifecycleを開始しない。

##### Invariants

- focus状態を所有または変更しない。
- Table構造、方向固有Move、確定後位置を計算しない。
- 視覚Noticeのmountを通知発行条件にしない。
- 同じ結果をPresentation再生成によって再通知しない。
- 特定のAssistive Technology向け分岐を持たない。

#### RF Interaction {#RESP_RF_INTERACTION}

##### Responsibility

一つの対象Tableに対するRF Session、方向、入力、現在評価、Apply要求、およびApply結果の一度だけのPresentation引き渡しを所有する。Accessibility責務へ渡す意味状態の正本でもある。

##### State ownership

対象Table Identity、現在方向、方向ごとの入力、現在評価を保持する。success / failureはPresentationとAnnouncementへ一度だけ引き渡されるまで未提示結果として保持できる。no-opまたは構造拒否等の現在評価について、意味が新しく成立したかを同じRF Session内で判定する。rendered semantics、focus intent、announcement surfaceは所有しない。

##### Contract

RF Input Interpretationと方向固有RF Resolutionから構造化された現在評価を受け、WordPress Reorder IntegrationとAccessibility Presentationが利用できる形で公開する。同じ評価の再計算またはPresentation再生成を新しい意味変化として公開しない。

Apply成功ではRFを終了し、確定済みsuccess summaryを一度だけ引き渡す。failureでは入力を保持したRFへ戻り、現在入力の再評価結果とfailureを一度だけ引き渡す。確認Cancelはfailure通知にしない。

##### Lifecycle

既存の`closed → open(row) ↔ open(column) → applying`を維持する。AccessibilityはこのLifecycleから導出され、別のAccessibility Sessionを開始しない。

##### Invariants

- Accessibility用に方向、入力、評価、Apply結果を複製しない。
- 同じ意味状態またはApply結果を複数回通知対象として公開しない。
- 表示再生成をRF Session終了または新規通知と扱わない。
- validation messageやannouncementのPresentation方式を所有しない。

#### RF Input Interpretation {#RESP_RF_INPUT_INTERPRETATION}

##### Responsibility

利用者入力と現在入力範囲 / 選択肢を、入力問題または方向固有Resolutionが扱える内部指定へ解釈する。

##### State ownership

状態を所有しない。入力、Table構造、Presentation状態、focus状態を保持しない。

##### Contract

未入力と修正が必要な入力を区別し、修正が必要な場合は対象入力と現在有効な条件を構造化された結果として返す。成立した入力だけを方向固有Resolutionへ進める。表示文言、semantic関係、focus移動は決めない。

##### Lifecycle

入力または現在入力範囲 / 選択肢が変化するたびに独立して解釈する。

##### Invariants

- 初期の未入力を入力問題として扱わない。
- Table構造上の移動可否やno-opを判定しない。
- Accessibility Presentationへ入力再検証を要求しない。

#### Row RF Resolution {#RESP_RF_ROW_RESOLUTION}

##### Responsibility

解釈済みRow指定を要求時点の現在Tableへ照合し、成立候補、no-op、構造拒否、利用不能を解決する。

##### State ownership

状態を所有しない。Accessibility用診断状態または通知状態を保持しない。

##### Contract

Row Table Integrationの現在構造と診断を利用し、RF Interactionへ構造化された解決結果を返す。利用者向けPresentation、focus、announcementは決めない。

##### Lifecycle

入力成立時と現在Table再評価時に要求時点のTableへ解決する。

##### Invariants

- Accessibility PresentationのためにRow構造を別解釈しない。
- no-op、構造拒否、利用不能を曖昧な共通errorへ変換しない。
- 成立候補をApply時点の保証または永続Identityとして扱わない。

#### Column RF Resolution {#RESP_RF_COLUMN_RESOLUTION}

##### Responsibility

解釈済みColumn指定を要求時点の現在Tableへ照合し、成立候補、no-op、構造拒否、利用不能を解決する。

##### State ownership

状態を所有しない。Accessibility用診断状態または通知状態を保持しない。

##### Contract

Column Table Integrationの現在論理列構造と診断を利用し、RF Interactionへ構造化された解決結果を返す。利用者向けPresentation、focus、announcementは決めない。

##### Lifecycle

入力成立時と現在Table再評価時に要求時点のTableへ解決する。

##### Invariants

- Accessibility PresentationのためにColumn構造を別解釈しない。
- no-op、構造拒否、利用不能を曖昧な共通errorへ変換しない。
- 成立候補をApply時点の保証または永続Identityとして扱わない。

#### RF Apply Coordination {#RESP_RF_APPLY_COORDINATION}

##### Responsibility

RF候補の現在Table再照合、反映経路、確認、確定更新、表示復帰、success / failure、および成功時の確定後位置を所有する。

##### State ownership

一つのactive RF Applyについて、対象Table、方向、候補、Apply phase、確認用Move summary、確定後位置、結果をLifecycle完了まで保持できる。focus element、announcement surface、Accessibility Presentation状態は所有しない。

##### Contract

方向固有Table Integrationへ現在候補のApply評価と確定更新を要求し、Reorder Apply Policyで反映経路を選択する。確認用summaryとsuccess announcementに必要な移動前位置 / 確定後位置を、方向固有結果から一度確定してWordPress接続へ公開する。editing surface再成立とsuccess後のfocus intentのsettleを含む表示復帰完了後にだけsuccessをRF Interactionへ返す。

failureではTable未変更の結果を返し、現在入力のどこを修正すべきかを独自に決めない。Focus CoordinationとAnnouncement Deliveryは直接所有せず、WordPress接続が確定済み結果を各Presentation責務へ接続する。

##### Lifecycle

既存の通常反映および確認付き大規模反映Lifecycleを維持する。Focus intentとannouncementはそのLifecycleの観測結果であり、新しいApply phaseを追加しない。成功側の表示復帰はfocus intentがsettleするまで継続し、その完了前にApply Lifecycleを終了しない。

##### Invariants

- success用の確定後位置をRF入力の移動先番号から推測しない。
- AccessibilityのためにTable再照合または確定更新を重複実行しない。
- 表示復帰完了前にsuccessを通知可能な結果として確定しない。
- success後のfocus intentがpendingの間は表示復帰完了として扱わない。
- 確認Cancelをfailureとして公開しない。

#### Row Table Integration {#RESP_ROW_TABLE_INTEGRATION}

##### Responsibility

Supported Table Block固有の保存表現差を吸収し、Row入力範囲、現在構造、構造診断、Apply評価、確定行移動、および確定後位置を提供する。

##### State ownership

Tableデータまたは解析結果をAccessibility状態として複製しない。要求間の成立保証となる長寿命cacheを持たない。

##### Contract

RF Interactionへ現在行範囲、Row RF Resolutionへ現在構造と診断、RF Apply CoordinationへApply結果と確定後位置を返す。Accessibility責務へTable保存表現を公開しない。

##### Lifecycle

入力範囲取得、Resolution、Apply評価、確定更新の各要求時点で現在Tableを参照する。

##### Invariants

- Row構造、診断、確定後位置の最終権威をAccessibility側へ移さない。
- DnDとRFとAccessibilityで異なるRow構造ルールを持たない。
- Accessibility Presentationまたはannouncementのために追加更新を生成しない。

#### Column Table Integration {#RESP_COLUMN_TABLE_INTEGRATION}

##### Responsibility

Supported Table Block固有の保存表現差を吸収し、RF用列記述、現在論理列構造、構造診断、Apply評価、確定列移動、および確定後位置を提供する。

##### State ownership

Tableデータ、論理列解析結果、列見出しをAccessibility状態として複製しない。要求間の成立保証となる長寿命cacheを持たない。

##### Contract

RF Interactionへ現在列選択肢と利用可能な列記述、Column RF Resolutionへ現在構造と診断、RF Apply CoordinationへApply結果と確定後位置を返す。Accessibility責務へTable保存表現を公開しない。

##### Lifecycle

列記述取得、Resolution、Apply評価、確定更新の各要求時点で現在Tableを参照する。

##### Invariants

- Column構造、列記述、診断、確定後位置の最終権威をAccessibility側へ移さない。
- DnDとRFとAccessibilityで異なるColumn構造ルールを持たない。
- Accessibility Presentationまたはannouncementのために追加更新を生成しない。

## 6. Runtime View

### RF open and Keyboard continuation {#RV_ACCESSIBILITY_RF_OPEN}

KeyboardからRFを開始し、現在RF状態をaccessibleに提示して最初の意味ある操作位置へfocusを移す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者が標準Keyboard操作で対象TableのRF入口を選択する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 対象TableでRF Sessionを開始する。 |
| 3 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 初期方向を含む現在RF状態のPresentationを要求する。 |
| 4 | RESP_ACCESSIBILITY_PRESENTATION | EXT_WORDPRESS_COMPONENTS | 標準操作部品のKeyboardとsemantic Contractを利用してRFを提示する。 |
| 5 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | RF open後の意味上の初期focus targetを渡す。 |
| 6 | RESP_FOCUS_COORDINATION | RESP_EDITOR_DOM_CONTEXT | 現在RFと同じEditor contextを要求する。 |
| 7 | RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | 現在存在する初期targetへfocusを適用する。 |

### RF input problem presentation {#RV_ACCESSIBILITY_RF_INPUT_PROBLEM}

標準Keyboard入力を既存の入力解釈へ接続し、修正が必要な入力を対象入力と関連付けて提示する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者が方向または現在入力を標準Keyboard操作で変更する。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在の方向または入力を同じRF Sessionへ渡す。 |
| 3 | RESP_RF_INTERACTION | RESP_RF_INPUT_INTERPRETATION | 現在入力の成立性を要求する。 |
| 4 | RESP_RF_INPUT_INTERPRETATION | RESP_RF_INTERACTION | 入力問題と修正対象、または成立した内部指定を返す。 |
| 5 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 現在の入力問題と修正情報をPresentationへ渡す。 |
| 6 | RESP_ACCESSIBILITY_PRESENTATION | EXT_BROWSER_ACCESSIBILITY | 入力問題を対象入力との関係として公開する。 |

### RF Row structural result {#RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT}

成立したRow入力を既存のRow構造責務へ解決し、指定全体のblockedまたはno-opをfocus移動なしで提示する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_INTERACTION | RESP_RF_ROW_RESOLUTION | 成立したRow指定について現在Table上の結果を要求する。 |
| 2 | RESP_RF_ROW_RESOLUTION | RESP_ROW_TABLE_INTEGRATION | 現在のRow構造と診断を要求する。 |
| 3 | RESP_RF_ROW_RESOLUTION | RESP_RF_INTERACTION | 成立候補、no-op、構造拒否、利用不能を返す。 |
| 4 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 現在のRow指定全体の評価をPresentationへ渡す。 |
| 5 | RESP_ACCESSIBILITY_PRESENTATION | EXT_BROWSER_ACCESSIBILITY | 現在評価を特定入力の再validationではなく指定全体の結果として公開する。 |
| 6 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | blockedまたはno-opが新しく成立した場合だけ一回性通知を提供する。 |
| 7 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 新しい通知意味をfocus移動要求なしで渡す。 |
| 8 | RESP_ANNOUNCEMENT_DELIVERY | EXT_BROWSER_ACCESSIBILITY | 現在結果を支援技術へ伝達可能な状態変化として公開する。 |

### RF Column structural result {#RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT}

成立したColumn入力を既存のColumn構造責務へ解決し、指定全体のblockedまたはno-opをfocus移動なしで提示する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_INTERACTION | RESP_RF_COLUMN_RESOLUTION | 成立したColumn指定について現在Table上の結果を要求する。 |
| 2 | RESP_RF_COLUMN_RESOLUTION | RESP_COLUMN_TABLE_INTEGRATION | 現在のColumn構造と診断を要求する。 |
| 3 | RESP_RF_COLUMN_RESOLUTION | RESP_RF_INTERACTION | 成立候補、no-op、構造拒否、利用不能を返す。 |
| 4 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 現在のColumn指定全体の評価をPresentationへ渡す。 |
| 5 | RESP_ACCESSIBILITY_PRESENTATION | EXT_BROWSER_ACCESSIBILITY | 現在評価を特定入力の再validationではなく指定全体の結果として公開する。 |
| 6 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | blockedまたはno-opが新しく成立した場合だけ一回性通知を提供する。 |
| 7 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 新しい通知意味をfocus移動要求なしで渡す。 |
| 8 | RESP_ANNOUNCEMENT_DELIVERY | EXT_BROWSER_ACCESSIBILITY | 現在結果を支援技術へ伝達可能な状態変化として公開する。 |

### RF close and focus protection {#RV_ACCESSIBILITY_RF_CLOSE}

明示的終了ではRF入口へ戻し、別の操作対象への移動による終了では利用者の新しいfocus位置を優先する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_INTEGRATION | 利用者の明示的終了または別操作対象への移動がRF終了条件となる。 |
| 2 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_RF_INTERACTION | 現在RF Sessionを終了する。 |
| 3 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | 明示的終了の場合だけ、対象Tableが操作可能であることを条件にRF入口への復帰intentを渡す。 |
| 4 | RESP_FOCUS_COORDINATION | EXT_WORDPRESS_EDITOR | 現在も成立する入口へfocusを戻すか、別操作対象への移動時は何も変更しない。 |

### Confirmation and cancel {#RV_ACCESSIBILITY_CONFIRMATION}

確認表示へfocusを移し、Cancelでは入力を保持したRFの実行位置へ戻す。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 確認状態と確定済みMove summaryを公開する。 |
| 2 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 確認内容と選択肢のaccessible Presentationを要求する。 |
| 3 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | 確認開始時の意味上の初期targetを渡す。 |
| 4 | EXT_WORDPRESS_EDITOR | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 利用者が標準Keyboard操作でCancelを選択する。 |
| 5 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | Table未変更のCancelを返す。 |
| 6 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | 入力を保持したopen RF状態へ戻す。 |
| 7 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 入力を保持した現在RF状態を再表示へ提供する。 |
| 8 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | RFの再実行位置への復帰intentを渡す。 |
| 9 | RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | 再成立したRFの現在targetへfocusを適用する。 |

### Row apply restoration and success {#RV_ACCESSIBILITY_ROW_APPLY_SUCCESS}

Row反映中の安定した位置を維持し、Table表示再生成後に確定済み最終位置へfocusを復帰してからsuccessを一度だけ通知する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 反映準備状態を公開する。 |
| 2 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | 対象Tableの反映中状態を示す意味上のtargetを渡す。 |
| 3 | RESP_RF_APPLY_COORDINATION | RESP_ROW_TABLE_INTEGRATION | Row候補の再照合と確定更新を要求する。 |
| 4 | RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | 確定更新成功と確定後Row位置を返す。 |
| 5 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | success時の確定後位置とediting surface restoration要求を公開する。 |
| 6 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 更新後の対象Table editing surfaceを再成立させる。 |
| 7 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | 確定後Row位置に対応する結果確認targetを渡す。 |
| 8 | RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | 最終targetが成立すればfocusを適用し、成立しないことが確定した場合は明示されたfallbackへ限定して適用する。 |
| 9 | RESP_FOCUS_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | focus適用、明示されたfallback、対象Table消失、または利用者の別位置への移動によってintentがsettleしたことを返す。 |
| 10 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | focus intentのsettleを含む表示復帰完了を返す。 |
| 11 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | 確定済みRow Move summaryを持つsuccessを返す。 |
| 12 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 一度だけ提示可能なsuccessを提供する。 |
| 13 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 確定済み移動前Row位置と確定後位置を持つsuccess通知を渡す。 |
| 14 | RESP_ANNOUNCEMENT_DELIVERY | EXT_BROWSER_ACCESSIBILITY | successをfocusから独立して公開する。 |

### Column apply restoration and success {#RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS}

Column反映中の安定した位置を維持し、Table表示再生成後に確定済み最終位置へfocusを復帰してからsuccessを一度だけ通知する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | 反映準備状態を公開する。 |
| 2 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | 対象Tableの反映中状態を示す意味上のtargetを渡す。 |
| 3 | RESP_RF_APPLY_COORDINATION | RESP_COLUMN_TABLE_INTEGRATION | Column候補の再照合と確定更新を要求する。 |
| 4 | RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | 確定更新成功と確定後Column位置を返す。 |
| 5 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | success時の確定後位置とediting surface restoration要求を公開する。 |
| 6 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 更新後の対象Table editing surfaceを再成立させる。 |
| 7 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_FOCUS_COORDINATION | 確定後Column位置に対応する結果確認targetを渡す。 |
| 8 | RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | 最終targetが成立すればfocusを適用し、成立しないことが確定した場合は明示されたfallbackへ限定して適用する。 |
| 9 | RESP_FOCUS_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | focus適用、明示されたfallback、対象Table消失、または利用者の別位置への移動によってintentがsettleしたことを返す。 |
| 10 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | focus intentのsettleを含む表示復帰完了を返す。 |
| 11 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | 確定済みColumn Move summaryを持つsuccessを返す。 |
| 12 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 一度だけ提示可能なsuccessを提供する。 |
| 13 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | 確定済み移動前Column位置と確定後位置を持つsuccess通知を渡す。 |
| 14 | RESP_ANNOUNCEMENT_DELIVERY | EXT_BROWSER_ACCESSIBILITY | successをfocusから独立して公開する。 |

### Row apply restoration failure and correction return {#RV_ACCESSIBILITY_ROW_APPLY_FAILURE}

反映中表示を成立させたRow Applyを完了できない場合、Table未変更のediting surfaceと入力を保持したRFを復帰し、既存評価から定まる修正可能な位置へfocusを移してfailureを一度だけ通知する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_ROW_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | Row Applyの再照合不成立または更新不能をTable未変更で返す。 |
| 2 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | Table未変更のediting surface restorationを要求する。 |
| 3 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableのediting surfaceを再成立させる。 |
| 4 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 表示復帰完了を返す。 |
| 5 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | failureを返して現在Row入力の再評価へ戻す。 |
| 6 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 入力を保持したRF状態、現在評価、および一度だけ提示可能なfailureを提供する。 |
| 7 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 現在評価に基づく修正対象とfailure Presentationを要求する。 |
| 8 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | 現在評価と通常の操作順から定まる意味上の修正targetを渡す。 |
| 9 | RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | 現在成立する修正targetへfocusを適用する。 |
| 10 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | Table未変更を含むfailure通知を渡す。 |
| 11 | RESP_ANNOUNCEMENT_DELIVERY | EXT_BROWSER_ACCESSIBILITY | failureをfocusから独立して公開する。 |

### Column apply restoration failure and correction return {#RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE}

反映中表示を成立させたColumn Applyを完了できない場合、Table未変更のediting surfaceと入力を保持したRFを復帰し、既存評価から定まる修正可能な位置へfocusを移してfailureを一度だけ通知する。

| Step | Source | Target | Interaction |
| ---: | --- | --- | --- |
| 1 | RESP_COLUMN_TABLE_INTEGRATION | RESP_RF_APPLY_COORDINATION | Column Applyの再照合不成立または更新不能をTable未変更で返す。 |
| 2 | RESP_RF_APPLY_COORDINATION | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | Table未変更のediting surface restorationを要求する。 |
| 3 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | EXT_WORDPRESS_EDITOR | 対象Tableのediting surfaceを再成立させる。 |
| 4 | RESP_WORDPRESS_REORDER_APPLY_INTEGRATION | RESP_RF_APPLY_COORDINATION | 表示復帰完了を返す。 |
| 5 | RESP_RF_APPLY_COORDINATION | RESP_RF_INTERACTION | failureを返して現在Column入力の再評価へ戻す。 |
| 6 | RESP_RF_INTERACTION | RESP_WORDPRESS_REORDER_INTEGRATION | 入力を保持したRF状態、現在評価、および一度だけ提示可能なfailureを提供する。 |
| 7 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ACCESSIBILITY_PRESENTATION | 現在評価に基づく修正対象とfailure Presentationを要求する。 |
| 8 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_FOCUS_COORDINATION | 現在評価と通常の操作順から定まる意味上の修正targetを渡す。 |
| 9 | RESP_FOCUS_COORDINATION | EXT_BROWSER_ACCESSIBILITY | 現在成立する修正targetへfocusを適用する。 |
| 10 | RESP_WORDPRESS_REORDER_INTEGRATION | RESP_ANNOUNCEMENT_DELIVERY | Table未変更を含むfailure通知を渡す。 |
| 11 | RESP_ANNOUNCEMENT_DELIVERY | EXT_BROWSER_ACCESSIBILITY | failureをfocusから独立して公開する。 |

## 8. Crosscutting Concepts

### State ownership and derivation

Accessibility v1は、新しいdomain stateを必要最小限にする。次の情報は既存責務を正本とし、Presentationから要求時点で導出する。

| Information | Authority | Accessibility use |
| --- | --- | --- |
| RF open / closed、対象Table、方向、入力 | RF Interaction | 操作意味、選択状態、入力Presentation、focus遷移条件を導出する。 |
| RFの折りたたみ等の表示専用状態 | WordPress Reorder Integration | 現在の表示状態と操作意味を導出し、Accessibility専用状態へ複製しない。 |
| 入力成立性と修正対象 | RF Input Interpretation | 対象入力との関係と修正案内を導出する。 |
| no-op、構造拒否、利用不能 | Row / Column RF Resolution | 指定全体の現在結果とannouncement候補を導出する。 |
| Row / Column構造、列記述、診断 | Row / Column Table Integration | 入力範囲、列識別、移動不可理由を既存Contract経由で利用する。 |
| 通常反映 / 確認付き大規模反映 | Reorder Apply Policy | 更新対象セル数に対する既存の反映経路を維持する。 |
| Apply phase、確認summary、success / failure、確定後位置 | RF Apply Coordination | 確認、反映中、focus復帰、結果announcementを導出する。 |
| 一回性通知の適格性 | RF Interaction | 同じ評価または結果の再通知を防ぐ。 |
| 一時的に適用不能なfocus intent | Focus Coordination | 同じLifecycleの表示復帰後にだけ適用する。 |

Accessibility Presentationはこの表の情報を保存用modelへ複製しない。Focus Coordinationが所有できるpending intentは既存Lifecycleの代替状態ではなく、確定済み遷移を一時的なPresentation不在の後に完了するための最小状態である。

### Validation and Accessibility Presentation boundary

入力成立性はRF Input Interpretation、Table構造上の成立性は方向固有RF ResolutionとTable Integration、Apply時の最終成立性は方向固有Table Integrationが所有する。

Accessibility Presentationは判定結果を受け取り、入力問題なら対象入力と修正情報の関係として、no-op・構造拒否・利用不能なら現在指定全体の結果として表現する。表示上の制約、空文字、control状態等から独自にvalidation結果を生成しない。

この境界により、視覚表示、支援技術向け意味、実行可否、focus復帰が同じ判定結果を利用しつつ、それぞれのPresentation責務を混在させない。

### Direction-independent Accessibility meaning

Row / Columnの差は、RF Interactionの現在方向、方向固有入力descriptor、Resolution結果、Table Integrationが返す診断・列記述・確定後位置として既存Contractから渡される。

Accessibility Presentation、Focus Coordination、Announcement Deliveryは方向固有Table構造を解釈しない。Row / Column別の状態、blocked理由、結果位置を重複保持せず、共通のPresentation Contractへ方向固有意味を値として渡す。

Row / Column DnDのInput Interaction、DnD Interaction、Reorder PresentationはAccessibility v1のKeyboard経路に含めない。既存DnD通知の責務を本書で置き換えず、Issue #1047のRF範囲だけを対象とする。

### WordPress and native semantics boundary

Browserはnative controlの標準Keyboard操作とfocus動作を提供する。WordPress ComponentsはEditorと整合する標準操作部品、確認Presentation、および公開されているsemantic Contractを提供する。WordPress Editorはtoolbar navigation、Table選択、表示Lifecycle、editing surfaceを提供する。

YTRは、要件を満たすprimitiveの選択、利用者向け意味の供給、現在状態との接続、入力問題との関係、RF / Apply固有focus遷移、結果announcementを所有する。外部primitiveがすでに提供するKeyboardやsemantic behaviorを再実装しない一方、YTR固有の名前・状態・関係を外部任せにしない。

外部Componentの不備がBasic DesignのContractを阻害する場合は、外部問題とYTR責務を切り分けて評価する。Phase 1の範囲を超える独自WidgetやComponent全面置換を自動的なfallbackにしない。

### Focus intent and current Editor context

focusはDOM位置ではなく、RF入口、方向選択、実行操作、確認の主要操作、反映中状態、修正対象入力、確定後セル、対象Tableの安定位置等の意味上のtargetとして責務間を渡す。具体的な要素探索やfocus APIはArchitecture Contractにしない。

Focus Coordinationは現在のEditor contextだけを利用する。Presentation再生成前のDOM参照を復元の正本にせず、同じTableとLifecycleに属する現在targetを要求時点で解決する。成功側のpending intentは、最終targetへの適用、明示されたfallbackへの適用、対象Table消失、または別操作対象への移動によってsettleする。Apply Lifecycle終了はsettle後にのみ成立し、pending intentを先に破棄する契機にはしない。

### Announcement source and delivery

通知意味の生成条件は結果の所有責務に置く。RF Interactionは現在評価の意味変化と未提示Apply結果を一回性入力として公開し、RF Apply Coordinationはsuccess summaryに必要な確定後位置を提供する。方向固有Table Integrationは診断と確定位置を提供するが、Announcementを直接発行しない。

Announcement Deliveryは視覚Noticeとは独立したdelivery境界である。両者は同じ確定済み意味を利用できるが、視覚Noticeのmount / unmountとAnnouncementの一回性を結び付けない。focus移動もAnnouncementのdelivery手段にしない。

### Architecture-wide invariants

- 一つの意味状態に一つの正本を維持し、Accessibility用StoreへRF / Apply / Row / Column状態を複製しない。
- Accessibility責務はTable構造、移動可否、no-op、確定結果、確定後位置を再解釈しない。
- Keyboard inputは既存RF / Apply Contractへ合流し、pointerとは別の並び替え結果modelを作らない。
- native semanticsとWordPress Componentの標準Contractを優先し、独自Keyboard state machineを導入しない。
- focusはDesignで定義されたLifecycle境界でだけ移動し、通知または再描画だけでは移動しない。
- pending focus intentは同じ対象TableとLifecycleにだけ適用し、利用者の新しい操作位置を奪わない。
- successはfocus intentが最終target、明示されたfallback、またはfocusを変更しない終了条件へsettleした後にだけ確定する。
- 成功後focusとannouncementは確定済み最終位置だけを利用し、指定した移動先や隣接位置から結果を推測しない。
- 同じ結果または同じblocked状態をPresentation再生成によって繰り返し通知しない。
- Wide / Narrow、iframe / non-iframe、Core Table / Flexible Table Blockの差は操作意味、focus方針、announcement意味を変えない。
- Accessibility Presentation、Focus Coordination、Announcement DeliveryはTable更新またはUndo履歴を生成しない。
- Row / Column DnDへKeyboard DnDまたはAccessibility v1固有状態を追加しない。

## 9. Architecture Decisions

### Accessibility Extends Existing Reorder Boundaries

Accessibilityを独立Subsystemにせず、Accessibility Presentation、Focus Coordination、Announcement Deliveryを既存WordPress Reorder接続境界へ置く。RF / Apply / Tableの意味責務を再利用し、Accessibility側に並び替えCoreを作らない。

### Platform-first Keyboard and Semantics

RFのKeyboard操作はnative semanticsとWordPress Componentsの標準Contractを利用する。YTRは現在状態との接続と不足する意味だけを補い、独自Widget、shortcut、Keyboard state machineをPhase 1へ導入しない。

### Focus Coordination is a Narrow Lifecycle Responsibility

表示再生成をまたぐfocus復帰には一時的なintent所有が必要なため、Focus Coordinationを独立責務として明示する。ただしRF / Apply phaseやTable位置を複製せず、既存Lifecycleから確定した意味上のtargetだけを調停する。成功側の表示復帰完了をfocus intentのsettle後に置き、Apply Lifecycle終了によるpending intentの先行破棄を防ぐ。

### Announcement Meaning Remains Source-owned

Announcement Deliveryはdeliveryだけを所有する。blocked / no-opの意味変化とApply結果の一回性はRF Interaction、成功時の確定後位置はRF Apply Coordinationと方向固有Table Integrationを正本とし、Announcement専用の結果状態を作らない。

### Validation and Presentation Remain Separate

入力成立性、構造成立性、Apply成立性は既存RF / Table責務に残す。Accessibility Presentationはそれらの結果を対象入力または指定全体へ関連付けるが、判定を再実装しない。

### Accessibility Does Not Reinterpret Table Structure

行数、論理列、列見出し、結合セル診断、最終位置はRow / Column Table Integrationの既存Contractから受け取る。AccessibilityのためのTable parser、Row / Column identity、結果位置推定を追加しない。

## 10. Quality Requirements

- **Keyboard operability**: RF開始から結果確認まで、platform標準のKeyboard Contractを通じて既存RF / Apply Lifecycleを完了できる。
- **Semantic consistency**: 視覚Presentationと支援技術向けPresentationが同じRF / Apply / Table意味状態を利用し、表示方式または方向ごとに矛盾しない。
- **Focus continuity**: RF open / close、確認、反映中、表示復帰、success / failureで、Designが定めた次の操作位置を維持し、success確定前に最終focus intentをsettleさせ、stale intentで利用者の現在位置を奪わない。
- **Notification correctness**: success、failure、構造拒否、no-opを正しい確定済み意味から一度だけ通知し、focus移動をdelivery手段にしない。
- **Correctness**: Accessibility Presentationが入力成立性、Table構造、no-op、確定後位置を再計算しない。
- **State minimality**: 新しい永続状態を追加せず、Focus Coordinationのpending intent以外は既存状態から導出する。
- **Maintainability**: Accessibility責務をWordPress接続境界に限定し、RF / Row / Columnのdomain責務と方向固有構造を重複させない。
- **Compatibility**: Core Table / Flexible Table Blockおよびiframe / non-iframe Editorの差を既存境界で吸収し、Accessibility意味を分岐させない。
- **Scope control**: Phase 1のRF baselineに必要な責務だけを扱い、Keyboard DnD、全面的WCAG監査、screen reader固有対応へ拡張しない。

## 11. Risks and Technical Debt

- WordPress EditorまたはWordPress Componentsのversion差により、標準Keyboard / semantic / focus Contractの実際の挙動が異なる可能性がある。差異は外部能力とYTR接続のどちらに原因があるかを分離して評価する必要がある。
- Table更新時のediting surface再生成では、focus targetが成立する時点がEditor Lifecycleに依存する。表示復帰完了のbarrierはpending intentのsettleを待つが、Focus Coordinationのpending intentをRF / Apply状態の複製へ拡張すると、stale focusや二重正本を生む危険がある。
- BrowserとAssistive Technologyの組み合わせによりannouncementの伝達挙動が異なる可能性がある。Phase 1では特定製品向け分岐を設けず、Issue #1047の代表環境でbaselineを検証する。
- 成功後の正確なセルを現在Tableで特定できない場合がある。Architectureは推測focusを禁止し、対象Tableの安定位置へのfallbackに限定するため、将来より強い結果位置Contractが必要になった場合はTable Integration側の設計判断が必要になる。

## 12. Glossary

| Term | Meaning |
| --- | --- |
| Accessibility Presentation | 既存RF / Apply状態を標準操作部品の意味、状態、案内、入力問題との関係として表現する責務。domain stateやvalidationは所有しない。 |
| Focus intent | Lifecycle上の遷移理由と意味上のfocus targetを表す一時的な要求。DOM nodeまたはRF / Apply phaseの複製ではない。 |
| Pending focus intent | 表示再生成中にtargetが一時的に存在しない場合だけ、同じ対象TableとLifecycleへ限定して保持し、target、明示されたfallback、またはfocusを変更しない終了条件のいずれかへsettleするfocus intent。 |
| Announcement | focusを移動せず、確定した結果または現在状態の意味変化を支援技術へ伝える一回性通知。 |
| Input problem | RF Input Interpretationが特定入力について修正を必要とすると解釈した結果。構造拒否またはno-opとは異なる。 |
| Structural result | Row / Column RF ResolutionとTable Integrationが現在指定全体について返すno-op、構造拒否、または利用不能。特定入力だけのvalidation errorではない。 |
| Semantic target | RF入口、入力、確認操作、反映中状態、確定後セル等、具体的なDOM構造から独立したfocus先の意味。 |
| Browser Accessibility Platform | native Keyboard動作、focus、accessibility tree、支援技術への状態変化伝達を提供するbrowser能力。 |
