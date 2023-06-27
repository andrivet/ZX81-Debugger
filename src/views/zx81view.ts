/**
 * ZX81 Debugger
 * 
 * File:			zx81view
 * Description:		A Webview that shows the ZX81 display and keyboard.
 * Author:			Sebastien Andrivet
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 */
/**
 * ZX81 Debugger
 * 
 * Fichier:			zx81view
 * Description:		Une vue web montrant l'écran et le clavier du ZX81.
 * Auteur:			Sebastien Andrivet
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 */
import * as vscode from 'vscode';
import {Remote} from '../remotes/remotebase';
import * as util from 'util';
import {Utility} from '../misc/utility';
import {MemoryDump} from '../misc/memorydump';
import {Settings} from '../settings/settings';
import {BaseView} from './baseview';
import {MetaBlock} from '../misc/metablock';
import { ZSimRemote } from '../remotes/zsimulator/zsimremote';

/**
 * A Webview that shows the ZX81 display (DFILE) and keyboard.
 * Une vue web montrant l'écran et le clavier du ZX81.
 */
export class Zx81View extends BaseView {

	// The memory corresponding to this view.
	// La portion de mémoire correspondant à cette vue.
	protected memDump = new MemoryDump();

	// The windows title.
	// Le titre de la fenètre.
	protected title = "ZX81 Simulator";

	// A reference to the simulator.
	// Une référence au simulateur.
	protected simulator: ZSimRemote;

	// A map to hold the values of the simulated ports for the keyboard (port <-> value).
	// Une table d'association qui contient la valeur des ports simulés du clavier (port <-> valeur).
	protected simulatedPorts: Map<number, number>;

		
	/**
	 * Creates the basic panel.
	 * Crée un panneau de base.
	 */
	constructor(simulator: ZSimRemote) {
		super(true, false);
		this.simulator = simulator;
		this.initPorts();
		Remote.on('vertSync', async () => this.vertSync());
	}

	/**
	 * Initialize I/O ports for the keyboard.
	 * Initialise les ports I/O pour le clavier.
	 */
	private initPorts() {
		this.simulatedPorts = new Map<number, number>();
		this.simulatedPorts.set(0xFEFE, 0xFF);
		this.simulatedPorts.set(0xFDFE, 0xFF);
		this.simulatedPorts.set(0xFBFE, 0xFF);
		this.simulatedPorts.set(0xF7FE, 0xFF);
		this.simulatedPorts.set(0xEFFE, 0xFF);
		this.simulatedPorts.set(0xDFFE, 0xFF);
		this.simulatedPorts.set(0xBFFE, 0xFF);
		this.simulatedPorts.set(0x7FFE, 0xFF);

		// Set callbacks for all simulated ports.
		// Met en place les rappels pour les ports simulés.
		for (const [simPort,] of this.simulatedPorts) {
			// Register the callback.
			// Enregistre la fonction de rappel.
			this.simulator.ports.registerSpecificInPortFunction(simPort, (port: number) => {
				// Simply return the value.
				// Retourne simplement la valeur.
				return this.simulatedPorts.get(port)!;
			});
		}
	}


	/**
	 * Dispose the view (called e.g. on close). Removes it from the static list.
	 * Dispose de la vue (appelé par onClose). Enlève là de la liste statique.
	 */
	public disposeView() {
		super.disposeView();
	}

	/**
	 * The web view posted a message to this view.
	 * La vue web a posté un message pour cette vue.
	 * @param message The message. message.command contains the command as a string.
	 *                Le message. message.command contient la commande sous forme de chaine.
	 * This needs to be created inside the web view.
	 */
	protected async webViewMessageReceived(message: any) {
		switch (message.command) {
			case 'keyChanged':
				// A key was pressed.
				// Une touche a été pressée.
				this.keyChanged(message.key, message.shift, message.value);
				break;
			
				case 'valueChanged':
				try {
					// Change memory.
					// Change la mémoire
					const address = parseInt(message.address);
					const value = Utility.evalExpression(message.value);
					if (value <= 255 && value >= -255) {
						await this.changeMemory(address, value);
					}
					else {
						// Error.
						// Erreur
						vscode.window.showWarningMessage("Value (" + value + ") out of range.");
					}
				}
				catch (e) {
					// Error.
					// Erreur
					vscode.window.showWarningMessage("Could not evaluate: '" + message.value + "'");
				}
				break;

			case 'getValueInfoText':
				// Display a tooltip.
				// Affiche une info-bulle.
				{
					const address = parseInt(message.address);
					await this.getValueInfoText(address, this.memDump);
				}
				break;

			default:
				await super.webViewMessageReceived(message);
				break;
		}
	}

	/**
	 * Called when the beam of the virtual display goes back to the top.
	 * Appelé lorse le rayon de l'écran virtuel revient au sommet.
	 */
	private vertSync() {
		this.update(false);
	}

	/**
	 * Adds a new memory block to display.
	 * Memory blocks are ordered, i.e. the 'memDumps' array is ordered from
	 * low to high (the start addresses).
	 * @param startAddress The address of the memory block.
	 * @param size The size of the memory block. (Can be 0x10000 max)
	 */
	public setBlock(startAddress: number, size: number, title: string) {
		this.memDump.clearBlocks();
		this.memDump.addBlockWithoutBoundary(startAddress, size, title);
	}

	/**
	 * The user just changed a cell in the dump view table.
	 * @param address The address to change.
	 * @param value The new value.
	 */
	protected async changeMemory(address: number, value: number) {
		await Remote.writeMemory(address, value);
		// Also update the all webviews
		await BaseView.staticCallUpdateFunctions();
		// Inform vscode
		BaseView.sendChangeEvent();
	}

	/**
	 * Retrieves the value info text (that is the hover text).
	 * @param address The address for which the info should be shown.
	 * @param md The MemoryDump to convert.
	 */
	protected async getValueInfoText(address: number, md: MemoryDump) {
		if(md.metaBlocks.length <= 0) return;
		// Line and column
		const offset = address - md.metaBlocks[0].address;
		// There is 33 bytes per line (HALT followed by 32 visible characters)
		const column = offset % 33 - 1;
		const line = Math.trunc(offset / 33);
		let text = 'Line: ' + line.toString() + ', Column: ' + column.toString() + '\n';

		// Value
		const value = md.getValueFor(address);
		const valFormattedString = await Utility.numberFormatted('', value, 1, Settings.launch.displayViewer.valueHoverFormat, undefined);
		text += 'Current value: ' + valFormattedString + '\n';
		
		// Check for last value
		const prevValue = md.getPrevValueFor(address);
		if (!isNaN(prevValue)) {
			text += 'Previous value: ' + Utility.getHexString(prevValue, 2) + 'h\n';
		}

		// Address
		const addrFormattedString = await Utility.numberFormatted('', address, 2, Settings.launch.displayViewer.addressHoverFormat, undefined);
		text += 'Address: ' + addrFormattedString;

		// Now send the formatted text to the web view for display.
		const msg = {
			command: 'valueInfoText',
			address: address.toString(),
			text: text
		};
		this.sendMessageToWebView(msg);
	}

	/** 
	 * Retrieves the memory content and displays it.
	 * Récupère le contenu de la mémoire et affiche le.
	 * @param reason Not used.
	 *               Non utilisé.
	 */
	public async update(reason: boolean): Promise<void> {
		// Do we have no data yet?
		// Est-ce qu'il n'y a pas de données ?
		if(this.memDump.metaBlocks.length <= 0) {
			// Get the content of the D_FILE system variable (2 bytes).
			// Récupère le contenu de la variable système D_FILE (2 octets)
			const dfile_ptr = await Remote.readMemoryDump(0x400c, 2);
			// Conversion from little endian.
			// Conversion depuis le petit boutiste.
			const dfile = dfile_ptr[0] + 256 * dfile_ptr[1];
			// 24 lines of 33 bytes.
			// 24 lignes de 33 octets.
			const size = 33 * 24;
			// Set the new block to display.
			// Indique le nouveau bloc à afficher.
			this.setBlock(dfile, size, "Display");
		}

		// Get the block to display.
		// Récupère le bloc à afficher.
		const metaBlock = this.memDump.metaBlocks[0];
		// Read its content.
		// Lit son contenu.
		const data = await Remote.readMemoryDump(metaBlock.address, metaBlock.size);
		// Store previous data.
		// Stoque les données précédentes.
		metaBlock.prevData = metaBlock.data || new Uint8Array(data);
		// Store the new data.
		// Stoque les nouvelles données.
		metaBlock.data = data;
	
		// Update the html.
		// Met à jour le HTML.
		this.updateWithoutRemote(reason);
	}


	/**
	 * Updates the html. E.g. after the change of a value, without getting the memory from the Remote.
	 */
	protected updateWithoutRemote(reason: boolean) {
		// Create generic html if not yet done
		if (!this.vscodePanel.webview.html) {
			// Create the first time
			this.setHtml();
			// Create title
			this.setPanelTitle();
		}
		else {
			// Update only the changed values

			const allAddrValsText: any[] = [];
			if(this.memDump.metaBlocks.length > 0) {
				const metaBlock = this.memDump.metaBlocks[0];
				// Get changes
				const addrValues = metaBlock.getChangedValues();
				// Convert values to [address, hex-text , zx81-text]
				addrValues.forEach(addrVal => {
					allAddrValsText.push([
						addrVal[0],
						Utility.getHexString(addrVal[1], 2),
						this.vscodePanel.webview.asWebviewUri(Utility.getZX81ImageSrc(addrVal[1])).toString()
					]);
				});
			}
			// Send to web view
			const msg = {
				command: 'memoryChanged',
				addressValues: allAddrValsText,	// Is also sent if empty to reset the changed values.
				stepping: reason
			};
			this.sendMessageToWebView(msg);
		}
	}


	/** Create and sets the panel title from the meta block address ranges.
	 */
	protected setPanelTitle() {
		if (this.vscodePanel)
			this.vscodePanel.title = this.title;
	}

	/** Creates the script (i.e. functions) for all blocks (html tables).
	 */
	protected createHtmlScript(): string {
		const html = `
		<script>
		const vscode = acquireVsCodeApi();

		// The changed memory
		let changedAddressValues = [];

		function mouseOverValue(obj) {
			const address = obj.getAttribute("address");
			// Send request to vscode to calculate the hover text
			vscode.postMessage({
				command: 'getValueInfoText',
				address: address
			});
		}

		//---- Handle Editing Cells --------
		let prevValue = '';	// Used to restore the value if ESC is pressed.
		let curObj = null;	// The currently used object (the tabbed cell)

		function keyPress(e) {
			let key = e.keyCode;

			if(key == 13) {	// ENTER key
				const value = curObj.innerText;
				const address = curObj.getAttribute("address");
				e.preventDefault();
				curObj.blur();
				// Send new value for address to vscode
				vscode.postMessage({
					command: 'valueChanged',
					address: address,
					value: value
				});
			}
			else if(key == 27) {	// ESC key, does not work in vscode
				// Use previous value
				e.preventDefault();
				curObj.blur();
			}
		}

		function focusLost(e) {	// = "blur"
			// Undo: Use previous value
			if(prevValue.length > 0) {
				// Inner text object
				const textObj = curObj.firstChild;
				textObj.textContent = prevValue;
			}
			curObj.contentEditable = false;
			curObj.removeEventListener("blur", focusLost);
			curObj.removeEventListener("keypress", keyPress);
			curObj = null;
		}

		function makeEditable(obj) {
			// makes the object editable on double click.
			curObj = obj;	// store object for use in other functions
			// Inner text object
			const textObj = curObj.firstChild;
			prevValue = textObj.textContent;	// store for undo
			if(!textObj.textContent.endsWith('h'))
				textObj.textContent += 'h';
			curObj.contentEditable = true;
			curObj.focus();
			selection = window.getSelection();    // Save the selection.

			// Select the text
			range = document.createRange();
			range.selectNodeContents(curObj);
			selection.removeAllRanges();          // Remove all ranges from the selection.
			selection.addRange(range);

			// Add listeners
			curObj.addEventListener("blur", focusLost, true);
			curObj.addEventListener("keypress", keyPress, true);
		}

		function getCharObjsForAddress(address) {
			return document.querySelectorAll("img[address='"+address+"']");
		}

		//---- Handle Messages from vscode extension --------
		window.addEventListener('message', event => {
			const message = event.data;

            switch (message.command) {
				case 'valueInfoText':
				{
					const spanObjs = getCharObjsForAddress(message.address);
					for(const obj of spanObjs) {
						obj.title = message.text;
					}
                }   break;

				case 'setMemoryTable':
				{	// Was used in the past instead of 'memoryChanged'. I.e.
					// this sets the whole memory as new data via a html string.
					// Problem here was that it created new objects which did not
					// work together with updating the  search results.
					// Now it is still used for the register memory view
					// which has no search and potentially may change
					// range each step.

					// Set table as html string
			        const tableDiv = document.getElementById("mem_table_"+message.index);
					tableDiv.innerHTML = message.html;
 				}   break;

				case 'memoryChanged':
				{
					// Note: This is called on every step, even if no memory has changed.
					// Because it is also required to de-highlight the previous values.

					// De-emphasize previously changed values
					for(const addrVal of changedAddressValues) {
						const address = addrVal[0];
						// Get char for address
						const charObjs = getCharObjsForAddress(address);
						for(const obj of charObjs) {
							obj.classList.remove("valueChanged");
						}
					}

					// The memory has changed.
					// Loop through all changed addresses and update.
					changedAddressValues = message.addressValues;
					for(const addrVal of changedAddressValues) {
						const address = addrVal[0];
						// Get Zx81 chars for address
						const charObjs = getCharObjsForAddress(address);
						for(const obj of charObjs) {
							obj.src = addrVal[2];
							if(message.stepping) obj.classList.add("valueChanged");
						}
					}
 				}   break;
           }
        });

		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("focus", onFocus);
		window.addEventListener("blur", onBlur);

		function onKeyDown(e) {
			vscode.postMessage({
				command: 'keyChanged',
				value: true,
				key: e.code,
				shift: e.shiftKey
			});
		}

		function onKeyUp(e) {
			vscode.postMessage({
				command: 'keyChanged',
				value: false,
				key: e.code,
				shift: e.shiftKey
			});
		}

		function onFocus() {
			const keyboard = document.querySelector(".keyboard");
			if(keyboard) keyboard.classList.add("focus");
		}

		function onBlur() {
			const keyboard = document.querySelector(".keyboard");
			if(keyboard) keyboard.classList.remove("focus");
		}

		//# sourceURL=displayview-htmlscript.js
		</script>
`;
		return html;
	}

	/**
	 * Creates one html table out of a meta block.
	 * Crée une table html à partir d'un méta-bloc.
	 * @param metaBlock The block to display.
	 *                  Le bloc à afficher.
	 */
	protected createHtmlTable(metaBlock: MetaBlock): string {
		// If there is not data, don't do anything.
		// S'il n'y a pas de données, ne rien faire.
		if (!metaBlock.data) return '';

		// Start the html with a div tag.
		// Débute le html avec une balise div.
		let html = '<div>\n';
		// The memory is composed of 24 lines of 33 bytes.
		// La mémoire est composée de 24 lignes de 34 octets.
		const clmns = 33;
		const data = metaBlock.data;
		const len = data.length;

		// Table contents.
		// Contenu de la table.
		let chars = '';
		let address = metaBlock.address;
		for (let k = 0; k < len; k++) {
			const value = data[k];

			// First byte of each line is an HALT (76), skip it.
			// Le premier octet de chaque ligne est un HALT (76), on le saute.
			if(k % clmns != 0) {
				// Add the image of the character and we set a mouseover handler.
				// On ajoute l'image du caractère et on met un gestionnaire pour mouseover
				chars += '<img address="' + address + '" src="' + this.vscodePanel.webview.asWebviewUri(Utility.getZX81ImageSrc(value)) + '"';
				chars += ' onmouseover="mouseOverValue(this)">\n';
			}

			// Check end of line.
			// Teste si c'est une fin de ligne.
			if (k % clmns == clmns - 1) {
				// Add characters to the table.
				// Ajoute les caractères à la table.
				html += '<div class="row">\n' + chars + '</div>\n';
				chars = '';
			}
			// Next address.
			// Adresse suivante.
			++address;
		}

		// Close the table.
		// Ferme la table.
		return html + "</div>";
	}

	/**
	 * Sets the html code to display the ZX81 simulator.
	 * Is called only once at creation time as it does not hold the actual data.
	 * Défini le code html pour affiche le code du similateur ZX81.
	 * Elle est appelée une seule fois au moment de la création car elle ne détient pas les véritables données.
	 */
	protected setHtml() {
		// Color to use when a value is changed.
		// Couleur à utiliser quand une valeur change.
		const changedColor = "red";
		// URL of the image of the keyboard.
		// URL de l'image du clavier.
		const keyboardImg = this.vscodePanel.webview.asWebviewUri(Utility.getAssetSrc("ZX81-keyboard.png")).toString();

		// HTMö and CSS.
		const format = `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Display</title>
		</head>

		<style>
		.row {
            display: flex;
            flex-direction: row;
			height: 16px;
        }
		
		.valueChanged {
			border: 1px solid ${changedColor};
			box-sizing: border-box;
		}

		.keyboard {
			width: 508px;
			margin-top: 20px;
			border-style: solid;
			border-width: 2px;
			border-color: black;
		}

		.focus {
			border-color: greenyellow;
		}
		</style>

		<body>

		%s

		<img class="keyboard" src="${keyboardImg}" alt="ZX81 Keyboard">

		</body>
		</html>
		`;

		// Table for the display. Each cell represents a character on the display.
		// Table pour l'affichage. Chaque cellule représente un caractère de l'affichage.
		let tables = (this.memDump.metaBlocks.length > 0) ? this.createHtmlTable(this.memDump.metaBlocks[0]) : '';

		// Add Javascript functions.
		// Ajoute les fonction Javascript
		const scripts = this.createHtmlScript();

		// Add html body to the view.
		// Ajoute le corps du HTML à la vue.
		const html = util.format(format, scripts + tables);
		this.vscodePanel.webview.html = html;
	}

	/**
	 * Called on key press or key release.
	 * Sets/clears the corresponding port bits.
	 * Appelé lors de la pression ou le relachement d'une touche.
	 * Met à jour les bits de ports correspondant
	 * @param key E.g. "Digit2", "KeyQ", "Enter", "Space", "ShiftLeft" or "ShiftRight"
	 * @param shift true: pressed, false: released.
	 * @param on true: pressed, false: released.
	 *           true: pressée, false: relachée.
	 */
	protected async keyChanged(key: string, shift: boolean, on: boolean) {
		// Determine port.
		// Détermine le numéro de port.
		let port = 0;
		switch (key) {
			case 'Digit1':
			case 'Digit2':
			case 'Digit3':
			case 'Digit4':
			case 'Digit5':
				port = 0xF7;
				break;
			case 'Digit6':
			case 'Digit7':
			case 'Digit8':
			case 'Digit9':
			case 'Digit0':
				port = 0xEF;
				break;
			case 'KeyQ':
			case 'KeyW':
			case 'KeyE':
			case 'KeyR':
			case 'KeyT':
				port = 0xFB;
				break;
			case 'KeyY':
			case 'KeyU':
			case 'KeyI':
			case 'KeyO':
			case 'KeyP':
				port = 0xDF;
				break;
			case 'KeyA':
			case 'KeyS':
			case 'KeyD':
			case 'KeyF':
			case 'KeyG':
				port = 0xFD;
				break;
			case 'KeyH':
			case 'KeyJ':
			case 'KeyK':
			case 'KeyL':
			case 'Enter':
				port = 0xBF;
				break;
			case 'KeyZ':
			case 'KeyX':
			case 'KeyC':
			case 'KeyV':
				port = 0xFE;
				break;
			case 'KeyB':
			case 'KeyN':
			case 'KeyM':
			case 'Period':
			case 'Space':
				port = 0x7F;
				break;
			default:
				break;
		}

		// Determine bit.
		// Détermine le numéro de bit.
		let n_bit = -1;
		switch (key) {
			case 'KeyA':
			case 'KeyQ':
			case 'Digit1':
			case 'Digit0':
			case 'KeyP':
			case 'Enter':
			case 'Space':
				n_bit = 0;
				break;
			case 'KeyZ':
			case 'KeyS':
			case 'KeyW':
			case 'Digit2':
			case 'Digit9':
			case 'KeyO':
			case 'KeyL':
			case 'Period':
				n_bit = 1;
				break;
			case 'KeyX':
			case 'KeyD':
			case 'KeyE':
			case 'Digit3':
			case 'Digit8':
			case 'KeyI':
			case 'KeyK':
			case 'KeyM':
				n_bit = 2;
				break;
			case 'KeyC':
			case 'KeyF':
			case 'KeyR':
			case 'Digit4':
			case 'Digit7':
			case 'KeyU':
			case 'KeyJ':
			case 'KeyN':
				n_bit = 3;
				break;
			case 'KeyV':
			case 'KeyG':
			case 'KeyT':
			case 'Digit5':
			case 'Digit6':
			case 'KeyY':
			case 'KeyH':
			case 'KeyB':
				n_bit = 4;
				break;
			default:
				break;
		}

		// Unknown key so return.
		// Touche inconnue donc sort.
		if(port === 0 || n_bit === -1) return;

		let bit = 1 << n_bit;
		// Special case for the Shift key. If on same port, add the bit.
		if(shift && port === 0xFE) bit |= 0b00001;

		const actualPort = (port << 8) | 0x00FE;
		// Get port value.
		// Obtient la valeur du port.
		Utility.assert(this.simulatedPorts);
		let value = this.simulatedPorts.get(actualPort)!;
		Utility.assert(value != undefined);
		// Set or reset the bit.
		// Met à jour le bit.
		if (on) value &= ~bit; else	value |= bit;
		// Update the value of the port.
		// Met à jour la valeur du port
		this.simulatedPorts.set(actualPort, value);

		// Special case for the Shift key. If not on same port, update the shift port
		if(shift && port !== 0xFE) {
			value = this.simulatedPorts.get(0xFEFE)!;
			this.simulatedPorts.set(0xFEFE, on ? value & 0b11110 : value | 0b00001);		
		}
	
		await this.updateLastK(on, port, n_bit, shift);
	}

	private async updateLastK(on: boolean, port: number, n_bit: number, shift: boolean) {
		// LAST_K+1     FD  FB  F7  EF  DF | DF  EF  F7  FB  FD
		//                                 |
		// LAST_K                          |
		//        F7    1   2   3   4   5  | 6   7   8   9   0    EF
		//                                 |
		//        FB    Q   W   E   R   T  | Y   U   I   O   P    DF
		//                                 
		//        FD    A   S   D   F   G  | H   J   K   L  ret   BF
		//                                 |
        //        FE        Z   X   C   V  | B   N   M   .  spc   7F
		//
		// Shift is bit 0 on LAST_K+1.

		if(on) {
			await Remote.writeMemory(0x4025, port);
			await Remote.writeMemory(0x4026, ~(1 << (n_bit + 1)) & (shift ? 0xFE : 0xFF));
		}
		else {
			await Remote.writeMemory(0x4025, 0xFF);
			await Remote.writeMemory(0x4026, 0xFF);
		}
	}

}
