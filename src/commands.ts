/**
 * ZX81 Debugger
 * 
 * File:			commands.ts
 * Description:		Custom commands
 * Author:			Sebastien Andrivet, based on Dezog my Thomas Busse (Maziac)
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 * 					DeZog Copyright (C) 2023 Maziac
 */
import * as vscode from 'vscode';
import {DebugSessionClass} from './debugadapter';
import { UnifiedPath } from './misc/unifiedpath';
import { Decoration } from './decoration';

/**
 * Register custom commands.
 */
export function registerCommands(context: vscode.ExtensionContext) {
    // Command to change the program counter via menu.
	context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.movePCtoCursor', async () => {
		// Only allowed in debug context
		const session = DebugSessionClass.singleton();
		if (!session.running)
			return;
		// Get focussed editor/file and line
		const editor = vscode.window.activeTextEditor;
		if (!editor)
			return;
		const position = editor.selection.anchor;
		const filename = editor.document.fileName;
		// Execute in debug adapter
		await session.setPcToLine(filename, position.line);
	}));

	// Command to do a disassembly at the cursor's position.
	context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.disassemblyAtCursor.code', async () => {
		// Only allowed in debug context
		const session = DebugSessionClass.singleton();
		if (session.running) {
			const arr = getSelectedLineBlocks();
			for (const block of arr)
				await session.disassemblyAtCursor('code', block.filename, block.fromLine, block.toLine);
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.disassemblyAtCursor.data', async () => {
		// Only allowed in debug context
		const session = DebugSessionClass.singleton();
		if (session.running) {
			const arr = getSelectedLineBlocks();
			for (const block of arr)
				await session.disassemblyAtCursor('data', block.filename, block.fromLine, block.toLine);
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.disassemblyAtCursor.string', async () => {
		// Only allowed in debug context
		const session = DebugSessionClass.singleton();
		if (session.running) {
			const arr = getSelectedLineBlocks();
			for (const block of arr)
				await session.disassemblyAtCursor('string', block.filename, block.fromLine, block.toLine);
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.analyzeAtCursor.disassembly', async () => {
		// Only allowed in debug context
		const session = DebugSessionClass.singleton();
		if (session.running) {
			const arr = getSelectedLineBlocks();
			await session.analyzeAtCursor('disassembly', arr);
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.analyzeAtCursor.flowChart', async () => {
		// Only allowed in debug context
		const session = DebugSessionClass.singleton();
		if (session.running) {
			const arr = getSelectedLineBlocks();
			await session.analyzeAtCursor('flowChart', arr);
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.analyzeAtCursor.callGraph', async () => {
		// Only allowed in debug context
		const session = DebugSessionClass.singleton();
		if (session.running) {
			const arr = getSelectedLineBlocks();
			await session.analyzeAtCursor('callGraph', arr);
		}
	}));

	// Command to disable code coverage display and analyzes.
	context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.clearAllDecorations', () => {
		Decoration?.clearAllDecorations();
	}));

	// Command to refresh (button) the disassembly.
	context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.disassembly.refresh', async () => {
		// Only allowed in debug context
		const session = DebugSessionClass.singleton();
		if (!session.running)
			return;
		// Execute in debug adapter
		await session.refreshDisassembler();
	}));
}

/**
 * Returns the selected lines in the editor(s).
 * In case of multi selection there might be more than 1 block.
 * For each block the start and end lines are calculated and returned.
 * @returns An array with blocks: filename, fromLine, toLine (included).
 */
function getSelectedLineBlocks(): Array<{filename: string, fromLine: number, toLine: number}> {
	// Get focussed editor/file and line
	const editor = vscode.window.activeTextEditor;
	if (!editor)
		return [];
	// Go through all selections in case of multiple selections
	const arr: Array<{filename: string, fromLine: number, toLine: number}> = [];
	for (const selection of editor.selections) {
		let from = selection.anchor;
		let to = selection.active;
		const filename = UnifiedPath.getUnifiedPath(editor.document.fileName);
		// Adjust
		if (from.line > to.line) {
			// exchange
			const tmp = from;
			from = to;
			to = tmp;
		}
		const fromLine = from.line;
		let toLine = to.line;
		if (toLine > fromLine) {
			if (to.character == 0)
				toLine--;
		}

		// Store in array
		arr.push({filename, fromLine, toLine});
	}
	return arr;
}
