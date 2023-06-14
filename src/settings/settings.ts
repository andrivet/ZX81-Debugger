/**
 * ZX81 Debugger
 * 
 * File:			settings.ts
 * Description:		Configuration parameters
 * Author:			Sebastien Andrivet, based on Dezog my Thomas Busse (Maziac)
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 * 					DeZog Copyright (C) 2023 Maziac
 */
import {DebugProtocol} from '@vscode/debugprotocol';
import {Utility} from '../misc/utility';
import * as fs from 'fs';
import {UnifiedPath} from '../misc/unifiedpath';


export interface Formatting {
	/// Format how the registers are displayed in the VARIABLES area.
	/// Is an array with 2 strings tuples. The first is an regex that checks the register.
	/// If fulfilled the 2nd is used to format the value.
	registerVar: Array<string>;

	/// Format how the registers are displayed when hovering with the mouse.
	/// Is an array with 2 strings tuples. The first is an regex that checks the register.
	/// If fulfilled the 2nd is used to format the value.
	registerHover: Array<string>;

	/// The general formatting for address labels bigger than 'smallValuesMaximum'.
	bigValues: string;

	/// The general formatting for small values like constants smaller/equal than 'smallValuesMaximum'.
	smallValues: string;

	/// The 'byte' formatting for labels in the WATCHES area.
	watchByte: string;

	/// The 'word' formatting for labels in the WATCHES area.
	watchWord: string;

	/// Format for the pushed values in the STACK area.
	stackVar: string;
}

/// Definitions for the 'zrcp' remote type.
export interface ZrcpType {
	/// The Zesarux ZRCP telnet host name/IP address
	hostname: string;

	/// The Zesarux ZRCP telnet port
	port: number;

	/// If enabled zesarux does not break on manual break in interrupts.
	skipInterrupt: boolean;

	// The delay before loading the Z80 program via smartload.
	loadDelay: number;

	/// Resets the cpu (on ZEsarUX) after starting the debugger.
	resetOnLaunch: boolean;

	/// The socket timeout in seconds.
	socketTimeout: number;
}


/// Definitions for the 'zsim' remote type.
export interface ZSimType {
	// If enabled the simulator shows a keyboard to simulate keypresses.
	zxDisplayKeyboard: boolean,

	// The number of interrupts to calculate the average from. 0 to disable.
	cpuLoadInterruptRange: number,

	// If enabled an interrupt is generated after ca. 20ms (this assumes a CPU clock of 3.25MHz).
	vsyncInterrupt: boolean,

	// The CPU frequency is only used for output. I.e. when the t-states are printed
	// there is also a printout of the correspondent time. This is calculated via the CPU frequency here.
	cpuFrequency: number,

	// If enabled the simulated CPU performance is throttled to fit the given CPU frequency.
	// Is enabled by default.If disabled the CPU will be simulated as fast as possible.
	limitSpeed: boolean;

	// The update frequency of the simulator view in Hz.
	updateFrequency: number,
}


/**
 * The settings for the disassembler in the VARIABLEs pane.
 */
export interface DisassemblerArgs {
	numberOfLines: number;	// Number of lines displayed in the (brute force) disassembly
}


/**
 * The settings for the smart disassembler (disasm.list).
 */
export interface SmartDisassemblerArgs {
	lowerCase: boolean;
}


/**
 * See also package.json.
 * The configuration parameters for the zesarux debugger.
 */
export interface SettingsParameters extends DebugProtocol.LaunchRequestArguments {
	/// The remote type: zesarux or zsim.
	remoteType: 'zrcp' | 'zsim';

	// The special settings for zrcp (ZEsarux).
	zrcp: ZrcpType;

	// The special settings for the internal Z80 simulator.
	zsim: ZSimType;

	/// The path of the root folder. All other paths are relative to this. Usually = ${workspaceFolder}
	rootFolder: string;

	/// Interprets labels as address if value is bigger. Typically this is e.g. 512. So all numbers below are not treated as addresses if shown. So most constant values are covered with this as they are usually smaller than 512. Influences the formatting.
	smallValuesMaximum: number;

	/// These arguments are passed to the disassembler in the VARIABLEs pane.
	disassemblerArgs: DisassemblerArgs;

	/// These arguments are passed to the smart disassembler (disasm.list).
	smartDisassemblerArgs: SmartDisassemblerArgs;

	/// A directory for temporary files created by this debug adapter. E.g. ".tmp"
	tmpDir: string;

	/// Source file to be compiled and debugged
	source: string;

	/// Binary file to be debugged.
	binary?: string;

	/// Source Level Debugging info
	sld?: string;

	/// Start automatically after launch.
	startAutomatically: boolean;

	/// An array with commands that are executed after the program-to-debug is loaded.
	commandsAfterLaunch: Array<string>;

	/// If enabled code coverage information is analyzed and displayed.
	/// Useful especially for unit tests but can be enabled also in "normal" launch configurations.
	history: {
		reverseDebugInstructionCount: number;	// Sets the number of instructions for reverse debugging. If set to 0 then reverse debugging is turned off.
		spotCount: number;	// Sets the number of instructions to show in a spot. If you set this e.g. to 5 then the 5 previous and the 5 next instructions related to the current position are shown.
		spotShowRegisters: boolean;	// If true it shows additionally the changed registers. Default=true.
		codeCoverageEnabled: boolean;	// Enable/disable code coverage.
	}

	/// Holds the formatting vor all values.
	formatting: Formatting;

	/// Values for the memory viewer.
	memoryViewer: {
		addressColor: string;	// The text color of the address field.
		bytesColor: string;	// The color of the bytes (hex values).
		charColor: string;	// The text color of the character field.
		addressHoverFormat: string;	// Format for the address when hovering.
		valueHoverFormat: string;	// Format for the value when hovering.
		registerPointerColors: Array<string>;	// The register/colors to show as colors in the memory view.
		registersMemoryView: Array<string>;	// An array of register to show in the register memory view.
	}

	/// Values for the display viewer.
	displayViewer: {
		addressHoverFormat: string;	// Format for the address when hovering.
		valueHoverFormat: string; // Format for the value when hovering over the display.
	}

	/// Tab size used in formatting.
	tabSize: number;
}


/// Singleton:
/// A class through which the settings can be accessed.
/// I.e. the parameters in launch.json.
export class Settings {

	// Maximum number for history spot count.
	protected static MAX_HISTORY_SPOT_COUNT = 20;

	// Remembers the name of the launch.json config being used
	public static configName = 'undefined';

	/// The representation of the launch.json
	public static launch: SettingsParameters;


	/**
	 * Sets unset default values.
	 * E.g. in the launchRequest.
	 * Initializes all values (sets anything that is not set in the json).
	 * All relative paths are expanded with the 'rootFolder' path.
	 * @param launchCfg The configuration (launch.json).
	 * @param rootFolder Path to the root folder.
	 * @returns An "enhanced" launchCfg. E.g. default values are set.
	 */
	static Init(launchCfg: SettingsParameters): SettingsParameters {
		if (!launchCfg) {
			launchCfg = {
				remoteType: <any>undefined,
				zrcp: <any>undefined,
				zsim: <any>undefined,
				rootFolder: <any>undefined,
				smallValuesMaximum: <any>undefined,
				disassemblerArgs: <any>undefined,
				smartDisassemblerArgs: <any>undefined,
				tmpDir: <any>undefined,
				source: <any>undefined,
				binary: <any>undefined,
				startAutomatically: <any>undefined,
				commandsAfterLaunch: <any>undefined,
				history: <any>undefined,
				formatting: <any>undefined,
				memoryViewer: <any>undefined,
				displayViewer: <any>undefined,
				tabSize: <any>undefined,
			}
		}

		// Check rootFolder
		let rootFolder = launchCfg.rootFolder || '';	// Will be checked in the CheckSettings.
		// Change to a true-case-path (E.g. the user might have given "/volumes..." but the real path is "/Volumes...")
		try {
			const result = fs.realpathSync.native(rootFolder); // On windows this returns a capital drive letter
			// If no exception occurs the path is valid:
			rootFolder = result;
		}
		catch {}
		// Also use for the launch config.
		rootFolder = UnifiedPath.getUnifiedPath(rootFolder);
		launchCfg.rootFolder = rootFolder;

		// zrcp
		if (!launchCfg.zrcp)
			launchCfg.zrcp = {} as ZrcpType;
		if (launchCfg.zrcp.hostname == undefined)
			launchCfg.zrcp.hostname = 'localhost';
		if (launchCfg.zrcp.port == undefined)
			launchCfg.zrcp.port = 10000;
		if (launchCfg.zrcp.loadDelay == undefined) {
			const platform = process.platform;
			let delay = 0;
			if (platform == 'win32')
				delay = 100;
			launchCfg.zrcp.loadDelay = delay;	// ms
		}
		if (launchCfg.zrcp.resetOnLaunch == undefined)
			launchCfg.zrcp.resetOnLaunch = true;
		if (!launchCfg.zrcp.socketTimeout)
			launchCfg.zrcp.socketTimeout = 5;	// 5 secs

		// zsim
		if (!launchCfg.zsim)
			launchCfg.zsim = {} as ZSimType;
		if (launchCfg.zsim.zxDisplayKeyboard == undefined)
			launchCfg.zsim.zxDisplayKeyboard = true;
		if (launchCfg.zsim.cpuLoadInterruptRange == undefined)
			launchCfg.zsim.cpuLoadInterruptRange = 1;
		if (launchCfg.zsim.vsyncInterrupt == undefined)
			launchCfg.zsim.vsyncInterrupt = true;
		if (launchCfg.zsim.cpuFrequency == undefined)
			launchCfg.zsim.cpuFrequency = 3250000.0;	// for 3.25MHz.
		if (launchCfg.zsim.limitSpeed == undefined)
			launchCfg.zsim.limitSpeed = true;
		if (launchCfg.zsim.updateFrequency == undefined)
			launchCfg.zsim.updateFrequency = 10.0;

		// Check update frequency ranges
		if (launchCfg.zsim.updateFrequency < 5.0)
			launchCfg.zsim.updateFrequency = 5.0;	// 5 Hz
		else if (launchCfg.zsim.updateFrequency > 100.0)
			launchCfg.zsim.updateFrequency = 100.0;	// 100 Hz

		if (launchCfg.source) {
			const usource = UnifiedPath.getUnifiedPath(launchCfg.source)
			launchCfg.source = Utility.getAbsFilePath(usource, rootFolder);
		}
		else
			launchCfg.source = '';

		if (launchCfg.binary) {
			const ubinary = UnifiedPath.getUnifiedPath(launchCfg.binary)
			launchCfg.binary = Utility.getAbsFilePath(ubinary, rootFolder);
		}

		if (launchCfg.tmpDir == undefined)
			launchCfg.tmpDir = '.tmp';
		launchCfg.tmpDir = UnifiedPath.getUnifiedPath(launchCfg.tmpDir);
		launchCfg.tmpDir = Utility.getAbsFilePath
			(launchCfg.tmpDir, rootFolder);
		if (isNaN(launchCfg.smallValuesMaximum))
			launchCfg.smallValuesMaximum = 255;
		if (launchCfg.disassemblerArgs == undefined) {
			launchCfg.disassemblerArgs = {
				numberOfLines: 10
			};
		}
		if (!launchCfg.disassemblerArgs.hasOwnProperty("numberOfLines"))
			launchCfg.disassemblerArgs.numberOfLines = 10;
		if (launchCfg.disassemblerArgs.numberOfLines > 100)
			launchCfg.disassemblerArgs.numberOfLines = 100;
		if (launchCfg.disassemblerArgs.numberOfLines < 1)
			launchCfg.disassemblerArgs.numberOfLines = 1;
		if (launchCfg.startAutomatically == undefined)
			launchCfg.startAutomatically = false;
		if (launchCfg.commandsAfterLaunch == undefined)
			launchCfg.commandsAfterLaunch = [];
		if (launchCfg.zrcp.skipInterrupt == undefined)
			launchCfg.zrcp.skipInterrupt = false;

		// Smart disassembly
		if (launchCfg.smartDisassemblerArgs == undefined) {
			launchCfg.smartDisassemblerArgs = {
				lowerCase: true
			}
		}
		if (launchCfg.smartDisassemblerArgs.lowerCase == undefined)
			launchCfg.smartDisassemblerArgs.lowerCase = false;

		// Reverse debugging
		if (launchCfg.history == undefined)
			launchCfg.history = {} as any;
		if (launchCfg.history.reverseDebugInstructionCount == undefined)
			launchCfg.history.reverseDebugInstructionCount = 10000;

		// Short history
		if (launchCfg.history.spotCount == undefined)
			launchCfg.history.spotCount = 10;
		if (launchCfg.history.spotCount > Settings.MAX_HISTORY_SPOT_COUNT)
			launchCfg.history.spotCount = Settings.MAX_HISTORY_SPOT_COUNT;
		if (launchCfg.history.spotCount > launchCfg.history.reverseDebugInstructionCount)
			launchCfg.history.spotCount = launchCfg.history.reverseDebugInstructionCount;
		if (launchCfg.history.spotCount < 0)
			launchCfg.history.spotCount = 0;
		if (launchCfg.history.spotShowRegisters == undefined)
			launchCfg.history.spotShowRegisters = true;

		// Code coverage
		if (launchCfg.history.codeCoverageEnabled == undefined) {
				launchCfg.history.codeCoverageEnabled = true;
		}

		if (!launchCfg.formatting)
			launchCfg.formatting = {
				registerVar: <any>undefined,
				registerHover: <any>undefined,
				bigValues: <any>undefined,
				smallValues: <any>undefined,
				watchByte: <any>undefined,
				watchWord: <any>undefined,
				stackVar: <any>undefined,
			};
		if (!launchCfg.formatting.registerVar)
			launchCfg.formatting.registerVar = [
				"AF", "AF: ${hex}h, F: ${flags}",
				"AF'", "AF': ${hex}h, F': ${flags}",
				"PC", "${hex}h, ${unsigned}u${, :labelsplus|, }",
				"SP", "${hex}h, ${unsigned}u${, :labelsplus|, }",
				"IM", "${unsigned}u",
				"..", "${hex}h, ${unsigned}u, ${signed}i${, :labelsplus|, }",
				"F", "${flags}",
				"R", "${unsigned}u",
				"I", "${hex}h",
				".", "${hex}h, ${unsigned}u, ${signed}i, ${bits}b"
			];
		if (!launchCfg.formatting.registerHover)
			launchCfg.formatting.registerHover = [
				"AF", "AF: ${hex}h, F: ${flags}",
				"AF'", "AF': ${hex}h, F': ${flags}",
				"PC", "PC: ${hex}h${\n:labelsplus|\n}",
				"SP", "SP: ${hex}h${\n:labelsplus|\n}",
				"IM", "IM: ${unsigned}u",
				"..", "${name}: ${hex}h, ${unsigned}u, ${signed}i${\n:labelsplus|\n}\n(${hex}h)b=${b@:hex}h, (${hex}h)w=${w@:hex}h",
				"R", "R: ${unsigned}u",
				"I", "I: ${hex}h",
				".", "${name}: ${hex}h, ${unsigned}u, ${signed}i, ${bits}b"
			];
		if (!launchCfg.formatting.bigValues)
			launchCfg.formatting.bigValues = "(${hex}h)=${b@:unsigned}/${b@:hex}h/'${b@:char}' or ${w@:hex}h/${w@:unsigned}";
		if (!launchCfg.formatting.smallValues)
			launchCfg.formatting.smallValues = "${hex}h, ${unsigned}u, ${signed}i', ${bits}";
		if (!launchCfg.formatting.watchByte)
			launchCfg.formatting.watchByte = "${hex}h,\t${unsigned}u,\t${signed}i,\t${bits}b";
		if (!launchCfg.formatting.watchWord)
			launchCfg.formatting.watchWord = "${hex}h,\t${unsigned}u,\t${signed}i";
		if (!launchCfg.formatting.stackVar)
			launchCfg.formatting.stackVar = "${hex}h\t${unsigned}u\t${signed}i\t${{:labels|, |}}";
		if (!launchCfg.tabSize)
			launchCfg.tabSize = 6;

		// Memory viewer
		if (!launchCfg.memoryViewer) {
			launchCfg.memoryViewer = {} as any;
		}
		if (!launchCfg.memoryViewer.addressColor)
			launchCfg.memoryViewer.addressColor = "CornflowerBlue";
		if (!launchCfg.memoryViewer.bytesColor)
			launchCfg.memoryViewer.bytesColor = "var(--vscode-editor-foreground)";	// Different dependent on dark or light theme.
		if (!launchCfg.memoryViewer.charColor)
			launchCfg.memoryViewer.charColor = "OliveDrab";
		if (!launchCfg.memoryViewer.addressHoverFormat)
			launchCfg.memoryViewer.addressHoverFormat = "${hex}h${\n:labelsplus|\n}";
		if (!launchCfg.memoryViewer.valueHoverFormat)
			launchCfg.memoryViewer.valueHoverFormat = "${hex}h, ${unsigned}u, ${signed}i, ${bits}";
		if (!launchCfg.memoryViewer.registerPointerColors)
			launchCfg.memoryViewer.registerPointerColors = [
				"HL", "darkgreen",
				"DE", "darkcyan",
				"BC", "dimgray",
				"SP", "goldenrod",
				"IX", "darkorange",
				"IY", "darkviolet"
			];
		if (!launchCfg.memoryViewer.registersMemoryView)
			launchCfg.memoryViewer.registersMemoryView = ["HL", "DE", "BC", "SP", "IX", "IY"];

		// Display viewer
		if (!launchCfg.displayViewer) {
			launchCfg.displayViewer = {} as any;
		}
	
		if (!launchCfg.displayViewer.addressHoverFormat)
			launchCfg.displayViewer.addressHoverFormat = "${hex}h${\n:labelsplus|\n}";
		if (!launchCfg.displayViewer.valueHoverFormat)
			launchCfg.displayViewer.valueHoverFormat = "${hex}h, ${unsigned}u";

		return launchCfg;
	}


	/**
	 * Checks the settings and throws an exception if something is wrong.
	 * E.g. it checks for the existence of file paths.
	 * Note: file paths are already expanded to absolute paths.
	 */
	public static CheckSettings() {
		// Check root folder
		const rootFolder = Settings.launch.rootFolder;
		if (!rootFolder)
			throw Error("'rootFolder' is empty");
		if (!fs.existsSync(rootFolder))
			throw Error("'rootFolder' path(" + rootFolder + ") does not exist.");

		// Check remote type
		const rType = Settings.launch.remoteType;
		const allowedTypes = ['zrcp', 'zsim'];
		const found = (allowedTypes.indexOf(rType) >= 0);
		if (!found) {
			throw Error("'remoteType': Remote type '" + rType + "' does not exist. Allowed are " + allowedTypes.join(', ') + ".");
		}
	}
}
