/**
 * ZX81 Debugger
 * 
 * File:			packageinfo.ts
 * Description:		Reads the package.json of the extension.
 * Author:			Sebastien Andrivet, based on Dezog my Thomas Busse (Maziac)
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 * 					DeZog Copyright (C) 2023 Maziac
 */
import * as vscode from 'vscode';


/**
 * Reads the package.json of the extension.
 */
export class PackageInfo {

	// The extension info is stored here after setting the extensionPath.
	public static extension: vscode.Extension<any>;


	/**
	 * Sets the extension path.
	 * Called on extension activation.
	 */
	public static Init(context: vscode.ExtensionContext) {
		// Store extension info
		this.extension = context.extension;
	}


	/**
	 * Convenience method to return the configuration/the settings.
	 */
	public static getConfiguration(): vscode.WorkspaceConfiguration {
		const packageJSON = this.extension.packageJSON;
		const extensionBaseName = packageJSON.name;
		const config = vscode.workspace.getConfiguration(extensionBaseName, null);
		return config;
	}
}

