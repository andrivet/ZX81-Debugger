import * as vscode from 'vscode';

const helloWorld = `;; Hello World - Example for ZX81 Debugger
;;
;; File:               hello-world.zx81
;; Description:        Displays "HELLO WORLD" on the screen
;; Author:             Sebastien Andrivet
;; License:            MIT
;; Copyrights:         Copyright (C) 2023 Sebastien Andrivet

    device ZX81 ; Tells the assembler to generate a binary for ZX81

; Start of user machine code program (0x4082, 16514)
start:
    ld bc,1                ; Starting position on the display
    ld de,hello_txt        ; String to display
    call dispstring        ; Display the string
    ret                    ; End of the program

; Display a string directly on the display
; (does not use the ZX81 ROM)
; BC: Offset on the display
; DE: Address of the string to display
dispstring:
    ld hl,(D_FILE)         ; Address of the display's memory
    add hl,bc              ; Add the offset
loop:
    ld a,(de)              ; Take a character from the string
    cp \\$ff                 ; End of string?
    ret z                  ; Yes, so exit
    ld (hl),a              ; Put the character in the display's memory
    inc hl                 ; Next position on the display
    inc de                 ; Next character
    jr loop                ; Loop

hello_txt:
    byte "HELLO WORLD",\\$ff
`;

/**
 * Register custom commands for the welcome walkthrough
 */
export function registerWelcomeCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.createNewFile', async () => {
        // Open a new text document of type asm-zx81.
        // Ouvre un nouveau document texte de type asm-zx81
		const newFile = await vscode.workspace.openTextDocument({ language: 'asm-zx81', content: `` });
        // Show this new document.
        // Montre ce nouveau document
		await vscode.window.showTextDocument(newFile, vscode.ViewColumn.Beside, false);
	}));

    context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.welcome.pasteExample', async () => {
        // Find the freshly created document.
        // Trouve le document récemment créé.
        const doc = findUntitledDocument();
        // If it was not found, return.
        // S'il n'est pas trouvé, on sort.
        if(!doc) return;
        // Be sure it is displayed and get a reference to its editor.
        // On s'assure qu'il est affiché et on obtient une référence sur son editeur.
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, false);
		if(!editor) return;

        // Create a snippet with the code we want to paste.
        // On crée un fragment avec le code que l'on souhaite coller.
		const code = new vscode.SnippetString(helloWorld);
        // Paste the snippet.
        // On colle le fragment.
		await editor.insertSnippet(code);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.welcome.save', async () => {
        // Get the current workspace configuration.
        // Obtient la configuration courante de l'espace de travail.
        const configuration = vscode.workspace.getConfiguration();
		const target = vscode.ConfigurationTarget.Global;
        // Get the current value of 'workbench.editor.untitled.labelFormat'
        // Obtient la valeur courante de 'workbench.editor.untitled.labelFormat'
        const oldValue = configuration.get('workbench.editor.untitled.labelFormat');
        // Change it to 'name'.
        // Changer cette valeur à 'name'.
		await configuration.update('workbench.editor.untitled.labelFormat', 'name', target, true);

        // Find the freshly created document.
        // Trouve le document récemment créé.
        const untitledDoc = findUntitledDocument();
        if(!untitledDoc) return;
        // Be sure it is displayed and get a reference to its editor.
        // On s'assure qu'il est affiché et on obtient une référence sur son editeur.
        const editor = await vscode.window.showTextDocument(untitledDoc, vscode.ViewColumn.Beside, false);
		if(!editor) return;

        // Save the document. This will close the document.
        // Sauve le document. Cela va le fermer.
        await editor.document.save();

        // Find the document we just saved.
        // Trouver le document sauvé précédemment.
        const doc = findDocument();
        if(doc) {
            // Open this document and show it.
            // Ouvrir ce document et le montrer.
            await vscode.workspace.openTextDocument(doc.fileName);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, false);
        }

        // Put back the previous value.
        // On remet l'ancienne valeur.
        await configuration.update('workbench.editor.untitled.labelFormat', oldValue, target, true);
	}));

    context.subscriptions.push(vscode.commands.registerCommand('zx81debugger.welcome.debug', async () => {
		const doc = findDocument();
        if(!doc) return;
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, false);
        await vscode.commands.executeCommand('workbench.action.debug.start');
    }));
}

/***
 * Find a document that is tilted and with the right language ID (asm-zx81).
 * Trouve un document qui a un titre titre et qui a le bon ID de language (asm-zx81).
 */
function findDocument() {
    return vscode.workspace.textDocuments.find(e => e.languageId === 'asm-zx81' && !e.isUntitled);
}

/**
 * Find a document that is untitled and with the right language ID (asm-zx81).
 * Trouve un document qui n'a pas de titre et qui a le bon ID de language (asm-zx81).
 */
function findUntitledDocument() {
    return vscode.workspace.textDocuments.find(e => e.languageId === 'asm-zx81' && e.isUntitled);
}
