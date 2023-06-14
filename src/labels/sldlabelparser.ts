/**
 * ZX81 Debugger
 * 
 * File:			sldlabelparser
 * Description:		Parser for SLD files
 * Author:			Sebastien Andrivet, based on Dezog my Thomas Busse (Maziac)
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 * 					DeZog Copyright (C) 2023 Maziac
 */
import {readFileSync} from 'fs';
import {Utility} from '../misc/utility';
import {SourceFileEntry, ListFileLine} from './labels';

/**
 * An issue is an error or warning generated while parsing the list file.
 * As list files are computer generated this normally does not happen, except
 * for warnings.
 * But for the manually created reverse engineering list file errors can happen
 * quite easily.
 */
export interface Issue {
	// The parser human readable name
	parser: string;

	// The absolute file path where the problem occurred.
	filepath: string;

	// The line number, 0-based.
	lineNr: number;

	// The severity:
	severity: 'error' | 'warning';

	// The error or warning text.
	message: string;
}


/**
 * This class parses SLD file.
 * SLD stands for Source Level Debugging.
 * 'SLD data are extra "tracing" data produced during assembling for debuggers and IDEs,
 * similar to "map" files already supported by sjasmplus (LABELSLIST and CSPECTMAP).
 * The debugger can read these data, and with non-tricky source producing machine code
 * with correct device memory mapping, the debugger can trace the origins of every
 * instruction back to the original source code line, and display the source instead/along
 * the disassembly view (the "map" files mentioned above provide only list of labels which
 * is usually already super helpful, but can't track the source origins of each instruction).'
 * See https://z00m128.github.io/sjasmplus/documentation.html#idp10
 *
 * A few notes:
 * - numberForLabel and labelsForNumber will normally only get 64k
 *   addresses/values (unless an EQU is by itself bigger than 0xFFFF.
 * - fileLineNrs and lineArrays will get potentially long address.
 *   I.e. their value is either a normal 64k address or a long address
 *   with bank number.
 *
 */
export class SldLabelParser {
	// parser name (for errors).
	protected parserName = "sld";

	// Mainly for error reporting.
	public currentLineNr: number = 0;

	/// Map that associates memory addresses (PC values) with line numbers
	/// and files.
	/// Long addresses.
	protected fileLineNrs: Map<number, SourceFileEntry>;

	/// Map of arrays of line numbers. The key of the map is the filename.
	/// The array contains the correspondent memory address for the line number.
	/// Long addresses.
	protected lineArrays: Map<string, Array<number>>;

	/// An element contains either the offset from the last
	/// entry with labels or an array of labels for that number.
	/// Array contains a max 0x10000 entries. Thus it is for
	/// 64k addresses.
	protected labelsForNumber64k: Array<any>;

	/// This map is used to associate long addresses with labels.
	/// E.g. used for the call stack.
	/// Long addresses.
	protected labelsForLongAddress = new Map<number, Array<string>>();

	/// Map with all labels (from labels file) and corresponding values.
	/// Long addresses.
	protected numberForLabel = new Map<string, number>();

	/// Map with label / file location association.
	/// Does not store local labels.
	/// Is used only for unit tests.
	/// Long addresses.
	protected labelLocations: Map<string, {file: string, lineNr: number, address: number}>;


	/// Stores the address of the watchpoints together with the line contents.
	/// Long addresses.
	protected watchPointLines: Array<{address: number, line: string}>;

	/// Stores the address of the assertions together with the line contents.
	/// Long addresses.
	protected assertionLines: Array<{address: number, line: string}>;

	/// Stores the address of the logpoints together with the line contents.
	/// Long addresses.
	protected logPointLines: Array<{address: number, line: string}>;

	/// Source Level Debugging info
	protected sld: string;

	/// Used for found MODULEs (Not used anymore?)
	protected modulePrefix: string;
	protected lastLabel: string;		// Only used for local labels (without modulePrefix)

	/// The separator used for local labels and modules.
	/// Normally a dot, but could also be defined otherwise.
	protected labelSeparator = '.';

	/// Holds the list file entry for the current line.
	protected currentFileEntry: ListFileLine;

	/// The stack of include files. For parsing filenames and line numbers.
	protected includeFileStack: Array<{fileName: string, lineNr: number}>;


	// Regexes to find WPMEM, ASSERTION and LOGPOINT in the comments
	protected wpmemRegEx = /.*(\bWPMEM([\s,]|$).*)/;
	protected assertionRegEx = /.*(\bASSERTION([\s,]|$).*)/;
	protected logpointRegEx = /.*(\bLOGPOINT([\s,]|$).*)/;


	/// Used to determine if current (included) files are used or excluded in the addr <-> file search.
	protected excludedFileStackIndex: number;

	/// This function gets called when a problem arises, an error or warning.
	protected issueHandler: (issue: Issue) => void;
	
	// <source file>|<src line>|<definition file>|<def line>|<page>|<value>|<type>|<data>
	// Format example:
	// |SLD.data.version|0
	// main.asm|5||0|-1|1|D|NEX
	// main.asm|10||0|-1|-1|Z|pages.size: 8192, pages.count: 224, slots.count: 8, slots.adr: 0, 8192, 16384, 24576, 32768, 40960, 49152, 57344
	// main.asm|15||0|11|24576|F|screen_top
	// utilities.asm|7||0|-1|500|D|PAUSE_TIME
	// src/breakpoints.asm|222||0|92|57577|F|enter_debugger.int_found
	// src/breakpoints.asm|222||0|92|57577|L|,enter_debugger,int_found,+used
	// src/breakpoints.asm|224||0|92|57577|T|
	// src/breakpoints.asm|225||0|92|57580|K|; LOGPOINT [INT] Saving interrupt state: ${A:hex}h
	// Note: F/D are not used (deprecated), instead L is used

	/// Regex to skip a commented SLDOPT, i.e. "; SLDOPT"
	protected regexSkipSldOptComment = /^;\s*sldopt/i;

	/// Map that associates memory addresses (PC values) with line numbers
	/// and files.
	/// This contains estimated address to file/line associations.
	/// I.e. they only indirectly derive from the SLD file.
	/// All addresses belonging to an instruction (except the start address)
	/// are put in here.
	/// This is simply done by assuming each instruction is 4 byte.
	/// I.e. the remaining 3 byte are put in here.
	/// In post processing all addresses that are not present in the fileLineNrs
	/// map are also set in the fileLineNrs map.
	/// The problem that is solved is SMC (self modifying code). ZX81 Debugger would switch to
	/// the disassembly file otherwise.
	/// Long addresses.
	protected estimatedFileLineNrs = new Map<number, SourceFileEntry>();

	/**
	 *  Constructor.
	 * @param issueHandler Gets called when an error or problem is found in the file.
	 */
		public constructor(
		fileLineNrs: Map<number, SourceFileEntry>,
		lineArrays: Map<string, Array<number>>,
		labelsForNumber64k: Array<any>,
		labelsForLongAddress: Map<number, Array<string>>,
		numberForLabel: Map<string, number>,
		labelLocations: Map<string, {file: string, lineNr: number, address: number}>,
		watchPointLines: Array<{address: number, line: string}>,
		assertionLines: Array<{address: number, line: string}>,
		logPointLines: Array<{address: number, line: string}>,
		issueHandler: (issue: Issue) => void
	) {
		// Store variables
		this.fileLineNrs = fileLineNrs;
		this.lineArrays = lineArrays;
		this.labelsForNumber64k = labelsForNumber64k;
		this.labelsForLongAddress = labelsForLongAddress;
		this.numberForLabel = numberForLabel;
		this.labelLocations = labelLocations;
		this.watchPointLines = watchPointLines;
		this.assertionLines = assertionLines;
		this.logPointLines = logPointLines;
		this.issueHandler = issueHandler;
	}


	/**
	 * Reads the given sld file.
	 * As the SLD file is easy to read only one pass is required.
	 * @param config The assembler configuration.
	 */
	public loadAsmListFile(sld: string) {
		this.sld = sld;

		// Init (in case of several sld files)
		this.lastLabel = undefined as any;

		// Strip away windows line ending
		const sldLinesFull = readFileSync(sld).toString().split('\n');
		const sldLines = sldLinesFull.map(line => line.trimEnd());
		this.checkSldVersion(sldLines);

		// Loop through all lines of the sld file
		for (const line of sldLines) {
			this.parseFileLabelAddress(line);
		}

		// Now put all estimated file/line addresses into the main file
		for (let [address, entry] of this.estimatedFileLineNrs) {
			if (!this.fileLineNrs.get(address)) {
				// Only if address not yet exists
				this.setFileLineNrForAddress(address, entry);
			}
		}
	}

	/**
	 * Associates the structure with file and lineNr to the address.
	 * Additionally uses the true-case-path for this.
	 * I.e. on windows and macos a path could have been used with a different capitalization.
	 * But for storage the correct path is used.
	 * This in turn also checks if the file is available at all.
	 * @param longAddress Long address
	 * @param entry Contains (relative) file name, lineNr, etc.
	 */
	protected setFileLineNrForAddress(longAddress: number, entry: SourceFileEntry) {
		this.fileLineNrs.set(longAddress, entry);
	}

	/**
	 * Adds a new label to the labelsForNumber64k array.
	 * Creates a new array if required.
	 * Adds the the label/value pair also to the numberForLabelMap.
	 * Don't use for EQUs > 64k.
	 * On the other hand long addresses can be passed.
	 * I.e. everything > 64k is interpreted as long address.
	 * Handles 64k and long addresses.
	 * @param value The value for which a new label is to be set. If a value > 64k it needs
	 * to be a long address.
	 * I.e. EQU values > 64k are not allowed here.
	 * @param label The label to add.
	 * @param labelType I.e. NORMAL, LOCAL or GLOBAL.
	 */
	protected addLabelForNumberRaw(value: number, label: string) {
		// Label: add to label array, long address
		this.numberForLabel.set(label, value);

		// Add label to labelsForNumber64k (just 64k address)
		const value64k = value & 0xFFFF;
		let labelsArray = this.labelsForNumber64k[value64k];
		if (labelsArray === undefined) {
			// create a new array
			labelsArray = new Array<string>();
			this.labelsForNumber64k[value64k] = labelsArray;
		}
		// Check if label already exists
		if (labelsArray.indexOf(label) < 0)
			labelsArray.push(label);	// Add new label

		// Add label to labelsForLongAddress
		labelsArray = this.labelsForLongAddress.get(value);
		if (labelsArray === undefined) {
			// create a new array
			labelsArray = new Array<string>();
			this.labelsForLongAddress.set(value, labelsArray);
		}
		// Check if label already exists
		if (labelsArray.indexOf(label) < 0)
			labelsArray.push(label);	// Add new label
	}

	/**
	 * Checks the SLD file version and throws an exception if too old.
	 */
	protected checkSldVersion(lines: Array<string>) {
		// Check only first line
		if (lines.length < 1)
			this.throwError("'" + this.sld + "' is empty.");	// throws
		// First line
		const fields = lines[0].split('|');
		if (fields[1] != 'SLD.data.version')
			this.throwError("'" + this.sld + "': SLD data version not found.");
		const version = fields[2] || '0';
		const requiredVersion = 1;
		if (parseInt(version) < requiredVersion)
			this.throwError("'" + this.sld + "': SLD data version " + version + " is too old. Need SLD version " + requiredVersion + ".");
	}


	/**
	 * Parses one line for label, address, file and line number.
	 * Parses one line of the SLD file.
	 * @param line The current analyzed line of the SLD file.
	 */
	protected parseFileLabelAddress(line: string) {
		// Split the fields, e.g. "main.asm|15||0|11|24576|F|screen_top"
		const fields = line.split('|');

		// Get filename
		let sourceFile = fields[0];
		// Check for comment or SLD.data.version
		if (sourceFile == '')
			return;

		sourceFile = Utility.getAbsFilePath(sourceFile);

		// Definition file/line not required

		// Get value
		let value = parseInt(fields[5]);
		// Note: An EQU could have a value bigger than 0xFFFF

		// Get type
		const type = fields[6];

		// Get label
		const label = fields[7];

		// Check data type
		switch (type) {
			case 'L': // Address labels or EQU
				// 0: module name
				// 1: main label
				// 2: local label
				// 3: optional usage traits, i.e. +equ, +macro, +reloc, +reloc_high, +used, +module, +endmod, +struct_def, +struct_data
				{
					// Split
					const lbls = label.split(',');
					const trait = lbls[3];	// E.g. "+equ", "+module", "+endmod"
					this.modulePrefix = lbls[0];
					// Check for ENDMODULE
					if (trait == "+endmod") {
						// Remove the last module (note: modules names cannot include a dot)
						const modArr = this.modulePrefix.split('.');
						modArr.pop();	// Remove last element
						this.modulePrefix = modArr.join('.');
					}
					if (this.modulePrefix)
						this.modulePrefix += '.';
					// Label
					const mainLabel = lbls[1];
					if (!mainLabel)
						break;
					this.lastLabel = mainLabel;
					const localLabel = lbls[2];	// without the '.'
					let fullLabel = mainLabel;
					if (this.modulePrefix)
						fullLabel = this.modulePrefix + mainLabel;
					if (localLabel)
						fullLabel += '.' + localLabel;

					// If some label exists
					if (fullLabel) {
						// Label: add to label array
						this.addLabelForNumberRaw(value, fullLabel);

						// Add (full) label to labelLocations for unit tests
						const lineNr = parseInt(fields[1]) - 1;	// Get line number
						this.labelLocations.set(fullLabel, {file: sourceFile, lineNr, address: value});
					}
				}
				break;
			case 'T':	// Instruction trace data
				{
					// Get line number
					const lineNr = parseInt(fields[1]) - 1;

					// Store values to associate address with line number and (last) label.
					this.setFileLineNrForAddress(value, {
						fileName: sourceFile,
						lineNr: lineNr,
						modulePrefix: this.modulePrefix,
						lastLabel: this.lastLabel,
						size: 1	// size is used in the disassembly at the moment for reverse engineering only and it is only important if 0 or not 0. We don't know the instruction size in sld, so we assume 1 here.
					});

					// Check if a new array need to be created
					let lineArray = this.lineArrays.get(sourceFile);
					if (!lineArray) {
						lineArray = new Array<number>();
						this.lineArrays.set(sourceFile, lineArray);
					}
					// Store long address
					if (lineArray[lineNr] == undefined) {
						// Store only the first. Otherwise a breakpoint on a multi instruction
						// line would be on the last instruction and not the first.
						lineArray[lineNr] = value;
					}
				}
				break;
			case 'K':	// A comment, e.g. WPMEM, ASSERTION and LOGPOINT
				{
					// Check for WPMEM etc.
					const comment = fields[7];
					this.findWpmemAssertionLogpoint(value, comment);
				}
				break;

		}
	}


	/**
	 * Parses the line for comments with WPMEM, ASSERTION or LOGPOINT.
	 * Note: This only collect the lines. Parsing is done at a
	 * later state when all labels are known.
	 * @param address The address that correspondents to the line.
	 * @param fullLine The line of the list file as string.
	 * Only if the line does not start with ";SLDOPT".
	 * I.e. it filters any commented SLDOPT line.
	 */
	protected findWpmemAssertionLogpoint(address: number | undefined, line: string) {
		// Skip line that starts with "; SLDOPT"
		let match = this.regexSkipSldOptComment.exec(line);
		if (match) return;

		// Extract just comment
		const comment = this.getComment(line);

		// WPMEM
		match =this.wpmemRegEx.exec(comment);
		if (match) {
			// Add watchpoint at this address
			/*
			if (this.currentFileEntry&&this.currentFileEntry.size==0)
				this.watchPointLines.push({address: undefined as any, line: match[1]}); // watchpoint inside a macro or without data -> Does not work: WPMEM could be on a separate line
			else
			*/
			this.watchPointLines.push({address: address!, line: match[1]});
		}

		if (address == undefined)
			return;

		// ASSERTION
		match = this.assertionRegEx.exec(comment);
		if (match) {
			// Add ASSERTION at this address
			this.assertionLines.push({address, line: match[1]});
		}

		// LOGPOINT
		match = this.logpointRegEx.exec(comment);
		if (match) {
			// Add logpoint at this address
			this.logPointLines.push({address, line: match[1]});
		}
	}

	/**
	 * Check the list file line for a comment and returns just the comment.
	 * Only override if you allow other line comment identifiers than ";".
	 * @param line The line of the list file as string. E.g. "5    A010 00 00 00...  	defs 0x10		; WPMEM, 5, w"
	 * @returns Just the comment, e.g. the text after ";". E.g. " WPMEM, 5, w"
	 */
	protected getComment(line: string): string {
		const i = line.indexOf(";");
		if (i < 0)
			return "";	// No comment
		const comment = line.substring(i + 1);
		return comment;
	}

	/**
	 * Sends a warning to the Labels class to print out a PROBLEM.
	 * @param message The text to print.
	 */
	protected sendWarning(message: string, severity: "error" | "warning" = "warning", filepath?: string, lineNr?: number) {
		if (filepath == undefined)
			filepath = this.sld;
		if (lineNr == undefined)
			lineNr = this.currentLineNr;
		const issue: Issue = {
			parser: this.parserName,
			severity,
			filepath,
			lineNr,
			message
		};
		this.issueHandler(issue);
	}


	/**
	 * Sends a warning to the Labels class to print out a PROBLEM.
	 * Throws an exception.
	 * @param message The text to print.
	 */
	protected throwError(message: string) {
		this.sendWarning(message, "error");
		// And throw an exception to stop
		//throw Error("Label parser error.");
		throw Error(message);
	}

}
