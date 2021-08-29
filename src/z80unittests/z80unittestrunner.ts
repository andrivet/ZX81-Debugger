import * as vscode from 'vscode';
import { DebugSessionClass } from '../debugadapter';
import { RemoteFactory, Remote } from '../remotes/remotefactory';
import {Labels, LabelsClass } from '../labels/labels';
import { RemoteBreakpoint } from '../remotes/remotebase';
import { Settings } from '../settings';
import * as jsonc from 'jsonc-parser';
import { readFileSync } from 'fs';
import { Utility } from '../misc/utility';
import { Decoration } from '../decoration';
import {StepHistory, CpuHistory, CpuHistoryClass} from '../remotes/cpuhistory';
import {Z80RegistersClass, Z80Registers} from '../remotes/z80registers';
import {StepHistoryClass} from '../remotes/stephistory';
import {ZSimRemote} from '../remotes/zsimulator/zsimremote';
import * as path from 'path';
import {TestRunner} from './testrunner';
import {FileWatcher} from '../misc/filewatcher';
import {UnifiedPath} from '../misc/unifiedpath';


/**
 * An item that represents a unit test and connect the vscode TestItem,
 * the unit test and the file watcher.
 * There are 4 different types of test items:
 * - A test suite representing a launch.json file
 * - A test suite representing a sld/list file
 * - A test suite collecting several unit test (this base class here)
 * - A unit test itself (the UT label)
 * plus the rootSuite which is a suite without parent and testItem references.
 */
class UnitTestCaseB {	// TODO: rename
	// Pointer to the test controller.
	protected static controller: vscode.TestController;

	// Pointer to the parent test item (suite).
	public parent?: UnitTestSuite;

	// Pointer to the corresponding test item.
	public testItem: vscode.TestItem;


	/**
	 * Constructor.
	 */
	constructor(testItem: vscode.TestItem, parent: UnitTestSuite) {
		this.testItem = testItem;
		if (parent) {
			parent.addChild(this);
		}
	}


	/**
	 * Delete a test item and it's children.
	 */
	public delete() {
		// Remove from parent
		if (this.parent) {
			// Delete from parent
			this.parent.removeChild(this);
		}
	}
}


class UnitTestSuite extends UnitTestCaseB {
	// A map that contains children unit tests.
	protected children: Array<UnitTestSuite | UnitTestCaseB>;


	/**
	 * Constructor.
	 */
	constructor(testItem: vscode.TestItem, parent: UnitTestSuite) {
		super(testItem, parent);
		this.children = [];
	}


	/**
	 * Adds a child. If necessary removes the child from its old parent.
	 */
	public addChild(child: UnitTestCaseB) {
		child.parent?.removeChild(child);
		this.children.push(child);
		child.parent = this;
		// Add vscode item
		this.testItem.children.add(child.testItem);
	}


	/**
	 * Removes a child from the list.
	 */
	public removeChild(child: UnitTestCaseB) {
		const reducedList = this.children.filter(item => item != child);
		this.children = reducedList;
		// Delete vscode test item
		this.testItem.children.delete(child.testItem.id);
	}


	/**
	 * Delete a test suite and it's children.
	 */
	public delete() {
		super.delete();
		// Delete children
		for (const child of this.children) {
			child.parent = undefined;
			child.delete();
		}
	}
}


/**
 * The root test suite. Used to hold all other test suites.
 * Is associated with a test controller but not with a test item.
 */
class RootTestSuite extends UnitTestSuite {
	/**
	 * Constructor.
	 */
	constructor() {
		super(undefined as any, undefined as any);
		// Create dezog test controller
		this.controller = vscode.tests.createTestController(
			'maziac.dezog.z80unittest.controller',
			'Z80 Unit Tests'
		);
		UnitTestCaseB.controller.resolveHandler = this.resolveTests;
	}


	/**
	 * Create the test items.
	 * Due to the nature how the test items are discovered they are all
	 * discovered at once when this function is called first with 'undefined'.
	 * Otherwise it should not be called anymore by vscode.
	 * 'resolveTests' should be called only once. Every test item is populated,
	 * so there is no need to call it anymore afterwards.
	 * If there are changes to the tet cases it will be handled by the file watchers.
	 * @param testItem If undefined create all test cases. Otherwise do nothing.
	 */
	protected resolveTests(testItem: vscode.TestItem) {
		if (testItem)
			return;
		if (!vscode.workspace.workspaceFolders)
			return;

		// Init
		// TODO: think about disposing the file watchers
		this.children = [];	// just in case

		// Loop over all workspaces
		// TODO: test what happens if a new workspace was added. Most probably the resolveTests is not called!
		for (const ws of vscode.workspace.workspaceFolders) {
			// Retrieve all unit test configs
			const wsFolder = ws.uri.fsPath;
			// Create test item for workspace
			const testWorkspace = this.controller.createTestItem(wsFolder, UnifiedPath.basename(wsFolder));
			const wsSuite = new UnitTestSuiteLaunchJson(testWorkspace, this);
			// Start file watcher on launch.json
			wsSuite.addFileWatcher();
			// Call once initially
			wsSuite.fileChanged();
		}
	}


	/**
	 * Adds a child. If necessary removes the child from its old parent.
	 */
	public addChild(child: UnitTestCaseB) {
		child.parent?.removeChild(child);
		this.children.push(child);
		child.parent = this;
		// Add vscode item
		UnitTestCaseB.controller.items.add(child.testItem);
	}


	/**
	 * Removes a child from the list.
	 */
	public removeChild(child: UnitTestCaseB) {
		const reducedList = this.children.filter(item => item != child);
		this.children = reducedList;
		// Delete vscode test item
		UnitTestCaseB.controller.items.delete(child.testItem.id);
	}
}


/**
 * Extends the base class with functionality for handling files (file watcher)
 * and especially the launch.json file.
 */
class UnitTestSuiteLaunchJson extends UnitTestSuite {
	// Pointer to an optional file watcher.
	public fileWatcher?: FileWatcher;


	/**
	 * Adds a file watcher.
	 */
	public addFileWatcher() {
		// The test id is at the same time the file name (if test item is a file)
		const filePath = this.testItem.id;
		this.fileWatcher = new FileWatcher();
		this.fileWatcher.start(filePath, (path, deleted) => {
			// Deleted?
			if (deleted) {
				this.delete();
				return;
			}
			// File changed
			this.fileChanged();
		});
	}


	/**
	 * Call if launch.json file has been changed.
	 */
	public fileChanged() {
		// Get workspace folder from launch.json path
		const wsFolder = UnifiedPath.resolve(UnifiedPath.dirname(this.testItem.id), '..');

		// Get parent test item
		const testWorkspace = this.testItems.get(wsFolder)!;
		Utility.assert(testWorkspace);

		// Read launch.json
		try {
			// Get launch configs
			const launchJsonPath = this.testItem.id;
			const configs = this.getUnitTestsLaunchConfigs(launchJsonPath);

			// Loop over all unit test launch configs (usually 1)
			for (const config of configs) {
				// Create new test item
				const configId = wsFolder + '#' + config.name;
				const vscodeTestConfig = UnitTestCaseB.controller.createTestItem(configId, config.name);
				const testConfig = new UnitTestSuiteConfig(vscodeTestConfig, config);
				this.addChild(testConfig);
				// Create sub childs
				testConfig.createChildren();
			}
		}
		catch (e) {
			// Ignore, e.g. errors in launch.json
		}
	}


	/**
	 * Delete a test item and it's children.
	 * Removes the file watcher.
	 */
	public delete() {
		super.delete();
		// Delete file watcher
		this.fileWatcher?.dispose();
	}
}


/**
 * Extends the base class with functionality for handling launch.json configs.
 */
class UnitTestSuiteConfig extends UnitTestSuite {
	// Pointer to the launch.json config
	protected config: any;


	/**
	 * Constructor.
	 */
	constructor(testItem: vscode.TestItem, config: any) {
		super(testItem);
		this.config = config;
	}


	/**
	 * Checks for the sld/list files for the configuration
	 * and creates a child for each file.
	 */
	public createChildren() {
		// Get workspace folder from launch.json path
		const wsFolder = UnifiedPath.resolve(UnifiedPath.dirname(this.testItem.id), '..');

		// Get parent test item
		const testWorkspace = this.testItems.get(wsFolder)!;
		Utility.assert(testWorkspace);

		// Read launch.json
		try {
			// Get all list files
			const listFiles = Settings.GetAllAssemblerListFiles(this.config);

			// Loop over all list files
			for (const listFile of listFiles) {
				// Create new test item
				const filePath = UnifiedPath.join(wsFolder, listFile.path);
				const testSuite = new UnitTestSuiteListFile(filePath);
				this.addChild(testSuite);
				// Create sub childs
				testSuite.fileChanged();
			}
		}
		catch (e) {
			// Ignore, e.g. errors in launch.json
		}
	}
}



/**
 * Special handling for sl/list files.
 */
class UnitTestSuiteListFile extends UnitTestSuiteLaunchJson {
	// The absolute path to the sld/list file.
	protected filePath: string;

	// The path to the workspace.
	protected workspace: string;


	/**
	 * Constructor.
	 */
	constructor(testItem: vscode.TestItem, filePath: string, workspace: string) {
		super(filePath, Utility.getRelFilePath(filePath));
		this.filePath = filePath;
		this.workspace = workspace;
	}


	/**
	 * Called if sld/list file has been changed.
	 */
	public fileChanged() {
		// Get parent test item
		const testFile = this.testItems.get(filePath)!;
		Utility.assert(testFile);
		// Get context
		const context = this.listFileContexts.get(filePath);
		Utility.setRootPath(context.wsFolder);
		// Read labels from sld/list file
		const labels = new LabelsClass();
		// Now parse for Unit test labels, i.e. starting with "UT_"
		const utLabels = this.getAllUtLabels(labels);
		// Create an test item for each unit test
		for (const utLabel of utLabels) {
			const id = filePathWith + utLabel.label;
			let testItem = this.testItems.get(id);
			if (testItem) {
				// Remove from removable list
				removeFiles.delete(id);
			}
			else {
				// Create new test item
				testItem = this.controller.createTestItem(id, utLabel.label);
				testFile.children.add(testFile);
				this.testItems.set(id, testItem);
			}
			// TODO: Add hierarchy of the test items
		}




		const filePath = UnifiedPath.join(wsFolder, listFile.path);
		// Create test item for file
		let testFile = this.testItems.get(filePath);
		if (testFile) {
			// Remove from removable list
			removeFiles.delete(filePath);
		}
		else {
			// Create new test item
			const idFile = filePath;
			testFile = this.controller.createTestItem(idFile, Utility.getRelFilePath(filePath));
			testWorkspace.children.add(testFile);
			this.testItems.set(idFile, testFile);
		}
		// Watch for list file
		const fwListFile = new FileWatcher();
		fwListFile.start(filePath, this.listFileChanged);
		// Call once initially
		this.listFileChanged(filePath);


		// Get workspace folder from launch.json path
		const wsFolder = UnifiedPath.resolve(UnifiedPath.dirname(this.testItem.id), '..');

		// Get parent test item
		const testWorkspace = this.testItems.get(wsFolder)!;
		Utility.assert(testWorkspace);

		// Read launch.json
		try {
			// Get launch configs
			const launchJsonPath = this.testItem.id;
			const configs = this.getUnitTestsLaunchConfigs(launchJsonPath);

			// Loop over all unit test launch configs (usually 1)
			for (const config of configs) {
				// Create new test item
				const configId = wsFolder + '#' + config.name;
				const vscodeTestConfig = UnitTestCaseB.controller.createTestItem(configId, config.name);
				const testConfig = new UnitTestSuiteConfig(vscodeTestConfig, config);
				this.addChild(testConfig);
				// Create sub childs
				testConfig.createChildren();
			}
		}
		catch (e) {
			// Ignore, e.g. errors in launch.json
		}

	}
}



/// Some definitions for colors.
enum Color {
	Reset = "\x1b[0m",
	Bright = "\x1b[1m",
	Dim = "\x1b[2m",
	Underscore = "\x1b[4m",
	Blink = "\x1b[5m",
	Reverse = "\x1b[7m",
	Hidden = "\x1b[8m",

	FgBlack = "\x1b[30m",
	FgRed = "\x1b[31m",
	FgGreen = "\x1b[32m",
	FgYellow = "\x1b[33m",
	FgBlue = "\x1b[34m",
	FgMagenta = "\x1b[35m",
	FgCyan = "\x1b[36m",
	FgWhite = "\x1b[37m",

	BgBlack = "\x1b[40m",
	BgRed = "\x1b[41m",
	BgGreen = "\x1b[42m",
	BgYellow = "\x1b[43m",
	BgBlue = "\x1b[44m",
	BgMagenta = "\x1b[45m",
	BgCyan = "\x1b[46m",
	BgWhite = "\x1b[47m",
}

/**
 * Colorize a string
 * @param color The color, e.g. '\x1b[36m' for cyan, see https://coderwall.com/p/yphywg/printing-colorful-text-in-terminal-when-run-node-js-script.
 * @param text The string to colorize.
 */
function colorize(color: string, text: string): string {
	//return color + text + '\x1b[0m';
	return text;	// No easy colorizing possible in output channel.
}


/**
 * Enumeration for the returned test case pass or failure.
 */
enum TestCaseResult {
	OK = 0,
	FAILED = 1,
	TIMEOUT = 2,
	CANCELLED = 3,	// Test cases have been cancelled, e.g. manually or the connection might have been lost or whatever.
}


/**
 * This structure is returned by getAllUnitTests.
 */
export interface UnitTestCase {
	label: string;	// The full label of the test case, e.g. "test.UT_test1"
	file: string;	// The full path of the file
	line: number;	// The line number of the label
}


/**
 * This class takes care of executing the unit tests.
 * It basically
 * 1. Reads the list file to find the unit test labels.
 * 2. Loads the binary into the emulator.
 * 3. Manipulates memory and PC register to call a specific unit test.
 * 4. Loops over all found unit tests.
 */
export class Z80UnitTestRunner extends TestRunner {
	/// This array will contain the names of all UT test cases.
	protected static utLabels: Array<string>;

	/// This array will contain the names of the test cases that should be run.
	protected static partialUtLabels: Array<string> | undefined;

	/// A map for the test case labels and their resolve functions. The resolve
	/// function is called when the test cases has been executed.
	/// result:
	///   0 = passed
	///   1 = failed
	///   2 = timeout
	protected static testCaseMap = new Map<string, (result: number) => void>();

	/// The unit test initialization routine. The user has to provide
	/// it and the label.
	protected static addrStart: number;

	/// The start address of the unit test wrapper.
	/// This is called to start the unit test.
	protected static addrTestWrapper: number;

	/// Here is the address of the unit test written.
	protected static addrCall: number;

	/// At the end of the test this address is reached on success.
	protected static addrTestReadySuccess: number;

	/// Is filled with the summary of tests and results.
	protected static outputSummary: string;

	/// Counts number of failed and total test cases.
	protected static countFailed: number;
	protected static countExecuted: number;

	/// Is set if the current  test case fails.
	protected static currentFail: boolean;

	/// The handle for the timeout.
	protected static timeoutHandle;

	/// Debug mode or run mode.
	protected static debug = false;

	/// Set to true if unit tests are cancelled.
	protected static cancelled = false;

	/// Stores the covered addresses for all unit tests.
	protected static allCoveredAddresses: Set<number>;

	/// Caches the last received addresses (from Emulator)
	protected static lastCoveredAddresses: Set<number>;

	/// Called when the unit test have finished.
	/// Used to know when the async function is over.
	protected static finishedCallback?: () => void;

	/// The output channel for the unit tests
	protected static unitTestOutput = vscode.window.createOutputChannel("DeZog Unit Tests");

	// The map of file watchers. Key is the file path.
	protected static fileWatchers: Map<string, FileWatcher>;

	// Maps the filename (=id) to the test item.
	protected static testItems: Map<string, vscode.TestItem>;

	// Maps the sld/list files to launch configs.
	protected static listFileContexts: Map<string, any>;

	// The unit test case root object. It contains the unit test (suite)
	// hierarchy:
	// rootSuite
	// |-- workspacefolder[i]
	// |   |-- unit test config [j] (from launch.json)
	// |   |   |-- Unit test label [k1]
	// |   |-- unit test config [j+1] (from launch.json)
	// |   |   |-- Unit test label [k2]
	// |-- workspacefolder[i+1]
	//     |-- ...
	protected static rootSuite: UnitTestSuite;


	/**
	 * Called whenever the launch.json file has changed on disk.
	 * @param filePath Absolute fie path.
	 * @param deleted If true the file has been deleted.
	 */
	protected static launchJsonFileChanged(filePath: string, deleted = false) {
		// Get workspace folder from launch.json path
		const wsFolder = UnifiedPath.resolve(UnifiedPath.dirname(filePath), '..');
		// Get all previous test items
		const wsFolderWith = wsFolder + '/';
		const removeFiles = new Set([...this.testItems.keys()].filter(id => id.startsWith(wsFolderWith)));

		// Get parent test item
		const testWorkspace = this.testItems.get(wsFolder)!;
		Utility.assert(testWorkspace);

		// Read launch.json
		if (!deleted) {
			try {
				// Get launch configs
				const configs = this.getUnitTestsLaunchConfigs(filePath);
				// Loop over all unit test launch configs (usually 1)
				for (const config of configs) {
					// Get all list files
					const listFiles = Settings.GetAllAssemblerListFiles(config);

					// Loop over all list files
					for (const listFile of listFiles) {
						const filePath = UnifiedPath.join(wsFolder, listFile.path);
						// Create test item for file
						let testFile = this.testItems.get(filePath);
						if (testFile) {
							// Remove from removable list
							removeFiles.delete(filePath);
						}
						else {
							// Create new test item
							const idFile = filePath;
							testFile = this.controller.createTestItem(idFile, Utility.getRelFilePath(filePath));
							testWorkspace.children.add(testFile);
							this.testItems.set(idFile, testFile);
						}
						// Watch for list file
						const fwListFile = new FileWatcher();
						fwListFile.start(filePath, this.listFileChanged);
						// Call once initially
						this.listFileChanged(filePath);
					}
				}
			}
			catch (e) {
				// Ignore, e.g. errors in launch.json
			}
		}

		// If launch.json was deleted remove file watchers
		for (const filePath of removeFiles) {
			// REmove file watcher
			const fw = this.fileWatchers.get(filePath)!;
			Utility.assert(fw);
			fw.dispose();
			this.fileWatchers.delete(filePath);
			// Remove test item
			testWorkspace.children.delete(filePath);
			this.listFileContexts.delete(filePath);
			this.testItems.delete(filePath);
			// Remove test items (the labels)
		}
	}


	/**
	 * Returns the unit tests launch configurations. I.e. the configuration
	 * from .vscode/launch.json with property unitTests set to true.
	 * @param launchJsonPath The absolute path to the .vscode/launch.json file.
	 * @returns Array of unit test configs or empty array.
	 * Throws an exception if launch.json cannot be parsed. Or if file does not exist.
	 */
	protected getUnitTestsLaunchConfigs(launchJsonPath: string): any {
		const launchData = readFileSync(launchJsonPath, 'utf8');
		const parseErrors: jsonc.ParseError[] = [];
		const launch = jsonc.parse(launchData, parseErrors, {allowTrailingComma: true});

		// Check for error
		if (parseErrors.length > 0) {
			// Error
			throw Error("Parse error while reading " + launchJsonPath + ".");
		}

		// Find the right configuration
		const configurations: any[] = [];
		for (const config of launch.configurations) {
			if (config.unitTests) {
				// Check if there is already unit test configuration:
				// Only one is allowed.
				//if (configuration)
				//	throw Error("More than one unit test launch configuration //found. Only one is allowed.");
				//configuration = config;
				configurations.push(config);
			}
		}

		return configurations;
	}


	/**
	 * Called whenever the sld7list file has changed on disk.
	 * @param filePath Absolute fie path.
	 * @param deleted If true the file has been deleted.
	 */
	protected static listFileChanged(filePath: string, deleted = false) {
		// Get all previous test items
		const filePathWith = filePath + '#';
		const removeFiles = new Set([...this.testItems.keys()].filter(id => id.startsWith(filePathWith)));

		// Read list file / create labels
		if (!deleted) {
			try {
				// Get parent test item
				const testFile = this.testItems.get(filePath)!;
				Utility.assert(testFile);
				// Get context
				const context = this.listFileContexts.get(filePath);
				Utility.setRootPath(context.wsFolder);
				// Read labels from sld/list file
				const labels = new LabelsClass();
				// Now parse for Unit test labels, i.e. starting with "UT_"
				const utLabels = this.getAllUtLabels(labels);
				// Create an test item for each unit test
				for (const utLabel of utLabels) {
					const id = filePathWith + utLabel.label;
					let testItem = this.testItems.get(id);
					if (testItem) {
						// Remove from removable list
						removeFiles.delete(id);
					}
					else {
						// Create new test item
						testItem = this.controller.createTestItem(id, utLabel.label);
						testFile.children.add(testFile);
						this.testItems.set(id, testItem);
					}
					// TODO: Add hierarchy of the test items
				}
			}
			catch (e) {
				// Ignore, e.g. errors in launch.json
				deleted = true;
			}
		}

		// If file was deleted remove file watchers
		for (const filePath of removeFiles) {
			const fw = this.fileWatchers.get(filePath)!;
			Utility.assert(fw);
			fw.dispose();
			this.fileWatchers.delete(filePath);
		}
	}


	/**
	 * Execute all unit tests.
	 */
	public static async runAllUnitTests() {
		// Safety check
		const wsFolders = vscode.workspace.workspaceFolders;
		if (!wsFolders)
			return;

		// Loop over all projects (for multiroot)
		for (const wsFolder of wsFolders) {
			// Set root folder
			const rootFolder = wsFolder.uri.fsPath;
			await Z80UnitTestRunner.runAllProjectUnitTests(rootFolder);
		}
	}


	/**
	 * Runs all tests of one projects.
	 * Does not return before all tests are done.
	 * @param rootFolder The root folder of the project.
	 */
	protected static async runAllProjectUnitTests(rootFolder: string): Promise<void> {
		return new Promise<void>(resolve => {
			// All test cases
			let lblFileLines: UnitTestCase[] = [];
			try {
				lblFileLines = Z80UnitTestRunner.getAllUnitTests(rootFolder);
			}
			catch {}
			if (lblFileLines.length == 0) {
				resolve();
				return;
			}
			Z80UnitTestRunner.partialUtLabels = lblFileLines.map(lfl => lfl.label);
			// Set callback
			Z80UnitTestRunner.finishedCallback = () => {
				Z80UnitTestRunner.finishedCallback = undefined;
				resolve();
			};
			// Start
			Z80UnitTestRunner.runTestsCheck();
		});
	}


	/**
	 * Execute some unit tests in debug mode.
	 */
	public static runPartialUnitTests(rootFolder: string) {
		// Get list of test case labels
		Z80UnitTestRunner.partialUtLabels = [];
		for (const [tcLabel,] of Z80UnitTestRunner.testCaseMap)
			Z80UnitTestRunner.partialUtLabels.push(tcLabel);
		// Set root folder
		Utility.setRootPath(rootFolder);
		// Start
		Z80UnitTestRunner.runTestsCheck();
	}


	/**
	 * Checks if the debugger is active. If yes terminates it and
	 * executes the unit tests.
	 * @param debug false: unit tests are run without debugger,
	 * true: unit tests are run with debugger.
	 */
	protected static async terminateEmulatorAndStartTests(debug: boolean): Promise<void> {
		Z80UnitTestRunner.debug = debug;
		return new Promise<void>(async resolve => {
			// Wait until vscode debugger has stopped.
			if (Remote) {
				// Terminate emulator
				await Remote.terminate();
				RemoteFactory.removeRemote();
			}

			// (Unfortunately there is no event for this, so we need to wait)
			Utility.delayedCall(time => {
				// After 5 secs give up
				if (time >= 5.0) {
					// Give up
					vscode.window.showErrorMessage('Could not terminate active debug session. Please try manually.');
					resolve();
					return true;
				}
				// New coverage set
				this.allCoveredAddresses = new Set<number>();
				// Check for active debug session
				if (vscode.debug.activeDebugSession)
					return false;  // Try again
				// Debugger not active anymore, start tests
				this.cancelled = false;
				if (debug)
					this.debugTests();
				else
					this.runTests();
				resolve();
				return true;  // Stop
			});
		});
	}


	/**
	 * Checks first if a debug session is active, terminates it
	 * and then starts the unit tests.
	 */
	protected static runTestsCheck() {
		this.terminateEmulatorAndStartTests(false);
	}


	/**
	  * Start the unit tests, either partial or full.
	  * If unit test cases are run (opposed to debugged) the vscode UI is not used
	  * and communication takes place directly with the emulator.
	  */
	protected static async runTests(): Promise<void> {
		// Mode
		this.debug = false;
		this.cancelled = false;

		// Get unit test launch config
		const configuration = Z80UnitTestRunner.getUnitTestsLaunchConfigs();

		// Setup settings
		const rootFolder = Utility.getRootPath();
		Settings.Init(configuration, rootFolder);
		Settings.CheckSettings();

		// Reset all decorations
		Decoration.clearAllDecorations();

		// Create the registers
		Z80RegistersClass.createRegisters();

		// Start emulator.
		RemoteFactory.createRemote(configuration.remoteType);

		// Check if a cpu history object has been created. (Note: this is only required for debug but done for both)
		if (!(CpuHistory as any)) {
			// If not create a lite (step) history
			CpuHistoryClass.setCpuHistory(new StepHistoryClass());
			StepHistory.decoder = Z80Registers.decoder;
		}

		// Reads the list file and also retrieves all occurrences of WPMEM, ASSERTION and LOGPOINT.
		Labels.init(configuration.smallValuesMaximum);
		Remote.readListFiles(configuration);

		return new Promise<void>(async (resolve, reject) => {
			// Events
			Remote.once('initialized', async () => {
				try {
					// Initialize Cpu- or StepHistory.
					StepHistory.init();  // might call the socket

					// Execute command to enable wpmem, logpoints, assertions.
					await Remote.enableLogpointGroup(undefined, true);
					try {
						await Remote.enableWPMEM(true);
					}
					catch (e) {
						// It's not essential anymore to have watchpoints running.
						// So catch this error from CSpect and show a warning instead
						vscode.window.showWarningMessage(e.message);
					}
					await Remote.enableAssertionBreakpoints(true);

					await Z80UnitTestRunner.initUnitTests();

					// Load the initial unit test routine (provided by the user)
					await this.execAddr(Z80UnitTestRunner.addrStart);

					// End
					resolve();
				}
				catch (e) {
					// Some error occurred
					Z80UnitTestRunner.stopUnitTests(undefined, e.message);// TODO
					//reject(e);
					resolve();
				}
			});

			Remote.on('coverage', coveredAddresses => {
				// Cache covered addresses (since last unit test)
				//Z80UnitTestRunner.lastCoveredAddresses = coveredAddresses;
				if (!Z80UnitTestRunner.lastCoveredAddresses)
					Z80UnitTestRunner.lastCoveredAddresses = new Set<number>();
				coveredAddresses.forEach(Z80UnitTestRunner.lastCoveredAddresses.add, Z80UnitTestRunner.lastCoveredAddresses);
			});

			Remote.on('warning', message => {
				// Some problem occurred
				vscode.window.showWarningMessage(message);
			});

			Remote.on('debug_console', message => {
				// Show the message in the debug console
				vscode.debug.activeDebugConsole.appendLine(message);

			});

			Remote.once('error', e => {
				// Some error occurred
				Z80UnitTestRunner.stopUnitTests(undefined, e.message);
				//reject(e);
				resolve();
			});


			// Connect to debugger.
			try {
				await Remote.init();
			}
			catch (e) {
				// Some error occurred
				Z80UnitTestRunner.stopUnitTests(undefined, e.message);
				//reject(e);
				resolve();
			};
		});
	}


	/**
	 * Execute all unit tests in debug mode.
	 */
	public static async debugAllUnitTests() {
		// Safety check
		const wsFolders = vscode.workspace.workspaceFolders;
		if (!wsFolders)
			return;

		// Loop over all projects (for multiroot)
		for (const wsFolder of wsFolders) {
			// Set root folder
			const rootFolder = wsFolder.uri.fsPath;
			await Z80UnitTestRunner.debugAllProjectUnitTests(rootFolder);
		}
	}


	/**
	 * Runs all tests of one projects in debug mode.
	 * Does not return before all tests are done.
	 * @param rootFolder The root folder of the project.
	 */
	protected static async debugAllProjectUnitTests(rootFolder: string): Promise<void> {
		return new Promise<void>(resolve => {
			// All test cases
			let lblFileLines: UnitTestCase[] = [];
			try {
				lblFileLines = Z80UnitTestRunner.getAllUnitTests(rootFolder);
			}
			catch {}
			if (lblFileLines.length == 0) {
				resolve();
				return;
			}
			Z80UnitTestRunner.partialUtLabels = lblFileLines.map(lfl => lfl.label);
			// Set callback
			Z80UnitTestRunner.finishedCallback = () => {
				Z80UnitTestRunner.finishedCallback = undefined;
				resolve();
			};
			// Start
			Z80UnitTestRunner.debugTestsCheck();
		});
	}


	/**
	 * Execute some unit tests in debug mode.
	 */
	public static debugPartialUnitTests(rootFolder: string) {
		// Mode
		this.debug = true;
		this.cancelled = false;
		// Get list of test case labels
		Z80UnitTestRunner.partialUtLabels = [];
		for (const [tcLabel,] of Z80UnitTestRunner.testCaseMap)
			Z80UnitTestRunner.partialUtLabels.push(tcLabel);
		// Set root folder
		Utility.setRootPath(rootFolder);
		// Start
		Z80UnitTestRunner.debugTestsCheck();
	}


	/**
	 * Command execution: Cancel all unit tests.
	 */
	public static async cmdCancelAllUnitTests() {
		Remote.emit('terminated');
		await Z80UnitTestRunner.cancelUnitTests();
	}


	/**
	 *  Command to cancel the unit tests. E.g. during debugging of one unit test.
	 */
	public static async cancelUnitTests() {
		// Avoid calling twice
		if (this.cancelled)
			return;
		// Cancel the unit tests
		this.cancelled = true;
		const text = "Unit tests cancelled.";
		Z80UnitTestRunner.dbgOutput(text);
		await Z80UnitTestRunner.stopUnitTests(undefined);
		//	ds.customRequest("terminate");
		// Fail the current test
		/*
		Z80UnitTestRunner.countFailed++;
		if (Z80UnitTestRunner.countFailed>Z80UnitTestRunner.countExecuted)
			Z80UnitTestRunner.countFailed=Z80UnitTestRunner.countExecuted;
		*/
		if (Z80UnitTestRunner.countExecuted > 0)
			Z80UnitTestRunner.countExecuted--;
		Z80UnitTestRunner.unitTestsFinished();
	}


	/**
	 * Start the unit tests but checks first if the debugger is active and
	 * terminates it.
	 */
	protected static debugTestsCheck() {
		this.terminateEmulatorAndStartTests(true);
	}


	/**
	 * Start the unit tests, either partial or full, in debug mode.
	 * Debug mode simulates the vscode UI to start debugging and to press continue
	 * after each unit test case.
	 */
	protected static debugTests() {
		try {
			// Get unit test launch config
			const configuration = Z80UnitTestRunner.getUnitTestsLaunchConfigs();
			const configName: string = configuration.name;

			// Start debugger
			const success = DebugSessionClass.unitTests(configName, this.handleDebugAdapter);
			if (!success) {
				vscode.window.showErrorMessage("Couldn't start unit tests. Is maybe a debug session active?");
			}
		}
		catch (e) {
			vscode.window.showErrorMessage(e.message);
		}
	}


	/**
	 * Clears the map of test cases.
	 * Is called at first when starting (partial) unit test cases.
	 */
	public static clearTestCaseList() {
		// Clear map
		Z80UnitTestRunner.testCaseMap.clear();
	}


	/**
	 * "Executes" one unit test case.
	 * The test case is just remembered and executed later.
	 * Whenever the test case is executed the result is passed in the promise.
	 * @param tcLabels An array with the unit test case labels.
	 */
	public static async execUnitTestCase(tcLabel: string): Promise<number> {
		return new Promise<number>((resolve) => {
			// Remember its resolve function.
			Z80UnitTestRunner.testCaseMap.set(tcLabel, resolve);
		});
	}






	/**
	 * Loads all labels from the launch.json unit test configuration and
	 * returns a new labels object.
	 * Reads in all labels files.
	 * @param rootFolder The root folder of the project.
	 * @returns A labels object.
	 */
	protected static loadLabelsFromConfiguration(rootFolder: string): LabelsClass {
		// Set root path
		Utility.setRootPath(rootFolder);

		const configuration = Z80UnitTestRunner.getUnitTestsLaunchConfigs();

		// Setup settings
		Settings.Init(configuration, rootFolder);
		Settings.CheckSettings();

		// Get labels
		const labels = new LabelsClass();
		labels.readListFiles(configuration);
		return labels;
	}


	/**
	 * Retrieves a list of strings with the labels of all unit tests.
	 * @returns A list of strings with the label names of the unit tests or a single string with the error text.
	 */
	/*
	public static async getAllUnitTests(): Promise<UnitTestCase[]> {
		return new Promise<UnitTestCase[]>((resolve, reject) => {
			try {
				// Read all list files.
				const labels = Z80UnitTestRunner.loadLabelsFromConfiguration();
				// Check if unit tests available
				if (!Z80UnitTestRunner.AreUnitTestsAvailable(labels))
					return resolve([]);	// Return empty array
				// Get the unit test labels
				const utLabels = Z80UnitTestRunner.getAllUtLabels(labels);
				resolve(utLabels);
			}
			catch (e) {
				// Error
				reject(e.message || "Unknown error.");
			}
		});
	}
	*/
	// TODO: REMOVE
	public static getAllUnitTests(rootFolder: string): UnitTestCase[] {
		let allUtLabels: UnitTestCase[] = [];
		try {
			// Read all list files.
			const labels = Z80UnitTestRunner.loadLabelsFromConfiguration(rootFolder);
			// Check if unit tests available
			if (Z80UnitTestRunner.AreUnitTestsAvailable(labels)) {
				// Get the unit test labels
				allUtLabels = Z80UnitTestRunner.getAllUtLabels(labels);
			}
		}
		catch (e) {
			// Re-throw
			const msg = e.message || "Unknown error.";
			throw Error("Z80 Unit Tests: " + msg);
		}
		return allUtLabels;
	}


	/**
	 * Check for z80asm:
	 * In z80asm the labels will be visible in the list file for the macro definition.
	 * Even if no unit test has been defined.
	 * This can be checked. In that case the addresses for all labels are the same.	protected
	 */
	protected static AreUnitTestsAvailable(labels: LabelsClass): boolean {
		const firstLabel = labels.getNumberForLabel("UNITTEST_TEST_WRAPPER");
		const lastLabel = labels.getNumberForLabel("UNITTEST_MAX_STACK_GUARD");

		if(firstLabel == lastLabel) {
			// Note: this is also true if both labels are not defined (undefined == undefined)
			return false;
		}

		// Everything fine
		return true;
	}


	/**
	 * Initializes the unit tests. Is called after the emulator has been setup.
	 */
	protected static async initUnitTests(): Promise<void> {
		// The Z80 binary has been loaded.
		// The debugger stopped before starting the program.
		// Now read all the unit tests.
		Z80UnitTestRunner.outputSummary = '';
		Z80UnitTestRunner.countFailed = 0;
		Z80UnitTestRunner.countExecuted = 0;
		Z80UnitTestRunner.timeoutHandle = undefined;
		Z80UnitTestRunner.currentFail = true;

		if (!Z80UnitTestRunner.AreUnitTestsAvailable(Labels))
			throw Error("Unit tests not enabled in assembler sources.");

		// Get the unit test code
		Z80UnitTestRunner.addrStart = Z80UnitTestRunner.getLongAddressForLabel("UNITTEST_START");
		Z80UnitTestRunner.addrTestWrapper = Z80UnitTestRunner.getLongAddressForLabel("UNITTEST_TEST_WRAPPER");
		Z80UnitTestRunner.addrCall = Z80UnitTestRunner.getLongAddressForLabel("UNITTEST_CALL_ADDR");
		Z80UnitTestRunner.addrCall ++;
		Z80UnitTestRunner.addrTestReadySuccess = Z80UnitTestRunner.getLongAddressForLabel("UNITTEST_TEST_READY_SUCCESS");
		//Z80UnitTestRunner.addrTestReadyReturnFailure = Z80UnitTestRunner.getLongAddressForLabel("UNITTEST_TEST_READY_RETURN_FAILURE");
		//Z80UnitTestRunner.addrTestReadyFailure = Z80UnitTestRunner.getLongAddressForLabel("UNITTEST_TEST_READY_FAILURE_BREAKPOINT");
		//const stackMinWatchpoint = Z80UnitTestRunner.getLongAddressForLabel("UNITTEST_MIN_STACK_GUARD");
		//const stackMaxWatchpoint = Z80UnitTestRunner.getLongAddressForLabel("UNITTEST_MAX_STACK_GUARD");

		// Check if code for unit tests is really present
		// (In case labels are present but the actual code has not been loaded.)
		const opcode = await Remote.readMemory(Z80UnitTestRunner.addrTestWrapper & 0xFFFF);	// TODO: Check if 64k address is OK here
		// Should start with DI (=0xF3)
		if (opcode != 0xF3)
			throw Error("Code for unit tests is not present.");

		// Labels not yet known.
		Z80UnitTestRunner.utLabels = undefined as unknown as Array<string>;

		// Success and failure breakpoints
		const successBp: RemoteBreakpoint = { bpId: 0, filePath: '', lineNr: -1, address: Z80UnitTestRunner.addrTestReadySuccess, condition: '',	log: undefined };
		await Remote.setBreakpoint(successBp);
		//const failureBp1: RemoteBreakpoint={bpId: 0, filePath: '', lineNr: -1, address: Z80UnitTestRunner.addrTestReadyFailure, condition: '', log: undefined};
		//await Remote.setBreakpoint(failureBp1);
		//const failureBp2: RemoteBreakpoint={bpId: 0, filePath: '', lineNr: -1, address: Z80UnitTestRunner.addrTestReadyReturnFailure, condition: '', log: undefined};
		//await Remote.setBreakpoint(failureBp2);

		// Stack watchpoints
		//const stackMinWp: GenericWatchpoint = { address: stackMinWatchpoint, size: 2, access: 'rw', condition: '' };
		//const stackMaxWp: GenericWatchpoint = { address: stackMaxWatchpoint, size: 2, access: 'rw', condition: '' };
		//await Remote.setWatchpoint(stackMinWp);
		//await Remote.setWatchpoint(stackMaxWp);
	}


	/**
	 * Handles the states of the debug adapter. Will be called after setup
	 * @param debugAdapter The debug adapter.
	 */
	protected static handleDebugAdapter(debugAdapter: DebugSessionClass) {
		debugAdapter.on('initialized', async () => {
			try {
				// Execute command to enable wpmem, logpoints, assertions.
				await Remote.enableLogpointGroup(undefined, true);
				try {
					await Remote.enableWPMEM(true);
				}
				catch (e) {
					// It's not essential anymore to have watchpoints running.
					// So catch this error from CSpect and show a warning instead
					vscode.window.showWarningMessage(e.message);
				}
				await Remote.enableAssertionBreakpoints(true);

				// Handle coverage
				Remote.on('coverage', coveredAddresses => {
					// Cache covered addresses (since last unit test)
					//Z80UnitTestRunner.lastCoveredAddresses = coveredAddresses;
					if (!Z80UnitTestRunner.lastCoveredAddresses)
						Z80UnitTestRunner.lastCoveredAddresses = new Set<number>();
					coveredAddresses.forEach(Z80UnitTestRunner.lastCoveredAddresses.add, Z80UnitTestRunner.lastCoveredAddresses);
				});

				// After initialization vscode might send breakpoint requests
				// to set the breakpoints.
				// Unfortunately this request is sent only if breakpoints exist.
				// I.e. there is no safe way to wait for something to
				// know when vscode is ready.
				// So just wait some time:
				if (Settings.launch.startAutomatically)
					await Utility.timeout(500);

				// Init unit tests
				await Z80UnitTestRunner.initUnitTests();
				// Start unit tests after a short while
				Z80UnitTestRunner.startUnitTestsWhenQuiet(debugAdapter);
			}
			catch(e) {
				Z80UnitTestRunner.stopUnitTests(debugAdapter, e.message);
			}
		});

		debugAdapter.on('break', () => {
			Z80UnitTestRunner.onBreak(debugAdapter);
		});
	}


	/**
	 * A break occurred. E.g. the test case stopped because it is finished
	 * or because of an error (ASSERTION).
	 * @param debugAdapter The debugAdapter (in debug mode) or undefined for the run mode.
	 */
	protected static onBreak(debugAdapter?: DebugSessionClass) {
		// The program was run and a break occurred.
		// Get current pc
		//Remote.getRegisters().then(() => {
			// Parse the PC value
			const pc = Remote.getPCLong();
			//const sp = Z80Registers.parseSP(data);
			// Check if test case was successful
			Z80UnitTestRunner.checkUnitTest(pc, debugAdapter);
			// Otherwise another break- or watchpoint was hit or the user stepped manually.
		//});
	}


	/**
	 * Returns the long address for a label. Checks it and throws an error if it does not exist.
	 * @param label The label eg. "UNITTEST_TEST_WRAPPER"
	 * @returns An address.
	 */
	protected static getLongAddressForLabel(label: string): number {
		const loc = Labels.getLocationOfLabel(label);
		let addr;
		if (loc)
			addr = loc.address;
		if (addr == undefined) {
			throw Error("Z80 unit Tests: Couldn't find the unit test wrapper (" + label + "). Did you forget to use the macro?");
		}
		return addr;
	}


	/**
	 * Waits a few 100ms until traffic is quiet on the zSocket interface.
	 * The problem that is solved here:
	 * After starting the vscode sends the source file breakpoints.
	 * But there is no signal to tell when all are sent.
	 * If we don't wait we would miss a few and we wouldn't break.
	 * @param da The debug emulator.
	 */
	protected static startUnitTestsWhenQuiet(da: DebugSessionClass) {
		// Wait
		da.waitForBeingQuietFor(1000)
		.then(() => {
			// Load the initial unit test routine (provided by the user)
			Z80UnitTestRunner.execAddr(Z80UnitTestRunner.addrStart, da);
		});
	}


	/**
	 * Executes the sub routine at 'addr'.
	 * Used to call the unit test initialization subroutine and the unit
	 * tests.
	 * @param address The (long) address of the unit test.
	 * @param da The debug adapter.
	 */
	protected static execAddr(address: number, da?: DebugSessionClass) {
		// Set memory values to test case address.
		const callAddr=new Uint8Array([address&0xFF, address>>>8]);
		Remote.writeMemoryDump(this.addrCall, callAddr).then(async () => {
			// Set slot/bank to Unit test address
			const bank = Z80Registers.getBankFromAddress(address);
			if (bank >= 0) {
				const slot = Z80Registers.getSlotFromAddress(address)
				await Remote.setSlot(slot, bank);
			}
			// Set PC
			const addr64k = this.addrTestWrapper & 0xFFFF;
			await Remote.setRegisterValue("PC", addr64k);

			// Run
			/*
			if (Z80UnitTestRunner.utLabels)
				Z80UnitTestRunner.dbgOutput('UnitTest: '+Z80UnitTestRunner.utLabels[0]+' da.emulatorContinue()');
			*/
			// Init
			StepHistory.clear();
			await Remote.getRegistersFromEmulator();
			await Remote.getCallStackFromEmulator();

			// Special handling for zsim: Re-init custom code.
			if (Remote instanceof ZSimRemote) {
				const zsim = Remote as ZSimRemote;
				zsim.customCode?.reload();
			}

			// Run or Debug
			Z80UnitTestRunner.RemoteContinue(da);
		});
	}


	/**
	 * Starts Continue directly or through the debug adapter.
	 */
	protected static RemoteContinue(da: DebugSessionClass|undefined) {
		// Start asynchronously
		(async () => {
			// Check if cancelled
			if (Z80UnitTestRunner.cancelled)
				return;
			// Init
			Remote.startProcessing();
			// Run or Debug
			if (da) {
				// With vscode UI
				da.sendEventContinued();
				// Debug: Continue
				await da.remoteContinue();
				Remote.stopProcessing();
			}
			else {
				// Run: Continue
				await Remote.continue();
				Remote.stopProcessing();
				Z80UnitTestRunner.onBreak();
			}
		})();
	}


	/**
	 * Executes the next test case.
	 * @param da The debug adapter.
	 */
	protected static nextUnitTest(da?: DebugSessionClass) {
		// Increase count
		Z80UnitTestRunner.countExecuted ++;
		Z80UnitTestRunner.currentFail = false;
		// Get Unit Test label
		const label = Z80UnitTestRunner.utLabels[0];
		// Calculate address
		const address = Labels.getNumberForLabel(label) as number;
		Utility.assert(address != undefined);

		// Set timeout
		if(!Z80UnitTestRunner.debug) {
			clearTimeout(Z80UnitTestRunner.timeoutHandle);
			const toMs=1000*Settings.launch.unitTestTimeout;
			Z80UnitTestRunner.timeoutHandle = setTimeout(() => {
				// Clear timeout
				clearTimeout(Z80UnitTestRunner.timeoutHandle);
				Z80UnitTestRunner.timeoutHandle = undefined;
				// Failure: Timeout. Send a break.
				Remote.pause();
			}, toMs);
		}

		// Start at test case address.
		Z80UnitTestRunner.dbgOutput('TestCase ' + label + '(0x' + address.toString(16) + ') started.');
		Z80UnitTestRunner.execAddr(address, da);
	}


	/**
	 * Checks if the test case was OK or a fail.
	 * Or undetermined.
	 * @param da The debug adapter.
	 * @param pc The program counter to check.
	 */
	protected static async checkUnitTest(pc: number, da?: DebugSessionClass): Promise<void> {
		// Check if it was a timeout
		let timeoutFailure = !Z80UnitTestRunner.debug;
		if(Z80UnitTestRunner.timeoutHandle) {
			// Clear timeout
			clearTimeout(Z80UnitTestRunner.timeoutHandle);
			Z80UnitTestRunner.timeoutHandle = undefined;
			timeoutFailure = false;
		}

		// Check if test case ended successfully or not
		if (pc != this.addrTestReadySuccess) {
			// Undetermined. Test case not ended yet.
			// Check if in debug or run mode.
			if(da) {
				// In debug mode: Send break to give vscode control
				await da.sendEventBreakAndUpdate();  // No need for 'await'
				return;
			}
			// Count failure
			if(!Z80UnitTestRunner.currentFail) {
				// Count only once
				Z80UnitTestRunner.currentFail = true;
				Z80UnitTestRunner.countFailed ++;
			}
		}

		// Check if this was the init routine that is started
		// before any test case:
		if(!Z80UnitTestRunner.utLabels) {
			// Use the test case list
			Z80UnitTestRunner.utLabels = Z80UnitTestRunner.partialUtLabels!;
			// Error check
			if (!Z80UnitTestRunner.utLabels || Z80UnitTestRunner.utLabels.length == 0) {
				// No unit tests found -> disconnect
				Z80UnitTestRunner.stopUnitTests(da, "Couldn't start unit tests. No unit tests found. Unit test labels should start with 'UT_'.");
				return;
			}
			// Check if we break on the first unit test.
			if(Z80UnitTestRunner.debug && !Settings.launch.startAutomatically ) {
				const firstLabel = Z80UnitTestRunner.utLabels[0];
				const firstAddr = Labels.getNumberForLabel(firstLabel) as number;
				if(firstAddr == undefined) {
					// Error
					Z80UnitTestRunner.stopUnitTests(da, "Couldn't find address for first unit test label '" + firstLabel + "'.");
					return;
				}
				const firstUtBp: RemoteBreakpoint = { bpId: 0, filePath: '', lineNr: -1, address: firstAddr, condition: '',	log: undefined };
				await Remote.setBreakpoint(firstUtBp);
			}

			// Start unit tests
			Z80UnitTestRunner.nextUnitTest(da);
			return;
		}

		// Was a real test case.

		// OK or failure
		const tcSuccess = (pc == Z80UnitTestRunner.addrTestReadySuccess);

		// Count failure
		if(!tcSuccess) {
			if(!Z80UnitTestRunner.currentFail) {
				// Count only once
				Z80UnitTestRunner.currentFail = true;
				Z80UnitTestRunner.countFailed ++;
			}
		}

		// Get the test case label.
		const label = Z80UnitTestRunner.utLabels[0];

		// In debug mode do break after one step. The step is required to put the PC at the right place.
		if(da && !tcSuccess) {
			// Do some additional output.
			if(Z80UnitTestRunner.utLabels) {
				if(pc == this.addrTestReadySuccess)
					Z80UnitTestRunner.dbgOutput(label + ' PASSED.');
			}
			return;
		}

		// Determine test case result.
		let tcResult: TestCaseResult = TestCaseResult.TIMEOUT;
		if(!timeoutFailure) {
			// No timeout
			tcResult = (Z80UnitTestRunner.currentFail) ? TestCaseResult.FAILED : TestCaseResult.OK;
		}

		// Send result to calling extension (i.e. test adapter)
		const resolveFunction = Z80UnitTestRunner.testCaseMap.get(label);
		if(resolveFunction) {
			// Inform calling party
			resolveFunction(tcResult);
			// Delete from map
			Z80UnitTestRunner.testCaseMap.delete(label);
		}

		// Print test case name, address and result.
		let tcResultStr;
		switch(tcResult) {
			case TestCaseResult.OK: tcResultStr = colorize(Color.FgGreen, 'OK'); break;
			case TestCaseResult.FAILED: tcResultStr = colorize(Color.FgRed, 'Fail'); break;
			case TestCaseResult.TIMEOUT: tcResultStr = colorize(Color.FgRed, 'Fail (timeout, ' + Settings.launch.unitTestTimeout + 's)'); break;
		}

		const addr = Labels.getNumberForLabel(label) || 0;
		const outTxt = label + ' (0x' + addr.toString(16) + '):\t' + tcResultStr;
		Z80UnitTestRunner.dbgOutput(outTxt);
		Z80UnitTestRunner.outputSummary += outTxt + '\n';

		// Collect coverage:
		// Get covered addresses (since last unit test) and add to collection.
		if (Z80UnitTestRunner.lastCoveredAddresses) {
			const target=Z80UnitTestRunner.allCoveredAddresses;
			Z80UnitTestRunner.lastCoveredAddresses.forEach(target.add, target);
			Z80UnitTestRunner.lastCoveredAddresses = undefined as any;
		}

		// Next unit test
		Z80UnitTestRunner.utLabels.shift();
		if(Z80UnitTestRunner.utLabels.length == 0) {
			// End the unit tests
			Z80UnitTestRunner.dbgOutput("All tests ready.");
			Z80UnitTestRunner.stopUnitTests(da);
			Z80UnitTestRunner.unitTestsFinished();
			return;
		}
		Z80UnitTestRunner.nextUnitTest(da);
	}


	/**
	 * Called when all unit tests have finished.
	 * Will print the summary and display the decorations for the line coverage.
	 */
	protected static unitTestsFinished() {
		// Summary
		Z80UnitTestRunner.printSummary();
		// Inform
		if (Z80UnitTestRunner.finishedCallback)
			Z80UnitTestRunner.finishedCallback();
	}


	/**
	 * Returns all labels that start with "UT_".
	 * @returns An array with label names.
	 */
	protected static getAllUtLabels(labels: LabelsClass): UnitTestCase[] {
		const utLabels = labels.getLabelsForRegEx('.*\\bUT_\\w*$', '');	// case sensitive
		// Convert to filenames and line numbers.
		const labelFilesLines: UnitTestCase[] = utLabels.map(label => {
			const location = labels.getLocationOfLabel(label)!
			Utility.assert(location, "'getAllUtLabels'");
			return {label, file:Utility.getAbsFilePath(location.file), line:location.lineNr};
		});
		return labelFilesLines;
	}


	/**
	 * Sends a CANCELLED for all still open running test cases
	 * to the caller (i.e. the test case adapter).
	 */
	protected static CancelAllRemainingResults() {
		for(const [, resolveFunc] of Z80UnitTestRunner.testCaseMap) {
			// Return an error code
			resolveFunc(TestCaseResult.CANCELLED);
		}
		Z80UnitTestRunner.testCaseMap.clear();
	}


	/**
	 * Stops the unit tests.
	 * @param errMessage If set an optional error message is shown.
	 */
	protected static async stopUnitTests(debugAdapter: DebugSessionClass|undefined, errMessage?: string): Promise<void> {
		// Async
		return new Promise<void>(async resolve => {
			// Clear timeout
			clearTimeout(Z80UnitTestRunner.timeoutHandle);
			Z80UnitTestRunner.timeoutHandle=undefined;
			// Clear remaining test cases
			Z80UnitTestRunner.CancelAllRemainingResults();

			// Show coverage
			Decoration.showCodeCoverage(Z80UnitTestRunner.allCoveredAddresses);

			// Wait a little bit for pending messages (The vscode could hang on waiting on a response for getRegisters)
			if (debugAdapter) {
				Remote.stopProcessing();	// To show the coverage after continue to end
				await debugAdapter.waitForBeingQuietFor(300);
			}

			// Show remaining covered addresses
			if (Z80UnitTestRunner.lastCoveredAddresses) {
				Decoration.showCodeCoverage(Z80UnitTestRunner.lastCoveredAddresses);
				Z80UnitTestRunner.lastCoveredAddresses = undefined as any;
			}

			// For reverse debugging.
			StepHistory.clear();

			// Exit
			if (debugAdapter) {
				this.cancelled = true;	// Avoid calling the cancel routine.
				debugAdapter.terminate(errMessage);
			}
			else {
				// Stop emulator
				await Remote.disconnect();
				// Show error
				if (errMessage)
					vscode.window.showErrorMessage(errMessage);
			}

			// Remove event handling for the emulator
			Remote.removeAllListeners();

			resolve();
		});
	}


	/**
	 * Prints out text to the clients debug console.
	 * @param txt The text to print.
	 */
	protected static dbgOutput(txt: string) {
		// Safety check
		if(!vscode.debug.activeDebugConsole)
			return;

		// Only newline?
		if(!txt)
			txt = '';
		vscode.debug.activeDebugConsole.appendLine('UNITTEST: ' + txt);
		//zSocket.logSocket.log('UNITTEST: ' + txt);
	}


	/**
	 * Prints out a test case and result summary.
	 */
	protected static printSummary() {


		// Print summary
		const emphasize = '+-------------------------------------------------';
		this.unitTestOutput.show();
		this.unitTestOutput.appendLine('');
		this.unitTestOutput.appendLine(emphasize);
		const projectName = path.basename(Utility.getRootPath());
		this.unitTestOutput.appendLine('UNITTEST SUMMARY, ' + projectName + ':');
		this.unitTestOutput.appendLine('Date: ' + new Date().toString() + '\n\n');
		this.unitTestOutput.appendLine(Z80UnitTestRunner.outputSummary);

		const color = (Z80UnitTestRunner.countFailed>0) ? Color.FgRed : Color.FgGreen;
		const countPassed = Z80UnitTestRunner.countExecuted - Z80UnitTestRunner.countFailed;
		this.unitTestOutput.appendLine('');
		this.unitTestOutput.appendLine('Total test cases: ' + Z80UnitTestRunner.countExecuted);
		this.unitTestOutput.appendLine('Passed test cases: ' + countPassed);
		this.unitTestOutput.appendLine(colorize(color, 'Failed test cases: '+Z80UnitTestRunner.countFailed));
		if (Z80UnitTestRunner.countExecuted>0)
			this.unitTestOutput.appendLine(colorize(color, Math.round(100*countPassed/Z80UnitTestRunner.countExecuted) + '% passed.'));
		this.unitTestOutput.appendLine('');

		this.unitTestOutput.appendLine(emphasize);
	}

}

