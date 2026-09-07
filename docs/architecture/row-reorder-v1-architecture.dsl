// Generated from docs/architecture/row-reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Row Reorder v1 Architecture" {
	!impliedRelationships false
	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "対応Tableのツールバー、既存Block wrapper、入力、および行DnD表示が存在する編集環境を提供する。" { tags "External Context,External System" }
		EXT_SUPPORTED_TABLE_BLOCK = element "Supported Table Block" "External Block" "Core TableまたはFlexible Table Blockとして、Table Integrationが行制約取得と行順更新を行う対象を提供する。" { tags "External Context,External Block" }
		EXT_WORDPRESS_UNDO = element "WordPress Undo" "External Capability" "成立した1回の行並び替えを1回のUndoで戻せる更新単位を提供する。" { tags "External Context,External Capability" }
		EXT_WORDPRESS_PREFERENCES = element "WordPress Preferences" "External Capability" "PC / タッチごとの初回案内表示済み状態を永続化する。" { tags "External Context,External Capability" }
		EXT_SCROLL_AREA = element "Editor Scroll Area" "External Environment" "行DnD中に縦方向へ自動スクロールする対象領域を提供する。" { tags "External Context,External Environment" }
		EXT_DND_ENGINE = element "DnD Engine" "External Library" "物理DnDの開始候補登録、開始・移動・終了Lifecycle、物理入力情報、および自動スクロールを提供する。" { tags "External Context,External Library" }
		RESP_REORDER_MODE = element "Reorder Mode" "Responsibility" "`edit / row / column`の排他状態、対象Table Identity、およびTable単位のモードLifecycleを所有する共通状態責務。" { tags "Responsibility" }
		RESP_REORDER_GUIDANCE = element "Reorder Guidance" "Responsibility" "現在どのTableへどの操作環境の共通入口案内を表示しているかという一時状態だけを所有する共通状態責務。" { tags "Responsibility" }
		RESP_EDITOR_DOM_CONTEXT = element "Editor DOM Context" "Responsibility" "現在のEditor DOM基準から、その表示環境に属するDOM / Web API contextを要求時点で解決する。" { tags "Responsibility" }
		RESP_WORDPRESS_REORDER_INTEGRATION = element "WordPress Reorder Integration" "Responsibility" "Tableツールバー入口、通常編集抑止、現在TableとReorder Mode、および方向固有DnD境界をWordPress Editorへ接続する。" { tags "Responsibility" }
		RESP_REORDER_GUIDANCE_INTEGRATION = element "Reorder Guidance Integration" "Responsibility" "初回案内の表示契機、操作環境判定、WordPress preferences永続化、Reorder Mode選択による案内終了を接続する。" { tags "Responsibility" }
		RESP_ROW_INPUT_INTERACTION = element "Input Interaction" "Responsibility" "PC / タッチの開始条件を解釈し、開始候補を第一段階Target Resolutionで事前解決して、開始可能な候補だけをDnD Engineへ登録する。" { tags "Responsibility" }
		RESP_ROW_DND_ENGINE_INTEGRATION = element "DnD Engine Integration" "Responsibility" "DnD Engineの物理Lifecycleを第二段階Target Resolution、Destination Resolution、DnD Interactionへ接続し、そのDnDだけの接続一時状態を所有する。" { tags "Responsibility" }
		RESP_ROW_DESTINATION_RESOLUTION = element "Destination Resolution" "Responsibility" "DnD Engineの物理入力位置をDnD開始時のTable配置に対する論理行間境界へ変換する。" { tags "Responsibility" }
		RESP_ROW_TABLE_INTEGRATION = element "Table Integration" "Responsibility" "指定された対応Tableの現在行制約取得、確定済み行移動、およびWordPress Undo境界を提供する。" { tags "Responsibility" }
		RESP_ROW_TARGET_RESOLUTION = element "Reorder Target Resolution" "Responsibility" "active DnD成立前に現在行制約から行の開始可否を二段階で解決し、開始可能時は開始時制約を返す。" { tags "Responsibility" }
		RESP_ROW_DND_INTERACTION = element "DnD Interaction" "Responsibility" "解決済みReorder Targetから始まる行DnD Session、論理移動先の有効性、確定、cancel、終了後モード解決を所有する。" { tags "Responsibility" }
		RESP_ROW_PRESENTATION = element "Reorder Presentation" "Responsibility" "開始不可、操作可能 / 移動不可、移動対象、水平挿入位置、周囲行移動、終了通知をRow Reorderの独立表示として表現する。" { tags "Responsibility" }
		DEP_001 = RESP_EDITOR_DOM_CONTEXT -> EXT_WORDPRESS_EDITOR "現在のEditor DOM基準と同じ表示環境のcontextを解決するために必要とする。" { tags "Structural Dependency" }
		DEP_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "Tableツールバー、現在Tableの編集面、WordPress側Lifecycleへ接続するために必要とする。" { tags "Structural Dependency" }
		DEP_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "ツールバー選択、通常編集抑止、対象Table単位の現在モードを接続するために必要とする。" { tags "Structural Dependency" }
		DEP_004 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ROW_DND_ENGINE_INTEGRATION "対象Tableの行並び替え有効状態を方向固有DnD境界へ接続するために必要とする。" { tags "Structural Dependency" }
		DEP_005 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_EDITOR "初回案内の表示契機とWordPress Editor上の表示位置を接続するために必要とする。" { tags "Structural Dependency" }
		DEP_006 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_PREFERENCES "PC / タッチごとの初回案内表示済み状態を永続化するために必要とする。" { tags "Structural Dependency" }
		DEP_007 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_EDITOR_DOM_CONTEXT "現在のEditor DOMに対する操作環境を解決するために必要とする。" { tags "Structural Dependency" }
		DEP_008 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_GUIDANCE "現在の共通入口案内状態を開始・終了するために必要とする。" { tags "Structural Dependency" }
		DEP_009 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_MODE "いずれかの並び替え入口選択を案内終了条件として扱うために必要とする。" { tags "Structural Dependency" }
		DEP_010 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_TARGET_RESOLUTION "入力開始候補を第一段階の現在制約で解決するために必要とする。" { tags "Structural Dependency" }
		DEP_011 = RESP_ROW_INPUT_INTERACTION -> EXT_DND_ENGINE "開始可能な候補だけを物理DnD開始候補として一時登録するために必要とする。" { tags "Structural Dependency" }
		DEP_012 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_PRESENTATION "第一段階でDesign上の開始拒否理由が返った場合に一回性の利用者向け通知へ接続するために必要とする。" { tags "Structural Dependency" }
		DEP_013 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_INPUT_INTERACTION "DnD Engine境界の配下で行開始入力を有効化し、開始候補登録を接続するために必要とする。" { tags "Structural Dependency" }
		DEP_014 = RESP_ROW_DND_ENGINE_INTEGRATION -> EXT_DND_ENGINE "物理DnDの開始前、開始、移動、終了Lifecycleを受け取るために必要とする。" { tags "Structural Dependency" }
		DEP_015 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_TARGET_RESOLUTION "active DnD成立直前の第二段階開始可否を解決するために必要とする。" { tags "Structural Dependency" }
		DEP_016 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DESTINATION_RESOLUTION "物理DnD移動を論理行間境界へ変換するために必要とする。" { tags "Structural Dependency" }
		DEP_017 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "解決済み開始情報、論理移動先、終了種別を行DnD Sessionへ接続するために必要とする。" { tags "Structural Dependency" }
		DEP_018 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_PRESENTATION "同じDnD Engine境界で独立したRow Reorder表示を活動させるために必要とする。" { tags "Structural Dependency" }
		DEP_019 = RESP_ROW_DESTINATION_RESOLUTION -> EXT_DND_ENGINE "現在の物理入力位置を論理行間境界へ変換するためにDnD Engineの移動情報を必要とする。" { tags "Structural Dependency" }
		DEP_020 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Block固有の行構造取得と行順更新を行うために必要とする。" { tags "Structural Dependency" }
		DEP_021 = RESP_ROW_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した1回の行移動を1回のUndo単位として維持するために必要とする。" { tags "Structural Dependency" }
		DEP_022 = RESP_ROW_TARGET_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "要求時点の現在行制約から行の開始可否と開始時制約を解決するために必要とする。" { tags "Structural Dependency" }
		DEP_023 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "complete時の現在構造再照合、確定済み行移動、終了後の対象Table継続可否確認に必要とする。" { tags "Structural Dependency" }
		DEP_024 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "Session終了後に対象Tableで行並び替えを安全に継続できるかだけを現在モードへ反映するために必要とする。" { tags "Structural Dependency" }
		DEP_025 = RESP_ROW_PRESENTATION -> RESP_EDITOR_DOM_CONTEXT "現在のEditor DOM contextで一時表示を配置するために必要とする。" { tags "Structural Dependency" }
		DEP_026 = RESP_ROW_PRESENTATION -> EXT_DND_ENGINE "移動対象表示等に必要な物理DnD情報をSessionへ複製せず利用するために必要とする。" { tags "Structural Dependency" }
		DEP_027 = RESP_ROW_PRESENTATION -> RESP_ROW_TARGET_RESOLUTION "操作可能 / 移動不可表示で開始可否の意味を重複判定せず利用するために必要とする。" { tags "Structural Dependency" }
		DEP_028 = RESP_ROW_PRESENTATION -> RESP_ROW_DND_INTERACTION "active状態と現在の有効移動先を購読し、終了通知を受け取るために必要とする。" { tags "Structural Dependency" }
		DEP_029 = EXT_DND_ENGINE -> EXT_SCROLL_AREA "行DnD中に縦方向の自動スクロールを実行する対象領域として必要とする。" { tags "Structural Dependency" }
		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "対応Tableの選択、ツールバー操作、既存Block wrapper上の入力がWordPress接続境界へ入る。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ROW_DND_ENGINE_INTEGRATION "対象TableのRow Reorder有効状態をDnD Engine接続境界へ反映する。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_003 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_INPUT_INTERACTION "有効なRow DnD境界から開始入力処理へ進む。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_004 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_TARGET_RESOLUTION "開始候補を第一段階の現在制約で事前解決する。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_005 = RESP_ROW_INPUT_INTERACTION -> EXT_DND_ENGINE "第一段階で開始可能な候補だけを物理DnD開始候補として一時登録する。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_006 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "active DnD成立前後の物理LifecycleをRow Reorder接続境界へ通知する。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_007 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_TARGET_RESOLUTION "active DnD成立直前に同じReorder Targetを第二段階の現在制約で再解決する。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_008 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DESTINATION_RESOLUTION "active DnDの物理移動を論理行間境界の解決へ進める。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_009 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "解決済み開始情報、論理行間境界、終了種別を行DnD Sessionへ渡す。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_010 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "complete時に現在構造の再照合と確定済み行移動の反映へ進む。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_011 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在行制約を取得し、確定時は`tbody`の行順を反映する。" { tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal" }
		PF_012 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "物理DnDがcancelまたは継続不能として終了する。" { tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,failure" }
		PF_013 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "物理DnDの終了種別を行DnD Sessionのcancelへ接続する。" { tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,recovery" }
		PF_014 = RESP_ROW_TABLE_INTEGRATION -> RESP_ROW_DND_INTERACTION "complete時の現在Table利用不能または更新不能を安全な確定不能結果として返す。" { tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,failure" }
		PF_015 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "DnD中表示を終了し、Designで通知対象となる確定不能だけを一回性通知へ反映する。" { tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,recovery" }
		PF_016 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "Session終了後に対象Tableで行並び替えを継続できるかだけを共通モード状態へ反映する。" { tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,recovery" }
		RT_001 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "active DnD成立直前の物理Lifecycleを通知する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_START" properties { "runtime.RV_ROW_DND_START.step.1" "active DnD成立直前の物理Lifecycleを通知する。" } }
		RT_002 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_TARGET_RESOLUTION "同じReorder Targetを現在制約で第二段階解決する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_START" properties { "runtime.RV_ROW_DND_START.step.2" "同じReorder Targetを現在制約で第二段階解決する。" } }
		RT_003 = RESP_ROW_TARGET_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "現在行制約を要求する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_START" properties { "runtime.RV_ROW_DND_START.step.3" "現在行制約を要求する。" } }
		RT_004 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Blockから現在行制約を取得する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_START" properties { "runtime.RV_ROW_DND_START.step.4" "対応Table Blockから現在行制約を取得する。" } }
		RT_005 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "第二段階が成立した場合だけ解決済みReorder Targetと開始時制約でSessionを開始する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_START" properties { "runtime.RV_ROW_DND_START.step.5" "第二段階が成立した場合だけ解決済みReorder Targetと開始時制約でSessionを開始する。" } }
		RT_006 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "現在の物理DnD移動を通知する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS" properties { "runtime.RV_ROW_DND_PROGRESS.step.1" "現在の物理DnD移動を通知する。" } }
		RT_007 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DESTINATION_RESOLUTION "物理入力位置を論理行間境界へ変換する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS" properties { "runtime.RV_ROW_DND_PROGRESS.step.2" "物理入力位置を論理行間境界へ変換する。" } }
		RT_008 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "解決済み論理行間境界をprogressへ渡す。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS" properties { "runtime.RV_ROW_DND_PROGRESS.step.3" "解決済み論理行間境界をprogressへ渡す。" } }
		RT_009 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "現在の有効移動先に対応する表示意味を更新する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS" properties { "runtime.RV_ROW_DND_PROGRESS.step.4" "現在の有効移動先に対応する表示意味を更新する。" } }
		RT_010 = EXT_DND_ENGINE -> EXT_SCROLL_AREA "必要な場合だけ縦方向へ自動スクロールする。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS" properties { "runtime.RV_ROW_DND_PROGRESS.step.5" "必要な場合だけ縦方向へ自動スクロールする。" } }
		RT_011 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "物理的なcompleteを通知する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE" properties { "runtime.RV_ROW_DND_COMPLETE.step.1" "物理的なcompleteを通知する。" } }
		RT_012 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "completeを行DnD Sessionへ渡す。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE" properties { "runtime.RV_ROW_DND_COMPLETE.step.2" "completeを行DnD Sessionへ渡す。" } }
		RT_013 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "現在構造を取得してReorder Targetと最終移動先を再照合する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE" properties { "runtime.RV_ROW_DND_COMPLETE.step.3" "現在構造を取得してReorder Targetと最終移動先を再照合する。" } }
		RT_014 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在行制約を取得する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE" properties { "runtime.RV_ROW_DND_COMPLETE.step.4" "現在行制約を取得する。" } }
		RT_015 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "現在も成立し行順が変化する場合だけ確定済み行移動を要求する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE" properties { "runtime.RV_ROW_DND_COMPLETE.step.5" "現在も成立し行順が変化する場合だけ確定済み行移動を要求する。" } }
		RT_016 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "`tbody`の行順だけを更新する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE" properties { "runtime.RV_ROW_DND_COMPLETE.step.6" "`tbody`の行順だけを更新する。" } }
		RT_017 = RESP_ROW_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した1回の行移動を1回のUndo単位として維持する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE" properties { "runtime.RV_ROW_DND_COMPLETE.step.7" "成立した1回の行移動を1回のUndo単位として維持する。" } }
		RT_018 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "DnD中表示を終了する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE" properties { "runtime.RV_ROW_DND_COMPLETE.step.8" "DnD中表示を終了する。" } }
		RT_019 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "対象Tableで行並び替えを継続できるかだけを通知する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE" properties { "runtime.RV_ROW_DND_COMPLETE.step.9" "対象Tableで行並び替えを継続できるかだけを通知する。" } }
		RT_020 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "cancelまたは継続不能として物理DnDを終了する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT" properties { "runtime.RV_ROW_DND_EXTERNAL_ABORT.step.1" "cancelまたは継続不能として物理DnDを終了する。" } }
		RT_021 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "cancelまたは継続不能をSessionへ渡す。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT" properties { "runtime.RV_ROW_DND_EXTERNAL_ABORT.step.2" "cancelまたは継続不能をSessionへ渡す。" } }
		RT_022 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "DnD中表示を終了し、Designで通知対象の場合だけ一時通知を要求する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT" properties { "runtime.RV_ROW_DND_EXTERNAL_ABORT.step.3" "DnD中表示を終了し、Designで通知対象の場合だけ一時通知を要求する。" } }
		RT_023 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "対象Tableで行並び替えを継続できるかだけを通知する。" { tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT" properties { "runtime.RV_ROW_DND_EXTERNAL_ABORT.step.4" "対象Tableで行並び替えを継続できるかだけを通知する。" } }
	}
	views {
		systemLandscape "DV_ROW_RESPONSIBILITY" { title "Structural Dependencies - Responsibility View" include EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES EXT_SCROLL_AREA EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION exclude "relationship.tag!=Structural Dependency" autoLayout lr }
		systemLandscape "DV_ROW_EDITOR_INTEGRATION" { title "Structural Dependencies - Editor Integration" include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ROW_DND_ENGINE_INTEGRATION exclude "relationship.tag!=Structural Dependency" autoLayout lr }
		systemLandscape "DV_ROW_DND_CORE" { title "Structural Dependencies - DnD Core" include EXT_DND_ENGINE RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION exclude "relationship.tag!=Structural Dependency" autoLayout lr }
		systemLandscape "DV_ROW_FEEDBACK" { title "Structural Dependencies - DnD Feedback" include EXT_DND_ENGINE RESP_EDITOR_DOM_CONTEXT RESP_ROW_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION exclude "relationship.tag!=Structural Dependency" autoLayout lr }
		systemLandscape "DV_ROW_DATA_UPDATE" { title "Structural Dependencies - Table Update" include EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION exclude "relationship.tag!=Structural Dependency" autoLayout lr }
		custom "PV_ROW_REORDER_END_TO_END" { title "Process Flow - Row Reorder End-to-End" include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_INPUT_INTERACTION RESP_ROW_TARGET_RESOLUTION EXT_DND_ENGINE RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK exclude "relationship.tag!=ProcessFlow_PV_ROW_REORDER_END_TO_END" autoLayout lr }
		custom "PV_ROW_EXTERNAL_CHANGE_RECOVERY" { title "Process Flow [Failure / Recovery] - External Environment Change and Recovery" include EXT_DND_ENGINE RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_PRESENTATION RESP_REORDER_MODE exclude "relationship.tag!=ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY" autoLayout lr }
		custom "RV_ROW_DND_START" { title "Runtime - Row DnD start" include EXT_DND_ENGINE RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_TARGET_RESOLUTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK RESP_ROW_DND_INTERACTION exclude "relationship.tag!=Runtime_RV_ROW_DND_START" properties { "runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005" } autoLayout lr }
		custom "RV_ROW_DND_PROGRESS" { title "Runtime - Row DnD progress" include EXT_DND_ENGINE RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION EXT_SCROLL_AREA exclude "relationship.tag!=Runtime_RV_ROW_DND_PROGRESS" properties { "runtime.steps" "1=RT_006;2=RT_007;3=RT_008;4=RT_009;5=RT_010" } autoLayout lr }
		custom "RV_ROW_DND_COMPLETE" { title "Runtime - Row DnD complete" include EXT_DND_ENGINE RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_ROW_PRESENTATION RESP_REORDER_MODE exclude "relationship.tag!=Runtime_RV_ROW_DND_COMPLETE" properties { "runtime.steps" "1=RT_011;2=RT_012;3=RT_013;4=RT_014;5=RT_015;6=RT_016;7=RT_017;8=RT_018;9=RT_019" } autoLayout lr }
		custom "RV_ROW_DND_EXTERNAL_ABORT" { title "Runtime - Row DnD external change abort" include EXT_DND_ENGINE RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_REORDER_MODE exclude "relationship.tag!=Runtime_RV_ROW_DND_EXTERNAL_ABORT" properties { "runtime.steps" "1=RT_020;2=RT_021;3=RT_022;4=RT_023" } autoLayout lr }
	}
}
