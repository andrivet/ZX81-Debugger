/**
 * ZX81 Debugger
 * 
 * File:			extension.ts
 * Description:		Entry points of the Visual Studio Code extension
 * Author:			Sebastien Andrivet, based on Dezog my Thomas Busse (Maziac)
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 * 					DeZog Copyright (C) 2023 Maziac
 */
import * as Net from 'net';
import * as vscode from 'vscode';
import {CancellationToken, DebugConfiguration, WorkspaceFolder} from 'vscode';
import {DebugSessionClass} from './debugadapter';
import {DecorationClass} from './decoration';
import {DiagnosticsHandler} from './diagnosticshandler';
import {LogGlobal, LogTransport} from './log';
import {UnifiedPath} from './misc/unifiedpath';
import {Utility} from './misc/utility';
import {PackageInfo} from './info/packageinfo';
import {registerCommands} from './commands';
import { registerWelcomeCommands } from './welcome';


/**
 * 'activate' is called when one of the package.json activationEvents
 * fires the first time.
 * Afterwards it is not called anymore.
 * 'deactivate' is called when vscode is terminated.
 * I.e. the activationEvents just distribute the calling of the extensions
 * little bit. Instead one could as well use "*", i.e. activate on all events.
 *
 * Registers configuration provider and command palette commands.
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
	// Init package info
	PackageInfo.Init(context);

	// Init/subscribe diagnostics
	DiagnosticsHandler.Init(context);

	// Save the extension path also to PackageInfo
	const extPath = context.extensionPath;
	// it is also stored here as Utility does not include vscode which is more unit-test-friendly.
	Utility.setExtensionPath(extPath);

	// Enable e.g. logging.
	const extension = PackageInfo.extension;
	const packageJSON = extension.packageJSON;
	const extensionBaseName = packageJSON.name;
	const configuration = PackageInfo.getConfiguration();
	configureLogging(configuration);
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
		// Logging changed
		if (event.affectsConfiguration(extensionBaseName + '.log.global')
			|| event.affectsConfiguration(extensionBaseName+'.log.transport')) {
			const currentConfig = PackageInfo.getConfiguration();
			configureLogging(currentConfig);
		}
	}));

	// Note: Weinand: "VS Code runs extensions on the node version that is built into electron (on which VS Code is based). This cannot be changed."

	context.subscriptions.push(vscode.debug.onDidTerminateDebugSession(s => {
		console.log(`terminated: ${s.type} ${s.name}`);
	}));

	// Register custom commands
	registerCommands(context);
	registerWelcomeCommands(context);

	// Register a configuration provider for 'zx81debugger' debug type
	const configProvider = new ZX81ConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('zx81debugger', configProvider));

	// Registers the debug inline value provider
	const asmDocSelector: vscode.DocumentSelector = {scheme: 'file'};
	const inlineValuesProvider = new ZX81InlineValuesProvider();
	context.subscriptions.push(vscode.languages.registerInlineValuesProvider(asmDocSelector, inlineValuesProvider));

	// Initialize the Coverage singleton.
	DecorationClass.Initialize();
}


/**
 * 'deactivate' is only called when vscode is terminated.
 */
export function deactivate() {
	//
}


/**
 * This debug inline values provider simply provides nothing.
 * This is to prevent that the default debug inline values provider is used instead,
 * which would show basically garbage.
 *
 * So for settings.json "debug.inlineValues":
 * - false: The inline provider is not called
 * - true/"auto": The inline provider is called but returns nothing.
 *
 * I'm not using the vscode approach for debug values but decorations instead because:
 * - The decorations implementation is ready and working fine. To change would give
 *   no advantage other than additional effort and bugs.
 * - vscode only shows the inline values for the currently debugged file.
 *   The decorations show them on all files, i.e. it is easier to follow where the
 *   instruction history came from.
 */
class ZX81InlineValuesProvider implements vscode.InlineValuesProvider {
	//onDidChangeInlineValues?: vscode.Event<void> | undefined;
	provideInlineValues(_document: vscode.TextDocument, _viewPort: vscode.Range, _context: vscode.InlineValueContext, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlineValue[]> {
		return undefined;
	}

}


/**
 * Instantiates the Debug Adapter and sets up the
 * socket connection to it.
 */
class ZX81ConfigurationProvider implements vscode.DebugConfigurationProvider {

	// Is set if a ZX81 Debugger instance is already running.
	private _server?: Net.Server;

	/**
	 * Instantiates DebugAdapter (DebugSessionClass) and sets up the
	 * socket connection to it.
	 * Is called once per vscode window.
	 * I.e. each window has a separate environment.
	 */
	public async resolveDebugConfiguration(
		_folder: WorkspaceFolder | undefined, 
		config: DebugConfiguration, 
		_token?: CancellationToken
	): Promise<DebugConfiguration | undefined> {
		// Remove current debug session
		const session = DebugSessionClass.singleton();
		if (session.running) {
			// Note: this point is not reached on a "normal" restart, instead
			// a) if a restart is done and at the same time the launch.json was also changed.
			// b) a different launch.json should be started.
			// Show warning and return.
			const result = await vscode.window.showWarningMessage('ZX81 Debugger is already active.', 'Terminate current session', 'Cancel');
			// Check user selection
			if (result?.toLowerCase().startsWith('terminate')) {
				// Terminate current session and start a new one
				await session.terminateRemote();	// Can lead to a 'cannot find session', see https://github.com/maziac/DeZog/issues/91
				// Because of this we will stop here simply (reject)
			}
			return;
		}

		// Check if (ZX81 Debugger) already running
		if (!this._server) {
			// Start port listener on launch of first debug session (random port)
			this._server = Net.createServer(socket => {
				session.setRunAsServer(true);
				session.start(<NodeJS.ReadableStream>socket, socket);
			}).listen(0);
		}

		const activeEditor = vscode.window.activeTextEditor;
		if (!config || !config.request) {
			// if 'request' is missing interpret this as a missing launch.json
			if (!activeEditor || activeEditor.document.languageId !== 'asm-zx81') return;

			const currentFilePath = UnifiedPath.getUnifiedPath(activeEditor.document.fileName);

			config = Object.assign(config || {}, {
				name: 'ZX81 Simulator',
				type: 'zx81debugger',
				request: 'launch',
				remoteType: 'zsim',
				rootFolder: UnifiedPath.dirname(currentFilePath),
				source: UnifiedPath.getUnifiedPath(currentFilePath)
			});
		}

		// Make VS Code connect to debug server
		const addrInfo = this._server.address() as Net.AddressInfo;
		Utility.assert(typeof addrInfo != 'string');
		config.debugServer = addrInfo.port;

		return config;
	}


	/**
	 * End.
	 */
	dispose() {
		if (this._server) {
			this._server.close();
		}
	}
}


/**
 * Configures the logging from the settings.
 */
function configureLogging(configuration: vscode.WorkspaceConfiguration) {
	// Global log
	{
		const logToPanel = configuration.get<boolean>('log.global');
		if (LogGlobal.isEnabled() != logToPanel) {
			// State has changed
			const channelOut = logToPanel ? vscode.window.createOutputChannel("ZX81 Debugger") : undefined;
			// Enable or dispose
			LogGlobal.init(channelOut);
		}
	}

	// Transport log
	{
		const logToPanel = configuration.get<boolean>('log.transport');
		if (LogTransport.isEnabled() != logToPanel) {
			// State has changed
			const channelOut = logToPanel ? vscode.window.createOutputChannel("ZX81 Debugger Transport") : undefined;
			// Enable or dispose
			LogTransport.init(channelOut);
		}
	}
}

