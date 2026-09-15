// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "対応Tableの選択、toolbar、RF、確認、反映中表示、editing surface、およびEditor Lifecycleを提供する。" {
			tags "External Context,External System"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_WORDPRESS_COMPONENTS = element "WordPress Components" "External UI Capability" "RFとApply Presentationで利用できる標準的な操作、Keyboard、focus、およびsemantic Contractを提供する。" {
			tags "External Context,External UI Capability"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}
		EXT_BROWSER_ACCESSIBILITY = element "Browser Accessibility Platform" "External Platform" "native controlのKeyboard動作、focus、accessibility tree、および支援技術への状態変化伝達を提供する。" {
			tags "External Context,External Platform"
			!script groovy {
				element.setGroup("Accessibility Platform")
			}
		}
		EXT_ASSISTIVE_TECHNOLOGY = element "Assistive Technology" "External Consumer" "Browserが公開する操作部品、状態、入力問題、およびannouncementを利用者へ伝える。" {
			tags "External Context,External Consumer"
			!script groovy {
				element.setGroup("Accessibility Platform")
			}
		}
		EXT_SUPPORTED_TABLE_BLOCK = element "Supported Table Block" "External Block" "Core TableまたはFlexible Table Blockとして、方向固有Table Integrationが構造解釈と確定更新を行う対象を提供する。" {
			tags "External Context,External Block"
			!script groovy {
				element.setGroup("WordPress External")
			}
		}

		RESP_EDITOR_DOM_CONTEXT = element "Editor DOM Context" "Responsibility" "現在のEditor基準から同じ表示環境のfocusおよびAccessibility platform contextを要求時点で解決する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Editor Integration")
			}
		}
		RESP_WORDPRESS_REORDER_INTEGRATION = element "WordPress Reorder Integration" "Responsibility" "RF入口、入力画面、Keyboard入力、現在RF状態、終了、および通常時のAccessibility責務をWordPress Editorへ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_WORDPRESS_REORDER_APPLY_INTEGRATION = element "WordPress Reorder Apply Integration" "Responsibility" "RF Apply状態を確認、反映中表示、表示復帰、およびApply中のAccessibility責務へ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_ACCESSIBILITY_PRESENTATION = element "Accessibility Presentation" "Responsibility" "既存RF / Apply状態を標準操作部品の意味、状態、案内、および入力問題との関係として表現する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_FOCUS_COORDINATION = element "Focus Coordination" "Responsibility" "Designで定義されたRF / Apply Lifecycleのfocus維持・移動・復帰intentを現在のEditor contextへ適用する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_ANNOUNCEMENT_DELIVERY = element "Announcement Delivery" "Responsibility" "既存責務が確定した一回性の結果意味をfocusから独立してBrowser Accessibility Platformへ伝える。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_RF_INTERACTION = element "RF Interaction" "Responsibility" "RF Session、対象Table、方向、入力、現在評価、Apply要求、および未提示のApply結果を所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_RF_INPUT_INTERPRETATION = element "RF Input Interpretation" "Responsibility" "利用者入力と現在入力範囲 / 選択肢を解釈し、入力問題または方向固有Resolution向け内部指定を返す。" {
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
		RESP_RF_APPLY_COORDINATION = element "RF Apply Coordination" "Responsibility" "候補再照合、反映経路、確認、確定更新、表示復帰、結果、および成功時の最終位置を所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_ROW_TABLE_INTEGRATION = element "Row Table Integration" "Responsibility" "現在のRow構造、診断、Apply評価、確定行移動、および確定後位置の最終権威を提供する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_COLUMN_TABLE_INTEGRATION = element "Column Table Integration" "Responsibility" "現在のColumn構造、列記述、診断、Apply評価、確定列移動、および確定後位置の最終権威を提供する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Column Reorder")
			}
		}

		DEP_001 = RESP_EDITOR_DOM_CONTEXT -> EXT_WORDPRESS_EDITOR "現在のEditor基準と同じ表示環境のcontextを解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "RF入口、入力画面、終了、および現在TableのEditor接続に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_COMPONENTS "RFの標準操作とKeyboard Contractを利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_004 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "RF Session、現在入力、評価、Apply結果をEditorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_005 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "RF状態を操作意味、状態、案内、入力問題との関係へ表現するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_006 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "RF open / close、failure、および表示変更時のfocus Contractに必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "新しいblocked、no-op、success、failure意味を支援技術へ伝えるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "確認、反映中表示、表示復帰をEditorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_COMPONENTS "確認と反映中状態の標準操作・semantic Contractを利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Apply状態、確認summary、確定結果、および最終位置を利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "確認と反映中状態をaccessible Presentationへ表現するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "確認、反映中、Cancel、表示復帰時のfocus Contractに必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_WORDPRESS_COMPONENTS "WordPressが提供する標準操作部品のsemantic Contractを優先して利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_BROWSER_ACCESSIBILITY "native semanticsを補足する意味、状態、関係を公開するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_FOCUS_COORDINATION -> RESP_EDITOR_DOM_CONTEXT "focus targetと同じEditor表示環境を要求時点で解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_FOCUS_COORDINATION -> EXT_WORDPRESS_EDITOR "現在のTable、toolbar、RF、確認、反映中表示、editing surfaceの存在を確認するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_FOCUS_COORDINATION -> EXT_BROWSER_ACCESSIBILITY "現在targetへのfocus適用と維持に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = RESP_ANNOUNCEMENT_DELIVERY -> EXT_BROWSER_ACCESSIBILITY "一回性の意味通知を支援技術へ公開するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_019 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在入力を入力問題または内部指定へ解釈するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_020 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "Row指定を現在Tableへ解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_021 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "Column指定を現在Tableへ解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_022 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "成立候補を反映し、Apply結果と最終位置を受けるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_023 = RESP_RF_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "Row入力範囲を現在Tableから取得するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_024 = RESP_RF_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "Column入力選択肢と列記述を現在Tableから取得するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_025 = RESP_RF_ROW_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "現在のRow構造と診断を利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_026 = RESP_RF_COLUMN_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "現在のColumn構造と診断を利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_027 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Row候補の再照合、確定更新、および確定後位置に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_028 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Column候補の再照合、確定更新、および確定後位置に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_029 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在のRow構造取得と確定行移動に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_030 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在のColumn構造取得と確定列移動に必要とする。" {
			tags "Structural Dependency"
		}

		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "対応TableのRF操作がWordPress接続境界へ入る。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "Keyboardまたは他の標準入力を同じRF Sessionへ接続する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_003 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在入力を方向固有Resolution向けの内部指定へ解釈する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_004 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "成立したRow指定を現在Tableへ解決する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_005 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "成立したColumn指定を現在Tableへ解決する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_006 = RESP_RF_ROW_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "Row構造と診断を既存の方向固有権威から取得する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_007 = RESP_RF_COLUMN_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "Column構造と診断を既存の方向固有権威から取得する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_008 = RESP_RF_INTERACTION -> RESP_ACCESSIBILITY_PRESENTATION "現在の入力意味、評価、操作可否をaccessible Presentationへ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_009 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_WORDPRESS_COMPONENTS "標準UI primitiveへRF / Applyの意味と状態を接続する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_010 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_BROWSER_ACCESSIBILITY "native semanticsを補足する必要な意味と関係を公開する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_011 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "成立した候補の既存Apply Lifecycleへ進む。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_012 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "確認、反映中、表示復帰に必要なApply状態と最終位置を公開する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_013 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "RF openまたは明示的終了に対応するfocus intentを調停へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_014 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "Apply Lifecycleに対応するfocus intentを調停へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_015 = RESP_FOCUS_COORDINATION -> EXT_BROWSER_ACCESSIBILITY "現在のEditor contextで確定したfocus targetへ移動する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_016 = RESP_RF_INTERACTION -> RESP_WORDPRESS_REORDER_INTEGRATION "新しく成立した一回性の結果意味をWordPress接続へ公開する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_017 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "確定済みの一回性結果意味を通知境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_018 = RESP_ANNOUNCEMENT_DELIVERY -> EXT_BROWSER_ACCESSIBILITY "結果意味をfocusから独立した状態変化として公開する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_019 = EXT_BROWSER_ACCESSIBILITY -> EXT_ASSISTIVE_TECHNOLOGY "公開された操作意味、状態、focus、announcementを支援技術へ伝える。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END,normal"
		}
		PF_020 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_ROW_RESOLUTION "[failure] Row指定の構造拒否または現在Tableでの利用不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,failure"
		}
		PF_021 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_COLUMN_RESOLUTION "[failure] Column指定の構造拒否または現在Tableでの利用不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,failure"
		}
		PF_022 = RESP_RF_ROW_RESOLUTION -> RESP_RF_INTERACTION "[recovery] Rowのno-op、構造拒否、利用不能を現在RF評価へ戻す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,recovery"
		}
		PF_023 = RESP_RF_COLUMN_RESOLUTION -> RESP_RF_INTERACTION "[recovery] Columnのno-op、構造拒否、利用不能を現在RF評価へ戻す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,recovery"
		}
		PF_024 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[failure] Apply時のRow再照合不成立または更新不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,failure"
		}
		PF_025 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[failure] Apply時のColumn再照合不成立または更新不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,failure"
		}
		PF_026 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "[recovery] Table未変更のfailureと現在入力の再評価へ戻す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,recovery"
		}
		PF_027 = RESP_RF_INTERACTION -> RESP_ACCESSIBILITY_PRESENTATION "[recovery] 現在の入力問題または指定全体の結果をaccessible Presentationへ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,recovery"
		}
		PF_028 = RESP_RF_INTERACTION -> RESP_WORDPRESS_REORDER_INTEGRATION "[recovery] 新しく成立したblocked、no-op、またはfailure意味をWordPress接続へ公開する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,recovery"
		}
		PF_029 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "[recovery] 確定済みの一回性failure / recovery意味を通知境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,recovery"
		}
		PF_030 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "[recovery] Designでfocus移動が必要なfailureまたは明示的終了だけを復帰intentへ変換する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,recovery"
		}
		PF_031 = RESP_FOCUS_COORDINATION -> EXT_WORDPRESS_EDITOR "[recovery] 現在存在する修正対象または安定したEditor操作位置へfocusを復帰する。" {
			tags "Process Flow,ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY,recovery"
		}

		RT_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "利用者が標準Keyboard操作で対象TableのRF入口を選択する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_OPEN"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_OPEN.step.1" "利用者が標準Keyboard操作で対象TableのRF入口を選択する。"
			}
		}
		RT_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "対象TableでRF Sessionを開始する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_OPEN"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_OPEN.step.2" "対象TableでRF Sessionを開始する。"
			}
		}
		RT_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "初期方向を含む現在RF状態のPresentationを要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_OPEN"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_OPEN.step.3" "初期方向を含む現在RF状態のPresentationを要求する。"
			}
		}
		RT_004 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_WORDPRESS_COMPONENTS "標準操作部品のKeyboardとsemantic Contractを利用してRFを提示する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_OPEN"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_OPEN.step.4" "標準操作部品のKeyboardとsemantic Contractを利用してRFを提示する。"
			}
		}
		RT_005 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "RF open後の意味上の初期focus targetを渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_OPEN"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_OPEN.step.5" "RF open後の意味上の初期focus targetを渡す。"
			}
		}
		RT_006 = RESP_FOCUS_COORDINATION -> RESP_EDITOR_DOM_CONTEXT "現在RFと同じEditor contextを要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_OPEN"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_OPEN.step.6" "現在RFと同じEditor contextを要求する。"
			}
		}
		RT_007 = RESP_FOCUS_COORDINATION -> EXT_BROWSER_ACCESSIBILITY "現在存在する初期targetへfocusを適用する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_OPEN"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_OPEN.step.7" "現在存在する初期targetへfocusを適用する。"
			}
		}
		RT_008 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "利用者が方向または現在入力を標準Keyboard操作で変更する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_INPUT_PROBLEM"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_INPUT_PROBLEM.step.1" "利用者が方向または現在入力を標準Keyboard操作で変更する。"
			}
		}
		RT_009 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "現在の方向または入力を同じRF Sessionへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_INPUT_PROBLEM"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_INPUT_PROBLEM.step.2" "現在の方向または入力を同じRF Sessionへ渡す。"
			}
		}
		RT_010 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在入力の成立性を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_INPUT_PROBLEM"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_INPUT_PROBLEM.step.3" "現在入力の成立性を要求する。"
			}
		}
		RT_011 = RESP_RF_INPUT_INTERPRETATION -> RESP_RF_INTERACTION "入力問題と修正対象、または成立した内部指定を返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_INPUT_PROBLEM"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_INPUT_PROBLEM.step.4" "入力問題と修正対象、または成立した内部指定を返す。"
			}
		}
		RT_012 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "現在の入力問題と修正情報をPresentationへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_INPUT_PROBLEM"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_INPUT_PROBLEM.step.5" "現在の入力問題と修正情報をPresentationへ渡す。"
			}
		}
		RT_013 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_BROWSER_ACCESSIBILITY "入力問題を対象入力との関係として公開する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_INPUT_PROBLEM"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_INPUT_PROBLEM.step.6" "入力問題を対象入力との関係として公開する。"
			}
		}
		RT_014 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "成立したRow指定について現在Table上の結果を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT.step.1" "成立したRow指定について現在Table上の結果を要求する。"
			}
		}
		RT_015 = RESP_RF_ROW_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "現在のRow構造と診断を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT.step.2" "現在のRow構造と診断を要求する。"
			}
		}
		RT_016 = RESP_RF_ROW_RESOLUTION -> RESP_RF_INTERACTION "成立候補、no-op、構造拒否、利用不能を返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT.step.3" "成立候補、no-op、構造拒否、利用不能を返す。"
			}
		}
		RT_017 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "現在のRow指定全体の評価をPresentationへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT.step.4" "現在のRow指定全体の評価をPresentationへ渡す。"
			}
		}
		RT_018 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_BROWSER_ACCESSIBILITY "現在評価を特定入力の再validationではなく指定全体の結果として公開する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT,Runtime_RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT.step.5" "現在評価を特定入力の再validationではなく指定全体の結果として公開する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT.step.5" "現在評価を特定入力の再validationではなく指定全体の結果として公開する。"
			}
		}
		RT_019 = RESP_RF_INTERACTION -> RESP_WORDPRESS_REORDER_INTEGRATION "blockedまたはno-opが新しく成立した場合だけ一回性通知を提供する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT,Runtime_RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT.step.6" "blockedまたはno-opが新しく成立した場合だけ一回性通知を提供する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT.step.6" "blockedまたはno-opが新しく成立した場合だけ一回性通知を提供する。"
			}
		}
		RT_020 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "新しい通知意味をfocus移動要求なしで渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT,Runtime_RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT.step.7" "新しい通知意味をfocus移動要求なしで渡す。"
				"runtime.RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT.step.7" "新しい通知意味をfocus移動要求なしで渡す。"
			}
		}
		RT_021 = RESP_ANNOUNCEMENT_DELIVERY -> EXT_BROWSER_ACCESSIBILITY "現在結果を支援技術へ伝達可能な状態変化として公開する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT,Runtime_RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT.step.8" "現在結果を支援技術へ伝達可能な状態変化として公開する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT.step.8" "現在結果を支援技術へ伝達可能な状態変化として公開する。"
			}
		}
		RT_022 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "成立したColumn指定について現在Table上の結果を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT.step.1" "成立したColumn指定について現在Table上の結果を要求する。"
			}
		}
		RT_023 = RESP_RF_COLUMN_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "現在のColumn構造と診断を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT.step.2" "現在のColumn構造と診断を要求する。"
			}
		}
		RT_024 = RESP_RF_COLUMN_RESOLUTION -> RESP_RF_INTERACTION "成立候補、no-op、構造拒否、利用不能を返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT.step.3" "成立候補、no-op、構造拒否、利用不能を返す。"
			}
		}
		RT_025 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "現在のColumn指定全体の評価をPresentationへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT.step.4" "現在のColumn指定全体の評価をPresentationへ渡す。"
			}
		}
		RT_026 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "利用者の明示的終了または別操作対象への移動がRF終了条件となる。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_CLOSE"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_CLOSE.step.1" "利用者の明示的終了または別操作対象への移動がRF終了条件となる。"
			}
		}
		RT_027 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "現在RF Sessionを終了する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_CLOSE"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_CLOSE.step.2" "現在RF Sessionを終了する。"
			}
		}
		RT_028 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "明示的終了の場合だけ、対象Tableが操作可能であることを条件にRF入口への復帰intentを渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_CLOSE"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_CLOSE.step.3" "明示的終了の場合だけ、対象Tableが操作可能であることを条件にRF入口への復帰intentを渡す。"
			}
		}
		RT_029 = RESP_FOCUS_COORDINATION -> EXT_WORDPRESS_EDITOR "現在も成立する入口へfocusを戻すか、別操作対象への移動時は何も変更しない。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_RF_CLOSE"
			properties {
				"runtime.RV_ACCESSIBILITY_RF_CLOSE.step.4" "現在も成立する入口へfocusを戻すか、別操作対象への移動時は何も変更しない。"
			}
		}
		RT_030 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "確認状態と確定済みMove summaryを公開する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_CONFIRMATION"
			properties {
				"runtime.RV_ACCESSIBILITY_CONFIRMATION.step.1" "確認状態と確定済みMove summaryを公開する。"
			}
		}
		RT_031 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "確認内容と選択肢のaccessible Presentationを要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_CONFIRMATION"
			properties {
				"runtime.RV_ACCESSIBILITY_CONFIRMATION.step.2" "確認内容と選択肢のaccessible Presentationを要求する。"
			}
		}
		RT_032 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "確認開始時の意味上の初期targetを渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_CONFIRMATION"
			properties {
				"runtime.RV_ACCESSIBILITY_CONFIRMATION.step.3" "確認開始時の意味上の初期targetを渡す。"
			}
		}
		RT_033 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "利用者が標準Keyboard操作でCancelを選択する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_CONFIRMATION"
			properties {
				"runtime.RV_ACCESSIBILITY_CONFIRMATION.step.4" "利用者が標準Keyboard操作でCancelを選択する。"
			}
		}
		RT_034 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Table未変更のCancelを返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_CONFIRMATION"
			properties {
				"runtime.RV_ACCESSIBILITY_CONFIRMATION.step.5" "Table未変更のCancelを返す。"
			}
		}
		RT_035 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "入力を保持したopen RF状態へ戻す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_CONFIRMATION"
			properties {
				"runtime.RV_ACCESSIBILITY_CONFIRMATION.step.6" "入力を保持したopen RF状態へ戻す。"
			}
		}
		RT_036 = RESP_RF_INTERACTION -> RESP_WORDPRESS_REORDER_INTEGRATION "入力を保持した現在RF状態を再表示へ提供する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_CONFIRMATION"
			properties {
				"runtime.RV_ACCESSIBILITY_CONFIRMATION.step.7" "入力を保持した現在RF状態を再表示へ提供する。"
			}
		}
		RT_037 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "RFの再実行位置への復帰intentを渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_CONFIRMATION"
			properties {
				"runtime.RV_ACCESSIBILITY_CONFIRMATION.step.8" "RFの再実行位置への復帰intentを渡す。"
			}
		}
		RT_038 = RESP_FOCUS_COORDINATION -> EXT_BROWSER_ACCESSIBILITY "再成立したRFの現在targetへfocusを適用する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_CONFIRMATION"
			properties {
				"runtime.RV_ACCESSIBILITY_CONFIRMATION.step.9" "再成立したRFの現在targetへfocusを適用する。"
			}
		}
		RT_039 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "反映準備状態を公開する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.1" "反映準備状態を公開する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.1" "反映準備状態を公開する。"
			}
		}
		RT_040 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "対象Tableの反映中状態を示す意味上のtargetを渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.2" "対象Tableの反映中状態を示す意味上のtargetを渡す。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.2" "対象Tableの反映中状態を示す意味上のtargetを渡す。"
			}
		}
		RT_041 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Row候補の再照合と確定更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.3" "Row候補の再照合と確定更新を要求する。"
			}
		}
		RT_042 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "確定更新成功と確定後Row位置を返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.4" "確定更新成功と確定後Row位置を返す。"
			}
		}
		RT_043 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "success時の確定後位置とediting surface restoration要求を公開する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.5" "success時の確定後位置とediting surface restoration要求を公開する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.5" "success時の確定後位置とediting surface restoration要求を公開する。"
			}
		}
		RT_044 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "更新後の対象Table editing surfaceを再成立させる。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.6" "更新後の対象Table editing surfaceを再成立させる。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.6" "更新後の対象Table editing surfaceを再成立させる。"
			}
		}
		RT_045 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "確定後Row位置に対応する結果確認targetを渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.7" "確定後Row位置に対応する結果確認targetを渡す。"
			}
		}
		RT_046 = RESP_FOCUS_COORDINATION -> EXT_BROWSER_ACCESSIBILITY "現在Table上で正確に確認できるtargetへfocusを適用する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.8" "現在Table上で正確に確認できるtargetへfocusを適用する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.8" "現在Table上で正確に確認できるtargetへfocusを適用する。"
			}
		}
		RT_047 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "表示復帰完了を返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.9" "表示復帰完了を返す。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.9" "表示復帰完了を返す。"
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.4" "表示復帰完了を返す。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.4" "表示復帰完了を返す。"
			}
		}
		RT_048 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "確定済みRow Move summaryを持つsuccessを返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.10" "確定済みRow Move summaryを持つsuccessを返す。"
			}
		}
		RT_049 = RESP_RF_INTERACTION -> RESP_WORDPRESS_REORDER_INTEGRATION "一度だけ提示可能なsuccessを提供する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.11" "一度だけ提示可能なsuccessを提供する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.11" "一度だけ提示可能なsuccessを提供する。"
			}
		}
		RT_050 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "確定済み移動前Row位置と確定後位置を持つsuccess通知を渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.12" "確定済み移動前Row位置と確定後位置を持つsuccess通知を渡す。"
			}
		}
		RT_051 = RESP_ANNOUNCEMENT_DELIVERY -> EXT_BROWSER_ACCESSIBILITY "successをfocusから独立して公開する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_SUCCESS.step.13" "successをfocusから独立して公開する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.13" "successをfocusから独立して公開する。"
			}
		}
		RT_052 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Column候補の再照合と確定更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.3" "Column候補の再照合と確定更新を要求する。"
			}
		}
		RT_053 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "確定更新成功と確定後Column位置を返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.4" "確定更新成功と確定後Column位置を返す。"
			}
		}
		RT_054 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "確定後Column位置に対応する結果確認targetを渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.7" "確定後Column位置に対応する結果確認targetを渡す。"
			}
		}
		RT_055 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "確定済みColumn Move summaryを持つsuccessを返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.10" "確定済みColumn Move summaryを持つsuccessを返す。"
			}
		}
		RT_056 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "確定済み移動前Column位置と確定後位置を持つsuccess通知を渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS.step.12" "確定済み移動前Column位置と確定後位置を持つsuccess通知を渡す。"
			}
		}
		RT_057 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Row Applyの再照合不成立または更新不能をTable未変更で返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.1" "Row Applyの再照合不成立または更新不能をTable未変更で返す。"
			}
		}
		RT_058 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "Table未変更のediting surface restorationを要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.2" "Table未変更のediting surface restorationを要求する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.2" "Table未変更のediting surface restorationを要求する。"
			}
		}
		RT_059 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "対象Tableのediting surfaceを再成立させる。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.3" "対象Tableのediting surfaceを再成立させる。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.3" "対象Tableのediting surfaceを再成立させる。"
			}
		}
		RT_060 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "failureを返して現在Row入力の再評価へ戻す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.5" "failureを返して現在Row入力の再評価へ戻す。"
			}
		}
		RT_061 = RESP_RF_INTERACTION -> RESP_WORDPRESS_REORDER_INTEGRATION "入力を保持したRF状態、現在評価、および一度だけ提示可能なfailureを提供する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.6" "入力を保持したRF状態、現在評価、および一度だけ提示可能なfailureを提供する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.6" "入力を保持したRF状態、現在評価、および一度だけ提示可能なfailureを提供する。"
			}
		}
		RT_062 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "現在評価に基づく修正対象とfailure Presentationを要求する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.7" "現在評価に基づく修正対象とfailure Presentationを要求する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.7" "現在評価に基づく修正対象とfailure Presentationを要求する。"
			}
		}
		RT_063 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "現在評価と通常の操作順から定まる意味上の修正targetを渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.8" "現在評価と通常の操作順から定まる意味上の修正targetを渡す。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.8" "現在評価と通常の操作順から定まる意味上の修正targetを渡す。"
			}
		}
		RT_064 = RESP_FOCUS_COORDINATION -> EXT_BROWSER_ACCESSIBILITY "現在成立する修正targetへfocusを適用する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.9" "現在成立する修正targetへfocusを適用する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.9" "現在成立する修正targetへfocusを適用する。"
			}
		}
		RT_065 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "Table未変更を含むfailure通知を渡す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.10" "Table未変更を含むfailure通知を渡す。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.10" "Table未変更を含むfailure通知を渡す。"
			}
		}
		RT_066 = RESP_ANNOUNCEMENT_DELIVERY -> EXT_BROWSER_ACCESSIBILITY "failureをfocusから独立して公開する。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_ROW_APPLY_FAILURE.step.11" "failureをfocusから独立して公開する。"
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.11" "failureをfocusから独立して公開する。"
			}
		}
		RT_067 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Column Applyの再照合不成立または更新不能をTable未変更で返す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.1" "Column Applyの再照合不成立または更新不能をTable未変更で返す。"
			}
		}
		RT_068 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "failureを返して現在Column入力の再評価へ戻す。" {
			tags "Runtime Interaction,Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE.step.5" "failureを返して現在Column入力の再評価へ戻す。"
			}
		}
	}

	views {
		systemLandscape "DV_ACCESSIBILITY_RESPONSIBILITY" {
			title "Structural Dependencies - Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY EXT_ASSISTIVE_TECHNOLOGY EXT_SUPPORTED_TABLE_BLOCK RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ACCESSIBILITY_PRESENTATION" {
			title "Structural Dependencies - Keyboard and Semantics"
			include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_RF_INTERACTION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ACCESSIBILITY_FOCUS" {
			title "Structural Dependencies - Focus Management"
			include EXT_WORDPRESS_EDITOR EXT_BROWSER_ACCESSIBILITY RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_FOCUS_COORDINATION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ACCESSIBILITY_ANNOUNCEMENT" {
			title "Structural Dependencies - Announcement"
			include EXT_BROWSER_ACCESSIBILITY EXT_ASSISTIVE_TECHNOLOGY RESP_WORDPRESS_REORDER_INTEGRATION RESP_ANNOUNCEMENT_DELIVERY RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ACCESSIBILITY_MEANING" {
			title "Structural Dependencies - Validation and Reorder Meaning"
			include EXT_SUPPORTED_TABLE_BLOCK RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "PV_ACCESSIBLE_RF_END_TO_END" {
			title "Process Flow - Accessible RF End-to-End"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY EXT_ASSISTIVE_TECHNOLOGY
			exclude "relationship.tag!=ProcessFlow_PV_ACCESSIBLE_RF_END_TO_END"
			autoLayout lr
		}

		custom "PV_ACCESSIBILITY_FAILURE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - Input or Apply Failure and Recovery"
			include RESP_ROW_TABLE_INTEGRATION RESP_RF_ROW_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_COLUMN_RESOLUTION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION RESP_ACCESSIBILITY_PRESENTATION RESP_WORDPRESS_REORDER_INTEGRATION RESP_ANNOUNCEMENT_DELIVERY RESP_FOCUS_COORDINATION EXT_WORDPRESS_EDITOR
			exclude "relationship.tag!=ProcessFlow_PV_ACCESSIBILITY_FAILURE_RECOVERY"
			autoLayout lr
		}

		custom "RV_ACCESSIBILITY_RF_OPEN" {
			title "Runtime - RF open and Keyboard continuation"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_RF_INTERACTION RESP_ACCESSIBILITY_PRESENTATION EXT_WORDPRESS_COMPONENTS RESP_FOCUS_COORDINATION RESP_EDITOR_DOM_CONTEXT EXT_BROWSER_ACCESSIBILITY
			exclude "relationship.tag!=Runtime_RV_ACCESSIBILITY_RF_OPEN"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006;7=RT_007"
			}
			autoLayout lr
		}

		custom "RV_ACCESSIBILITY_RF_INPUT_PROBLEM" {
			title "Runtime - RF input problem presentation"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_ACCESSIBILITY_PRESENTATION EXT_BROWSER_ACCESSIBILITY
			exclude "relationship.tag!=Runtime_RV_ACCESSIBILITY_RF_INPUT_PROBLEM"
			properties {
				"runtime.steps" "1=RT_008;2=RT_009;3=RT_010;4=RT_011;5=RT_012;6=RT_013"
			}
			autoLayout lr
		}

		custom "RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT" {
			title "Runtime - RF Row structural result"
			include RESP_RF_INTERACTION RESP_RF_ROW_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_WORDPRESS_REORDER_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION EXT_BROWSER_ACCESSIBILITY RESP_ANNOUNCEMENT_DELIVERY
			exclude "relationship.tag!=Runtime_RV_ACCESSIBILITY_ROW_STRUCTURAL_RESULT"
			properties {
				"runtime.steps" "1=RT_014;2=RT_015;3=RT_016;4=RT_017;5=RT_018;6=RT_019;7=RT_020;8=RT_021"
			}
			autoLayout lr
		}

		custom "RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT" {
			title "Runtime - RF Column structural result"
			include RESP_RF_INTERACTION RESP_RF_COLUMN_RESOLUTION RESP_COLUMN_TABLE_INTEGRATION RESP_WORDPRESS_REORDER_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION EXT_BROWSER_ACCESSIBILITY RESP_ANNOUNCEMENT_DELIVERY
			exclude "relationship.tag!=Runtime_RV_ACCESSIBILITY_COLUMN_STRUCTURAL_RESULT"
			properties {
				"runtime.steps" "1=RT_022;2=RT_023;3=RT_024;4=RT_025;5=RT_018;6=RT_019;7=RT_020;8=RT_021"
			}
			autoLayout lr
		}

		custom "RV_ACCESSIBILITY_RF_CLOSE" {
			title "Runtime - RF close and focus protection"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_RF_INTERACTION RESP_FOCUS_COORDINATION
			exclude "relationship.tag!=Runtime_RV_ACCESSIBILITY_RF_CLOSE"
			properties {
				"runtime.steps" "1=RT_026;2=RT_027;3=RT_028;4=RT_029"
			}
			autoLayout lr
		}

		custom "RV_ACCESSIBILITY_CONFIRMATION" {
			title "Runtime - Confirmation and cancel"
			include RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION EXT_WORDPRESS_EDITOR RESP_RF_INTERACTION RESP_WORDPRESS_REORDER_INTEGRATION EXT_BROWSER_ACCESSIBILITY
			exclude "relationship.tag!=Runtime_RV_ACCESSIBILITY_CONFIRMATION"
			properties {
				"runtime.steps" "1=RT_030;2=RT_031;3=RT_032;4=RT_033;5=RT_034;6=RT_035;7=RT_036;8=RT_037;9=RT_038"
			}
			autoLayout lr
		}

		custom "RV_ACCESSIBILITY_ROW_APPLY_SUCCESS" {
			title "Runtime - Row apply restoration and success"
			include RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_FOCUS_COORDINATION RESP_ROW_TABLE_INTEGRATION EXT_WORDPRESS_EDITOR EXT_BROWSER_ACCESSIBILITY RESP_RF_INTERACTION RESP_WORDPRESS_REORDER_INTEGRATION RESP_ANNOUNCEMENT_DELIVERY
			exclude "relationship.tag!=Runtime_RV_ACCESSIBILITY_ROW_APPLY_SUCCESS"
			properties {
				"runtime.steps" "1=RT_039;2=RT_040;3=RT_041;4=RT_042;5=RT_043;6=RT_044;7=RT_045;8=RT_046;9=RT_047;10=RT_048;11=RT_049;12=RT_050;13=RT_051"
			}
			autoLayout lr
		}

		custom "RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS" {
			title "Runtime - Column apply restoration and success"
			include RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_FOCUS_COORDINATION RESP_COLUMN_TABLE_INTEGRATION EXT_WORDPRESS_EDITOR EXT_BROWSER_ACCESSIBILITY RESP_RF_INTERACTION RESP_WORDPRESS_REORDER_INTEGRATION RESP_ANNOUNCEMENT_DELIVERY
			exclude "relationship.tag!=Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_SUCCESS"
			properties {
				"runtime.steps" "1=RT_039;2=RT_040;3=RT_052;4=RT_053;5=RT_043;6=RT_044;7=RT_054;8=RT_046;9=RT_047;10=RT_055;11=RT_049;12=RT_056;13=RT_051"
			}
			autoLayout lr
		}

		custom "RV_ACCESSIBILITY_ROW_APPLY_FAILURE" {
			title "Runtime - Row apply restoration failure and correction return"
			include RESP_ROW_TABLE_INTEGRATION RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR RESP_RF_INTERACTION RESP_WORDPRESS_REORDER_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION EXT_BROWSER_ACCESSIBILITY RESP_ANNOUNCEMENT_DELIVERY
			exclude "relationship.tag!=Runtime_RV_ACCESSIBILITY_ROW_APPLY_FAILURE"
			properties {
				"runtime.steps" "1=RT_057;2=RT_058;3=RT_059;4=RT_047;5=RT_060;6=RT_061;7=RT_062;8=RT_063;9=RT_064;10=RT_065;11=RT_066"
			}
			autoLayout lr
		}

		custom "RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE" {
			title "Runtime - Column apply restoration failure and correction return"
			include RESP_COLUMN_TABLE_INTEGRATION RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR RESP_RF_INTERACTION RESP_WORDPRESS_REORDER_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION EXT_BROWSER_ACCESSIBILITY RESP_ANNOUNCEMENT_DELIVERY
			exclude "relationship.tag!=Runtime_RV_ACCESSIBILITY_COLUMN_APPLY_FAILURE"
			properties {
				"runtime.steps" "1=RT_067;2=RT_058;3=RT_059;4=RT_047;5=RT_068;6=RT_061;7=RT_062;8=RT_063;9=RT_064;10=RT_065;11=RT_066"
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
