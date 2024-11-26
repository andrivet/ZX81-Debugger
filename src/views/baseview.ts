import * as vscode from 'vscode';
import {Utility} from '../misc/utility';
import {EventEmitter} from 'stream';



/**
 * A Webview that serves as base class for other views like the MemoryDumpView or the
 * ZxNextSpritesView.
 */
export class BaseView extends EventEmitter {

	// STATIC:

	/// Holds a list of all derived view classes.
	/// Used to call the static update functions.
	public static staticViewClasses: Array<any> = [];

	/// Holds a list of all open views.
	protected static staticViews: Array<BaseView> = [];


	/**
	 * Initializes the static variables.
	 * Called at launchRequest.
	 */
	public static staticClearAll() {
		// Copy view array
		const views = [...BaseView.staticViews];
		// Clear old
		BaseView.staticViews = [];
		BaseView.staticViewClasses = [];
		// Remove listeners/prohibit de-registration by emit/on.
		views.forEach(view => view.removeAllListeners());
		// Dispose/close all views
		for (const view of views) {
			view.vscodePanel.dispose();
		}
	}


	/**
	 * Is called when a register was changed manually.
	 * Used to update the register colors in the memory views.
	 */
	public static async staticCallUpdateRegisterChanged(): Promise<void> {
		// Loop all views
		for (const view of BaseView.staticViews) {
			await view.updateRegisterChanged();
		}
	}


	/** Is called on 'update' event.
	 * First calls the static update functions.
	 * Afterwards the update functions of all views.
	 * @param reason The reason is a data object that contains additional information.
	 * E.g. for 'step' it contains { step: true };
	 */
	public static async staticCallUpdateFunctionsAsync(reason?: any): Promise<void> {
		// Loop all view classes
		for (const viewClass of BaseView.staticViewClasses) {
			await viewClass.staticUpdate(reason);
		}
		// Loop all views
		for (const view of BaseView.staticViews) {
			await view.update(reason);
		}
	}

	// Same as above but the sync version.
	public static staticCallUpdateFunctions(reason?: any) {
		(async () => {
			await BaseView.staticCallUpdateFunctionsAsync(reason);
		})();
	}


	/**
	 * Returns a list of all open views for a given class.
	 * @param viewClass A classname.
	 * @return All open views for the given class.
	 */
	public static staticGetAllViews(viewClass: any) {
		// Get all views of the given class
		const views = BaseView.staticViews.filter(view => view instanceof viewClass);
		return views;
	}


	/**
	 * Calls the registers function (debug adapter) to inform about
	 * a change. I.e. the user changed a memory value.
	 * The DebugAdapter/vscode uses this to update e.g. the WATCHes.
	 */
	public static sendChangeEvent = () => {
		// override
	};


	/**
	 * Registers the sendChangeEvent function.
	 * @param func The function to register.
	 */
	public static onChange(func: () => void) {
		this.sendChangeEvent = func;
	}

	// DYNAMIC:

	/// A panel (containing the webview).
	protected vscodePanel: vscode.WebviewPanel;


	/** Creates the basic view.
	 * @param addToStaticViews Adds the view to the static views list so that
	 * it will get an update event. This is the default for debug windows.
	 * Other (independent) views can set this to false.
	 * @param enableGenericFindWidget Set to true to enable the vscode find widget.
	 */
	constructor(addToStaticViews = true, enableGenericFindWidget = true) {
		super();
		// Add to view list
		if (addToStaticViews) {
			BaseView.staticViews.push(this);
		}

		// Create vscode panel view
		this.vscodePanel = vscode.window.createWebviewPanel('', '', {preserveFocus: true, viewColumn: vscode.ViewColumn.Nine}, {enableScripts: true, enableFindWidget: enableGenericFindWidget, retainContextWhenHidden: true});

		// Handle messages from the webview
		this.vscodePanel.webview.onDidReceiveMessage(async message => {
			await this.webViewMessageReceived(message);
		});

		// Handle closing of the view: Is called when user closes
		// the view and by staticClearAll

		this.vscodePanel.onDidDispose(() => {
			// Call overwritable function
			this.vscodePanel = undefined as any;
			this.dispose();
			// Remove from list
			const index = BaseView.staticViews.indexOf(this);
			if (index >= 0) {
				BaseView.staticViews.splice(index, 1);
			}
		});

	}


	/** Dispose the view (called e.g. on close).
	 * Use this to clean up additional stuff.
	 * Normally not required.
	 */
	public dispose() {
		this.emit('remove');
	}


	/** The web view posted a message to this view.
	 * @param message The message. message.command contains the command as a string.
	 * This needs to be created inside the web view.
	 */
	protected async webViewMessageReceived(_message: any) {
		// Overwrite
		Utility.assert(false);
	}


	/**
	 * A message is posted to the web view.
	 * @param message The message. message.command should contain the command as a string.
	 * This needs to be evaluated inside the web view.
	 * @param baseView The webview to post to. Can be omitted, default is 'this'.
	 */
	protected sendMessageToWebView(message: any, baseView: BaseView = this) {
		(async () => {
			await baseView.vscodePanel?.webview.postMessage(message);
		})();
	}


	/** View is informed that a register has changed (manually).
	 */
	public async updateRegisterChanged(): Promise<void> {
		// Overwrite this.
	}


	/** Retrieves the memory content and displays it.
	 * @param reason The reason is a data object that contains additional information.
	 * E.g. for 'step' it contains { step: true };
	 */
	public async update(_reason?: any): Promise<void> {
		// Overwrite this.
	}


	/** Put webview to the foreground.
	 */
	public reveal() {
		this.vscodePanel.reveal();
	}

	/**
	 * Get the path of a ZX81 character.
	 * @param value The value of the character.
	 * @returns the path of an asset.
	 */
	private static getZX81ImageSrc(value: number): string {
		if(value < 0 || (value >= 0x40 && value < 0x80) || value >= 0xC0)
			return '/chars/ZX81-placeholder.png';
		return '/chars/ZX81-0x' + Utility.getHexString(value, 2) + '.png';
	}

	/**
	 * Get the URI of an asset.
	 * @param path The path of the asset inside the assets folder.
	 * @returns the URI of an asset.
	 */
	private static getAssetSrc(path: string): vscode.Uri {
		return vscode.Uri.file(Utility.getExtensionPath() + '/assets/' + path);
	}

	/**
	 * Get the Uri of a ZX81 character.
	 * @param value The value of the character.
	 * @returns the URI of an asset.
	 */
	public static getZX81ImageUri(value: number): vscode.Uri {
		return BaseView.getAssetSrc(BaseView.getZX81ImageSrc(value));
	}
}

