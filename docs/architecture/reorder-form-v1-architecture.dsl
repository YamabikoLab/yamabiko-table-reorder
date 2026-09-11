// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "対応Tableのツールバー、RF入力画面、確認、反映中表示、通知、および通常編集環境を提供する。" {
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
		EXT_WORDPRESS_PREFERENCES = element "WordPress Preferences" "External Capability" "共通初回案内の表示済み状態を永続化する。" {
			tags "External Context,External Capability"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}

		RESP_REORDER_MODE = element "Reorder Mode" "Responsibility" "`edit" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Common")
			}
		}
		RESP_REORDER_GUIDANCE = element "Reorder Guidance" "Responsibility" "現在どのTableへ共通入口案内を表示しているかという一時状態を所有する共通状態責務。" {
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
		RESP_WORDPRESS_REORDER_INTEGRATION = element "WordPress Reorder Integration" "Responsibility" "TableツールバーのRow / Column / RF入口、Reorder ModeとRFの排他、および現在TableをWordPress Editorへ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_WORDPRESS_REORDER_APPLY_INTEGRATION = element "WordPress Reorder Apply Integration" "Responsibility" "Reorder Apply状態をWordPress Editorの確認、反映中表示、editing surface restorationへ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_REORDER_GUIDANCE_INTEGRATION = element "Reorder Guidance Integration" "Responsibility" "共通初回案内の表示契機、WordPress Preferences永続化、およびRow / Column / RF入口選択による案内終了を接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_RF_INTERACTION = element "RF Interaction" "Responsibility" "RFのopen / close、対象Table、方向、利用者入力、入力保持、および成功 / 失敗後の入力Lifecycleを所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_RF_INPUT_INTERPRETATION = element "RF Input Interpretation" "Responsibility" "RFの利用者入力を方向固有Resolutionが解釈できる内部指定へ変換し、入力自体の有効性を判定する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_RF_ROW_RESOLUTION = element "Row RF Resolution" "Responsibility" "tbody行のRF指定を現在Tableへ照合し、移動前基準の確定候補、構造拒否、no-opを解決する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_RF_COLUMN_RESOLUTION = element "Column RF Resolution" "Responsibility" "論理列のRF指定を現在Tableへ照合し、移動前基準の確定候補、構造拒否、no-opを解決する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_RF_APPLY_COORDINATION = element "RF Apply Coordination" "Responsibility" "RF確定候補の反映経路選択、確認付き反映、反映直前再照合、成功 / 失敗、editing surface restorationまでのLifecycleを所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_ROW_TABLE_INTEGRATION = element "Row Table Integration" "Responsibility" "対応Tableの現在行制約、構造診断、更新対象セル数、確定済み行移動、およびUndo境界を提供する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_COLUMN_TABLE_INTEGRATION = element "Column Table Integration" "Responsibility" "対応Tableの論理列制約、RF用列記述、構造診断、更新対象セル数、確定済み列移動、およびUndo境界を提供する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}

		DEP_001 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "Tableツールバー、現在Table、RF入力画面の表示境界をWordPress Editorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "RF開始時の方向固有モード終了とRow / Column入口との排他を接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "RF入口から対象TableのRF Lifecycleを開始・終了し、RF表示中の排他を接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_004 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "確認UI、反映中表示、更新後のediting surfaceをWordPress Editorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_005 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "RFの確認付き反映状態をEditor表示へ接続し、Continue / Cancel / 表示復帰完了をLifecycleへ返すために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_006 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_EDITOR "RFを含む共通初回案内の表示契機と表示位置を接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_PREFERENCES "共通初回案内の表示済み状態を永続化するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_GUIDANCE "現在の共通入口案内状態を開始・終了するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_MODE "Row / Column入口選択を共通案内終了条件として扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_RF_INTERACTION "RF入口選択を共通案内終了条件として扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在方向の入力を安全に解釈し、入力自体の有効性を判断するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "Row選択時の指定を現在Tableへ照合し、行移動候補を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "Column選択時の指定を現在Tableへ照合し、列移動候補を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "成立した確定候補を反映し、成功 / 失敗結果をRF Lifecycleへ反映するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_RF_ROW_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "要求時点のtbody行制約と構造診断から行移動候補を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_RF_COLUMN_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "要求時点の論理列制約、列記述、構造診断から列移動候補を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_RF_APPLY_COORDINATION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から通常反映か確認付き大規模反映かを選択するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Row候補の更新対象セル数取得、反映直前再照合、確定行移動に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_019 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Column候補の更新対象セル数取得、反映直前再照合、確定列移動に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_020 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Block固有のtbody構造取得と行順更新を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_021 = RESP_ROW_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した一回の行移動を一回のUndo単位として維持するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_022 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Block固有の論理列構造取得、列記述取得、列順更新を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_023 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した一回の列移動を一回のUndo単位として維持するために必要とする。" {
			tags "Structural Dependency"
		}

		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "対応TableのRF入口操作がWordPress接続境界へ入る。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "RF開始前に同一Tableの方向固有Reorder Modeを終了する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "対象Table IdentityとともにRF入力Lifecycleを開始する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_004 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在方向の利用者入力を内部で解釈可能な指定へ変換する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_005 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "Row選択時の解釈済み指定を行移動候補として解決する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_006 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "Column選択時の解釈済み指定を列移動候補として解決する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_007 = RESP_RF_ROW_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "現在のtbody行制約と構造診断から行移動候補を解決する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_008 = RESP_RF_COLUMN_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "現在の論理列制約、列記述、構造診断から列移動候補を解決する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_009 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "成立し並び順が変わる確定候補の反映を要求する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_010 = RESP_RF_APPLY_COORDINATION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から通常反映または確認付き大規模反映を選択する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_011 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Row候補の再照合、更新対象セル数取得、確定更新を要求する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_012 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Column候補の再照合、更新対象セル数取得、確定更新を要求する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_013 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "確定結果をRF Lifecycleへ返し、成功時はRF終了、失敗時は入力画面復帰へ進める。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_014 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "confirmingまたはapplying状態をWordPress Editor表示接続へ公開する。" {
			tags "Process Flow,ProcessFlow_PV_RF_LARGE_APPLY,normal"
		}
		PF_015 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "確認UI、反映中表示、およびediting surface restorationを対象Tableへ接続する。" {
			tags "Process Flow,ProcessFlow_PV_RF_LARGE_APPLY,normal"
		}
		PF_016 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Continue、Cancel、反映表示成立、表示復帰完了をRF Apply Lifecycleへ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_LARGE_APPLY,normal"
		}
		PF_017 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "RowのContinue後に現在Tableを再照合し、成立時だけ確定更新する。" {
			tags "Process Flow,ProcessFlow_PV_RF_LARGE_APPLY,normal"
		}
		PF_018 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "ColumnのContinue後に現在Tableを再照合し、成立時だけ確定更新する。" {
			tags "Process Flow,ProcessFlow_PV_RF_LARGE_APPLY,normal"
		}
		PF_019 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "大規模反映の成功または失敗をRF入力Lifecycleへ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_LARGE_APPLY,normal"
		}
		PF_020 = RESP_RF_INPUT_INTERPRETATION -> RESP_RF_INTERACTION "[recovery] 未入力または有効に解釈できない入力をTable更新なしで現在入力状態へ反映する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_021 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_ROW_RESOLUTION "[failure] Row候補を成立させない現在構造または結合セル診断を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_022 = RESP_RF_ROW_RESOLUTION -> RESP_RF_INTERACTION "[recovery] Rowの構造拒否またはno-opを入力画面の現在結果へ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_023 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_COLUMN_RESOLUTION "[failure] Column候補を成立させない現在構造または結合セル診断を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_024 = RESP_RF_COLUMN_RESOLUTION -> RESP_RF_INTERACTION "[recovery] Columnの構造拒否またはno-opを入力画面の現在結果へ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_025 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[recovery] 確認Cancelまたはediting surface restoration完了をRF Apply Lifecycleへ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_026 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[failure] Rowの反映直前再照合不成立または更新不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_027 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[failure] Columnの反映直前再照合不成立または更新不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_028 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "[recovery] Tableを変更しない失敗結果を入力保持したRFへ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}

		RT_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "利用者が対象TableのRF入口を選択する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.1" "利用者が対象TableのRF入口を選択する。"
			}
		}
		RT_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "同一Tableで`row" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.2" "同一Tableで`row"
			}
		}
		RT_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "対象Table IdentityでRFを開始する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.3" "対象Table IdentityでRFを開始する。"
			}
		}
		RT_004 = RESP_RF_INTERACTION -> EXT_WORDPRESS_EDITOR "Rowを初期方向とするRF入力状態を表示へ反映する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.4" "Rowを初期方向とするRF入力状態を表示へ反映する。"
			}
		}
		RT_005 = EXT_WORDPRESS_EDITOR -> RESP_RF_INTERACTION "利用者がRow / Column方向を切り替える。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.5" "利用者がRow / Column方向を切り替える。"
			}
		}
		RT_006 = RESP_RF_INTERACTION -> EXT_WORDPRESS_EDITOR "新しい方向の入力状態へ切り替え、旧方向のエラー・構造拒否表示を現在表示から終了する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.RV_RF_OPEN_DIRECTION.step.6" "新しい方向の入力状態へ切り替え、旧方向のエラー・構造拒否表示を現在表示から終了する。"
			}
		}
		RT_007 = EXT_WORDPRESS_EDITOR -> RESP_RF_INTERACTION "利用者が移動元行、移動先行、上 / 下を入力する。" {
			tags "Runtime Interaction,Runtime_RV_RF_ROW_RESOLUTION"
			properties {
				"runtime.RV_RF_ROW_RESOLUTION.step.1" "利用者が移動元行、移動先行、上 / 下を入力する。"
			}
		}
		RT_008 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在のRow入力を解釈する。" {
			tags "Runtime Interaction,Runtime_RV_RF_ROW_RESOLUTION"
			properties {
				"runtime.RV_RF_ROW_RESOLUTION.step.2" "現在のRow入力を解釈する。"
			}
		}
		RT_009 = RESP_RF_INPUT_INTERPRETATION -> RESP_RF_INTERACTION "未完成、不正、または解釈済み0-based指定を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_ROW_RESOLUTION"
			properties {
				"runtime.RV_RF_ROW_RESOLUTION.step.3" "未完成、不正、または解釈済み0-based指定を返す。"
			}
		}
		RT_010 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "必要な指定が揃った場合だけRow候補の解決を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_ROW_RESOLUTION"
			properties {
				"runtime.RV_RF_ROW_RESOLUTION.step.4" "必要な指定が揃った場合だけRow候補の解決を要求する。"
			}
		}
		RT_011 = RESP_RF_ROW_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "要求時点のtbody行制約と必要な構造診断を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_ROW_RESOLUTION"
			properties {
				"runtime.RV_RF_ROW_RESOLUTION.step.5" "要求時点のtbody行制約と必要な構造診断を要求する。"
			}
		}
		RT_012 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在の対応TableからRow構造を解釈する。" {
			tags "Runtime Interaction,Runtime_RV_RF_ROW_RESOLUTION"
			properties {
				"runtime.RV_RF_ROW_RESOLUTION.step.6" "現在の対応TableからRow構造を解釈する。"
			}
		}
		RT_013 = RESP_RF_ROW_RESOLUTION -> RESP_RF_INTERACTION "resolved、blocking merged rangeを伴う構造拒否、またはno-opを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_ROW_RESOLUTION"
			properties {
				"runtime.RV_RF_ROW_RESOLUTION.step.7" "resolved、blocking merged rangeを伴う構造拒否、またはno-opを返す。"
			}
		}
		RT_014 = RESP_RF_INTERACTION -> EXT_WORDPRESS_EDITOR "現在結果に応じて実行可否と理由表示を更新する。" {
			tags "Runtime Interaction,Runtime_RV_RF_ROW_RESOLUTION,Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.RV_RF_ROW_RESOLUTION.step.8" "現在結果に応じて実行可否と理由表示を更新する。"
				"runtime.RV_RF_COLUMN_RESOLUTION.step.10" "現在結果に応じて実行可否と理由表示を更新する。"
			}
		}
		RT_015 = RESP_RF_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "現在TableのRF用列記述を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.RV_RF_COLUMN_RESOLUTION.step.1" "現在TableのRF用列記述を要求する。"
			}
		}
		RT_016 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在のTable全体を論理列構造として解釈する。" {
			tags "Runtime Interaction,Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.RV_RF_COLUMN_RESOLUTION.step.2" "現在のTable全体を論理列構造として解釈する。"
			}
		}
		RT_017 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_INTERACTION "列Identity、列番号、利用可能な見出し表示値を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.RV_RF_COLUMN_RESOLUTION.step.3" "列Identity、列番号、利用可能な見出し表示値を返す。"
			}
		}
		RT_018 = EXT_WORDPRESS_EDITOR -> RESP_RF_INTERACTION "利用者が移動元列、移動先列、左 / 右を選択する。" {
			tags "Runtime Interaction,Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.RV_RF_COLUMN_RESOLUTION.step.4" "利用者が移動元列、移動先列、左 / 右を選択する。"
			}
		}
		RT_019 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在のColumn入力を解釈する。" {
			tags "Runtime Interaction,Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.RV_RF_COLUMN_RESOLUTION.step.5" "現在のColumn入力を解釈する。"
			}
		}
		RT_020 = RESP_RF_INPUT_INTERPRETATION -> RESP_RF_INTERACTION "未完成または解釈済み論理列指定を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.RV_RF_COLUMN_RESOLUTION.step.6" "未完成または解釈済み論理列指定を返す。"
			}
		}
		RT_021 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "必要な指定が揃った場合だけColumn候補の解決を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.RV_RF_COLUMN_RESOLUTION.step.7" "必要な指定が揃った場合だけColumn候補の解決を要求する。"
			}
		}
		RT_022 = RESP_RF_COLUMN_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "要求時点の論理列制約と必要な構造診断を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.RV_RF_COLUMN_RESOLUTION.step.8" "要求時点の論理列制約と必要な構造診断を要求する。"
			}
		}
		RT_023 = RESP_RF_COLUMN_RESOLUTION -> RESP_RF_INTERACTION "resolved、blocking merged rangeを伴う構造拒否、またはno-opを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.RV_RF_COLUMN_RESOLUTION.step.9" "resolved、blocking merged rangeを伴う構造拒否、またはno-opを返す。"
			}
		}
		RT_024 = EXT_WORDPRESS_EDITOR -> RESP_RF_INTERACTION "利用者が実行可能な指定で並び替えを要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.1" "利用者が実行可能な指定で並び替えを要求する。"
			}
		}
		RT_025 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "現在方向の解決済み確定候補を渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.2" "現在方向の解決済み確定候補を渡す。"
			}
		}
		RT_026 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Rowの場合は現在候補の更新対象セル数を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.3" "Rowの場合は現在候補の更新対象セル数を要求する。"
			}
		}
		RT_027 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Columnの場合は現在候補の更新対象セル数を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.4" "Columnの場合は現在候補の更新対象セル数を要求する。"
			}
		}
		RT_028 = RESP_RF_APPLY_COORDINATION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から反映経路を選択する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.5" "更新対象セル数から反映経路を選択する。"
			}
		}
		RT_029 = RESP_REORDER_APPLY_POLICY -> RESP_RF_APPLY_COORDINATION "通常反映を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.6" "通常反映を返す。"
			}
		}
		RT_030 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Rowの場合は現在Tableへの再照合後、成立時だけ一回の確定行移動を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.7" "Rowの場合は現在Tableへの再照合後、成立時だけ一回の確定行移動を要求する。"
			}
		}
		RT_031 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Columnの場合は現在Tableへの再照合後、成立時だけ一回の確定列移動を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.8" "Columnの場合は現在Tableへの再照合後、成立時だけ一回の確定列移動を要求する。"
			}
		}
		RT_032 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "成功またはTable未変更の失敗結果を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.9" "成功またはTable未変更の失敗結果を返す。"
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.14" "成功またはTable未変更の失敗結果を返す。"
			}
		}
		RT_033 = RESP_RF_INTERACTION -> EXT_WORDPRESS_EDITOR "成功時はRFを終了して完了通知を表示し、失敗時は入力を保持したRFへ戻す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.RV_RF_NORMAL_APPLY.step.10" "成功時はRFを終了して完了通知を表示し、失敗時は入力を保持したRFへ戻す。"
			}
		}
		RT_034 = RESP_REORDER_APPLY_POLICY -> RESP_RF_APPLY_COORDINATION "確認付き大規模反映を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.1" "確認付き大規模反映を返す。"
			}
		}
		RT_035 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "confirming状態を公開する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.2" "confirming状態を公開する。"
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.1" "confirming状態を公開する。"
			}
		}
		RT_036 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "対象Tableを維持したまま確認UIを表示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.3" "対象Tableを維持したまま確認UIを表示する。"
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.2" "対象Tableを維持したまま確認UIを表示する。"
			}
		}
		RT_037 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "利用者がContinueを選択する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.4" "利用者がContinueを選択する。"
			}
		}
		RT_038 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Continueを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.5" "Continueを返す。"
			}
		}
		RT_039 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "applying状態を公開する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.6" "applying状態を公開する。"
			}
		}
		RT_040 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "対象Tableの編集を抑止し、必要な反映中表示を先に成立させる。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.7" "対象Tableの編集を抑止し、必要な反映中表示を先に成立させる。"
			}
		}
		RT_041 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "反映表示成立を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.8" "反映表示成立を返す。"
			}
		}
		RT_042 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Rowの場合は現在Tableへ再照合し、成立時だけ一回の行更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.9" "Rowの場合は現在Tableへ再照合し、成立時だけ一回の行更新を要求する。"
			}
		}
		RT_043 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Columnの場合は現在Tableへ再照合し、成立時だけ一回の列更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.10" "Columnの場合は現在Tableへ再照合し、成立時だけ一回の列更新を要求する。"
			}
		}
		RT_044 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "editing surface restorationへ進む。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.11" "editing surface restorationへ進む。"
			}
		}
		RT_045 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "更新後または未変更のTable editing surfaceを再成立させる。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.12" "更新後または未変更のTable editing surfaceを再成立させる。"
			}
		}
		RT_046 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "表示復帰完了を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.13" "表示復帰完了を返す。"
			}
		}
		RT_047 = RESP_RF_INTERACTION -> EXT_WORDPRESS_EDITOR "成功時はRFを終了し、失敗時は入力を保持したRFへ戻す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CONTINUE.step.15" "成功時はRFを終了し、失敗時は入力を保持したRFへ戻す。"
			}
		}
		RT_048 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "利用者がCancelを選択する。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.3" "利用者がCancelを選択する。"
			}
		}
		RT_049 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Cancelを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.4" "Cancelを返す。"
			}
		}
		RT_050 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "Table未変更のcancel結果を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.5" "Table未変更のcancel結果を返す。"
			}
		}
		RT_051 = RESP_RF_INTERACTION -> EXT_WORDPRESS_EDITOR "入力内容を保持したRF入力画面へ戻る。" {
			tags "Runtime Interaction,Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.RV_RF_LARGE_APPLY_CANCEL.step.6" "入力内容を保持したRF入力画面へ戻る。"
			}
		}
	}

	views {
		systemLandscape "DV_RF_RESPONSIBILITY" {
			title "Structural Dependencies - Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_RF_EDITOR_INTEGRATION" {
			title "Structural Dependencies - Editor Integration"
			include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION
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
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_MODE RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_APPLY_COORDINATION RESP_REORDER_APPLY_POLICY
			exclude "relationship.tag!=ProcessFlow_PV_RF_REORDER_END_TO_END"
			autoLayout lr
		}

		custom "PV_RF_LARGE_APPLY" {
			title "Process Flow - RF Large Apply"
			include RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_INTERACTION
			exclude "relationship.tag!=ProcessFlow_PV_RF_LARGE_APPLY"
			autoLayout lr
		}

		custom "PV_RF_REJECTION_RECOVERY" {
			title "Process Flow [Failure / Recovery] - RF Rejection and Recovery"
			include RESP_RF_INPUT_INTERPRETATION RESP_RF_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_RF_ROW_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_COLUMN_RESOLUTION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_RF_APPLY_COORDINATION
			exclude "relationship.tag!=ProcessFlow_PV_RF_REJECTION_RECOVERY"
			autoLayout lr
		}

		custom "RV_RF_OPEN_DIRECTION" {
			title "Runtime - RF open and direction switch"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_MODE RESP_RF_INTERACTION
			exclude "relationship.tag!=Runtime_RV_RF_OPEN_DIRECTION"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006"
			}
			autoLayout lr
		}

		custom "RV_RF_ROW_RESOLUTION" {
			title "Runtime - RF row resolution"
			include EXT_WORDPRESS_EDITOR RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK
			exclude "relationship.tag!=Runtime_RV_RF_ROW_RESOLUTION"
			properties {
				"runtime.steps" "1=RT_007;2=RT_008;3=RT_009;4=RT_010;5=RT_011;6=RT_012;7=RT_013;8=RT_014"
			}
			autoLayout lr
		}

		custom "RV_RF_COLUMN_RESOLUTION" {
			title "Runtime - RF column resolution"
			include RESP_RF_INTERACTION RESP_COLUMN_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_EDITOR RESP_RF_INPUT_INTERPRETATION RESP_RF_COLUMN_RESOLUTION
			exclude "relationship.tag!=Runtime_RV_RF_COLUMN_RESOLUTION"
			properties {
				"runtime.steps" "1=RT_015;2=RT_016;3=RT_017;4=RT_018;5=RT_019;6=RT_020;7=RT_021;8=RT_022;9=RT_023;10=RT_014"
			}
			autoLayout lr
		}

		custom "RV_RF_NORMAL_APPLY" {
			title "Runtime - RF normal apply"
			include EXT_WORDPRESS_EDITOR RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_REORDER_APPLY_POLICY
			exclude "relationship.tag!=Runtime_RV_RF_NORMAL_APPLY"
			properties {
				"runtime.steps" "1=RT_024;2=RT_025;3=RT_026;4=RT_027;5=RT_028;6=RT_029;7=RT_030;8=RT_031;9=RT_032;10=RT_033"
			}
			autoLayout lr
		}

		custom "RV_RF_LARGE_APPLY_CONTINUE" {
			title "Runtime - RF large apply continue"
			include RESP_REORDER_APPLY_POLICY RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_INTERACTION
			exclude "relationship.tag!=Runtime_RV_RF_LARGE_APPLY_CONTINUE"
			properties {
				"runtime.steps" "1=RT_034;2=RT_035;3=RT_036;4=RT_037;5=RT_038;6=RT_039;7=RT_040;8=RT_041;9=RT_042;10=RT_043;11=RT_044;12=RT_045;13=RT_046;14=RT_032;15=RT_047"
			}
			autoLayout lr
		}

		custom "RV_RF_LARGE_APPLY_CANCEL" {
			title "Runtime - RF large apply cancel"
			include RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR RESP_RF_INTERACTION
			exclude "relationship.tag!=Runtime_RV_RF_LARGE_APPLY_CANCEL"
			properties {
				"runtime.steps" "1=RT_035;2=RT_036;3=RT_048;4=RT_049;5=RT_050;6=RT_051"
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
