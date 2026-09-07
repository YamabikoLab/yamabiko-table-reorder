// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "対応Tableのツールバー、編集面、入力、および行DnD表示が存在する編集環境を提供する。" {
			tags "External Context,External System"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_SUPPORTED_TABLE_BLOCK = element "Supported Table Block" "External Block" "Core TableまたはFlexible Table Blockとして、Table Integrationが行制約取得と行順更新を行う対象を提供する。" {
			tags "External Context,External Block"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_WORDPRESS_UNDO = element "WordPress Undo" "External Capability" "成立した1回の行並び替えを1回のUndoで戻せる更新単位を提供する。" {
			tags "External Context,External Capability"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_WORDPRESS_PREFERENCES = element "WordPress Preferences" "External Capability" "PC / タッチごとの初回案内表示済み状態を永続化する。" {
			tags "External Context,External Capability"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_SCROLL_AREA = element "Editor Scroll Area" "External Environment" "行DnD中に縦方向へ自動スクロールする対象領域を提供する。" {
			tags "External Context,External Environment"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_DND_ENGINE = element "DnD Engine" "External Library" "物理DnDの開始候補登録、開始・移動・終了Lifecycle、物理入力情報、および自動スクロールを提供する。" {
			tags "External Context,External Library"
		}

		RESP_REORDER_MODE = element "Reorder Mode" "Responsibility" "`edit" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Common")
			}
		}
		RESP_REORDER_GUIDANCE = element "Reorder Guidance" "Responsibility" "現在どのTableへどの操作環境の共通入口案内を表示しているかという一時状態だけを所有する共通状態責務。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Common")
			}
		}
		RESP_EDITOR_DOM_CONTEXT = element "Editor DOM Context" "Responsibility" "現在のEditor DOM基準から、その表示環境に属するDOM / Web API contextを要求時点で解決する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Editor Integration")
			}
		}
		RESP_WORDPRESS_REORDER_INTEGRATION = element "WordPress Reorder Integration" "Responsibility" "Tableツールバー入口、通常編集抑止、現在TableとReorder Mode、および方向固有DnD境界をWordPress Editorへ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_REORDER_GUIDANCE_INTEGRATION = element "Reorder Guidance Integration" "Responsibility" "初回案内の表示契機、操作環境判定、WordPress Preferences永続化、Reorder Mode選択による案内終了を接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_ROW_INPUT_INTERACTION = element "Input Interaction" "Responsibility" "PC / タッチの開始条件を解釈し、開始候補を第一段階Target Resolutionで事前解決して、開始可能な候補だけをDnD Engineへ登録する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_ROW_DND_ENGINE_INTEGRATION = element "DnD Engine Integration" "Responsibility" "DnD Engineの物理Lifecycleを第二段階Target Resolution、Destination Resolution、DnD Interactionへ接続し、そのDnDだけの接続一時状態を所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_ROW_DESTINATION_RESOLUTION = element "Destination Resolution" "Responsibility" "DnD Engineの物理入力位置をDnD開始時のTable配置に対する論理行間境界へ変換する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_ROW_TABLE_INTEGRATION = element "Table Integration" "Responsibility" "指定された対応Tableの現在行制約取得、確定済み行移動、およびWordPress Undo境界を提供する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_ROW_TARGET_RESOLUTION = element "Reorder Target Resolution" "Responsibility" "active DnD成立前に現在行制約から移動行の開始可否を二段階で解決し、開始可能時は開始時制約を返す。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_ROW_DND_INTERACTION = element "DnD Interaction" "Responsibility" "解決済みReorder Targetから始まる行DnD Session、論理移動先の有効性、確定、cancel、終了後モード解決を所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_ROW_PRESENTATION = element "Reorder Presentation" "Responsibility" "操作可否、開始不可、移動対象、水平挿入位置、周囲行移動、終了通知をRow Reorderの独立表示として表現する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}

		DEP_001 = RESP_EDITOR_DOM_CONTEXT -> EXT_WORDPRESS_EDITOR "現在のEditor DOM基準と同じ表示環境のcontextを解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "Tableツールバー、現在Tableの編集面、WordPress側Lifecycleへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "ツールバー選択、通常編集抑止、対象Table単位の現在モードを接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_004 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ROW_DND_ENGINE_INTEGRATION "対象Tableの行並び替え有効状態を方向固有DnD境界へ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_005 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_EDITOR "初回案内の表示契機とWordPress Editor上の表示位置を接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_006 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_PREFERENCES "PC / タッチごとの初回案内表示済み状態を永続化するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_EDITOR_DOM_CONTEXT "現在のEditor DOMに対する操作環境を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_GUIDANCE "現在の共通入口案内状態を開始・終了するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_MODE "いずれかの並び替え入口選択を案内終了条件として扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_TARGET_RESOLUTION "入力開始候補を第一段階の現在制約で解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_ROW_INPUT_INTERACTION -> EXT_DND_ENGINE "開始可能な候補だけを物理DnD開始候補として一時登録するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_PRESENTATION "第一段階でDesign上の開始拒否理由が返った場合に利用者向け通知へ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_INPUT_INTERACTION "DnD Engine境界の配下で行開始入力を有効化し、開始候補登録を接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_ROW_DND_ENGINE_INTEGRATION -> EXT_DND_ENGINE "物理DnDの開始前、開始、移動、終了Lifecycleを受け取るために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_TARGET_RESOLUTION "active DnD成立直前の第二段階開始可否を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DESTINATION_RESOLUTION "物理DnD移動を論理行間境界へ変換するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "解決済み開始情報、論理移動先、終了種別を行DnD Sessionへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_PRESENTATION "同じDnD Engine境界で独立したRow Reorder表示を活動させるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_019 = RESP_ROW_DESTINATION_RESOLUTION -> EXT_DND_ENGINE "現在の物理入力位置を論理行間境界へ変換するためにDnD Engineの移動情報を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_020 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Block固有の行構造取得と行順更新を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_021 = RESP_ROW_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した1回の行移動を1回のUndo単位として維持するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_022 = RESP_ROW_TARGET_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "要求時点の現在行制約から移動行の開始可否と開始時制約を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_023 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "complete時の現在構造再照合、確定済み行移動、終了後の対象Table継続可否確認に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_024 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "Session終了後に対象Tableで行並び替えを安全に継続できるかだけを現在モードへ反映するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_025 = RESP_ROW_PRESENTATION -> RESP_EDITOR_DOM_CONTEXT "現在のEditor DOM contextで一時表示を配置するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_026 = RESP_ROW_PRESENTATION -> EXT_DND_ENGINE "移動対象表示等に必要な物理DnD情報をSessionへ複製せず利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_027 = RESP_ROW_PRESENTATION -> RESP_ROW_TARGET_RESOLUTION "操作可能・移動不可表示で開始可否の意味を重複判定せず利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_028 = RESP_ROW_PRESENTATION -> RESP_ROW_DND_INTERACTION "active状態と現在の有効移動先を購読し、終了通知を受け取るために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_029 = EXT_DND_ENGINE -> EXT_SCROLL_AREA "行DnD中に縦方向の自動スクロールを実行する対象領域として必要とする。" {
			tags "Structural Dependency"
		}

		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "対応Tableの選択、ツールバー操作、対応Tableの編集面上の入力がWordPress接続境界へ入る。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ROW_DND_ENGINE_INTEGRATION "対象TableのRow Reorder有効状態をDnD Engine接続境界へ反映する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_003 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_INPUT_INTERACTION "有効なRow DnD境界から開始入力処理へ進む。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_004 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_TARGET_RESOLUTION "開始候補を第一段階の現在制約で事前解決する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_005 = RESP_ROW_INPUT_INTERACTION -> EXT_DND_ENGINE "第一段階で開始可能な候補だけを物理DnD開始候補として一時登録する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_006 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "active DnD成立前後の物理LifecycleをRow Reorder接続境界へ通知する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_007 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_TARGET_RESOLUTION "active DnD成立直前に同じReorder Targetを第二段階の現在制約で再解決する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_008 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DESTINATION_RESOLUTION "active DnDの物理移動を論理行間境界の解決へ進める。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_009 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "解決済み開始情報、論理行間境界、終了種別を行DnD Sessionへ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_010 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "complete時に現在構造の再照合と確定済み行移動の反映へ進む。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_011 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在行制約を取得し、確定時はtbodyの行順を反映する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_012 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "[failure] 物理DnDがcancelまたは継続不能として終了する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_013 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "[recovery] 物理DnDの終了種別を行DnD Sessionのcancelへ接続する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,recovery"
		}
		PF_014 = RESP_ROW_TABLE_INTEGRATION -> RESP_ROW_DND_INTERACTION "[failure] complete時の現在Table利用不能または更新不能を安全な確定不能結果として返す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_015 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "[recovery] DnD中表示を終了し、Designで通知対象となる確定不能だけを一回性通知へ反映する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,recovery"
		}
		PF_016 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "[recovery] Session終了後に対象Tableで行並び替えを継続できるかだけを共通モード状態へ反映する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,recovery"
		}

		RT_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "対象Tableの既存編集面で開始入力が発生する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.1" "対象Tableの既存編集面で開始入力が発生する。"
			}
		}
		RT_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ROW_DND_ENGINE_INTEGRATION "対象Tableの行並び替え有効状態と開始入力接続を方向固有DnD境界へ反映する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.2" "対象Tableの行並び替え有効状態と開始入力接続を方向固有DnD境界へ反映する。"
			}
		}
		RT_003 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_INPUT_INTERACTION "行開始入力を入力境界へ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.3" "行開始入力を入力境界へ渡す。"
			}
		}
		RT_004 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_TARGET_RESOLUTION "開始候補を第一段階の現在制約で解決する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.4" "開始候補を第一段階の現在制約で解決する。"
			}
		}
		RT_005 = RESP_ROW_TARGET_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "指定Tableの現在行制約を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.5" "指定Tableの現在行制約を要求する。"
			}
		}
		RT_006 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "要求時点の対応Tableから行制約を取得する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.6" "要求時点の対応Tableから行制約を取得する。"
				"runtime.RV_ROW_DND_START.step.13" "要求時点の対応Tableから行制約を取得する。"
			}
		}
		RT_007 = RESP_ROW_TARGET_RESOLUTION -> RESP_ROW_INPUT_INTERACTION "resolved、Design上のrejected、またはunavailableを返す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.7" "resolved、Design上のrejected、またはunavailableを返す。"
			}
		}
		RT_008 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_PRESENTATION "第一段階がDesign上のrejectedの場合だけ開始不可理由を通知する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.8" "第一段階がDesign上のrejectedの場合だけ開始不可理由を通知する。"
			}
		}
		RT_009 = RESP_ROW_INPUT_INTERACTION -> EXT_DND_ENGINE "第一段階がresolvedの場合だけ開始候補を一時登録する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.9" "第一段階がresolvedの場合だけ開始候補を一時登録する。"
			}
		}
		RT_010 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "active DnD成立直前の開始通知を渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.10" "active DnD成立直前の開始通知を渡す。"
			}
		}
		RT_011 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_TARGET_RESOLUTION "同じReorder Targetを第二段階の現在制約で再解決する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.11" "同じReorder Targetを第二段階の現在制約で再解決する。"
			}
		}
		RT_012 = RESP_ROW_TARGET_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "第二段階の現在行制約を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.12" "第二段階の現在行制約を要求する。"
			}
		}
		RT_013 = RESP_ROW_TARGET_RESOLUTION -> RESP_ROW_DND_ENGINE_INTEGRATION "第二段階の解決結果を返す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.14" "第二段階の解決結果を返す。"
			}
		}
		RT_014 = RESP_ROW_DND_ENGINE_INTEGRATION -> EXT_DND_ENGINE "第二段階がresolvedでなければ物理DnD開始を成立させない。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.15" "第二段階がresolvedでなければ物理DnD開始を成立させない。"
			}
		}
		RT_015 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "第二段階成立後の物理DnD startを通知する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.16" "第二段階成立後の物理DnD startを通知する。"
			}
		}
		RT_016 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "解決済みReorder Targetと開始時制約でRow DnD Sessionを開始する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.17" "解決済みReorder Targetと開始時制約でRow DnD Sessionを開始する。"
			}
		}
		RT_017 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "active状態への遷移を表示購読へ反映する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.18" "active状態への遷移を表示購読へ反映する。"
			}
		}
		RT_018 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "現在の物理DnD移動を通知する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.1" "現在の物理DnD移動を通知する。"
			}
		}
		RT_019 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DESTINATION_RESOLUTION "現在の物理入力位置から論理行間境界を要求する。未成立なら当該DnDの解決境界を再び成立させる。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.2" "現在の物理入力位置から論理行間境界を要求する。未成立なら当該DnDの解決境界を再び成立させる。"
			}
		}
		RT_020 = RESP_ROW_DESTINATION_RESOLUTION -> RESP_ROW_DND_ENGINE_INTEGRATION "0-based論理行間境界またはnullを返す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.3" "0-based論理行間境界またはnullを返す。"
			}
		}
		RT_021 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "解決済み論理行間境界を現在Sessionへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.4" "解決済み論理行間境界を現在Sessionへ渡す。"
			}
		}
		RT_022 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "開始時制約に対して成立した現在の有効移動先を表示購読へ反映する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.5" "開始時制約に対して成立した現在の有効移動先を表示購読へ反映する。"
			}
		}
		RT_023 = RESP_ROW_PRESENTATION -> EXT_DND_ENGINE "移動対象表示に必要な物理DnD情報を必要な時点だけ利用する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.6" "移動対象表示に必要な物理DnD情報を必要な時点だけ利用する。"
			}
		}
		RT_024 = EXT_DND_ENGINE -> EXT_SCROLL_AREA "必要な場合だけ縦方向へ自動スクロールする。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.7" "必要な場合だけ縦方向へ自動スクロールする。"
			}
		}
		RT_025 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "cancelされていない物理DnD endを通知する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.1" "cancelされていない物理DnD endを通知する。"
			}
		}
		RT_026 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "active Sessionのcompleteを要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.2" "active Sessionのcompleteを要求する。"
			}
		}
		RT_027 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "現在の行制約を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.3" "現在の行制約を要求する。"
			}
		}
		RT_028 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "要求時点の対応Tableから現在行制約を取得する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.4" "要求時点の対応Tableから現在行制約を取得する。"
			}
		}
		RT_029 = RESP_ROW_TABLE_INTEGRATION -> RESP_ROW_DND_INTERACTION "現在行制約または利用不能結果を返す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.5" "現在行制約または利用不能結果を返す。"
			}
		}
		RT_030 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "現在も移動元と移動先が成立し行順が変化する場合だけ確定済み行移動を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.6" "現在も移動元と移動先が成立し行順が変化する場合だけ確定済み行移動を要求する。"
			}
		}
		RT_031 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "tbodyの行順を一回の更新として反映する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.7" "tbodyの行順を一回の更新として反映する。"
			}
		}
		RT_032 = RESP_ROW_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した行移動を一回のUndo単位として成立させる。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.8" "成立した行移動を一回のUndo単位として成立させる。"
			}
		}
		RT_033 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "Session終了を表示購読へ反映する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.9" "Session終了を表示購読へ反映する。"
			}
		}
		RT_034 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "Session破棄後、対象Tableが次の行並び替えを安全に受けられるか現在状態を取得し直す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE,Runtime_RV_ROW_DND_CANCEL"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.10" "Session破棄後、対象Tableが次の行並び替えを安全に受けられるか現在状態を取得し直す。"
				"runtime.RV_ROW_DND_CANCEL.step.4" "Session破棄後、対象Tableが次の行並び替えを安全に受けられるか現在状態を取得し直す。"
			}
		}
		RT_035 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "対象Tableの継続可否だけを現在モードへ反映する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE,Runtime_RV_ROW_DND_CANCEL"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.11" "対象Tableの継続可否だけを現在モードへ反映する。"
				"runtime.RV_ROW_DND_CANCEL.step.5" "対象Tableの継続可否だけを現在モードへ反映する。"
			}
		}
		RT_036 = EXT_DND_ENGINE -> RESP_ROW_DND_ENGINE_INTEGRATION "cancelまたは物理DnD endを通知する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_CANCEL"
			properties {
				"runtime.RV_ROW_DND_CANCEL.step.1" "cancelまたは物理DnD endを通知する。"
			}
		}
		RT_037 = RESP_ROW_DND_ENGINE_INTEGRATION -> RESP_ROW_DND_INTERACTION "cancelまたはcompleteという物理終了種別をSessionへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_CANCEL"
			properties {
				"runtime.RV_ROW_DND_CANCEL.step.2" "cancelまたはcompleteという物理終了種別をSessionへ渡す。"
			}
		}
		RT_038 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "DnD中表示を終了し、異常終了通知を要求しない。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_CANCEL"
			properties {
				"runtime.RV_ROW_DND_CANCEL.step.3" "DnD中表示を終了し、異常終了通知を要求しない。"
			}
		}
		RT_039 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "complete時の現在行制約または確定済み行移動の反映を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.RV_ROW_CURRENT_STATE_RECOVERY.step.1" "complete時の現在行制約または確定済み行移動の反映を要求する。"
			}
		}
		RT_040 = RESP_ROW_TABLE_INTEGRATION -> RESP_ROW_DND_INTERACTION "現在Table利用不能または更新不能を安全な確定不能結果として返す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.RV_ROW_CURRENT_STATE_RECOVERY.step.2" "現在Table利用不能または更新不能を安全な確定不能結果として返す。"
			}
		}
		RT_041 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "Sessionを終了し、Designで通知対象となる場合だけ一回性終了通知を発行する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.RV_ROW_CURRENT_STATE_RECOVERY.step.3" "Sessionを終了し、Designで通知対象となる場合だけ一回性終了通知を発行する。"
			}
		}
		RT_042 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "Session破棄後の対象Table利用可否を取得し直す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.RV_ROW_CURRENT_STATE_RECOVERY.step.4" "Session破棄後の対象Table利用可否を取得し直す。"
			}
		}
		RT_043 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "対象Tableで次の行並び替えを安全に受けられるかだけを現在モードへ反映する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.RV_ROW_CURRENT_STATE_RECOVERY.step.5" "対象Tableで次の行並び替えを安全に受けられるかだけを現在モードへ反映する。"
			}
		}
	}

	views {
		systemLandscape "DV_ROW_RESPONSIBILITY" {
			title "Structural Dependencies - Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES EXT_SCROLL_AREA EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ROW_EDITOR_INTEGRATION" {
			title "Structural Dependencies - Editor Integration"
			include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ROW_DND_ENGINE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ROW_DND_CORE" {
			title "Structural Dependencies - DnD Core"
			include EXT_DND_ENGINE RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ROW_FEEDBACK" {
			title "Structural Dependencies - DnD Feedback"
			include EXT_DND_ENGINE RESP_EDITOR_DOM_CONTEXT RESP_ROW_TARGET_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ROW_DATA_UPDATE" {
			title "Structural Dependencies - Table Update"
			include EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "PV_ROW_REORDER_END_TO_END" {
			title "Process Flow - Row Reorder End-to-End"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_INPUT_INTERACTION RESP_ROW_TARGET_RESOLUTION EXT_DND_ENGINE RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK
			exclude "relationship.tag!=ProcessFlow_PV_ROW_REORDER_END_TO_END"
			autoLayout lr
		}

		custom "PV_ROW_EXTERNAL_CHANGE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - External Environment Change and Recovery"
			include EXT_DND_ENGINE RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY"
			autoLayout lr
		}

		custom "RV_ROW_DND_START" {
			title "Runtime - Row DnD start attempt"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_INPUT_INTERACTION RESP_ROW_TARGET_RESOLUTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK RESP_ROW_PRESENTATION EXT_DND_ENGINE RESP_ROW_DND_INTERACTION
			exclude "relationship.tag!=Runtime_RV_ROW_DND_START"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006;7=RT_007;8=RT_008;9=RT_009;10=RT_010;11=RT_011;12=RT_012;13=RT_006;14=RT_013;15=RT_014;16=RT_015;17=RT_016;18=RT_017"
			}
			autoLayout lr
		}

		custom "RV_ROW_DND_PROGRESS" {
			title "Runtime - Row DnD progress"
			include EXT_DND_ENGINE RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DESTINATION_RESOLUTION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION EXT_SCROLL_AREA
			exclude "relationship.tag!=Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.steps" "1=RT_018;2=RT_019;3=RT_020;4=RT_021;5=RT_022;6=RT_023;7=RT_024"
			}
			autoLayout lr
		}

		custom "RV_ROW_DND_COMPLETE" {
			title "Runtime - Row DnD complete"
			include EXT_DND_ENGINE RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_ROW_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.steps" "1=RT_025;2=RT_026;3=RT_027;4=RT_028;5=RT_029;6=RT_030;7=RT_031;8=RT_032;9=RT_033;10=RT_034;11=RT_035"
			}
			autoLayout lr
		}

		custom "RV_ROW_DND_CANCEL" {
			title "Runtime - Row DnD cancel or invalid drop"
			include EXT_DND_ENGINE RESP_ROW_DND_ENGINE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION RESP_ROW_TABLE_INTEGRATION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_ROW_DND_CANCEL"
			properties {
				"runtime.steps" "1=RT_036;2=RT_037;3=RT_038;4=RT_034;5=RT_035"
			}
			autoLayout lr
		}

		custom "RV_ROW_CURRENT_STATE_RECOVERY" {
			title "Runtime - Row DnD current-state recovery"
			include RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_ROW_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.steps" "1=RT_039;2=RT_040;3=RT_041;4=RT_042;5=RT_043"
			}
			autoLayout lr
		}

		styles {
			element "Responsibility" {
				shape Box
			}
			element "External System" {
				shape RoundedBox
				background #f8fafc
				color #344054
				stroke #667085
				border solid
			}
			element "External Block" {
				shape Component
				background #eef4ff
				color #344054
				stroke #6172f3
			}
			element "External Capability" {
				shape Hexagon
				background #f4f3ff
				color #344054
				stroke #7f56d9
			}
			element "External Environment" {
				shape Box
				background #f2f4f7
				color #344054
				stroke #98a2b3
				border dashed
			}
			element "External Library" {
				shape Box
				background #fff7ed
				color #344054
				stroke #f79009
				border dashed
			}
			relationship "Structural Dependency" {
				style solid
			}
			relationship "Runtime Interaction" {
				style solid
			}
			relationship "normal" {
				style solid
			}
			relationship "failure" {
				color #b42318
				style dashed
				thickness 3
			}
			relationship "recovery" {
				color #b54708
				style dotted
				thickness 3
			}
		}
	}
}
