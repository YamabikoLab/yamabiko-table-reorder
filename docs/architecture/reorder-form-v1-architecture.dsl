// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "対応Tableの入口、RF入力画面、確認、反映中表示、通知、および通常編集環境を提供する。" {
			tags "External Context,External System"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_SUPPORTED_TABLE_BLOCK = element "Supported Table Block" "External Block" "Core TableまたはFlexible Table Blockとして、方向固有Table Integrationが構造取得と確定更新を行う対象を提供する。" {
			tags "External Context,External Block"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_WORDPRESS_UNDO = element "WordPress Undo" "External Capability" "成立した一回のRF並び替えを一回のUndoで戻せる更新単位を提供する。" {
			tags "External Context,External Capability"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_WORDPRESS_PREFERENCES = element "WordPress Preferences" "External Capability" "PC / タッチごとの共通初回案内表示済み状態を永続化する。" {
			tags "External Context,External Capability"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}

		RESP_REORDER_MODE = element "Reorder Mode" "Responsibility" "edit / row / columnの排他状態と対象Tableを所有する共通状態責務。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Common")
			}
		}
		RESP_REORDER_GUIDANCE = element "Reorder Guidance" "Responsibility" "現在どのTableへどの操作環境の共通入口案内を表示しているかという一時状態を所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Common")
			}
		}
		RESP_REORDER_APPLY_POLICY = element "Reorder Apply Policy" "Responsibility" "更新対象セル数から通常反映か確認付き大規模反映かを選択する共通方針責務。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Common")
			}
		}
		RESP_EDITOR_DOM_CONTEXT = element "Editor DOM Context" "Responsibility" "現在のEditor DOM基準から同じ表示環境のDOM / Web API contextを要求時点で解決する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Editor Integration")
			}
		}
		RESP_WORDPRESS_REORDER_INTEGRATION = element "WordPress Reorder Integration" "Responsibility" "Row / Column / RF入口、RF入力画面、現在Table、および相互排他をWordPress Editorへ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_WORDPRESS_REORDER_APPLY_INTEGRATION = element "WordPress Reorder Apply Integration" "Responsibility" "Reorder Apply状態を確認、反映中表示、表示復帰へ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_REORDER_GUIDANCE_INTEGRATION = element "Reorder Guidance Integration" "Responsibility" "共通初回案内をEditor環境、Preferences、および各Reorder入口へ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_RF_INTERACTION = element "RF Interaction" "Responsibility" "RF Session、対象Table、方向、利用者入力、現在評価、Apply要求、および未提示のApply結果を所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_RF_INPUT_INTERPRETATION = element "RF Input Interpretation" "Responsibility" "利用者入力と現在入力範囲 / 選択肢を解釈し、方向固有Resolution向け内部指定を生成する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_RF_ROW_RESOLUTION = element "Row RF Resolution" "Responsibility" "Row指定を現在Tableへ照合し、成立候補、no-op、構造拒否、利用不能を解決する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_RF_COLUMN_RESOLUTION = element "Column RF Resolution" "Responsibility" "Column指定を現在Tableへ照合し、成立候補、no-op、構造拒否、利用不能を解決する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_RF_APPLY_COORDINATION = element "RF Apply Coordination" "Responsibility" "RF候補の再照合、反映経路選択、確認、確定更新、表示復帰、結果確定までのLifecycleを所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_ROW_TABLE_INTEGRATION = element "Row Table Integration" "Responsibility" "現在のRow構造、診断、Apply評価、および確定行移動の最終権威を提供する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_COLUMN_TABLE_INTEGRATION = element "Column Table Integration" "Responsibility" "現在のColumn構造、RF用列記述、診断、Apply評価、および確定列移動の最終権威を提供する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}

		DEP_001 = RESP_EDITOR_DOM_CONTEXT -> EXT_WORDPRESS_EDITOR "現在のEditor DOM基準と同じ表示環境のcontextを解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "Reorder入口、RF入力画面、現在TableのEditor接続に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "RF開始時のDnDモード終了と入口排他に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_004 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "RF Sessionと現在表示状態をEditorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_005 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "確認、反映中表示、表示復帰をEditorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_006 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "RF Apply状態、確認summary、表示復帰位置を利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_EDITOR "初回案内をEditorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_PREFERENCES "操作環境別の案内済み状態を永続化するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_EDITOR_DOM_CONTEXT "現在の操作環境を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_GUIDANCE "現在の共通案内状態を開始・終了するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_MODE "Row / Column入口選択を案内終了条件として扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_RF_INTERACTION "RF入口選択を案内終了条件として扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在入力を内部指定へ解釈するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "Row指定を現在Tableへ解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "Column指定を現在Tableへ解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "成立候補を反映しApply結果を受けるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_RF_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "Row入力範囲を現在Tableから取得するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = RESP_RF_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "Column入力選択肢を現在Tableから取得するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_019 = RESP_RF_ROW_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "現在のRow構造と診断を利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_020 = RESP_RF_COLUMN_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "現在のColumn構造と診断を利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_021 = RESP_RF_APPLY_COORDINATION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から反映経路を選択するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_022 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Row候補のApply評価と確定更新に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_023 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Column候補のApply評価と確定更新に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_024 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在のtbody構造取得と行順更新に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_025 = RESP_ROW_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "一回の成立した行移動を一回のUndo単位として維持するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_026 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在の論理列構造取得と列順更新に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_027 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "一回の成立した列移動を一回のUndo単位として維持するために必要とする。" {
			tags "Structural Dependency"
		}

		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "対応TableのRF操作がWordPress接続境界へ入る。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "RF開始前に同一Tableの方向固有Reorder Modeを終了する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "対象TableとともにRF入力Lifecycleを開始・表示接続する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_004 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在の入力範囲 / 選択肢と利用者入力を内部指定へ解釈する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_005 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "Row指定を要求時点の現在Tableへ解決する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_006 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "Column指定を要求時点の現在Tableへ解決する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_007 = RESP_RF_ROW_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "Row構造と診断を現在Tableから取得する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_008 = RESP_RF_COLUMN_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "Column構造と診断を現在Tableから取得する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_009 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "成立した候補の反映を要求する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_010 = RESP_RF_APPLY_COORDINATION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から反映経路を選択する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_011 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Row候補の再照合と確定更新を要求する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_012 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Column候補の再照合と確定更新を要求する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_013 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "Apply状態と表示復帰要求をWordPress表示接続へ公開する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_014 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "表示復帰後に確定したsuccess / failureをRF Lifecycleへ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_015 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_ROW_RESOLUTION "[failure] Row指定を現在Tableへ安全に解決できない、または構造制約に抵触することを返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_016 = RESP_RF_ROW_RESOLUTION -> RESP_RF_INTERACTION "[recovery] Rowの利用不能、構造拒否、no-opを現在RF状態へ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_017 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_COLUMN_RESOLUTION "[failure] Column指定を現在Tableへ安全に解決できない、または構造制約に抵触することを返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_018 = RESP_RF_COLUMN_RESOLUTION -> RESP_RF_INTERACTION "[recovery] Columnの利用不能、構造拒否、no-opを現在RF状態へ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_019 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[failure] Row候補のApply再照合不成立または更新不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_020 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[failure] Column候補のApply再照合不成立または更新不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_021 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[recovery] Cancelまたは表示復帰完了をRF Apply Lifecycleへ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_022 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "[recovery] Tableを不完全に変更しないfailure、またはTable未変更のCancelをRFへ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}

		RT_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "利用者が対象TableのRF入口を選択する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.1" "利用者が対象TableのRF入口を選択する。"
			}
		}
		RT_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "同一Tableで方向固有モードが有効なら通常編集へ戻す。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.2" "同一Tableで方向固有モードが有効なら通常編集へ戻す。"
			}
		}
		RT_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "対象TableでRF Sessionを開始する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.3" "対象TableでRF Sessionを開始する。"
			}
		}
		RT_004 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "現在のRF入力状態を表示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.4" "現在のRF入力状態を表示する。"
			}
		}
		RT_005 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "利用者がRow / Column方向を切り替える。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.5" "利用者がRow / Column方向を切り替える。"
			}
		}
		RT_006 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "現在方向を切り替える。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.6" "現在方向を切り替える。"
			}
		}
		RT_007 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "新しい方向の現在状態を表示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.7" "新しい方向の現在状態を表示する。"
			}
		}
		RT_008 = EXT_SUPPORTED_TABLE_BLOCK -> RESP_WORDPRESS_REORDER_INTEGRATION "対象Tableの現在内容または構造が変化する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.1" "対象Tableの現在内容または構造が変化する。"
			}
		}
		RT_009 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "現在Tableを基準とするRF評価更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.2" "現在Tableを基準とするRF評価更新を要求する。"
			}
		}
		RT_010 = RESP_RF_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "Row選択時は現在行範囲を再取得する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.3" "Row選択時は現在行範囲を再取得する。"
			}
		}
		RT_011 = RESP_RF_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "Column選択時は現在列記述を再取得する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.4" "Column選択時は現在列記述を再取得する。"
			}
		}
		RT_012 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "保持中の入力を現在範囲 / 選択肢へ再解釈する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.5" "保持中の入力を現在範囲 / 選択肢へ再解釈する。"
			}
		}
		RT_013 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "Rowのready指定を現在Tableへ再解決する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.6" "Rowのready指定を現在Tableへ再解決する。"
			}
		}
		RT_014 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "Columnのready指定を現在Tableへ再解決する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.7" "Columnのready指定を現在Tableへ再解決する。"
			}
		}
		RT_015 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "再評価後の実行可否と理由を表示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.8" "再評価後の実行可否と理由を表示する。"
			}
		}
		RT_016 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "利用者がRF入力を変更する。" {
			tags "Runtime Interaction,Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.RV_RF_RESOLUTION.step.1" "利用者がRF入力を変更する。"
			}
		}
		RT_017 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "現在入力をRF Sessionへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.RV_RF_RESOLUTION.step.2" "現在入力をRF Sessionへ渡す。"
			}
		}
		RT_018 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在入力を内部指定へ解釈する。" {
			tags "Runtime Interaction,Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.RV_RF_RESOLUTION.step.3" "現在入力を内部指定へ解釈する。"
			}
		}
		RT_019 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "Rowのready指定を現在Tableへ解決する。" {
			tags "Runtime Interaction,Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.RV_RF_RESOLUTION.step.4" "Rowのready指定を現在Tableへ解決する。"
			}
		}
		RT_020 = RESP_RF_ROW_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "現在Row構造と診断を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.RV_RF_RESOLUTION.step.5" "現在Row構造と診断を要求する。"
			}
		}
		RT_021 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "Columnのready指定を現在Tableへ解決する。" {
			tags "Runtime Interaction,Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.RV_RF_RESOLUTION.step.6" "Columnのready指定を現在Tableへ解決する。"
			}
		}
		RT_022 = RESP_RF_COLUMN_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "現在Column構造と診断を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.RV_RF_RESOLUTION.step.7" "現在Column構造と診断を要求する。"
			}
		}
		RT_023 = RESP_RF_ROW_RESOLUTION -> RESP_RF_INTERACTION "Rowの成立候補、no-op、構造拒否、利用不能を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.RV_RF_RESOLUTION.step.8" "Rowの成立候補、no-op、構造拒否、利用不能を返す。"
			}
		}
		RT_024 = RESP_RF_COLUMN_RESOLUTION -> RESP_RF_INTERACTION "Columnの成立候補、no-op、構造拒否、利用不能を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.RV_RF_RESOLUTION.step.9" "Columnの成立候補、no-op、構造拒否、利用不能を返す。"
			}
		}
		RT_025 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "現在評価に応じて実行可否と理由を表示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.RV_RF_RESOLUTION.step.10" "現在評価に応じて実行可否と理由を表示する。"
			}
		}
		RT_026 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "利用者が成立候補の並び替えを要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.1" "利用者が成立候補の並び替えを要求する。"
			}
		}
		RT_027 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "Apply要求をRF Sessionへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.2" "Apply要求をRF Sessionへ渡す。"
			}
		}
		RT_028 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "現在の成立候補を渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.3" "現在の成立候補を渡す。"
			}
		}
		RT_029 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Rowの場合は現在TableでApply評価を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.4" "Rowの場合は現在TableでApply評価を要求する。"
			}
		}
		RT_030 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Columnの場合は現在TableでApply評価を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.5" "Columnの場合は現在TableでApply評価を要求する。"
			}
		}
		RT_031 = RESP_RF_APPLY_COORDINATION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から反映経路を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.6" "更新対象セル数から反映経路を要求する。"
			}
		}
		RT_032 = RESP_REORDER_APPLY_POLICY -> RESP_RF_APPLY_COORDINATION "通常反映を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.7" "通常反映を返す。"
			}
		}
		RT_033 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Rowの場合は現在Tableを最終確認して一回の確定更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.8" "Rowの場合は現在Tableを最終確認して一回の確定更新を要求する。"
			}
		}
		RT_034 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Columnの場合は現在Tableを最終確認して一回の確定更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.9" "Columnの場合は現在Tableを最終確認して一回の確定更新を要求する。"
			}
		}
		RT_035 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "更新成功時に表示復帰を要求し、最終位置を公開する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.10" "更新成功時に表示復帰を要求し、最終位置を公開する。"
			}
		}
		RT_036 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "更新後の対象Table editing surfaceを再成立させる。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.11" "更新後の対象Table editing surfaceを再成立させる。"
			}
		}
		RT_037 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "表示復帰完了を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.12" "表示復帰完了を返す。"
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.13" "表示復帰完了を返す。"
			}
		}
		RT_038 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "successを返す。更新不成立時はTableを不完全に変更せずfailureを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.13" "successを返す。更新不成立時はTableを不完全に変更せずfailureを返す。"
			}
		}
		RT_039 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "successではRFを終了して一度だけ通知し、failureでは入力を保持したRFと一度だけの失敗通知を表示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.14" "successではRFを終了して一度だけ通知し、failureでは入力を保持したRFと一度だけの失敗通知を表示する。"
			}
		}
		RT_040 = RESP_REORDER_APPLY_POLICY -> RESP_RF_APPLY_COORDINATION "確認付き大規模反映を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.1" "確認付き大規模反映を返す。"
			}
		}
		RT_041 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "確認状態と確認用Move summaryを公開する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.2" "確認状態と確認用Move summaryを公開する。"
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.1" "確認状態と確認用Move summaryを公開する。"
			}
		}
		RT_042 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "対象Tableを維持したまま確認UIを表示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.3" "対象Tableを維持したまま確認UIを表示する。"
			}
		}
		RT_043 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "利用者がContinueを選択する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.4" "利用者がContinueを選択する。"
			}
		}
		RT_044 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Continueを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.5" "Continueを返す。"
			}
		}
		RT_045 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "反映準備状態を公開する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.6" "反映準備状態を公開する。"
			}
		}
		RT_046 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "対象Tableの競合編集を抑止し、反映中表示を成立させる。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.7" "対象Tableの競合編集を抑止し、反映中表示を成立させる。"
			}
		}
		RT_047 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "反映準備完了を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.8" "反映準備完了を返す。"
			}
		}
		RT_048 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Rowの場合は現在Tableを再評価し、成立時だけ一回の確定更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.9" "Rowの場合は現在Tableを再評価し、成立時だけ一回の確定更新を要求する。"
			}
		}
		RT_049 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Columnの場合は現在Tableを再評価し、成立時だけ一回の確定更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.10" "Columnの場合は現在Tableを再評価し、成立時だけ一回の確定更新を要求する。"
			}
		}
		RT_050 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "success / failureにかかわらず表示復帰を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.11" "success / failureにかかわらず表示復帰を要求する。"
			}
		}
		RT_051 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "更新後または未変更のediting surfaceを再成立させる。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.12" "更新後または未変更のediting surfaceを再成立させる。"
			}
		}
		RT_052 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "successまたはfailureを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.14" "successまたはfailureを返す。"
			}
		}
		RT_053 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "successではRFを終了し、failureでは入力を保持したRFを表示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.15" "successではRFを終了し、failureでは入力を保持したRFを表示する。"
			}
		}
		RT_054 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "確認UIを表示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.2" "確認UIを表示する。"
			}
		}
		RT_055 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "利用者がCancelを選択する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.3" "利用者がCancelを選択する。"
			}
		}
		RT_056 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Cancelを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.4" "Cancelを返す。"
			}
		}
		RT_057 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "Table未変更のCancelを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.5" "Table未変更のCancelを返す。"
			}
		}
		RT_058 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "入力を保持したRFへ戻る。failure通知は表示しない。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.6" "入力を保持したRFへ戻る。failure通知は表示しない。"
			}
		}
	}

	views {
		systemLandscape "DV_RF_RESPONSIBILITY" {
			title "Structural Dependencies - Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_REORDER_APPLY_POLICY RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_RF_EDITOR_INTEGRATION" {
			title "Structural Dependencies - Editor Integration"
			include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_RF_RESOLUTION" {
			title "Structural Dependencies - RF Resolution"
			include EXT_SUPPORTED_TABLE_BLOCK RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_RF_APPLY" {
			title "Structural Dependencies - RF Apply"
			include EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "PV_RF_REORDER_END_TO_END" {
			title "Process Flow - RF Reorder End-to-End"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_MODE RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_APPLY_COORDINATION RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION
			exclude "relationship.tag!=ProcessFlow_PV_RF_REORDER_END_TO_END"
			autoLayout lr
		}

		custom "PV_RF_REJECTION_RECOVERY" {
			title "Process Flow [Failure / Recovery] - RF Rejection and Recovery"
			include RESP_ROW_TABLE_INTEGRATION RESP_RF_ROW_RESOLUTION RESP_RF_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION
			exclude "relationship.tag!=ProcessFlow_PV_RF_REJECTION_RECOVERY"
			autoLayout lr
		}

		custom "RV_RF_OPEN_DIRECTION" {
			title "Runtime - RF open and direction switch"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_MODE RESP_RF_INTERACTION
			exclude "relationship.tag!=Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006;7=RT_007"
			}
			autoLayout lr
		}

		custom "RV_RF_CURRENT_TABLE_REEVALUATION" {
			title "Runtime - RF current-table reevaluation"
			include EXT_SUPPORTED_TABLE_BLOCK RESP_WORDPRESS_REORDER_INTEGRATION RESP_RF_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION EXT_WORDPRESS_EDITOR
			exclude "relationship.tag!=Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.steps" "1=RT_008;2=RT_009;3=RT_010;4=RT_011;5=RT_012;6=RT_013;7=RT_014;8=RT_015"
			}
			autoLayout lr
		}

		custom "RV_RF_RESOLUTION" {
			title "Runtime - RF resolution"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_RF_COLUMN_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION
			exclude "relationship.tag!=Runtime_RV_RF_RESOLUTION"
			properties {
				"runtime.steps" "1=RT_016;2=RT_017;3=RT_018;4=RT_019;5=RT_020;6=RT_021;7=RT_022;8=RT_023;9=RT_024;10=RT_025"
			}
			autoLayout lr
		}

		custom "RV_RF_NORMAL_APPLY" {
			title "Runtime - RF normal apply"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION
			exclude "relationship.tag!=Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.steps" "1=RT_026;2=RT_027;3=RT_028;4=RT_029;5=RT_030;6=RT_031;7=RT_032;8=RT_033;9=RT_034;10=RT_035;11=RT_036;12=RT_037;13=RT_038;14=RT_039"
			}
			autoLayout lr
		}

		custom "RV_RF_LARGE_APPLY_CONTINUE" {
			title "Runtime - RF large apply continue"
			include RESP_REORDER_APPLY_POLICY RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_INTERACTION RESP_WORDPRESS_REORDER_INTEGRATION
			exclude "relationship.tag!=Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.steps" "1=RT_040;2=RT_041;3=RT_042;4=RT_043;5=RT_044;6=RT_045;7=RT_046;8=RT_047;9=RT_048;10=RT_049;11=RT_050;12=RT_051;13=RT_037;14=RT_052;15=RT_053"
			}
			autoLayout lr
		}

		custom "RV_RF_LARGE_APPLY_CANCEL" {
			title "Runtime - RF large apply cancel"
			include RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR RESP_RF_INTERACTION RESP_WORDPRESS_REORDER_INTEGRATION
			exclude "relationship.tag!=Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.steps" "1=RT_041;2=RT_054;3=RT_055;4=RT_056;5=RT_057;6=RT_058"
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
