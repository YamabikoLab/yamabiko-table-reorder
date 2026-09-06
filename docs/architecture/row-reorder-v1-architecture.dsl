// Generated from docs/architecture/reorder-v1-architecture.md. Do not edit manually.
workspace "YTR Reorder v1 Architecture" {
	!impliedRelationships false

	model {
		EXT_WORDPRESS_EDITOR = element "WordPress Editor" "External System" "QR-02で保証対象とする編集環境を提供し、Row Reorderの入力と表示が存在する。" {
			tags "External Context,External System"
			!script groovy {
				element.setGroup("WordPress Integration")
			}
		}
		EXT_SUPPORTED_TABLE_BLOCK = element "Supported Table Block" "External Block" "FR-13で定義されるCore TableまたはFlexible Table Blockであり、Table Integrationを介して行構造の取得と行順更新を行う対象。" {
			tags "External Context,External Block"
			!script groovy {
				element.setGroup("WordPress Integration")
			}
		}
		EXT_WORDPRESS_UNDO = element "WordPress Undo" "External Capability" "成立した1回の行並び替えを1回のUndoで戻せる更新単位を提供する。" {
			tags "External Context,External Capability"
			!script groovy {
				element.setGroup("WordPress Integration")
			}
		}
		EXT_SCROLL_AREA = element "Editor Scroll Area" "External Environment" "行DnD中に縦方向へ自動スクロールする対象領域を提供する。" {
			tags "External Context,External Environment"
			!script groovy {
				element.setGroup("WordPress Integration")
			}
		}
		EXT_DND_ENGINE = element "DnD Engine" "External Library" "物理入力の継続、物理的なDnD状態、現在の物理入力位置、および自動スクロール実行を提供する。" {
			tags "External Context,External Library"
		}

		RESP_REORDER_MODE = element "Reorder Mode" "Responsibility" "Tableツールバーの行・列入口、`edit" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Common")
			}
		}
		RESP_REORDER_GUIDANCE = element "Reorder Guidance" "Responsibility" "PC / タッチごとの初回案内表示済み状態と、Reorder Modeが所有する行・列入口をまとめて提示する共通案内状態を所有する外側の境界。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Reorder Common")
			}
		}
		RESP_EDITOR_DOM_CONTEXT = element "Editor DOM Context" "Responsibility" "現在のWordPress Editorに属するDOM / Web API contextを必要な時点で解決する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Editor Integration")
			}
		}
		RESP_ROW_INPUT_INTERACTION = element "Input Interaction" "Responsibility" "PCとタッチ端末の開始条件を解釈し、DnD開始候補と入力方式固有の一時状態を所有してDnD Engineへ接続する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_ROW_TABLE_INTEGRATION = element "Table Integration" "Responsibility" "対応Table Blockとの差を吸収し、行並び替えに必要なTable同一性、現在構造、行更新境界、およびWordPress Undoとの境界を提供する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_ROW_DND_INTERACTION = element "DnD Interaction" "Responsibility" "DnD Engineの物理的なDnD進行をRow Reorderの意味状態へ変換し、行DnD Session、開始可否判定、移動先判定、確定、中止のLifecycleを所有する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}
		RESP_ROW_PRESENTATION = element "Reorder Presentation" "Responsibility" "Row Reorderの意味状態と必要な物理的DnD情報から、行DnD中の独立した視覚フィードバックとDesignで定義された通知を表現する。" {
			tags "Responsibility"
			!script groovy {
				element.setGroup("Row Reorder")
			}
		}

		DEP_001 = RESP_REORDER_MODE -> EXT_WORDPRESS_EDITOR "WordPress Editor上のTableツールバー入口、通常編集と行・列並び替えの排他、および対象Table単位のモードLifecycleを扱うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_002 = RESP_REORDER_GUIDANCE -> EXT_WORDPRESS_EDITOR "初回案内の表示契機、および行・列の入口をまとめて提示する編集環境を必要とする。" {
			tags "Structural Dependency"
		}
		DEP_003 = RESP_REORDER_GUIDANCE -> RESP_EDITOR_DOM_CONTEXT "共通入口案内を現在のeditor contextで表現するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_004 = RESP_REORDER_GUIDANCE -> RESP_REORDER_MODE "Reorder Modeが所有する行・列入口の案内と、入口選択による案内終了を整合させるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_005 = RESP_EDITOR_DOM_CONTEXT -> EXT_WORDPRESS_EDITOR "現在のeditor contextを解決するために現在のWordPress Editorを必要とする。" {
			tags "Structural Dependency"
		}
		DEP_006 = RESP_ROW_INPUT_INTERACTION -> EXT_WORDPRESS_EDITOR "PCまたはタッチ端末の開始入力を判断するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_007 = RESP_ROW_INPUT_INTERACTION -> RESP_EDITOR_DOM_CONTEXT "入力開始時の現在のeditor contextを利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_008 = RESP_ROW_INPUT_INTERACTION -> RESP_REORDER_MODE "行並び替えが有効な期間だけ行入力を受理するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_009 = RESP_ROW_INPUT_INTERACTION -> EXT_DND_ENGINE "開始条件が成立した行だけを物理的なDnD開始候補へ接続し、DnD終了またはcancelを検知して自身の一時状態を終了するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_010 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Block固有の行構造取得と行順更新を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_011 = RESP_ROW_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した1回の行並び替えを1回のUndoで戻せる更新単位を維持するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_012 = RESP_ROW_DND_INTERACTION -> EXT_DND_ENGINE "active DnD成立前の開始試行、成立後の物理的なDnD進行、および現在の物理入力位置をRow Reorderの意味状態へ変換するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_013 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "DnD Interactionがモード状態を所有せず、DnD終了後のモードLifecycle判断をReorder Modeの責務として成立させるために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_014 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "開始可否判定時の行構造取得、complete時の現在構造への再照合、および確定した行移動の反映に必要とする。" {
			tags "Structural Dependency"
		}
		DEP_015 = RESP_ROW_PRESENTATION -> RESP_EDITOR_DOM_CONTEXT "現在のeditor contextで行DnDの表示を行うために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_016 = RESP_ROW_PRESENTATION -> EXT_DND_ENGINE "行DnDの表示に必要な物理的なDnD情報をSessionへ取り込まず利用するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_017 = RESP_ROW_PRESENTATION -> RESP_ROW_DND_INTERACTION "現在の有効な移動先、移動不可理由、終了時の表示解除、およびDesign上の通知要否を表示状態へ反映するために必要とする。" {
			tags "Structural Dependency"
		}
		DEP_018 = EXT_DND_ENGINE -> EXT_SCROLL_AREA "行DnD中に縦方向の自動スクロールを実行する対象領域として必要とする。" {
			tags "Structural Dependency"
		}

		PF_001 = EXT_WORDPRESS_EDITOR -> RESP_ROW_INPUT_INTERACTION "WordPress Editorの入力が行並び替えの入力境界へ入る。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_002 = RESP_ROW_INPUT_INTERACTION -> EXT_DND_ENGINE "入力方式固有の開始条件が成立した開始候補を物理的なDnD開始境界へ接続する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_003 = EXT_DND_ENGINE -> RESP_ROW_DND_INTERACTION "active DnD成立前の開始試行と、成立後のstart、progress、complete、cancelをRow Reorderの意味へ解釈する境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_004 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "開始可否判定時の行構造取得とcomplete時の現在構造取得・確定済み行移動の反映へ進む。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_005 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "対応Table Blockから行構造を取得し、確定時はtbodyの行順だけを反映する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_REORDER_END_TO_END,normal"
		}
		PF_006 = RESP_ROW_INPUT_INTERACTION -> RESP_ROW_DND_INTERACTION "[failure] 現在のEditor contextを利用できないなど、外部環境変化による継続不能を通常の終了結果として渡す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_007 = RESP_ROW_TABLE_INTEGRATION -> RESP_ROW_DND_INTERACTION "[failure] 対象Tableが現在利用できない、または更新開始前に現在更新できないなど、外部Table状態の変化による継続不能・確定不能を通常の結果として返す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,failure"
		}
		PF_008 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "[recovery] DnD中だけの表示状態を解除し、安全な操作継続不能による終了ではDesignで定義された通知を要求する。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,recovery"
		}
		PF_009 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "[recovery] DnD終了後に現在のTableで行並び替えモードを安全に継続できるかを外側のモード境界へ渡す。" {
			tags "Process Flow,ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY,recovery"
		}

		RT_001 = RESP_ROW_INPUT_INTERACTION -> EXT_DND_ENGINE "開始条件が成立した行だけをDnD開始候補として一時的に接続する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.1" "開始条件が成立した行だけをDnD開始候補として一時的に接続する。"
			}
		}
		RT_002 = EXT_DND_ENGINE -> RESP_ROW_DND_INTERACTION "active DnD成立前の開始試行と開始候補をRow Reorderの開始可否判定境界へ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.2" "active DnD成立前の開始試行と開始候補をRow Reorderの開始可否判定境界へ渡す。"
			}
		}
		RT_003 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "現在の対象Table情報を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.3" "現在の対象Table情報を要求する。"
			}
		}
		RT_004 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "現在の対応Table Blockから行構造とTable同一性を取得する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_START.step.4" "現在の対応Table Blockから行構造とTable同一性を取得する。"
				"runtime.RV_ROW_DND_COMPLETE.step.3" "現在の対応Table Blockから行構造とTable同一性を取得する。"
			}
		}
		RT_005 = RESP_ROW_DND_INTERACTION -> EXT_DND_ENGINE "開始可否結果を返し、開始不能な場合は物理的なDnDを成立させない。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.5" "開始可否結果を返し、開始不能な場合は物理的なDnDを成立させない。"
			}
		}
		RT_006 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "開始不能な場合は、必要な理由表示を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.6" "開始不能な場合は、必要な理由表示を要求する。"
			}
		}
		RT_007 = EXT_DND_ENGINE -> RESP_ROW_DND_INTERACTION "開始可能な場合だけ物理的なDnD開始成立をstart境界へ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.7" "開始可能な場合だけ物理的なDnD開始成立をstart境界へ渡す。"
			}
		}
		RT_008 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "Session開始時は移動対象行のDnD表示を開始する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_START"
			properties {
				"runtime.RV_ROW_DND_START.step.8" "Session開始時は移動対象行のDnD表示を開始する。"
			}
		}
		RT_009 = EXT_DND_ENGINE -> RESP_ROW_DND_INTERACTION "現在の物理入力位置をprogress境界へ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.1" "現在の物理入力位置をprogress境界へ渡す。"
			}
		}
		RT_010 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "現在の有効な移動先とRow Reorderの表示意味を更新する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.2" "現在の有効な移動先とRow Reorderの表示意味を更新する。"
			}
		}
		RT_011 = EXT_DND_ENGINE -> EXT_SCROLL_AREA "行DnDの移動に必要な場合だけ縦方向へ自動スクロールする。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.RV_ROW_DND_PROGRESS.step.3" "行DnDの移動に必要な場合だけ縦方向へ自動スクロールする。"
			}
		}
		RT_012 = EXT_DND_ENGINE -> RESP_ROW_DND_INTERACTION "物理的なDnD終了をcompleteまたはcancelとして解釈する境界へ渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.1" "物理的なDnD終了をcompleteまたはcancelとして解釈する境界へ渡す。"
			}
		}
		RT_013 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "completeでは現在のTable同一性と行構造を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.2" "completeでは現在のTable同一性と行構造を要求する。"
			}
		}
		RT_014 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "現在も成立し、実際に行順が変化することを確認できた場合だけ確定済み行移動の反映を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.4" "現在も成立し、実際に行順が変化することを確認できた場合だけ確定済み行移動の反映を要求する。"
			}
		}
		RT_015 = RESP_ROW_TABLE_INTEGRATION -> EXT_SUPPORTED_TABLE_BLOCK "tbodyの行順だけを確定結果として更新する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.5" "tbodyの行順だけを確定結果として更新する。"
			}
		}
		RT_016 = RESP_ROW_TABLE_INTEGRATION -> EXT_WORDPRESS_UNDO "成立した行並び替えを1回のUndoで戻せる更新単位として維持する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.6" "成立した行並び替えを1回のUndoで戻せる更新単位として維持する。"
			}
		}
		RT_017 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "DnD中だけの表示を終了する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.7" "DnD中だけの表示を終了する。"
			}
		}
		RT_018 = EXT_DND_ENGINE -> RESP_ROW_INPUT_INTERACTION "DnD終了またはcancelのLifecycleを通知し、Input Interactionが自身の開始候補と入力一時状態を破棄する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.8" "DnD終了またはcancelのLifecycleを通知し、Input Interactionが自身の開始候補と入力一時状態を破棄する。"
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.4" "DnD終了またはcancelのLifecycleを通知し、Input Interactionが自身の開始候補と入力一時状態を破棄する。"
			}
		}
		RT_019 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "complete終了後も現在のTableで行並び替えモードを維持できる結果を渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.RV_ROW_DND_COMPLETE.step.9" "complete終了後も現在のTableで行並び替えモードを維持できる結果を渡す。"
			}
		}
		RT_020 = RESP_ROW_DND_INTERACTION -> RESP_ROW_TABLE_INTEGRATION "complete時は現在の対象Table情報を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.1" "complete時は現在の対象Table情報を要求する。"
			}
		}
		RT_021 = RESP_ROW_TABLE_INTEGRATION -> RESP_ROW_DND_INTERACTION "現在のTable情報、または対象Tableが利用できない正常な不在を返す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.2" "現在のTable情報、または対象Tableが利用できない正常な不在を返す。"
			}
		}
		RT_022 = RESP_ROW_DND_INTERACTION -> RESP_ROW_PRESENTATION "DnD中だけの表示を解除し、安全な操作継続不能による終了としてDesignで定義された通知を要求する。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.3" "DnD中だけの表示を解除し、安全な操作継続不能による終了としてDesignで定義された通知を要求する。"
			}
		}
		RT_023 = RESP_ROW_DND_INTERACTION -> RESP_REORDER_MODE "現在のTableで行並び替えモードを安全に継続できるかという結果を渡す。" {
			tags "Runtime Interaction,Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.RV_ROW_DND_EXTERNAL_ABORT.step.5" "現在のTableで行並び替えモードを安全に継続できるかという結果を渡す。"
			}
		}
	}

	views {
		systemLandscape "DV_ROW_RESPONSIBILITY" {
			title "Structural Dependencies - Responsibility View"
			include EXT_WORDPRESS_EDITOR EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO EXT_SCROLL_AREA EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ROW_EDITOR_INTERACTION" {
			title "Structural Dependencies - Editor Interaction"
			include EXT_WORDPRESS_EDITOR EXT_DND_ENGINE RESP_REORDER_MODE RESP_REORDER_GUIDANCE RESP_EDITOR_DOM_CONTEXT RESP_ROW_INPUT_INTERACTION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ROW_DND_CORE" {
			title "Structural Dependencies - DnD Core"
			include EXT_SUPPORTED_TABLE_BLOCK EXT_DND_ENGINE RESP_REORDER_MODE RESP_ROW_INPUT_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_DND_INTERACTION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ROW_FEEDBACK" {
			title "Structural Dependencies - DnD Feedback"
			include EXT_SCROLL_AREA EXT_DND_ENGINE RESP_EDITOR_DOM_CONTEXT RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		systemLandscape "DV_ROW_DATA_UPDATE" {
			title "Structural Dependencies - Table Update"
			include EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION
			exclude "relationship.tag!=Structural Dependency"
			autoLayout lr
		}

		custom "PV_ROW_REORDER_END_TO_END" {
			title "Process Flow - Row Reorder End-to-End"
			include EXT_WORDPRESS_EDITOR RESP_ROW_INPUT_INTERACTION EXT_DND_ENGINE RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK
			exclude "relationship.tag!=ProcessFlow_PV_ROW_REORDER_END_TO_END"
			autoLayout lr
		}

		custom "PV_ROW_EXTERNAL_CHANGE_RECOVERY" {
			title "Process Flow [Failure / Recovery] - External Environment Change and Recovery"
			include RESP_ROW_INPUT_INTERACTION RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_PRESENTATION RESP_REORDER_MODE
			exclude "relationship.tag!=ProcessFlow_PV_ROW_EXTERNAL_CHANGE_RECOVERY"
			autoLayout lr
		}

		custom "RV_ROW_DND_START" {
			title "Runtime - Row DnD start attempt"
			include RESP_ROW_INPUT_INTERACTION EXT_DND_ENGINE RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK RESP_ROW_PRESENTATION
			exclude "relationship.tag!=Runtime_RV_ROW_DND_START"
			properties {
				"runtime.steps" "1=RT_001;2=RT_002;3=RT_003;4=RT_004;5=RT_005;6=RT_006;7=RT_007;8=RT_008"
			}
			autoLayout lr
		}

		custom "RV_ROW_DND_PROGRESS" {
			title "Runtime - Row DnD progress"
			include EXT_DND_ENGINE RESP_ROW_DND_INTERACTION RESP_ROW_PRESENTATION EXT_SCROLL_AREA
			exclude "relationship.tag!=Runtime_RV_ROW_DND_PROGRESS"
			properties {
				"runtime.steps" "1=RT_009;2=RT_010;3=RT_011"
			}
			autoLayout lr
		}

		custom "RV_ROW_DND_COMPLETE" {
			title "Runtime - Row DnD complete"
			include EXT_DND_ENGINE RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION EXT_SUPPORTED_TABLE_BLOCK EXT_WORDPRESS_UNDO RESP_ROW_PRESENTATION RESP_ROW_INPUT_INTERACTION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_ROW_DND_COMPLETE"
			properties {
				"runtime.steps" "1=RT_012;2=RT_013;3=RT_004;4=RT_014;5=RT_015;6=RT_016;7=RT_017;8=RT_018;9=RT_019"
			}
			autoLayout lr
		}

		custom "RV_ROW_DND_EXTERNAL_ABORT" {
			title "Runtime - Row DnD external change abort"
			include RESP_ROW_DND_INTERACTION RESP_ROW_TABLE_INTEGRATION RESP_ROW_PRESENTATION EXT_DND_ENGINE RESP_ROW_INPUT_INTERACTION RESP_REORDER_MODE
			exclude "relationship.tag!=Runtime_RV_ROW_DND_EXTERNAL_ABORT"
			properties {
				"runtime.steps" "1=RT_020;2=RT_021;3=RT_022;4=RT_018;5=RT_023"
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
