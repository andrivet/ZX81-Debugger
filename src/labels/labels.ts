import { FileWatcher } from './../misc/filewatcher';
import { EventEmitter } from 'events';
import {ListConfigBase} from './../settings/settings';
import {Utility} from '../misc/utility';
import {MemoryModel} from '../remotes/MemoryModel/memorymodel';
import {Remote} from '../remotes/remotebase';
import {SjasmplusSldLabelParser} from './sjasmplussldlabelparser';
import {Z80asmLabelParser} from './z80asmlabelparser';
import {Z88dkLabelParser} from './z88dklabelparser';
import * as fs from 'fs';
import {ReverseEngineeringLabelParser} from './reverseengineeringlabelparser';
import {SettingsParameters} from '../settings/settings';
import {Issue, LabelParserBase} from './labelparserbase';

/**
 * For the association of the addresses to the files.
 * modulePrefix and lastLabel are also put here. They are used mainly for hovering.
 * This is not optimal but too much effort to change.
 */
export interface SourceFileEntry {
	fileName: string;	/// The associated source filename
	lineNr: number;		/// The line number of the associated source file
	modulePrefix?: string;	/// For sjasmplus: module is an optional module prefix that is added to all labels (e.g. "sprites.sw.").
	lastLabel?: string;	/// For local labels: lastLabel is the last non-local label that is used as prefix for local labels. modulePrefix and lastLabel are used for hovering.
	size: number;		/// The size of bytes the line extends to. I.e. the line covers addresses [address;address+size-1]. Can be 0 if just a label is defined.
}


/**
 * The representation of the list file.
 */
export interface ListFileLine extends SourceFileEntry {
	addr?: number;		/// The corresponding address from the list file
	line: string;		/// The text of the line of the list file
}


/**
 * Entries for the distanceForLabelAddress map.
 * Required would be only the number.
 * But the name of the next label is also stored for debugging
 * purposes.
 */
export interface NextLabelDistance {
	distance: number;		/// The distance in bytes to the next label
	nextLabel: string;		/// The next label as string.
}



/**
 * Calculation of the labels from the input list and labels file.
 *
 * For "normal" list files the labels are 64k addresses.
 * Special assemblers (e.g. sjasmplus) is also able to generate label
 * information that includes the used bank number as well.
 *
 * DeZog is capable of handling both. If banking information should be used as
 * well then the bankSize field is set to something different than 0.
 * This has to be set by the list file parser.
 * Furthermore the list file parser has to provide these 'long addresses'
 * in a special format.
 * Please look at SjasmplusSldLabelParser as an example.
 *
 * LabelsClass is derived from EventEmitter to emit 'reload' events.
 * This is used for the ReverseEngineeringLabelParser to reload labels on the fly
 * if the list file was updated by the user.
 */
export class LabelsClass extends EventEmitter {
	// Function used to add an error to the diagnostics.
	public static addDiagnosticsErrorFunc: ((message: string, severity: 'error' | 'warning', filepath: string, line: number, column: number) => void) | undefined;

	/// Map that associates memory addresses (PC values) with line numbers
	/// and files.
	/// Long addresses.
	protected fileLineNrs = new Map<number, SourceFileEntry>();

	/// Map of arrays of line numbers. The key of the map is the filename.
	/// The array contains the correspondent memory address for the line number.
	/// Long addresses.
	protected lineArrays = new Map<string, Array<number>>();

	/// An element contains either the offset from the last
	/// entry with labels or an array of labels for that number.
	/// Array contains a max 0x10000 entries. Thus it is for
	/// 64k addresses.
	protected labelsForNumber64k = new Array<any>(0x10000);

	/// This map is used to associate long addresses with labels.
	/// E.g. used for the call stack.
	/// Long addresses.
	protected labelsForLongAddress = new Map<number, Array<string>>();

	/// This map contains the distance to the next label.
	/// E.g.
	/// [0x8000] = 4  : Label	stack_bottom
	/// [0x8001] = 3  : 3 bytes to stack_top
	/// [0x8002] = 2
	/// [0x8003] = 1
	/// [0x8004] = 1	: Label stack_top
	/// Note: The stored 'NextLabelDistance' type stores also the
	/// name of the next label.
	/// The map contains long addresses.
	protected distanceForLabelAddress = new Map<number, NextLabelDistance>();

	/// Map with all labels (from labels file) and corresponding values.
	/// Long addresses.
	protected numberForLabel = new Map<string, number>();


	/// Map with a key with a label that contains other maps recursively.
	/// I.e. a dotted label like 'a.b.c.d' can be referenced through
	/// through 'a' which will contain another map which can be referneced by 'b'
	/// and so on.
	/// Used for displaying structs in the watches window.
	protected labelsHierarchy = new Map<string, any>();


	/// Map with label / file location association.
	/// Used in sourcesModeFinish to create the file label association and
	/// used in unit tests to point to the unit tests.
	/// Direct relationship: The line number of the label is returned.
	/// Not the line number of the value of the label.
	/// Long addresses.
	protected labelLocations = new Map<string, {file: string, lineNr: number, address: number}>()

	/// Stores the address of the watchpoints together with the line contents.
	/// Long addresses.
	protected watchPointLines = new Array<{address: number, line: string}>();

	/// Stores the address of the assertions together with the line contents.
	/// Long addresses.
	protected assertionLines = new Array<{address: number, line: string}>();

	/// Stores the address of the logpoints together with the line contents.
	/// Long addresses.
	protected logPointLines = new Array<{address: number, line: string}>();


	/// From the Settings.
	protected smallValuesMaximum: number;


	/// The used bank size. Only set if the assembler+parser supports
	/// long addresses. Then it holds the used bank size (otherwise 0).
	/// Is used to tell if the Labels are long or not and for internal
	/// conversion if target has a different memory model.
	/// Typical value: 0, 8192 or 16384.
	protected bankSize: number;	// TODO: still required?

	// Remembers if an error happened.
	protected errorHappened: boolean;

	/// The used memory model. E.g. if and how slots are used.
	/// Set during 'readListFiles'.
	//public memoryModel: MemoryModel;

	// Contains the watched files. For reverse engineering auto re-load.
	protected watchedFiles: Array<FileWatcher> = [];


	/**
	 * Initializes the lists/arrays.
	 * @param smallValuesMaximum If smaller a label is not recognized as label.
	 */
	protected init(smallValuesMaximum: number) {
		// clear data
		this.fileLineNrs.clear();
		this.lineArrays.clear();
		this.labelsForNumber64k.fill(undefined);
		this.labelsForLongAddress.clear();
		this.numberForLabel.clear();
		this.labelLocations.clear();
		this.labelsHierarchy.clear();
		this.watchPointLines.length = 0;
		this.assertionLines.length = 0;
		this.logPointLines.length = 0;
		this.smallValuesMaximum = smallValuesMaximum;
		this.bankSize = 0;
		this.errorHappened = false;
		this.clearWatchedFiles();
	}


	/**
	 * Returns true if long addresses have been used.
	 * I.e. if bankSize != 0.
	 */
	public AreLongAddressesUsed() {	// TODO: still required?
		//return this.bankSize != 0;
		return true;
	}


	/**
	 * This has to be set in the launchRequest.
	 * Finishes off the loading of list and labels files.
	 * Can throw an exception if some values make no sense.
	 */
	public finish() {
		// Calculate the label offsets
		this.calculateLabelOffsets();
		// Calculate the label distances
		this.calculateLabelDistances();
		// Create the hierarchy of labels
		this.createLabelHierarchy();
	}


	/**
	 * Reads all list files for all available assemblers.
	 * @param mainConfig Is a part of Settings. It contains e.g. the properties "sjasmplus",
	 * "z80asm" and "z88dk".
	 * Each property is an object which contains the specific parameters.
	 * Especially it contains the paths to the list files.
	 * @param memoryModel The memory model. Used for bank/long address creation.
	 */
	public readListFiles(mainConfig: SettingsParameters, memoryModel: MemoryModel) {
		// Clear some fields
		// TODO: instead of init: create new arras etc. Use this arrays for reading. Then, only on success, copy them to the real arrays.
		this.init(mainConfig.smallValuesMaximum);

		// Prepare callback to issue handler
		const issueHandler = (issue) => {
			this.handleIssue(issue);
		}

		// sjasmplus
		if (mainConfig.sjasmplus) {
			for (const config of mainConfig.sjasmplus) {
				// Parse SLD file
				const parser = new SjasmplusSldLabelParser(memoryModel, this.fileLineNrs, this.lineArrays, this.labelsForNumber64k, this.labelsForLongAddress, this.numberForLabel, this.labelLocations, this.watchPointLines, this.assertionLines, this.logPointLines, issueHandler);
				this.loadAsmListFile(parser, config);
				this.bankSize = parser.bankSize;
			}
		}

		// z80asm
		if (mainConfig.z80asm) {
			const parser = new Z80asmLabelParser(memoryModel, this.fileLineNrs, this.lineArrays, this.labelsForNumber64k, this.labelsForLongAddress, this.numberForLabel, this.labelLocations, this.watchPointLines, this.assertionLines, this.logPointLines, issueHandler);
			for (const config of mainConfig.z80asm) {
				this.loadAsmListFile(parser, config);
			}
		}

		// z88dk
		if (mainConfig.z88dk) {
			const parser = new Z88dkLabelParser(memoryModel, this.fileLineNrs, this.lineArrays, this.labelsForNumber64k, this.labelsForLongAddress, this.numberForLabel, this.labelLocations, this.watchPointLines, this.assertionLines, this.logPointLines, issueHandler);
			for (const config of mainConfig.z88dk) {
				this.loadAsmListFile(parser, config);
			}
		}

		// Reverse Engineering List File
		if (mainConfig.revEng) {
			const parser = new ReverseEngineeringLabelParser(memoryModel, this.fileLineNrs, this.lineArrays, this.labelsForNumber64k, this.labelsForLongAddress, this.numberForLabel, this.labelLocations, this.watchPointLines, this.assertionLines, this.logPointLines, issueHandler);
			for (const config of mainConfig.revEng) {
				this.loadAsmListFile(parser, config);
				// Check if files need to be watched
				if (config.reloadOnSave) {
					// Watch file for save
					this.watchFile(config.path);
				}
			}
			this.bankSize = 0x4000;	// TODO: need to be read from somewhere. Still required?
		}

		// Add new assemblers here ...


		// Check errors
		if (this.errorHappened)
			throw Error("Error during parsing of the list/sld file(s).");

		// Finish
		this.finish();
	}


	/**
	 * Calls loadAsmFile while catching exceptions.
	 * @param parser The parser to call.
	 * @param config The configuration.
	 */
	protected loadAsmListFile(parser: LabelParserBase, config: ListConfigBase) {
		try {
			parser.loadAsmListFile(config);
		}
		catch (e) {
			// Just remember that an exception happened
			this.errorHappened = true;
		}
	}


	/**
	 * Retrieves the file's last modified date and compares it with the given date.
	 * Whichever date is younger is returned.
	 * @param date The date to compare with.
	 * @param path The file's path.
	 * @returns The youngest date of both.
	 */
	protected youngestDate(date: Date, path: string) {
		const stats = fs.statSync(path)
		const fileDate = new Date(stats.mtimeMs);
		const youngestDate = (date < fileDate) ? fileDate : date;
		return youngestDate;
	}


	/**
	 * Accessor for the watchpoint lines.
	 * Long addresses.
	 */
	public getWatchPointLines() {
		return this.watchPointLines;
	}


	/**
	 * Accessor for the assertion lines.
	 * Long addresses.
	 */
	public getAssertionLines() {
		return this.assertionLines;
	}


	/**
	 * Accessor for the logpoint lines.
	 * Long addresses.
	 */
	public getLogPointLines() {
		return this.logPointLines;
	}


	/**
	 * Calculates the offsets for all labels.
	 * I.e. for all addresses without a direct label entry.
	 * Deals with 64k addresses only.
	 * E.g. labelsForNumber:
	 * [0x0000] undefined
	 * [0x0001] undefined
	 * ...
	 * [0x8000]	stack_bottom
	 * [0x8001] 1
	 * [0x8002] 2
	 * [0x8003] 3
	 * [0x8004] 4
	 * [0x8005] stack_top
	 * [0x8006] 1
	 * ...
	 */
	protected calculateLabelOffsets() {
		// Now fill the unset values with the offsets
		let offs = -1;
		for (let i = 0; i < 0x10000; i++) {
			const labels = this.labelsForNumber64k[i];
			if (labels === undefined) {
				if (offs >= 0) {
					this.labelsForNumber64k[i] = offs;
					++offs;
				}
			}
			else {
				// Array
				offs = 1;
			}
		}
	}


	/**
	 * Calculates the distance array (distance to next label, or estimated size of a label).
	 * Works also with long addresses and fills the 'distanceForLabelAddress' map.
	 * It has entries for each long address with it's size.
	 * The last label address will stay undefined as no distance to the next label can be measured.
	 * Similar, if the next label is smaller (maybe because a different bank is used or
	 * a smaller EQU has been defined).
	 * This is used for estimating the data that should be displayed on hovering or if no
	 * data size is specified in the WATCH window.
	 * It covers only main cases and the output might not be accurate. e.g. the following
	 * won't work:
	 * ~~~
	 *  ORG 0x8000
	 *  label: defb 1
	 *  val: equ 0x7000
	 * ~~~
	 * Because val is < label, address 0x8000 gets no size entry.
	 */
	protected calculateLabelDistances() {
		// This approach assumes that the labels in the map are ordered.
		let prevAddr;
		for (let [labelName, longAddr] of this.numberForLabel) {
			// Skip first entry
			if (prevAddr != undefined) {
				// Check if it is a higher address (in 64k area)
				const dist = (longAddr & 0xFFFF) - (prevAddr & 0xFFFF);
				if (dist > 0) {
					// Store distance
					this.distanceForLabelAddress.set(prevAddr, {distance: dist, nextLabel: labelName});
				}
			}
			// Next
			prevAddr = longAddr;
		}
	}


	/**
	 * Returns all labels with the exact same address to the given address.
	 * Long addresses.
	 * @param longAddress The address value to find.
	 * @returns An array of strings with labels. Might return an empty array.
	 */
	public getLabelsForLongAddress(longAddress: number): Array<string> {
		const labels = this.labelsForLongAddress.get(longAddress);
		return labels || [];
	}


	/**
	 * Returns all labels with the exact same address to the given address.
	 * 64k addresses.
	 * @param number The address value to find. Ignores numbers/labels <= e.g. 'smallValuesMaximum'.
	 * Bits >= bit 16 are ignored.
	 * @param regsAsWell If true it also returns registers which match the number. If false (default) then no registers are returned.
	 * @returns An array of strings with (registers and) labels. Might return an empty array.
	 */
	public getLabelsForNumber64k(number: number, regsAsWell = false): Array<string> {
		// Make sure it is not a long address.
		number &= 0xFFFF;

		if (number <= this.smallValuesMaximum) {
			return [];	// E.g. ignore numbers/labels < e.g. 513
		}

		let names;
		if (regsAsWell)
			names = Remote.getRegistersEqualTo(number);
		else
			names = new Array<string>();

		const labels = this.labelsForNumber64k[number];

		if (labels && typeof labels !== 'number') {
			names.push(...labels);
		}
		return names;
	}


	/**
	 * Returns the distance to the next label.
	 * This is used to estimate the size of a label value.
	 * @param addr The address (of the current label). Long address.
	 * @returns N. addr+N is the address that relates to the next available label.
	 */
	public getDistanceToNextLabel(addr: number): number|undefined {
		const nextLabel = this.distanceForLabelAddress.get(addr);
		return nextLabel?.distance;
	}


	/**
	 * Returns all labels with the same address that are nearest and lower-equal
	 * to the given address.
	 * If label is equal to given addr the label itself is returned.
	 * If label is not equal to given addr the label+offset is returned.
	 * 64k addresses.
	 * @param number The address value to find. Ignores numbers/labels <= e.g. 'smallValuesMaximum' or > 65535.
	 * @param regsAsWell If true it also returns registers which match the number. If false (default) then no registers are returned.
	 * @returns An array of strings with (registers and) labels + offset
	 */
	public getLabelsPlusIndexForNumber64k(number: number, regsAsWell = false): Array<string> {
		if (number <= this.smallValuesMaximum || number > 0xFFFF) {
			return [];	// E.g. ignore numbers/labels < e.g. 513 or > 65535
		}

		let names;
		if (regsAsWell)
			names = Remote.getRegistersEqualTo(number);
		else
			names = new Array<string>();

		let labels = this.labelsForNumber64k[number];
		if (labels) {
			if (typeof labels !== 'number') {
				names.push(...labels);
			}
			else {
				const offs = labels;	// number
				number -= offs;
				const baseLabels = this.labelsForNumber64k[number];	// this is an array
				if (baseLabels !== undefined) {
					const labelsPlus = baseLabels.map(label => label + '+' + offs);
					names.push(...labelsPlus);
				}
			}
		}
		return names;
	}


	/**
	 * Returns the corresponding number of a label.
	 * Long addresses.
	 * Used by:
	 * - debugAdapter.evalLabel
	 * - zesarux.convertCondition
	 * - z80unittests.labels.getNumberForLabel("UNITTEST_TEST_WRAPPER");
	 * @param label The label name.
	 * @returns It's value. (Long address). undefined if label does not exist.
	 */
	public getNumberForLabel(label: string): number | undefined {
		return this.numberForLabel.get(label);
	}


	/**
	 * Returns the location (file/line number) of a label.
	 * Long addresses.
	 * @param label The label. E.g. "math.div_c_d"
	 * @returns {file, lineNr, address}: The absolute filepath, the line number and the (long) address.
	 * undefined if label does not exist.
	 */
	public getLocationOfLabel(label: string): {file: string, lineNr: number, address: number} | undefined {
		return this.labelLocations.get(label);
	}


	/**
	 * Returns all labels that match the regular expression string.
	 * @param labelRegEx Regular expression string.
	 * @param options E.g. 'g'
	 * @returns An array with matching labels. If nothing found an empty array is returned.
	 */
	public getLabelsForRegEx(labelRegEx: string, options = 'i'): Array<string> {
		const regex = new RegExp(labelRegEx, options);
		const foundLabels = new Array<string>();
		for (let [k,] of this.numberForLabel) {
			const match = regex.exec(k);
			if (match)
				foundLabels.push(k);
		}
		// return array with labels
		return foundLabels;
	}


	/**
	 * Create the hierarchy of labels.
	 */
	protected createLabelHierarchy() {
		for (let [label,] of this.numberForLabel) {
			// Get all parts of the label
			const parts = label.split('.');
			// Special case: I.e. z80asm allows labels like ".label"
			// but that doesn't mean they are hierarchly ordered:
			if (parts[0] == '') {
				// Label starts with '.'
				parts.shift();	// Remove first entry
				parts[0] = '.' + parts[0];	// Re-add the '.'
			}
			let map = this.labelsHierarchy;
			for (const part of parts) {
				// Check if already existing
				let subMap = map.get(part);
				if (!subMap) {
					// Create one
					subMap = new Map<string, any>();
					map.set(part, subMap);
				}
				// Next
				map = subMap;
			}
		}
	}


	/**
	 * Returns the direct sub labels.
	 * @param label E.g. "Invader" or "Invader.hitbox"
	 * @returns An array of direct sub labels. E.g. for "Invader" it returns "Invader.x" or "Invader.hitbox" but not "Invader.hitbox.x"
	 */
	public getSubLabels(label: string): Array<string> {
		// Get all parts of the label
		const parts = label.split('.');
		let map = this.labelsHierarchy;
		for (const part of parts) {
			// Check if already existing
			let subMap = map.get(part);
			if (!subMap) {
				// Create one
				subMap = new Map<string, any>();
				map.set(part, subMap);
			}
			// Next
			map = subMap;
		}
		return Array.from(map.keys());
	}


	/**
	 * Returns a number. If text is a label than the corresponding number for the label is returned.
	 * If text is not a label it is tried to convert text as string to a number.
	 * 64k addresses.
	 * @param text The label name or a number in hex or decimal as string.
	 * @returns The correspondent number. May return NaN.
	 */
	public getNumberFromString64k(text: string): number {
		if (text == undefined)
			return NaN;
		let result = this.getNumberForLabel(text);
		if (result == undefined) {
			// Try convert as string
			if (text.startsWith('_'))
				return NaN;
			result = Utility.parseValue(text);
		}
		if (isNaN(result))
			return result;
		return result & 0xFFFF;
	}


	/**
	 * Returns file name and line number associated with a certain memory address.
	 * Used e.g. for the call stack.
	 * Long addresses.
	 * @param address The (long) memory address to search for.
	 * @returns The associated filename and line number (and for sjasmplus the modulePrefix and the lastLabel).
	 * It not found returns .fileName==''.
	 */
	public getFileAndLineForAddress(address: number): SourceFileEntry {
		// Address file conversion
		let entry = this.fileLineNrs.get(address);
		if (!entry) {
			entry = this.fileLineNrs.get(address & 0xFFFF);	// Try 64k address, in case some sld file was without banking.
			if (!entry) {
				return {fileName: '', lineNr: 0, modulePrefix: undefined, lastLabel: undefined, size: 0};
			}
		}

		const filePath = Utility.getAbsFilePath(entry.fileName);
		return {fileName: filePath, lineNr: entry.lineNr, modulePrefix: entry.modulePrefix, lastLabel: entry.lastLabel, size: entry.size
};
	}


	/**
	 * Returns the SourceFileEntry (file name and line number) associated with a certain memory address.
	 * Uses long addresses.
	 * Enables direct access to the map.
	 * @param address The (long) memory address to search for.
	 * @returns The associated SourceFileEntry or undefined.
	 */
	public getSourceFileEntryForAddress(address: number): SourceFileEntry | undefined {
		return this.fileLineNrs.get(address);
	}


	/**
	 * Returns the memory address associated with a certain file and line number.
	 * Long addresses.
	 * @param fileName The path to the file. Can be an absolute path.
	 * @param lineNr The line number inside the file.
	 * @returns The associated (long) address. -1 if file or line does not exist.
	 */
	public getModuleAndLastLabelForFileAndLine(fileName: string, lineNr: number): {modulePrefix: string, lastLabel: string} {
		// The available structures are not ideal:
		// First find an address for lineNr.
		// Then use the address to get modulePrefix and lastLabel.
		const filePath = Utility.getRelFilePath(fileName);
		const result = {modulePrefix: '', lastLabel: ''};
		let longAddr;
		const lineArray = this.lineArrays.get(filePath);
		if (!lineArray)
			return result;
		// Search backward for an address
		while (true) {
			if (lineNr < 0)
				return {modulePrefix: '', lastLabel: ''};
			longAddr = lineArray[lineNr];
			if (longAddr != undefined)
				break;
			// Previous
			lineNr--;
		}

		// Now with the address get the modulePrefix and the lastLabel
		const entry = Labels.getFileAndLineForAddress(longAddr);
		result.modulePrefix = entry.modulePrefix!;
		result.lastLabel = entry.lastLabel!;

		return result;
	}


	/**
	 * Returns the memory address associated with a certain file and line number.
	 * Long addresses.
	 * @param fileName The path to the file. Can be an absolute path.
	 * @param lineNr The line number inside the file.
	 * @returns The associated (long) address. -1 if file or line does not exist.
	 */
	public getAddrForFileAndLine(fileName: string, lineNr: number): number {
		const filePath = Utility.getRelFilePath(fileName);
		let addr = -1;
		const lineArray = this.lineArrays.get(filePath);
		if (lineArray) {
			addr = lineArray[lineNr];
			if (addr == undefined)
				addr = -1;
		}
		return addr;
	}


	/**
	 * Handles an issue (error, warning) reported by a parser.
	 * Shows the problem in the PROBLEMs pane, i.e. in the diagnostics.
	 * @param issue The issue reported. Contains file and line number.
	 */
	protected handleIssue(issue: Issue) {
		if(LabelsClass.addDiagnosticsErrorFunc)
			LabelsClass.addDiagnosticsErrorFunc(issue.message, issue.severity, issue.filepath, issue.lineNr, 0);
	}


	/**
	 * Removes the existing watches.
	 */
	protected clearWatchedFiles() {
		for (const fileWatcher of this.watchedFiles) {
			fileWatcher.dispose();
		}
	}


	/**
	 * Watches a file. If saved a 'reload' event will be emitted.
	 * (For reverse engineering reload of list files.)
	 * Note: the event is delayed a little bit in case several files are changed at the same time.
	 * @path The absolute path.
	 */
	protected watchFile(path: string) {
		// Create new file watcher
		const fileWatcher = new FileWatcher(path);
		this.watchedFiles.push(fileWatcher);
		// Watch for changes
		//	let emitInProgress = false;	// For collecting several changes
		fileWatcher.onDidChange(() => {
			this.emit('reload');
			/*
					if (emitInProgress)
						return;	// Emit will happen anyway
					// Delay the emit to collect several different file changes
					emitInProgress = true;
					setTimeout(() => {
						this.emit('reload');
						emitInProgress = false;
					}, 500);
				});
			*/
		});
	}
}


/// Labels is the singleton object that should be accessed.
export const Labels = new LabelsClass();
