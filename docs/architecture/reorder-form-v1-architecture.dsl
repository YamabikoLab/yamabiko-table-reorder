// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "対応Tableの入口、RF入力画面、確認、反映中表示、editing surface、通知、および通常編集環境を提供する。" {
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
		RESP_EDITOR_DOM_CONTEXT = element "Editor DOM Context" "Responsibility" "現在のEditor基準から同じ表示環境のDOM / focus / Accessibility platform contextを要求時点で解決する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Editor Integration")
			}
		}
		RESP_WORDPRESS_REORDER_INTEGRATION = element "WordPress Reorder Integration" "Responsibility" "Row / Column / RF入口、RF入力画面、現在Table、相互排他、標準Keyboard入力、および現在RF Sessionの表示専用状態をWordPress Editorへ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_WORDPRESS_REORDER_APPLY_INTEGRATION = element "WordPress Reorder Apply Integration" "Responsibility" "Reorder Apply状態を確認、反映中表示、表示復帰、accessible Presentation、およびfocusへ接続する。" {
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
		RESP_ACCESSIBILITY_PRESENTATION = element "Accessibility Presentation" "Responsibility" "既存RF / Apply状態を標準操作部品の意味、状態、案内、および入力問題との関係として表現する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("WordPress Reorder Integration")
			}
		}
		RESP_FOCUS_COORDINATION = element "Focus Coordination" "Responsibility" "Designで定義されたRF / Apply Lifecycleのfocus維持・移動・復帰intentを現在Editor contextへ適用する。" {
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
		RESP_RF_INTERACTION = element "RF Interaction" "Responsibility" "RF Session、対象Table、方向、利用者入力、現在評価、意味変化、Apply要求、および未提示Apply結果を所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Form")
			}
		}
		RESP_RF_INPUT_INTERPRETATION = element "RF Input Interpretation" "Responsibility" "利用者入力と現在入力範囲 / 選択肢を解釈し、未入力、修正が必要な入力、または方向固有Resolution向け内部指定を返す。" {
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
		DEP_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_EDITOR "Reorder入口、RF入力画面、終了、および現在TableのEditor接続に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> EXT_WORDPRESS_COMPONENTS "RFの標準操作とKeyboard Contractを利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_004 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "RF開始時のDnDモード終了と入口排他に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_005 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "RF Session、現在入力、評価、Apply結果をEditorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_006 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "RF状態を操作意味、状態、案内、入力問題との関係へ表現するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "RF open / close、failure、および表示変更時のfocus Contractに必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "新しいblocked、no-op、success、failure意味を支援技術へ伝えるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "確認、反映中表示、表示復帰をEditorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_COMPONENTS "確認と反映中状態の標準操作・semantic Contractを利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Apply状態、確認summary、確定結果、最終位置を利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "確認と反映中状態をaccessible Presentationへ表現するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "確認、反映中、Cancel、表示復帰時のfocus Contractに必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_EDITOR "初回案内をEditorへ接続するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_REORDER_GUIDANCE_INTEGRATION -> EXT_WORDPRESS_PREFERENCES "操作環境別の案内済み状態を永続化するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_EDITOR_DOM_CONTEXT "現在の操作環境を解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_GUIDANCE "現在の共通案内状態を開始・終了するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_REORDER_MODE "Row / Column入口選択を案内終了条件として扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_019 = RESP_REORDER_GUIDANCE_INTEGRATION -> RESP_RF_INTERACTION "RF入口選択を案内終了条件として扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_020 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_WORDPRESS_COMPONENTS "WordPressの標準操作部品のsemantic Contractを優先して利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_021 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_BROWSER_ACCESSIBILITY "native semanticsを補足する意味、状態、関係を公開するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_022 = RESP_FOCUS_COORDINATION -> RESP_EDITOR_DOM_CONTEXT "focus targetと同じEditor表示環境を要求時点で解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_023 = RESP_FOCUS_COORDINATION -> EXT_WORDPRESS_EDITOR "現在のRF、確認、反映中表示、editing surfaceの存在を確認するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_024 = RESP_FOCUS_COORDINATION -> EXT_BROWSER_ACCESSIBILITY "現在targetへのfocus適用と維持に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_025 = RESP_ANNOUNCEMENT_DELIVERY -> EXT_BROWSER_ACCESSIBILITY "一回性の意味通知を支援技術へ公開するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_026 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在入力を入力問題または内部指定へ解釈するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_027 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "Row指定を現在Tableへ解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_028 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "Column指定を現在Tableへ解決するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_029 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "成立候補を反映し、Apply結果と最終位置を受けるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_030 = RESP_RF_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "Row入力範囲を現在Tableから取得するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_031 = RESP_RF_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "Column入力選択肢と列記述を現在Tableから取得するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_032 = RESP_RF_ROW_RESOLUTION -> RESP_ROW_TABLE_INTEGRATION "現在のRow構造と診断を利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_033 = RESP_RF_COLUMN_RESOLUTION -> RESP_COLUMN_TABLE_INTEGRATION "現在のColumn構造と診断を利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_034 = RESP_RF_APPLY_COORDINATION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から反映経路を選択するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_035 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Row候補の再照合、確定更新、確定後位置に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_036 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Column候補の再照合、確定更新、確定後位置に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_037 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在のRow構造取得と確定行移動に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_038 = RESP_ROW_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "一回の成立した行移動を一回のUndo単位として維持するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_039 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在のColumn構造取得と確定列移動に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_040 = RESP_COLUMN_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "一回の成立した列移動を一回のUndo単位として維持するために必要とする。" {
			tags "Structural Dependency"
		}

		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "対応TableのRF操作がWordPress接続境界へ入る。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "RF開始前に同一Tableの方向固有Reorder Modeを終了する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "対象Tableと標準入力を同じRF Sessionへ接続する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_004 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "現在入力を方向固有Resolution向けの内部指定へ解釈する。" {
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
		PF_009 = RESP_RF_INTERACTION -> RESP_ACCESSIBILITY_PRESENTATION "現在入力、評価、操作可否をaccessible Presentationへ渡す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_010 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_WORDPRESS_COMPONENTS "RF / Apply状態を標準UI primitiveへ接続する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_011 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_BROWSER_ACCESSIBILITY "native semanticsを補足する意味と関係を公開する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_012 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "成立した候補の反映を要求する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_013 = RESP_RF_APPLY_COORDINATION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から反映経路を選択する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_014 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Row候補の再照合と確定更新を要求する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_015 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Column候補の再照合と確定更新を要求する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_016 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "Apply状態、最終位置、表示復帰要求を公開する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_017 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "Apply Lifecycleに対応するfocus intentを調停へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_018 = RESP_FOCUS_COORDINATION -> EXT_BROWSER_ACCESSIBILITY "現在Editor contextで確定したtargetへfocusを適用する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_019 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "表示復帰後に確定したsuccess / failureをRF Lifecycleへ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_020 = RESP_RF_INTERACTION -> RESP_WORDPRESS_REORDER_INTEGRATION "新しく成立した一回性の結果意味をWordPress接続へ公開する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_021 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "確定済み結果意味を通知境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_022 = RESP_ANNOUNCEMENT_DELIVERY -> EXT_BROWSER_ACCESSIBILITY "結果意味をfocusから独立した状態変化として公開する。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_023 = EXT_BROWSER_ACCESSIBILITY -> EXT_ASSISTIVE_TECHNOLOGY "公開された操作意味、focus、announcementを支援技術へ伝える。" {
			tags "Process Flow,ProcessFlow_PV_RF_REORDER_END_TO_END,normal"
		}
		PF_024 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_ROW_RESOLUTION "[failure] Row指定の構造拒否または現在Tableでの利用不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_025 = RESP_RF_ROW_RESOLUTION -> RESP_RF_INTERACTION "[recovery] Rowのno-op、構造拒否、利用不能を現在RF評価へ戻す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_026 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_COLUMN_RESOLUTION "[failure] Column指定の構造拒否または現在Tableでの利用不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_027 = RESP_RF_COLUMN_RESOLUTION -> RESP_RF_INTERACTION "[recovery] Columnのno-op、構造拒否、利用不能を現在RF評価へ戻す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_028 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[failure] Apply時のRow再照合不成立または更新不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_029 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[failure] Apply時のColumn再照合不成立または更新不能を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,failure"
		}
		PF_030 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "[recovery] Cancelまたは必要な表示復帰完了を返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_031 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "[recovery] Tableを不完全に変更しないfailureまたはCancelをRFへ返す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_032 = RESP_RF_INTERACTION -> RESP_ACCESSIBILITY_PRESENTATION "[recovery] 現在の入力問題または指定全体の結果をaccessible Presentationへ渡す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_033 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "[recovery] Designでfocus移動が必要なfailureまたは明示的終了の復帰intentを渡す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}
		PF_034 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "[recovery] 確定済みの一回性failure / recovery意味を通知境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_RF_REJECTION_RECOVERY,recovery"
		}

		RT_001 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "利用者が対象TableのRF入口を選択する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN"
			properties {
				"runtime.RV_RF_OPEN.step.1" "利用者が対象TableのRF入口を選択する。"
			}
		}
		RT_002 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_REORDER_MODE "同一Tableで方向固有モードが有効なら通常編集へ戻す。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN"
			properties {
				"runtime.RV_RF_OPEN.step.2" "同一Tableで方向固有モードが有効なら通常編集へ戻す。"
			}
		}
		RT_003 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "対象TableでRF Sessionを開始する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN"
			properties {
				"runtime.RV_RF_OPEN.step.3" "対象TableでRF Sessionを開始する。"
			}
		}
		RT_004 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "初期方向を含む現在RF状態のPresentationを要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN"
			properties {
				"runtime.RV_RF_OPEN.step.4" "初期方向を含む現在RF状態のPresentationを要求する。"
			}
		}
		RT_005 = RESP_ACCESSIBILITY_PRESENTATION -> EXT_WORDPRESS_COMPONENTS "標準操作部品のKeyboardとsemantic Contractを利用してRFを提示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN"
			properties {
				"runtime.RV_RF_OPEN.step.5" "標準操作部品のKeyboardとsemantic Contractを利用してRFを提示する。"
			}
		}
		RT_006 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "RF open後の意味上の初期focus targetを渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN"
			properties {
				"runtime.RV_RF_OPEN.step.6" "RF open後の意味上の初期focus targetを渡す。"
			}
		}
		RT_007 = RESP_FOCUS_COORDINATION -> RESP_EDITOR_DOM_CONTEXT "現在RFと同じEditor contextを要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN"
			properties {
				"runtime.RV_RF_OPEN.step.7" "現在RFと同じEditor contextを要求する。"
			}
		}
		RT_008 = RESP_FOCUS_COORDINATION -> EXT_BROWSER_ACCESSIBILITY "現在存在する初期targetへfocusを適用する。" {
			tags "Runtime Interaction,Runtime_RV_RF_OPEN"
			properties {
				"runtime.RV_RF_OPEN.step.8" "現在存在する初期targetへfocusを適用する。"
			}
		}
		RT_009 = EXT_SUPPORTED_TABLE_BLOCK -> RESP_WORDPRESS_REORDER_INTEGRATION "対象Tableの現在内容または構造が変化する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.1" "対象Tableの現在内容または構造が変化する。"
			}
		}
		RT_010 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "現在Tableを基準とするRF評価更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.2" "現在Tableを基準とするRF評価更新を要求する。"
			}
		}
		RT_011 = RESP_RF_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "Rowの場合は現在行範囲を再取得する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.3" "Rowの場合は現在行範囲を再取得する。"
			}
		}
		RT_012 = RESP_RF_INTERACTION -> RESP_COLUMN_TABLE_INTEGRATION "Columnの場合は現在列記述を再取得する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.4" "Columnの場合は現在列記述を再取得する。"
			}
		}
		RT_013 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "保持中入力を現在範囲 / 選択肢へ再解釈する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.5" "保持中入力を現在範囲 / 選択肢へ再解釈する。"
			}
		}
		RT_014 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "Row ready指定を現在Tableへ再解決する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.6" "Row ready指定を現在Tableへ再解決する。"
			}
		}
		RT_015 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "Column ready指定を現在Tableへ再解決する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.7" "Column ready指定を現在Tableへ再解決する。"
			}
		}
		RT_016 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "再評価後の実行可否と理由を提示する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.RV_RF_CURRENT_TABLE_REEVALUATION.step.8" "再評価後の実行可否と理由を提示する。"
			}
		}
		RT_017 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "利用者が方向または入力を変更する。" {
			tags "Runtime Interaction,Runtime_RV_RF_INPUT_RESULT"
			properties {
				"runtime.RV_RF_INPUT_RESULT.step.1" "利用者が方向または入力を変更する。"
			}
		}
		RT_018 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "現在の方向または入力を同じRF Sessionへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_INPUT_RESULT"
			properties {
				"runtime.RV_RF_INPUT_RESULT.step.2" "現在の方向または入力を同じRF Sessionへ渡す。"
			}
		}
		RT_019 = RESP_RF_INTERACTION -> RESP_RF_INPUT_INTERPRETATION "入力成立性を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_INPUT_RESULT"
			properties {
				"runtime.RV_RF_INPUT_RESULT.step.3" "入力成立性を要求する。"
			}
		}
		RT_020 = RESP_RF_INTERACTION -> RESP_RF_ROW_RESOLUTION "Row ready指定を現在Tableへ解決する。" {
			tags "Runtime Interaction,Runtime_RV_RF_INPUT_RESULT"
			properties {
				"runtime.RV_RF_INPUT_RESULT.step.4" "Row ready指定を現在Tableへ解決する。"
			}
		}
		RT_021 = RESP_RF_INTERACTION -> RESP_RF_COLUMN_RESOLUTION "Column ready指定を現在Tableへ解決する。" {
			tags "Runtime Interaction,Runtime_RV_RF_INPUT_RESULT"
			properties {
				"runtime.RV_RF_INPUT_RESULT.step.5" "Column ready指定を現在Tableへ解決する。"
			}
		}
		RT_022 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "入力問題または指定全体の現在評価をPresentationへ渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_INPUT_RESULT"
			properties {
				"runtime.RV_RF_INPUT_RESULT.step.6" "入力問題または指定全体の現在評価をPresentationへ渡す。"
			}
		}
		RT_023 = RESP_RF_INTERACTION -> RESP_WORDPRESS_REORDER_INTEGRATION "blocked / no-op等が新しく成立した場合だけ一回性通知を提供する。" {
			tags "Runtime Interaction,Runtime_RV_RF_INPUT_RESULT"
			properties {
				"runtime.RV_RF_INPUT_RESULT.step.7" "blocked / no-op等が新しく成立した場合だけ一回性通知を提供する。"
			}
		}
		RT_024 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "新しい通知意味をfocus移動要求なしで渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_INPUT_RESULT"
			properties {
				"runtime.RV_RF_INPUT_RESULT.step.8" "新しい通知意味をfocus移動要求なしで渡す。"
			}
		}
		RT_025 = RESP_RF_INTERACTION -> RESP_RF_APPLY_COORDINATION "成立したRowまたはColumn候補を渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.1" "成立したRowまたはColumn候補を渡す。"
			}
		}
		RT_026 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Rowの場合は現在TableでApply評価と確定更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.2" "Rowの場合は現在TableでApply評価と確定更新を要求する。"
			}
		}
		RT_027 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Columnの場合は現在TableでApply評価と確定更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.3" "Columnの場合は現在TableでApply評価と確定更新を要求する。"
			}
		}
		RT_028 = RESP_RF_APPLY_COORDINATION -> RESP_REORDER_APPLY_POLICY "更新対象セル数から反映経路を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.4" "更新対象セル数から反映経路を要求する。"
			}
		}
		RT_029 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "更新成功後の表示復帰と確定済み最終位置を公開する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.5" "更新成功後の表示復帰と確定済み最終位置を公開する。"
			}
		}
		RT_030 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "更新後の対象Table editing surfaceを再成立させる。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.6" "更新後の対象Table editing surfaceを再成立させる。"
			}
		}
		RT_031 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "確定後位置に対応する結果確認targetを渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.7" "確定後位置に対応する結果確認targetを渡す。"
			}
		}
		RT_032 = RESP_FOCUS_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "focus intentがsettleしたことを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.8" "focus intentがsettleしたことを返す。"
			}
		}
		RT_033 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "focus settleを含む表示復帰完了を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.9" "focus settleを含む表示復帰完了を返す。"
			}
		}
		RT_034 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "確定済みMove summaryを持つsuccessを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.10" "確定済みMove summaryを持つsuccessを返す。"
			}
		}
		RT_035 = RESP_RF_INTERACTION -> RESP_WORDPRESS_REORDER_INTEGRATION "一度だけ提示可能なsuccessを提供する。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.11" "一度だけ提示可能なsuccessを提供する。"
			}
		}
		RT_036 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "確定済みsuccess通知を渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.RV_RF_NORMAL_APPLY_SUCCESS.step.12" "確定済みsuccess通知を渡す。"
			}
		}
		RT_037 = RESP_RF_APPLY_COORDINATION -> RESP_ROW_TABLE_INTEGRATION "Row候補のApply評価または確定更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARATION_FAILURE"
			properties {
				"runtime.RV_RF_PREPARATION_FAILURE.step.1" "Row候補のApply評価または確定更新を要求する。"
			}
		}
		RT_038 = RESP_RF_APPLY_COORDINATION -> RESP_COLUMN_TABLE_INTEGRATION "Column候補のApply評価または確定更新を要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARATION_FAILURE"
			properties {
				"runtime.RV_RF_PREPARATION_FAILURE.step.2" "Column候補のApply評価または確定更新を要求する。"
			}
		}
		RT_039 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Rowが現在Tableで成立しない、または更新不能であることをTable未変更で返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARATION_FAILURE"
			properties {
				"runtime.RV_RF_PREPARATION_FAILURE.step.3" "Rowが現在Tableで成立しない、または更新不能であることをTable未変更で返す。"
			}
		}
		RT_040 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Columnが現在Tableで成立しない、または更新不能であることをTable未変更で返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARATION_FAILURE"
			properties {
				"runtime.RV_RF_PREPARATION_FAILURE.step.4" "Columnが現在Tableで成立しない、または更新不能であることをTable未変更で返す。"
			}
		}
		RT_041 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "restorationなしでfailureを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARATION_FAILURE"
			properties {
				"runtime.RV_RF_PREPARATION_FAILURE.step.5" "restorationなしでfailureを返す。"
			}
		}
		RT_042 = RESP_RF_INTERACTION -> RESP_WORDPRESS_REORDER_INTEGRATION "入力を保持したRF状態と一回性failureを提供する。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARATION_FAILURE,Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.RV_RF_PREPARATION_FAILURE.step.6" "入力を保持したRF状態と一回性failureを提供する。"
				"runtime.RV_RF_PREPARED_FAILURE.step.9" "入力を保持したRF状態と一回性failureを提供する。"
			}
		}
		RT_043 = RESP_ROW_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Row Applyの再照合不成立または更新不能をTable未変更で返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.RV_RF_PREPARED_FAILURE.step.1" "Row Applyの再照合不成立または更新不能をTable未変更で返す。"
			}
		}
		RT_044 = RESP_COLUMN_TABLE_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Column Applyの再照合不成立または更新不能をTable未変更で返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.RV_RF_PREPARED_FAILURE.step.2" "Column Applyの再照合不成立または更新不能をTable未変更で返す。"
			}
		}
		RT_045 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "Table未変更のediting surface restorationを要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.RV_RF_PREPARED_FAILURE.step.3" "Table未変更のediting surface restorationを要求する。"
			}
		}
		RT_046 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> EXT_WORDPRESS_EDITOR "対象Table editing surfaceを再成立させる。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.RV_RF_PREPARED_FAILURE.step.4" "対象Table editing surfaceを再成立させる。"
			}
		}
		RT_047 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "入力を修正または再実行できる意味上のtargetを渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.RV_RF_PREPARED_FAILURE.step.5" "入力を修正または再実行できる意味上のtargetを渡す。"
			}
		}
		RT_048 = RESP_FOCUS_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "focus intentのsettleを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.RV_RF_PREPARED_FAILURE.step.6" "focus intentのsettleを返す。"
			}
		}
		RT_049 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "必要な表示復帰完了を返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.RV_RF_PREPARED_FAILURE.step.7" "必要な表示復帰完了を返す。"
			}
		}
		RT_050 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "failureを返して現在入力の再評価へ戻す。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.RV_RF_PREPARED_FAILURE.step.8" "failureを返して現在入力の再評価へ戻す。"
			}
		}
		RT_051 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_ANNOUNCEMENT_DELIVERY "Table未変更を含むfailure通知を渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.RV_RF_PREPARED_FAILURE.step.10" "Table未変更を含むfailure通知を渡す。"
			}
		}
		RT_052 = RESP_RF_APPLY_COORDINATION -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "確認状態と確定済みMove summaryを公開する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CONFIRMATION_CANCEL"
			properties {
				"runtime.RV_RF_CONFIRMATION_CANCEL.step.1" "確認状態と確定済みMove summaryを公開する。"
			}
		}
		RT_053 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_ACCESSIBILITY_PRESENTATION "確認内容と選択肢のaccessible Presentationを要求する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CONFIRMATION_CANCEL"
			properties {
				"runtime.RV_RF_CONFIRMATION_CANCEL.step.2" "確認内容と選択肢のaccessible Presentationを要求する。"
			}
		}
		RT_054 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_FOCUS_COORDINATION "確認開始時の意味上の初期targetを渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_CONFIRMATION_CANCEL"
			properties {
				"runtime.RV_RF_CONFIRMATION_CANCEL.step.3" "確認開始時の意味上の初期targetを渡す。"
			}
		}
		RT_055 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_APPLY_INTEGRATION "利用者がCancelを選択する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CONFIRMATION_CANCEL"
			properties {
				"runtime.RV_RF_CONFIRMATION_CANCEL.step.4" "利用者がCancelを選択する。"
			}
		}
		RT_056 = RESP_WORDPRESS_REORDER_APPLY_INTEGRATION -> RESP_RF_APPLY_COORDINATION "Table未変更のCancelを返す。" {
			tags "Runtime Interaction,Runtime_RV_RF_CONFIRMATION_CANCEL"
			properties {
				"runtime.RV_RF_CONFIRMATION_CANCEL.step.5" "Table未変更のCancelを返す。"
			}
		}
		RT_057 = RESP_RF_APPLY_COORDINATION -> RESP_RF_INTERACTION "入力を保持したopen RF状態へ戻す。" {
			tags "Runtime Interaction,Runtime_RV_RF_CONFIRMATION_CANCEL"
			properties {
				"runtime.RV_RF_CONFIRMATION_CANCEL.step.6" "入力を保持したopen RF状態へ戻す。"
			}
		}
		RT_058 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "RFの再実行位置への復帰intentを渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_CONFIRMATION_CANCEL"
			properties {
				"runtime.RV_RF_CONFIRMATION_CANCEL.step.7" "RFの再実行位置への復帰intentを渡す。"
			}
		}
		RT_059 = EXT_WORDPRESS_EDITOR -> RESP_WORDPRESS_REORDER_INTEGRATION "明示的終了または別操作対象への移動がRF終了条件となる。" {
			tags "Runtime Interaction,Runtime_RV_RF_CLOSE"
			properties {
				"runtime.RV_RF_CLOSE.step.1" "明示的終了または別操作対象への移動がRF終了条件となる。"
			}
		}
		RT_060 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_RF_INTERACTION "現在RF Sessionを終了する。" {
			tags "Runtime Interaction,Runtime_RV_RF_CLOSE"
			properties {
				"runtime.RV_RF_CLOSE.step.2" "現在RF Sessionを終了する。"
			}
		}
		RT_061 = RESP_WORDPRESS_REORDER_INTEGRATION -> RESP_FOCUS_COORDINATION "明示的終了の場合だけRF入口への復帰intentを渡す。" {
			tags "Runtime Interaction,Runtime_RV_RF_CLOSE"
			properties {
				"runtime.RV_RF_CLOSE.step.3" "明示的終了の場合だけRF入口への復帰intentを渡す。"
			}
		}
		RT_062 = RESP_FOCUS_COORDINATION -> EXT_WORDPRESS_EDITOR "現在も成立する入口へfocusを戻すか、別操作対象への移動時は何も変更しない。" {
			tags "Runtime Interaction,Runtime_RV_RF_CLOSE"
			properties {
				"runtime.RV_RF_CLOSE.step.4" "現在も成立する入口へfocusを戻すか、別操作対象への移動時は何も変更しない。"
			}
		}
	}

	views {
		systemLandscape "DV_RF_RESPONSIBILITY" {
			title "Structural Dependencies - Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY EXT_ASSISTIVE_TECHNOLOGY EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_REORDER_APPLY_POLICY RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_RF_EDITOR_INTEGRATION" {
			title "Structural Dependencies - Editor Integration"
			include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_WORDPRESS_PREFERENCES RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_REORDER_GUIDANCE_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION
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
			include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_FOCUS_COORDINATION RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_RF_ACCESSIBILITY" {
			title "Structural Dependencies - Keyboard, Focus and Announcement"
			include EXT_WORDPRESS_EDITOR EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY EXT_ASSISTIVE_TECHNOLOGY RESP_EDITOR_DOM_CONTEXT RESP_WORDPRESS_REORDER_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "PV_RF_REORDER_END_TO_END" {
			title "Process Flow - RF Reorder End-to-End"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_MODE RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION EXT_WORDPRESS_COMPONENTS EXT_BROWSER_ACCESSIBILITY RESP_RF_APPLY_COORDINATION RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY EXT_ASSISTIVE_TECHNOLOGY
			exclude "relationship.tag!=ProcessFlow_PV_RF_REORDER_END_TO_END"
			autoLayout lr
		}

		custom "PV_RF_REJECTION_RECOVERY" {
			title "Process Flow [Failure / Recovery] - RF Rejection and Recovery"
			include RESP_ROW_TABLE_INTEGRATION RESP_RF_ROW_RESOLUTION RESP_RF_INTERACTION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_COLUMN_RESOLUTION RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_WORDPRESS_REORDER_INTEGRATION RESP_FOCUS_COORDINATION RESP_ANNOUNCEMENT_DELIVERY
			exclude "relationship.tag!=ProcessFlow_PV_RF_REJECTION_RECOVERY"
			autoLayout lr
		}

		custom "RV_RF_OPEN" {
			title "Runtime - RF open and Keyboard continuation"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_REORDER_MODE RESP_RF_INTERACTION RESP_ACCESSIBILITY_PRESENTATION EXT_WORDPRESS_COMPONENTS RESP_FOCUS_COORDINATION RESP_EDITOR_DOM_CONTEXT EXT_BROWSER_ACCESSIBILITY
			exclude "relationship.tag!=Runtime_RV_RF_OPEN"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006;7=RT_007;8=RT_008"
			}
			autoLayout lr
		}

		custom "RV_RF_CURRENT_TABLE_REEVALUATION" {
			title "Runtime - RF current-table reevaluation"
			include EXT_SUPPORTED_TABLE_BLOCK RESP_WORDPRESS_REORDER_INTEGRATION RESP_RF_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_ACCESSIBILITY_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_RF_CURRENT_TABLE_REEVALUATION"
			properties {
				"runtime.steps" "1=RT_009;2=RT_010;3=RT_011;4=RT_012;5=RT_013;6=RT_014;7=RT_015;8=RT_016"
			}
			autoLayout lr
		}

		custom "RV_RF_INPUT_RESULT" {
			title "Runtime - RF input and structural result"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_RF_INTERACTION RESP_RF_INPUT_INTERPRETATION RESP_RF_ROW_RESOLUTION RESP_RF_COLUMN_RESOLUTION RESP_ACCESSIBILITY_PRESENTATION RESP_ANNOUNCEMENT_DELIVERY
			exclude "relationship.tag!=Runtime_RV_RF_INPUT_RESULT"
			properties {
				"runtime.steps" "1=RT_017;2=RT_018;3=RT_019;4=RT_020;5=RT_021;6=RT_022;7=RT_023;8=RT_024"
			}
			autoLayout lr
		}

		custom "RV_RF_NORMAL_APPLY_SUCCESS" {
			title "Runtime - RF normal apply success"
			include RESP_RF_INTERACTION RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_REORDER_APPLY_POLICY RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR RESP_FOCUS_COORDINATION RESP_WORDPRESS_REORDER_INTEGRATION RESP_ANNOUNCEMENT_DELIVERY
			exclude "relationship.tag!=Runtime_RV_RF_NORMAL_APPLY_SUCCESS"
			properties {
				"runtime.steps" "1=RT_025;2=RT_026;3=RT_027;4=RT_028;5=RT_029;6=RT_030;7=RT_031;8=RT_032;9=RT_033;10=RT_034;11=RT_035;12=RT_036"
			}
			autoLayout lr
		}

		custom "RV_RF_PREPARATION_FAILURE" {
			title "Runtime - RF pre-preparation apply failure"
			include RESP_RF_APPLY_COORDINATION RESP_ROW_TABLE_INTEGRATION RESP_COLUMN_TABLE_INTEGRATION RESP_RF_INTERACTION RESP_WORDPRESS_REORDER_INTEGRATION
			exclude "relationship.tag!=Runtime_RV_RF_PREPARATION_FAILURE"
			properties {
				"runtime.steps" "1=RT_037;2=RT_038;3=RT_039;4=RT_040;5=RT_041;6=RT_042"
			}
			autoLayout lr
		}

		custom "RV_RF_PREPARED_FAILURE" {
			title "Runtime - RF prepared apply failure and recovery"
			include RESP_ROW_TABLE_INTEGRATION RESP_RF_APPLY_COORDINATION RESP_COLUMN_TABLE_INTEGRATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION EXT_WORDPRESS_EDITOR RESP_FOCUS_COORDINATION RESP_RF_INTERACTION RESP_WORDPRESS_REORDER_INTEGRATION RESP_ANNOUNCEMENT_DELIVERY
			exclude "relationship.tag!=Runtime_RV_RF_PREPARED_FAILURE"
			properties {
				"runtime.steps" "1=RT_043;2=RT_044;3=RT_045;4=RT_046;5=RT_047;6=RT_048;7=RT_049;8=RT_050;9=RT_042;10=RT_051"
			}
			autoLayout lr
		}

		custom "RV_RF_CONFIRMATION_CANCEL" {
			title "Runtime - RF confirmation and cancel"
			include RESP_RF_APPLY_COORDINATION RESP_WORDPRESS_REORDER_APPLY_INTEGRATION RESP_ACCESSIBILITY_PRESENTATION RESP_FOCUS_COORDINATION EXT_WORDPRESS_EDITOR RESP_RF_INTERACTION RESP_WORDPRESS_REORDER_INTEGRATION
			exclude "relationship.tag!=Runtime_RV_RF_CONFIRMATION_CANCEL"
			properties {
				"runtime.steps" "1=RT_052;2=RT_053;3=RT_054;4=RT_055;5=RT_056;6=RT_057;7=RT_058"
			}
			autoLayout lr
		}

		custom "RV_RF_CLOSE" {
			title "Runtime - RF close and focus protection"
			include EXT_WORDPRESS_EDITOR RESP_WORDPRESS_REORDER_INTEGRATION RESP_RF_INTERACTION RESP_FOCUS_COORDINATION
			exclude "relationship.tag!=Runtime_RV_RF_CLOSE"
			properties {
				"runtime.steps" "1=RT_059;2=RT_060;3=RT_061;4=RT_062"
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
