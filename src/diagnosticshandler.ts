import * as vscode from 'vscode';
import {LabelsClass} from './labels/labels';
import {SimulatedMemory} from './remotes/zsimulator/simulatedmemory';

/**
 * ZX81 Debugger
 * 
 * File:			diagnosticshandler.ts
 * Description:		Manages diagnostics e.g. errors
 * Author:			Sebastien Andrivet, based on Dezog my Thomas Busse (Maziac)
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 * 					DeZog Copyright (C) 2023 Maziac
 */

/**
 * A singleton that manages diagnostics, e.g. errors found.
 */
export class DiagnosticsHandler {

	// The diagnostics collection.
	protected static diagnosticsCollection: vscode.DiagnosticCollection;


	/**
	 * Subscribes the diagnostics.
	 */
	public static Init(context: vscode.ExtensionContext) {
		DiagnosticsHandler.diagnosticsCollection = vscode.languages.createDiagnosticCollection("ZX81 Debugger");
		context.subscriptions.push(DiagnosticsHandler.diagnosticsCollection);
		LabelsClass.addDiagnosticsErrorFunc = DiagnosticsHandler.add;
		SimulatedMemory.addDiagnosticsErrorFunc = DiagnosticsHandler.add;
	}

	/**
	 * Clears all diagnostics messages.
	 * E.g. called at start of unit tests or at start of a
	 * debug session.
	 */
	public static clear() {
		DiagnosticsHandler.diagnosticsCollection.clear();
	}


	/**
	 * Adds a diagnostics message for a file.
	 * @param message The shown message.
	 * @param severity 'error' or 'warning'.
	 * @param filepath Absolute path to the file.
	 * @param line The line number.
	 * @param column The column number.
	 */
	public static add(message: string, severity: 'error'|'warning', filepath: string, line: number, column = 0) {
		const uri = vscode.Uri.file(filepath);
		const range = new vscode.Range(line, column, line, Number.MAX_VALUE);
		const diagSeverity = (severity == 'error') ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
		const diagnostic = new vscode.Diagnostic(range, message, diagSeverity);
		diagnostic.source = 'ZX81 Debugger';
		const allFileProblems: readonly vscode.Diagnostic[] = DiagnosticsHandler.diagnosticsCollection.get(uri) || [];
		DiagnosticsHandler.diagnosticsCollection.set(uri, [...allFileProblems, diagnostic]);
	}
}

