/**
 * RF Input Interpretationとして、利用者向けRow / Column入力を方向固有Resolutionが扱う内部指定へ変換する。
 *
 * この責務は入力そのものが解釈可能かだけを判定し、Table構造、結合セル、no-op、移動先境界、Apply可否、UI表示状態は扱わない。
 * Rowでは利用者向け1-based行番号を0-based indexへ変換し、Columnでは現在の列選択肢に存在する論理列Identityだけを受理する。
 */

/** Row RFフォームで利用者が指定する入力値。 */
export type RowRfFormInput = {
	/** 移動する行の利用者向け1-based行番号。 */
	sourceRowNumber: string;
	/** 移動先として指定する行の利用者向け1-based行番号。 */
	targetRowNumber: string;
	/** 移動先行に対する配置位置。未選択時はnull。 */
	position: 'above' | 'below' | null;
};

/** Row RF Resolutionへ渡す、解釈済みの内部指定。 */
export type RowRfSpecification = {
	/** 移動する行の0-based index。 */
	sourceRowIndex: number;
	/** 移動先として指定された行の0-based index。 */
	targetRowIndex: number;
	/** 移動先行に対する配置位置。 */
	position: 'above' | 'below';
};

/** Row RF入力で修正が必要な対象と現在有効な修正条件。 */
export type RowRfInputProblem = {
	/** 修正が必要な入力。 */
	target: 'source' | 'target';
	/** 現在Tableで入力できる1-based行番号範囲。 */
	correction: {
		kind: 'row-number-range';
		min: number;
		max: number;
	};
};

/** Row RFフォーム入力の解釈結果。 */
export type RowRfInputInterpretation =
	| {
			/** Resolutionへ進めない入力状態。 */
			status: 'not-ready';
			/** 未入力を除き、現在修正が必要なsource / target入力。 */
			inputProblems: readonly RowRfInputProblem[];
	  }
	| {
			/** Resolutionへ進める入力状態。 */
			status: 'ready';
			/** 利用者向け入力を内部位置へ変換したRow RF指定。 */
			specification: RowRfSpecification;
	  };

/** Column RFフォームで利用者が指定する入力値。 */
export type ColumnRfFormInput = {
	/** 移動する列の論理列Identity。未選択時はnull。 */
	sourceColumnIndex: number | null;
	/** 移動先として指定する列の論理列Identity。未選択時はnull。 */
	targetColumnIndex: number | null;
	/** 移動先列に対する配置位置。未選択時はnull。 */
	position: 'left' | 'right' | null;
};

/** Column RF Resolutionへ渡す、解釈済みの内部指定。 */
export type ColumnRfSpecification = {
	/** 移動する列の0-based論理列index。 */
	sourceColumnIndex: number;
	/** 移動先として指定された列の0-based論理列index。 */
	targetColumnIndex: number;
	/** 移動先列に対する配置位置。 */
	position: 'left' | 'right';
};

/** Column RF入力で修正が必要な対象と再選択条件。 */
export type ColumnRfInputProblem = {
	/** 修正が必要な入力。 */
	target: 'source' | 'target';
	/** 現在の列選択肢から再選択する必要があることを示す修正条件。 */
	correction: {
		kind: 'select-current-column';
	};
};

/** Column RFフォーム入力の解釈結果。 */
export type ColumnRfInputInterpretation =
	| {
			/** Resolutionへ進めない入力状態。 */
			status: 'not-ready';
			/** 未選択を除き、現在修正が必要なsource / target入力。 */
			inputProblems: readonly ColumnRfInputProblem[];
	  }
	| {
			/** Resolutionへ進める入力状態。 */
			status: 'ready';
			/** 現在の列選択肢に照合済みのColumn RF指定。 */
			specification: ColumnRfSpecification;
	  };

/** RF Input InterpretationがColumn入力成立性の照合に利用する現在列Identity。 */
type ColumnRfInputChoice = {
	/** 現在Table上の0-based論理列Identity。 */
	columnIndex: number;
};

/**
 * 利用者向け行番号を、現在のRow RF入力範囲内にある0-based indexへ変換する。
 *
 * @param value    利用者が入力した行番号文字列。
 * @param rowCount 現在Tableのtbody行数。
 * @return 有効な行番号に対応する0-based index。入力として成立しない場合はnull。
 */
const interpretRowNumber = ( value: string, rowCount: number ): number | null => {
	const trimmedValue = value.trim();
	/* 行番号は空白を除いた文字列全体が10進整数を表す場合だけ入力として受理する。 */
	if ( ! /^\d+$/.test( trimmedValue ) ) {
		return null;
	}

	const rowNumber = Number( trimmedValue );
	/* 現在Tableに存在する1-based行番号だけを内部位置へ変換する。 */
	if ( ! Number.isSafeInteger( rowNumber ) || rowNumber < 1 || rowNumber > rowCount ) {
		return null;
	}

	return rowNumber - 1;
};

/**
 * Row RFフォーム入力を解釈する。
 *
 * 必要な3入力が成立した場合だけ、利用者向け1-based行番号を0-based indexへ変換した内部指定を返す。
 * 未入力は入力待ちとして扱い、入力済みだが現在範囲で成立しないsource / targetだけを修正対象として公開する。
 * source / targetの位置関係によるno-opやTable構造上の移動可否は判定しない。
 *
 * @param input    Row RFフォームの現在入力。
 * @param rowCount 現在Tableのtbody行数。
 * @return Resolutionへ進める内部指定、または入力がまだ成立していないことを示す結果。
 */
export const interpretRowRfInput = (
	input: RowRfFormInput,
	rowCount: number
): RowRfInputInterpretation => {
	/* 有効な入力範囲自体が成立しない場合は修正条件を推測せず入力待ちとして扱う。 */
	if ( ! Number.isSafeInteger( rowCount ) || rowCount < 1 ) {
		return { status: 'not-ready', inputProblems: [] };
	}

	const sourceRowIndex = interpretRowNumber( input.sourceRowNumber, rowCount );
	const targetRowIndex = interpretRowNumber( input.targetRowNumber, rowCount );
	const inputProblems: RowRfInputProblem[] = [];
	/* 未入力は問題にせず、入力済みだが現在範囲へ変換できないsourceだけを修正対象とする。 */
	if ( input.sourceRowNumber.trim() !== '' && sourceRowIndex === null ) {
		inputProblems.push( {
			target: 'source',
			correction: { kind: 'row-number-range', min: 1, max: rowCount },
		} );
	}
	/* targetもsourceと独立して評価し、両方が不正なら二つの問題を同時に公開する。 */
	if ( input.targetRowNumber.trim() !== '' && targetRowIndex === null ) {
		inputProblems.push( {
			target: 'target',
			correction: { kind: 'row-number-range', min: 1, max: rowCount },
		} );
	}

	/* 必要入力が未成立、または修正対象がある場合は内部指定を生成しない。 */
	if (
		sourceRowIndex === null ||
		targetRowIndex === null ||
		input.position === null ||
		inputProblems.length > 0
	) {
		return { status: 'not-ready', inputProblems };
	}

	return {
		status: 'ready',
		specification: {
			sourceRowIndex,
			targetRowIndex,
			position: input.position,
		},
	};
};

/**
 * Column RFフォーム入力を解釈する。
 *
 * 必要な3入力が成立し、source / targetの論理列Identityが現在の列選択肢に存在する場合だけ内部指定を返す。
 * 未選択は入力待ちとして扱い、選択済みだが現在の列選択肢から消えたsource / targetだけを修正対象として公開する。
 * blocked boundary、結合セル、no-op、移動先境界などの方向固有制約は判定しない。
 *
 * @param input   Column RFフォームの現在入力。
 * @param columns RF Interactionから渡された現在Tableの列Identity集合。
 * @return Resolutionへ進める内部指定、または入力がまだ成立していないことを示す結果。
 */
export const interpretColumnRfInput = (
	input: ColumnRfFormInput,
	columns: readonly ColumnRfInputChoice[]
): ColumnRfInputInterpretation => {
	const sourceExists =
		input.sourceColumnIndex !== null &&
		columns.some( ( column ) => column.columnIndex === input.sourceColumnIndex );
	const targetExists =
		input.targetColumnIndex !== null &&
		columns.some( ( column ) => column.columnIndex === input.targetColumnIndex );
	const inputProblems: ColumnRfInputProblem[] = [];
	/* 選択済みsourceが現在の列選択肢から消えた場合だけ、再選択が必要な問題として公開する。 */
	if ( input.sourceColumnIndex !== null && ! sourceExists ) {
		inputProblems.push( {
			target: 'source',
			correction: { kind: 'select-current-column' },
		} );
	}
	/* targetもsourceと独立して評価し、両方が消失した場合は二つの問題を同時に公開する。 */
	if ( input.targetColumnIndex !== null && ! targetExists ) {
		inputProblems.push( {
			target: 'target',
			correction: { kind: 'select-current-column' },
		} );
	}

	/* 必要な選択が不足している、または修正対象がある場合は方向固有Resolutionへ内部指定を渡さない。 */
	if (
		input.sourceColumnIndex === null ||
		input.targetColumnIndex === null ||
		input.position === null ||
		inputProblems.length > 0
	) {
		return { status: 'not-ready', inputProblems };
	}

	return {
		status: 'ready',
		specification: {
			sourceColumnIndex: input.sourceColumnIndex,
			targetColumnIndex: input.targetColumnIndex,
			position: input.position,
		},
	};
};
