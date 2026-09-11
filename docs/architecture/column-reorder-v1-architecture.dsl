// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "対応Tableのツールバー、既存Block wrapper、入力、および列DnD表示が存在する編集環境を提供する。" {
			tags "External Context,External System"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_SUPPORTED_TABLE_BLOCK = element "Supported Table Block" "External Block" "Core TableまたはFlexible Table Blockとして、Table Integrationが列制約取得と列順更新を行う対象を提供する。" {
			tags "External Context,External Block"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_WORDPRESS_UNDO = element "WordPress Undo" "External Capability" "成立した1回の列並び替えを1回のUndoで戻せる更新単位を提供する。" {
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
		EXT_SCROLL_AREA = element "Editor Scroll Area" "External Environment" "列DnD中にColumn DnD Engine Integrationが横方向へ自動スクロールする対象領域を提供する。" {
			tags "External Context,External Environment"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_DND_ENGINE = element "DnD Engine" "External Library" "物理DnDの開始候補登録、開始・移動・終了Lifecycle、および物理入力情報を提供する。" {
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
		RESP_REORDER_APPLY_POLICY = element "Reorder Apply Policy" "Responsibility" "Table Integrationが算出した更新対象セル数だけから通常反映か確認付き大規模反映かを選択する共通方針責務。" {
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
		RESP_WORDPRESS_REORDER_APPLY_INTEGRATION = element "WordPress Reorder Apply Integration" "Responsibility" "方向固有Reorder Apply状態をWordPress Editorの確認、反映中表示、editing surface restorationへ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_REORDER_GUIDANCE_INTEGRATION = element "Reorder Guidance Integration" "Responsibility" "初回案内の表示契機、操作環境判定、WordPress preferences永続化、Reorder Mode選択による案内終了を接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_COLUMN_INPUT_INTERACTION = element "Input Interaction" "Responsibility" "PC / タッチの開始条件を解釈し、開始候補を第一段階Target Resolutionで事前解決して、開始可能な候補だけをDnD Engineへ登録する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_DND_ENGINE_INTEGRATION = element "DnD Engine Integration" "Responsibility" "DnD Engineの物理Lifecycleを第二段階Target Resolution、Destination Resolution、DnD Interactionへ接続し、そのDnDだけの接続一時状態と対象Tableの水平自動スクロールを所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_DESTINATION_RESOLUTION = element "Destination Resolution" "Responsibility" "DnD Engineの物理入力位置をDnD開始時のTable配置に対する論理列間境界へ変換する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_TABLE_INTEGRATION = element "Table Integration" "Responsibility" "指定された対応Tableの現在列制約取得、Table全体の確定済み列移動、およびWordPress Undo境界を提供する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_TARGET_RESOLUTION = element "Reorder Target Resolution" "Responsibility" "active DnD成立前に現在列制約から論理列の開始可否を二段階で解決し、開始可能時は開始時制約を返す。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_DND_INTERACTION = element "DnD Interaction" "Responsibility" "解決済みReorder Targetから始まる列DnD Session、論理移動先の有効性、確定、cancel、終了後モード解決を所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_REORDER_APPLY = element "Reorder Apply" "Responsibility" "DnD Session終了後の確認付き大規模反映について、確定済み列移動意図、確認、反映開始、現在構造再照合、表示復帰完了までの方向固有Lifecycleを所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}
		RESP_COLUMN_PRESENTATION = element "Reorder Presentation" "Responsibility" "開始不可、移動対象、垂直挿入位置、Editor表示方式に応じた周囲列移動、終了通知をColumn Reorderの独立表示として表現する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
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
		DEP_004 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_COLUMN_DND_ENGINE_INTEGRATION "対象Tableの列並び替え有効状態を方向固有DnD境界へ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_005 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "確認UI、反映中表示、更新後の編集表示をWordPress Editorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_006 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_COLUMN_REORDER_APPLY "方向固有の確認付き大規模反映状態をEditor表示へ接続し、Continue / Cancel / 表示復帰完了をLifecycleへ返すために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_EDITOR "初回案内の表示契機とWordPress Editor上の表示位置を接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_PREFERENCES "PC / タッチごとの初回案内表示済み状態を永続化するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_EDITOR_DOM_CONTEXT "現在のEditor DOMに対する操作環境を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_GUIDANCE "現在の共通入口案内状態を開始・終了するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_MODE "いずれかの並び替え入口選択を案内終了条件として扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_COLUMN_INPUT_INTERACTION -> RESP_COLUMN_TARGET_RESOLUTION "入力開始候補を第一段階の現在制約で解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_COLUMN_INPUT_INTERACTION -> EXT_DND_ENGINE "開始可能な候補だけを物理DnD開始候補として一時登録するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_COLUMN_INPUT_INTERACTION -> RESP_COLUMN_PRESENTATION "第一段階でDesign上の開始拒否理由が返った場合に一回性の利用者向け通知へ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_INPUT_INTERACTION "DnD Engine境界の配下で列開始入力を有効化し、開始候補登録を接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> EXT_DND_ENGINE "物理DnDの開始前、開始、移動、終了Lifecycleを受け取るために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> EXT_SCROLL_AREA "active Column DnD中に対象Tableを横方向だけ自動スクロールするために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_TARGET_RESOLUTION "active DnD成立直前の第二段階開始可否を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_019 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DESTINATION_RESOLUTION "物理DnD移動と水平自動スクロール後の現在位置を論理列間境界へ変換するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_020 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "解決済み開始情報、論理移動先、終了種別を列DnD Sessionへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_021 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_PRESENTATION "同じDnD Engine境界で独立したColumn Reorder表示を活動させるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_022 = RESP_COLUMN_DESTINATION_RESOLUTION -> EXT_DND_ENGINE "現在の物理入力位置を論理列間境界へ変換するためにDnD Engineの移動情報を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_023 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Block固有の列構造取得と列順更新を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_024 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した1回の列移動を1回のUndo単位として維持するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_025 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "要求時点の現在列制約から論理列の開始可否と開始時制約を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_026 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "complete時の現在構造再照合、確定済み列移動、終了後の対象Table継続可否確認に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_027 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から通常反映か確認付き大規模反映かを選択するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_028 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_REORDER_APPLY "確認付き大規模反映ではDnD Session終了後に確定済み移動意図を方向固有Apply Lifecycleへ引き渡すために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_029 = RESP_COLUMN_REORDER_APPLY -> RESP_COLUMN_TABLE_INTEGRATION "Continue後の現在構造再照合、更新対象の成立確認、確定済み列移動の反映に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_030 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_MODE "Session終了後に対象Tableで列並び替えを安全に継続できるかだけを現在モードへ反映するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_031 = RESP_COLUMN_PRESENTATION -> RESP_EDITOR_DOM_CONTEXT "現在のEditor DOM contextで一時表示を配置し、Editor表示方式に応じた周囲列移動方針を選択するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_032 = RESP_COLUMN_PRESENTATION -> EXT_DND_ENGINE "移動対象表示等に必要な物理DnD情報をSessionへ複製せず利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_033 = RESP_COLUMN_PRESENTATION -> RESP_COLUMN_TARGET_RESOLUTION "操作可能列の事前表示等で開始可否の意味を重複判定せず利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_034 = RESP_COLUMN_PRESENTATION -> RESP_COLUMN_DND_INTERACTION "active状態と現在の有効移動先を購読し、終了通知を受け取るために必要とする。" {
			tags "Structural Dependency"
		}

		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "対応Tableの選択、ツールバー操作、既存Block wrapper上の入力がWordPress接続境界へ入る。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_COLUMN_DND_ENGINE_INTEGRATION "対象TableのColumn Reorder有効状態をDnD Engine接続境界へ反映する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_003 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_INPUT_INTERACTION "有効なColumn DnD境界から開始入力処理へ進む。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_004 = RESP_COLUMN_INPUT_INTERACTION -> RESP_COLUMN_TARGET_RESOLUTION "開始候補を第一段階の現在制約で事前解決する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_005 = RESP_COLUMN_INPUT_INTERACTION -> EXT_DND_ENGINE "第一段階で開始可能な候補だけを物理DnD開始候補として一時登録する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_006 = EXT_DND_ENGINE -> RESP_COLUMN_DND_ENGINE_INTEGRATION "active DnD成立前後の物理LifecycleをColumn Reorder接続境界へ通知する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_007 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_TARGET_RESOLUTION "active DnD成立直前に同じReorder Targetを第二段階の現在制約で再解決する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_008 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DESTINATION_RESOLUTION "active DnDの物理移動を論理列間境界の解決へ進める。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_009 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "解決済み開始情報、論理列間境界、終了種別を列DnD Sessionへ渡す。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_010 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "complete時に現在構造の再照合と確定済み列移動の反映へ進む。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_011 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在列制約を取得し、確定時はTable全体の列順を反映する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_REORDER_END_TO_END,normal"
		}
		PF_012 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_APPLY_POLICY "Table Integrationが算出した更新対象セル数から反映経路の選択へ進む。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_LARGE_REORDER_APPLY,normal"
		}
		PF_013 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_REORDER_APPLY "確認付き大規模反映ではDnD Session終了後に確定済み移動意図を方向固有Apply Lifecycleへ引き渡す。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_LARGE_REORDER_APPLY,normal"
		}
		PF_014 = RESP_COLUMN_REORDER_APPLY -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "方向固有Apply状態をWordPress Editorの確認・反映中・表示復帰へ接続する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_LARGE_REORDER_APPLY,normal"
		}
		PF_015 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "確認UI、反映中表示、更新後の編集表示をWordPress Editor上に成立させる。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_LARGE_REORDER_APPLY,normal"
		}
		PF_016 = RESP_COLUMN_REORDER_APPLY -> RESP_COLUMN_TABLE_INTEGRATION "Continue後に現在構造を再照合し、成立する場合だけ確定済み列移動を要求する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_LARGE_REORDER_APPLY,normal"
		}
		PF_017 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在構造を取得し、成立した確定移動だけを対応Tableへ反映する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_LARGE_REORDER_APPLY,normal"
		}
		PF_018 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した1回の列移動を1回のUndo単位として成立させる。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_LARGE_REORDER_APPLY,normal"
		}
		PF_019 = EXT_DND_ENGINE -> RESP_COLUMN_DND_ENGINE_INTEGRATION "[failure] 物理DnDがcancelまたは継続不能として終了する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_020 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "[recovery] 物理DnDの終了種別を列DnD Sessionのcancelへ接続する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY,recovery"
		}
		PF_021 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "[failure] complete時の現在Table利用不能または更新不能を安全な確定不能結果として返す。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_022 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "[recovery] DnD中表示を終了し、Designで通知対象となる確定不能だけを一回性通知へ反映する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY,recovery"
		}
		PF_023 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_MODE "[recovery] Session終了後に対象Tableで列並び替えを継続できるかだけを共通モード状態へ反映する。" {
			tags "Process Flow,ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY,recovery"
		}

		RT_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "対象Tableの既存Block wrapper上で開始入力が発生する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.1" "対象Tableの既存Block wrapper上で開始入力が発生する。"
			}
		}
		RT_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_COLUMN_DND_ENGINE_INTEGRATION "対象Tableの列並び替え有効状態と開始入力接続を方向固有DnD境界へ反映する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.2" "対象Tableの列並び替え有効状態と開始入力接続を方向固有DnD境界へ反映する。"
			}
		}
		RT_003 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_INPUT_INTERACTION "列開始入力を入力境界へ渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.3" "列開始入力を入力境界へ渡す。"
			}
		}
		RT_004 = RESP_COLUMN_INPUT_INTERACTION -> RESP_COLUMN_TARGET_RESOLUTION "開始候補を第一段階の現在制約で解決する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.4" "開始候補を第一段階の現在制約で解決する。"
			}
		}
		RT_005 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "指定Tableの現在列制約を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.5" "指定Tableの現在列制約を要求する。"
			}
		}
		RT_006 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "要求時点の対応Tableから列制約を取得する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.6" "要求時点の対応Tableから列制約を取得する。"
				"runtime.RV_COLUMN_DND_START.step.13" "要求時点の対応Tableから列制約を取得する。"
			}
		}
		RT_007 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_INPUT_INTERACTION "resolved、Design上のrejected、またはunavailableを返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.7" "resolved、Design上のrejected、またはunavailableを返す。"
			}
		}
		RT_008 = RESP_COLUMN_INPUT_INTERACTION -> RESP_COLUMN_PRESENTATION "第一段階がDesign上のrejectedの場合だけ理由と操作位置を通知する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.8" "第一段階がDesign上のrejectedの場合だけ理由と操作位置を通知する。"
			}
		}
		RT_009 = RESP_COLUMN_INPUT_INTERACTION -> EXT_DND_ENGINE "第一段階がresolvedの場合だけ開始候補を一時登録する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.9" "第一段階がresolvedの場合だけ開始候補を一時登録する。"
			}
		}
		RT_010 = EXT_DND_ENGINE -> RESP_COLUMN_DND_ENGINE_INTEGRATION "active DnD成立直前の開始通知を渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.10" "active DnD成立直前の開始通知を渡す。"
			}
		}
		RT_011 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_TARGET_RESOLUTION "同じReorder Targetを第二段階の現在制約で再解決する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.11" "同じReorder Targetを第二段階の現在制約で再解決する。"
			}
		}
		RT_012 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "第二段階の現在列制約を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.12" "第二段階の現在列制約を要求する。"
			}
		}
		RT_013 = RESP_COLUMN_TARGET_RESOLUTION -> RESP_COLUMN_DND_ENGINE_INTEGRATION "第二段階の解決結果を返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.14" "第二段階の解決結果を返す。"
			}
		}
		RT_014 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> EXT_DND_ENGINE "第二段階がresolvedでなければ物理DnD開始を成立させない。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.15" "第二段階がresolvedでなければ物理DnD開始を成立させない。"
			}
		}
		RT_015 = EXT_DND_ENGINE -> RESP_COLUMN_DND_ENGINE_INTEGRATION "第二段階成立後の物理DnD startを通知する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.16" "第二段階成立後の物理DnD startを通知する。"
			}
		}
		RT_016 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DESTINATION_RESOLUTION "当該DnDの開始時Table配置から移動先解決境界を生成する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.17" "当該DnDの開始時Table配置から移動先解決境界を生成する。"
			}
		}
		RT_017 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> EXT_SCROLL_AREA "当該DnDの対象Tableに対する横スクロール領域を一つ確定する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.18" "当該DnDの対象Tableに対する横スクロール領域を一つ確定する。"
			}
		}
		RT_018 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "解決済みReorder Targetと開始時制約でColumn DnD Sessionを開始する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.19" "解決済みReorder Targetと開始時制約でColumn DnD Sessionを開始する。"
			}
		}
		RT_019 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "active状態への遷移を表示購読へ反映する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.RV_COLUMN_DND_START.step.20" "active状態への遷移を表示購読へ反映する。"
			}
		}
		RT_020 = EXT_DND_ENGINE -> RESP_COLUMN_DND_ENGINE_INTEGRATION "現在の物理DnD移動と物理入力位置を通知する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.1" "現在の物理DnD移動と物理入力位置を通知する。"
			}
		}
		RT_021 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DESTINATION_RESOLUTION "現在の物理入力位置から論理列間境界を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.2" "現在の物理入力位置から論理列間境界を要求する。"
			}
		}
		RT_022 = RESP_COLUMN_DESTINATION_RESOLUTION -> RESP_COLUMN_DND_ENGINE_INTEGRATION "0-based論理列間境界またはnullを返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.3" "0-based論理列間境界またはnullを返す。"
			}
		}
		RT_023 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "解決済み論理列間境界を現在Sessionへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.4" "解決済み論理列間境界を現在Sessionへ渡す。"
			}
		}
		RT_024 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "開始時制約に対して成立した現在の有効移動先を表示購読へ反映する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.5" "開始時制約に対して成立した現在の有効移動先を表示購読へ反映する。"
			}
		}
		RT_025 = RESP_COLUMN_PRESENTATION -> EXT_DND_ENGINE "移動対象表示に必要な物理DnD情報を必要な時点だけ利用する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.6" "移動対象表示に必要な物理DnD情報を必要な時点だけ利用する。"
			}
		}
		RT_026 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> EXT_SCROLL_AREA "現在の物理入力位置が対象領域の左右端にある場合だけ横方向へ自動スクロールする。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.7" "現在の物理入力位置が対象領域の左右端にある場合だけ横方向へ自動スクロールする。"
			}
		}
		RT_027 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DESTINATION_RESOLUTION "実際に横スクロールした場合、最新の物理入力位置から現在Table位置に対する論理列間境界を再要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.8" "実際に横スクロールした場合、最新の物理入力位置から現在Table位置に対する論理列間境界を再要求する。"
			}
		}
		RT_028 = RESP_COLUMN_DESTINATION_RESOLUTION -> RESP_COLUMN_DND_ENGINE_INTEGRATION "スクロール後のTable位置に追従した0-based論理列間境界またはnullを返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.9" "スクロール後のTable位置に追従した0-based論理列間境界またはnullを返す。"
			}
		}
		RT_029 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "再解決された論理列間境界を現在Sessionへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.RV_COLUMN_DND_PROGRESS.step.10" "再解決された論理列間境界を現在Sessionへ渡す。"
			}
		}
		RT_030 = EXT_DND_ENGINE -> RESP_COLUMN_DND_ENGINE_INTEGRATION "cancelされていない物理DnD endを通知する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.1" "cancelされていない物理DnD endを通知する。"
			}
		}
		RT_031 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "active Sessionのcompleteを要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.2" "active Sessionのcompleteを要求する。"
			}
		}
		RT_032 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "現在の列制約を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.3" "現在の列制約を要求する。"
			}
		}
		RT_033 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "要求時点の対応Tableから現在列制約を取得する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE,Runtime_RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.4" "要求時点の対応Tableから現在列制約を取得する。"
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.7" "要求時点の対応Tableから現在列制約を取得する。"
				"runtime.RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE.step.2" "要求時点の対応Tableから現在列制約を取得する。"
			}
		}
		RT_034 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "現在列制約または利用不能結果を返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.5" "現在列制約または利用不能結果を返す。"
			}
		}
		RT_035 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "現在も移動元と移動先が成立する確定候補について更新対象セル数を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.6" "現在も移動元と移動先が成立する確定候補について更新対象セル数を要求する。"
			}
		}
		RT_036 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "更新対象セル数または利用不能結果を返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.7" "更新対象セル数または利用不能結果を返す。"
			}
		}
		RT_037 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から反映経路の選択を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.8" "更新対象セル数から反映経路の選択を要求する。"
			}
		}
		RT_038 = RESP_REORDER_APPLY_POLICY -> RESP_COLUMN_DND_INTERACTION "通常反映または確認付き大規模反映を返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.9" "通常反映または確認付き大規模反映を返す。"
			}
		}
		RT_039 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "通常反映の場合だけ確定済み列移動を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.10" "通常反映の場合だけ確定済み列移動を要求する。"
			}
		}
		RT_040 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "列順を一回の更新として反映する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.11" "列順を一回の更新として反映する。"
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.10" "列順を一回の更新として反映する。"
			}
		}
		RT_041 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した列移動を一回のUndo単位として成立させる。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.12" "成立した列移動を一回のUndo単位として成立させる。"
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.11" "成立した列移動を一回のUndo単位として成立させる。"
			}
		}
		RT_042 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "DnD Session終了を表示購読へ反映する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.13" "DnD Session終了を表示購読へ反映する。"
			}
		}
		RT_043 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "Session破棄後、対象Tableが次のcolumn並び替えを安全に受けられるか現在状態を取得し直す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.14" "Session破棄後、対象Tableが次のcolumn並び替えを安全に受けられるか現在状態を取得し直す。"
			}
		}
		RT_044 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_MODE "対象Tableの継続可否だけを現在モードへ反映する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_COMPLETE,Runtime_RV_COLUMN_LARGE_REORDER_CONFIRM,Runtime_RV_COLUMN_DND_CANCEL"
			properties {
				"runtime.RV_COLUMN_DND_COMPLETE.step.15" "対象Tableの継続可否だけを現在モードへ反映する。"
				"runtime.RV_COLUMN_LARGE_REORDER_CONFIRM.step.3" "対象Tableの継続可否だけを現在モードへ反映する。"
				"runtime.RV_COLUMN_DND_CANCEL.step.5" "対象Tableの継続可否だけを現在モードへ反映する。"
			}
		}
		RT_045 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "DnD Session終了を表示購読へ反映し、物理DnD表示を終了する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONFIRM"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONFIRM.step.1" "DnD Session終了を表示購読へ反映し、物理DnD表示を終了する。"
			}
		}
		RT_046 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "Session破棄後の対象Table利用可否を取得し直す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONFIRM,Runtime_RV_COLUMN_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONFIRM.step.2" "Session破棄後の対象Table利用可否を取得し直す。"
				"runtime.RV_COLUMN_CURRENT_STATE_RECOVERY.step.4" "Session破棄後の対象Table利用可否を取得し直す。"
			}
		}
		RT_047 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_REORDER_APPLY "DnD Session終了後に確定済み列移動意図を確認付き大規模反映として引き渡す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONFIRM"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONFIRM.step.4" "DnD Session終了後に確定済み列移動意図を確認付き大規模反映として引き渡す。"
			}
		}
		RT_048 = RESP_COLUMN_REORDER_APPLY -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "confirming状態をWordPress表示接続へ公開する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONFIRM"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONFIRM.step.5" "confirming状態をWordPress表示接続へ公開する。"
			}
		}
		RT_049 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "対象Tableの通常編集表示を維持したまま確認UIを表示する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONFIRM"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONFIRM.step.6" "対象Tableの通常編集表示を維持したまま確認UIを表示する。"
			}
		}
		RT_050 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "利用者が確認UIでContinueを選択する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.1" "利用者が確認UIでContinueを選択する。"
			}
		}
		RT_051 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_COLUMN_REORDER_APPLY "確認待ちの移動意図を反映開始へ進める。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.2" "確認待ちの移動意図を反映開始へ進める。"
			}
		}
		RT_052 = RESP_COLUMN_REORDER_APPLY -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "applying状態をWordPress表示接続へ公開する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.3" "applying状態をWordPress表示接続へ公開する。"
			}
		}
		RT_053 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "対象Tableの通常編集表示を一時的に退避し、反映中表示を先に成立させる。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.4" "対象Tableの通常編集表示を一時的に退避し、反映中表示を先に成立させる。"
			}
		}
		RT_054 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_COLUMN_REORDER_APPLY "反映中表示成立後に確定処理を進める。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.5" "反映中表示成立後に確定処理を進める。"
			}
		}
		RT_055 = RESP_COLUMN_REORDER_APPLY -> RESP_COLUMN_TABLE_INTEGRATION "現在の列制約を取得し、保持中の移動元・移動先を再照合する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.6" "現在の列制約を取得し、保持中の移動元・移動先を再照合する。"
			}
		}
		RT_056 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_COLUMN_REORDER_APPLY "現在列制約または利用不能結果を返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.8" "現在列制約または利用不能結果を返す。"
			}
		}
		RT_057 = RESP_COLUMN_REORDER_APPLY -> RESP_COLUMN_TABLE_INTEGRATION "現在も成立する場合だけ確定済み列移動を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.9" "現在も成立する場合だけ確定済み列移動を要求する。"
			}
		}
		RT_058 = RESP_COLUMN_REORDER_APPLY -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "Table更新後にediting surface restorationへ進んだことを公開する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.12" "Table更新後にediting surface restorationへ進んだことを公開する。"
			}
		}
		RT_059 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "更新後のTable編集表示を再成立させる。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.13" "更新後のTable編集表示を再成立させる。"
			}
		}
		RT_060 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_COLUMN_REORDER_APPLY "表示復帰完了を通知して方向固有Apply Lifecycleをidleへ完了させる。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE,Runtime_RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CONTINUE.step.14" "表示復帰完了を通知して方向固有Apply Lifecycleをidleへ完了させる。"
				"runtime.RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE.step.6" "表示復帰完了を通知して方向固有Apply Lifecycleをidleへ完了させる。"
			}
		}
		RT_061 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "利用者が確認UIでCancelを選択する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CANCEL"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CANCEL.step.1" "利用者が確認UIでCancelを選択する。"
			}
		}
		RT_062 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_COLUMN_REORDER_APPLY "確認待ちの移動意図を破棄する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CANCEL"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CANCEL.step.2" "確認待ちの移動意図を破棄する。"
			}
		}
		RT_063 = RESP_COLUMN_REORDER_APPLY -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "Tableを変更せずidleへ戻った状態を公開する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CANCEL"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CANCEL.step.3" "Tableを変更せずidleへ戻った状態を公開する。"
			}
		}
		RT_064 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "確認UIを終了し、対象Tableの通常編集表示を維持する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_CANCEL"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_CANCEL.step.4" "確認UIを終了し、対象Tableの通常編集表示を維持する。"
			}
		}
		RT_065 = RESP_COLUMN_REORDER_APPLY -> RESP_COLUMN_TABLE_INTEGRATION "反映直前の現在列制約を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE.step.1" "反映直前の現在列制約を要求する。"
			}
		}
		RT_066 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_COLUMN_REORDER_APPLY "移動元または移動先が成立しない現在状態を返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE.step.3" "移動元または移動先が成立しない現在状態を返す。"
			}
		}
		RT_067 = RESP_COLUMN_REORDER_APPLY -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "Tableを更新せずediting surface restorationへ進んだことを公開する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE.step.4" "Tableを更新せずediting surface restorationへ進んだことを公開する。"
			}
		}
		RT_068 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "対象Tableの編集表示を再成立させる。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE"
			properties {
				"runtime.RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE.step.5" "対象Tableの編集表示を再成立させる。"
			}
		}
		RT_069 = EXT_DND_ENGINE -> RESP_COLUMN_DND_ENGINE_INTEGRATION "cancelまたは物理DnD endを通知する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_CANCEL"
			properties {
				"runtime.RV_COLUMN_DND_CANCEL.step.1" "cancelまたは物理DnD endを通知する。"
			}
		}
		RT_070 = RESP_COLUMN_DND_ENGINE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "cancel、またはcomplete時の有効移動先なしとしてSession終了へ接続する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_CANCEL"
			properties {
				"runtime.RV_COLUMN_DND_CANCEL.step.2" "cancel、またはcomplete時の有効移動先なしとしてSession終了へ接続する。"
			}
		}
		RT_071 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "DnD中表示を終了し、異常終了通知を要求しない。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_CANCEL"
			properties {
				"runtime.RV_COLUMN_DND_CANCEL.step.3" "DnD中表示を終了し、異常終了通知を要求しない。"
			}
		}
		RT_072 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "Session破棄後、対象Tableが次の列並び替えを安全に受けられるか現在状態を取得し直す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_DND_CANCEL"
			properties {
				"runtime.RV_COLUMN_DND_CANCEL.step.4" "Session破棄後、対象Tableが次の列並び替えを安全に受けられるか現在状態を取得し直す。"
			}
		}
		RT_073 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "complete時の現在列制約または確定済み列移動の反映を要求する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.RV_COLUMN_CURRENT_STATE_RECOVERY.step.1" "complete時の現在列制約または確定済み列移動の反映を要求する。"
			}
		}
		RT_074 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_COLUMN_DND_INTERACTION "現在Table利用不能または更新不能を安全な確定不能結果として返す。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.RV_COLUMN_CURRENT_STATE_RECOVERY.step.2" "現在Table利用不能または更新不能を安全な確定不能結果として返す。"
			}
		}
		RT_075 = RESP_COLUMN_DND_INTERACTION -> RESP_COLUMN_PRESENTATION "Sessionを終了し、Designで通知対象となる場合だけ一回性終了通知を発行する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.RV_COLUMN_CURRENT_STATE_RECOVERY.step.3" "Sessionを終了し、Designで通知対象となる場合だけ一回性終了通知を発行する。"
			}
		}
		RT_076 = RESP_COLUMN_DND_INTERACTION -> RESP_REORDER_MODE "対象Tableで次の列並び替えを安全に受けられるかだけを現在モードへ反映する。" {
			tags "Runtime Interaction,Runtime_RV_COLUMN_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.RV_COLUMN_CURRENT_STATE_RECOVERY.step.5" "対象Tableで次の列並び替えを安全に受けられるかだけを現在モードへ反映する。"
			}
		}
	}

	views {
		systemLandscape "DV_COLUMN_RESPONSIBILITY" {
			title "Structural Dependencies - Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES EXT_SCROLL_AREA EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_DESTINATION_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_COLUMN_REORDER_APPLY
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_COLUMN_EDITOR_INTEGRATION" {
			title "Structural Dependencies - Editor Integration"
			include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_COLUMN_REORDER_APPLY
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_COLUMN_DND_CORE" {
			title "Structural Dependencies - DnD Core"
			include EXT_DND_ENGINE EXT_SCROLL_AREA RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_DESTINATION_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_REORDER_APPLY_POLICY RESP_COLUMN_REORDER_APPLY
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_COLUMN_FEEDBACK" {
			title "Structural Dependencies - DnD Feedback"
			include EXT_DND_ENGINE RESP_EDITOR_DOM_CONTEXT RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_COLUMN_DATA_UPDATE" {
			title "Structural Dependencies - Table Update"
			include EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_DND_INTERACTION RESP_REORDER_APPLY_POLICY RESP_COLUMN_REORDER_APPLY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "PV_COLUMN_REORDER_END_TO_END" {
			title "Process Flow - Column Reorder End-to-End"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TARGET_RESOLUTION EXT_DND_ENGINE RESP_COLUMN_DESTINATION_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK
			exclude "relationship.tag!=ProcessFlow_PV_COLUMN_REORDER_END_TO_END"
			autoLayout lr
		}

		custom "PV_COLUMN_LARGE_REORDER_APPLY" {
			title "Process Flow - Large Column Reorder Apply"
			include RESP_COLUMN_DND_INTERACTION RESP_REORDER_APPLY_POLICY RESP_COLUMN_REORDER_APPLY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR RESP_COLUMN_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO
			exclude "relationship.tag!=ProcessFlow_PV_COLUMN_LARGE_REORDER_APPLY"
			autoLayout lr
		}

		custom "PV_COLUMN_EXTERNAL_CHANGE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - External Environment Change and Recovery"
			include EXT_DND_ENGINE RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=ProcessFlow_PV_COLUMN_EXTERNAL_CHANGE_RECOVERY"
			autoLayout lr
		}

		custom "RV_COLUMN_DND_START" {
			title "Runtime - Column DnD start attempt"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_INPUT_INTERACTION RESP_COLUMN_TARGET_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK RESP_COLUMN_PRESENTATION EXT_DND_ENGINE RESP_COLUMN_DESTINATION_RESOLUTION EXT_SCROLL_AREA RESP_COLUMN_DND_INTERACTION
			exclude "relationship.tag!=Runtime_RV_COLUMN_DND_START"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006;7=RT_007;8=RT_008;9=RT_009;10=RT_010;11=RT_011;12=RT_012;13=RT_006;14=RT_013;15=RT_014;16=RT_015;17=RT_016;18=RT_017;19=RT_018;20=RT_019"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_DND_PROGRESS" {
			title "Runtime - Column DnD progress"
			include EXT_DND_ENGINE RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_DESTINATION_RESOLUTION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION EXT_SCROLL_AREA
			exclude "relationship.tag!=Runtime_RV_COLUMN_DND_PROGRESS"
			properties {
				"runtime.steps" "1=RT_020;2=RT_021;3=RT_022;4=RT_023;5=RT_024;6=RT_025;7=RT_026;8=RT_027;9=RT_028;10=RT_029"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_DND_COMPLETE" {
			title "Runtime - Column DnD complete"
			include EXT_DND_ENGINE RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK RESP_REORDER_APPLY_POLICY EXT_WORDPRESS_UNDO RESP_COLUMN_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_COLUMN_DND_COMPLETE"
			properties {
				"runtime.steps" "1=RT_030;2=RT_031;3=RT_032;4=RT_033;5=RT_034;6=RT_035;7=RT_036;8=RT_037;9=RT_038;10=RT_039;11=RT_040;12=RT_041;13=RT_042;14=RT_043;15=RT_044"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_LARGE_REORDER_CONFIRM" {
			title "Runtime - Column large reorder confirmation"
			include RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION RESP_COLUMN_TABLE_INTEGRATION RESP_REORDER_MODE RESP_COLUMN_REORDER_APPLY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR
			exclude "relationship.tag!=Runtime_RV_COLUMN_LARGE_REORDER_CONFIRM"
			properties {
				"runtime.steps" "1=RT_045;2=RT_046;3=RT_044;4=RT_047;5=RT_048;6=RT_049"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_LARGE_REORDER_CONTINUE" {
			title "Runtime - Column large reorder continue"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_COLUMN_REORDER_APPLY RESP_COLUMN_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO
			exclude "relationship.tag!=Runtime_RV_COLUMN_LARGE_REORDER_CONTINUE"
			properties {
				"runtime.steps" "1=RT_050;2=RT_051;3=RT_052;4=RT_053;5=RT_054;6=RT_055;7=RT_033;8=RT_056;9=RT_057;10=RT_040;11=RT_041;12=RT_058;13=RT_059;14=RT_060"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_LARGE_REORDER_CANCEL" {
			title "Runtime - Column large reorder cancel"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_COLUMN_REORDER_APPLY
			exclude "relationship.tag!=Runtime_RV_COLUMN_LARGE_REORDER_CANCEL"
			properties {
				"runtime.steps" "1=RT_061;2=RT_062;3=RT_063;4=RT_064"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE" {
			title "Runtime - Column large reorder revalidation failure"
			include RESP_COLUMN_REORDER_APPLY RESP_COLUMN_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR
			exclude "relationship.tag!=Runtime_RV_COLUMN_LARGE_REORDER_REVALIDATION_FAILURE"
			properties {
				"runtime.steps" "1=RT_065;2=RT_033;3=RT_066;4=RT_067;5=RT_068;6=RT_060"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_DND_CANCEL" {
			title "Runtime - Column DnD cancel or invalid drop"
			include EXT_DND_ENGINE RESP_COLUMN_DND_ENGINE_INTEGRATION RESP_COLUMN_DND_INTERACTION RESP_COLUMN_PRESENTATION RESP_COLUMN_TABLE_INTEGRATION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_COLUMN_DND_CANCEL"
			properties {
				"runtime.steps" "1=RT_069;2=RT_070;3=RT_071;4=RT_072;5=RT_044"
			}
			autoLayout lr
		}

		custom "RV_COLUMN_CURRENT_STATE_RECOVERY" {
			title "Runtime - Column DnD current-state recovery"
			include RESP_COLUMN_DND_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_COLUMN_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_COLUMN_CURRENT_STATE_RECOVERY"
			properties {
				"runtime.steps" "1=RT_073;2=RT_074;3=RT_075;4=RT_046;5=RT_076"
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
