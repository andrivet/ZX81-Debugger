/**
 * ZX81 Debugger
 * 
 * File:			renderedlines.ts
 * Description:		Holds the disassembled/rendered lines (text)
 * Author:			Sebastien Andrivet, based on Dezog my Thomas Busse (Maziac)
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 * 					DeZog Copyright (C) 2023 Maziac
 */

/**
 * Class that holds the disassembled/rendered lines (text).
 */
export class RenderedLines {
	// The lines in an array.
	protected lines: string[] = [];

	
	/** @returns The length of the array.
	 */
	public length() {
		return this.lines.length;
	}


	/** Adds a newline.
	 * But only if previous line is no newline.
	 */
	public addNewline() {
		const lastLine = this.lines.at(-1);
		if (lastLine) {
			// Only if last line is not already a newline
			this.lines.push('');
		}
	}

	/** Adds a line.
	 * @param text The text to add in a separate line.
	 */
	public addLine(text: string) {
		this.lines.push(text);
	}


	/** Returns the concatenated text.
	 * @returns All lines as one string.
	 */
	public getText() {
		return this.lines.join('\n');
	}
}