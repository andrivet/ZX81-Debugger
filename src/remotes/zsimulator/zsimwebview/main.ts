import {vscode} from "./vscode-import";
import {Zx81UlaDraw} from "./zx81uladraw";
import {Zx81HiResUlaDraw} from "./zx81hiresuladraw";
import {VisualMem} from "./visualmem";
import {joystickObjs, initJoystickPolling} from "./joysticks";
import {UIAPI, UiBit} from "./helper";
import {UlaDraw} from "./uladraw";


// HTML element used for the cpu frequency.
let cpuFreq: HTMLLabelElement

// HTML element used for the cpu load.
let cpuLoad: HTMLLabelElement

// HTML element used for the keyboard
let keyboard : HTMLElement | null;


// For flow control.
let countOfProcessedMessages = 0;

// Message water marks.
// @ts-ignore
const MESSAGE_HIGH_WATERMARK = 100;
const MESSAGE_LOW_WATERMARK = 10;

// The last cell that was clicked and is on.
let lastCell: HTMLElement | null = null;
// Is shift pressed?
let shift: HTMLElement | null = null;

// The slot HTML elements.
const slots: HTMLElement[] = [];

// For the ULA screen.
let screenImg: HTMLCanvasElement;
let ulaDraw: UlaDraw;

// ZX81 keyboard or not.
let zxKeyboard: boolean = true;


//---- Handle Messages from vscode extension --------
window.addEventListener('message', event => {// NOSONAR
	// Count message
	countOfProcessedMessages++;
	if (countOfProcessedMessages >= MESSAGE_LOW_WATERMARK) {
		// Send info to vscode
		vscode.postMessage({
			command: 'countOfProcessedMessages',
			value: countOfProcessedMessages
		});
		countOfProcessedMessages = 0;
	}

	// Process message
	const message = event.data;
	switch (message.command) {
		case 'init':
			// Configuration received. Is received once after 'configRequest' was sent.
			// Is only done once after loading.
			initSimulation(message);
			break;

		case 'cpuStopped':
			// Z80 CPU was stopped, t-states do not advance.
			break;

		case 'updateScreen':
			// Update the screen
			const ulaData = message.ulaData;
			if (ulaData) {
				ulaDraw.drawUlaScreen(ulaData);
			}
			break;

		case 'update':
			if (message.cpuFreq) {
				cpuFreq.innerHTML = message.cpuFreq
			}

			if (cpuLoad) {
				if (message.cpuLoad !== undefined)
					cpuLoad.innerHTML = message.cpuLoad;
				cpuLoad.style.backgroundColor = message.simulationTooSlow ? 'yellow' : '';
			}

			if (message.slotNames) {
				let i = 0;
				for (const slotString of message.slotNames) {
					const slot = slots[i++];
					if (slot)
						slot.textContent = slotString;
				}
			}

			if (message.visualMem) {
				VisualMem.drawVisualMemory(message.visualMem);
			}
			break;

		case 'receivedFromCustomLogic':
			// Message received from custom code.
			// Call custom UI code
			if (UIAPI.receivedFromCustomLogic) {
				// Unwrap original message:
				const innerMsg = message.value;
				// Process message
				UIAPI.receivedFromCustomLogic(innerMsg);
			}
			break;
	}
});


/** Init: Initializes parts of the simulation.
 * @param screenWidth The width of the screen.
 * @param screenHeight The height of the screen.
 */
function initSimulation(message) {
	// Store the cpu_freq_id
	cpuFreq = document.getElementById("cpu_freq_id") as HTMLLabelElement;

	// Store the cpu_load_id
	cpuLoad = document.getElementById("cpu_load_id") as HTMLLabelElement;

	keyboard = document.querySelector(".keyboard");

	// Store the visual mem image source
	const visualMemCanvas = document.getElementById("visual_mem_img_id") as HTMLCanvasElement;
	if (visualMemCanvas) {
		// Init both
		VisualMem.initCanvas(visualMemCanvas);
	}

	// Slots
	for (let i = 0; ; i++) {
		const slot = document.getElementById("slot" + i + "_id");
		if (!slot)
			break;
		slots.push(slot);
	}

	// Store the screen image source
	screenImg = document.getElementById("screen_img_id") as HTMLCanvasElement;
	if (screenImg) {
		if (message.ulaOptions.hires) {
			ulaDraw = new Zx81HiResUlaDraw(screenImg, message.ulaOptions);
		}
		else {
			ulaDraw = new Zx81UlaDraw(screenImg, message.ulaOptions);
		}
	}

	// Joysticks (Interface II)
	const if2Joy1Fire = document.getElementById("if2.joy1.fire") as UiBit;
	if (if2Joy1Fire) {
		joystickObjs.push({
			fire: if2Joy1Fire,
			up: document.getElementById("if2.joy1.up") as UiBit,
			left: document.getElementById("if2.joy1.left") as UiBit,
			right: document.getElementById("if2.joy1.right") as UiBit,
			down: document.getElementById("if2.joy1.down") as UiBit
		});
		joystickObjs.push({
			fire: document.getElementById("if2.joy2.fire") as UiBit,
			up: document.getElementById("if2.joy2.up") as UiBit,
			left: document.getElementById("if2.joy2.left") as UiBit,
			right: document.getElementById("if2.joy2.right") as UiBit,
			down: document.getElementById("if2.joy2.down") as UiBit
		});
	}

	// Joystick (Kempston)
	const kempstonJoy1Fire = document.getElementById("kempston.joy1.fire") as UiBit;
	if (kempstonJoy1Fire) {
		joystickObjs.push({
			fire: kempstonJoy1Fire,
			up: document.getElementById("kempston.joy1.up") as UiBit,
			left: document.getElementById("kempston.joy1.left") as UiBit,
			right: document.getElementById("kempston.joy1.right") as UiBit,
			down: document.getElementById("kempston.joy1.down") as UiBit,
		});
	}

	// Joystick (Custom)
	const customJoy1Fire = document.getElementById("customJoy.joy1.fire") as UiBit;
	if (customJoy1Fire) {
		const cjoy = {
			fire: customJoy1Fire,
			fire2: document.getElementById("customJoy.joy1.fire2") as UiBit,
			fire3: document.getElementById("customJoy.joy1.fire3") as UiBit,
			fire4: document.getElementById("customJoy.joy1.fire4") as UiBit,
			up: document.getElementById("customJoy.joy1.up") as UiBit,
			left: document.getElementById("customJoy.joy1.left") as UiBit,
			right: document.getElementById("customJoy.joy1.right") as UiBit,
			down: document.getElementById("customJoy.joy1.down") as UiBit,
		};
		joystickObjs.push(cjoy);
	}

	// Start joystick polling (if joystick is setup)
	initJoystickPolling();
}


// Set cell to selected or unselected.
function cellSelect(cell, on) {
	if (!cell)
		return;
	cell.tag = on;
	if (on) {
		cell.classList.add('key-pressed');
	}
	else {
		cell.classList.remove('key-pressed');
	}

	// Send request to vscode
	vscode.postMessage({
		command: 'keyChanged',
		value: on,
		key: cell.id
	});
}

// Toggle the cell.
globalThis.cellClicked = function (cell) {
	if(lastCell) return;

	// Press the key
	cellSelect(cell, true);
	// Remember the key
	lastCell = cell;
	// Unpress the key after 500ms
	setTimeout(() => {
		if(lastCell !== cell) return;
		// Unpress the key
		cellSelect(cell, false);
		lastCell = null;
		// Shift was presses?
		if(shift) {
			// Unpress the shift key
			cellSelect(shift, false);
			shift = null;
		}
	}, 500);
}

// Toggle the cell.
// Only the shift key is a sticky key (until another key is pressed).
globalThis.cellShiftClicked = function (cell) {
	if(lastCell || shift) return;

	cellSelect(cell, true);
	shift = cell;
}

// Toggle the cell and the corresponding bit
globalThis.togglePortBit = function (cell, port, bitByte) {
	// Send request to vscode
	vscode.postMessage({
		command: 'portBit',
		value: {port: port, on: cell.bitvalue, bitByte: bitByte}
	});
}

// Toggle the cell and the corresponding bit.
// Used for Interface 2 joystick.
// Inverts the bit before sending.
// I.e. Active=LOW
globalThis.sendKeyBit = function (cell, row, bitByte) {
	// Send request to vscode
	vscode.postMessage({
		command: 'keyBit',
		value: {row: row, on: cell.bitvalue, bitByte: bitByte}
	});
}

// Is sent by the custom joystick if a button is pressed/released.
globalThis.sendJoyButton = function (cell) {
	// Send request to vscode
	vscode.postMessage({
		command: 'joyButton',
		value: {id: cell.id, on: cell.bitvalue}
	});
}

// Find right cell for keycode.
function findCell(keyCode) {
	// Find correspondent cell
	const cell = document.getElementById("key_" + keyCode);
	return cell;
}


// "Copy all HTML" button-- >

// Copies the complete html of the document to the clipboard.
globalThis.copyHtmlToClipboard = function () {
	const copyText = document.documentElement.innerHTML;
	(async () => {
		await navigator.clipboard.writeText(copyText);
	})();
}


// Reload the javascript business logic.
globalThis.reloadCustomLogicAndUi = function () {
	// Send request to vscode
	vscode.postMessage({
		command: 'reloadCustomLogicAndUi'
	});
}


// Handles key up/down events.
// e: the keyboard event
// on: true if key is pressed, false if released
function keySelect(e, on) {
	//console.log("Key:", on, e);
	let mappedKeys;

	// Check for cursor keys + delete
	switch (e.code) {
		case "ArrowLeft": mappedKeys = ['Shift_Caps', 'Digit5']; break;
		case "ArrowRight": mappedKeys = ['Shift_Caps', 'Digit8']; break;
		case "ArrowUp": mappedKeys = ['Shift_Caps', 'Digit7']; break;
		case "ArrowDown": mappedKeys = ['Shift_Caps', 'Digit6']; break;
		case "Backspace": mappedKeys = ['Shift_Caps', 'Digit0']; break;
	}

	if (zxKeyboard) {
		switch (e.key) {
			case '$': mappedKeys = ['Shift_Caps', 'KeyU']; break;
			case '(': mappedKeys = ['Shift_Caps', 'KeyI']; break;
			case ')': mappedKeys = ['Shift_Caps', 'KeyO']; break;
			case '"': mappedKeys = ['Shift_Caps', 'KeyP']; break;
			case '-': mappedKeys = ['Shift_Caps', 'KeyJ']; break;
			case '+': mappedKeys = ['Shift_Caps', 'KeyK']; break;
			case '=': mappedKeys = ['Shift_Caps', 'KeyL']; break;
			case ':': mappedKeys = ['Shift_Caps', 'KeyZ']; break;
			case ';': mappedKeys = ['Shift_Caps', 'KeyX']; break;
			case '?': mappedKeys = ['Shift_Caps', 'KeyC']; break;
			case '/': mappedKeys = ['Shift_Caps', 'KeyV']; break;
			case '*': mappedKeys = ['Shift_Caps', 'KeyB']; break;
			case '<': mappedKeys = ['Shift_Caps', 'KeyN']; break;
			case '>': mappedKeys = ['Shift_Caps', 'KeyM']; break;
			case ',': mappedKeys = ['Shift_Caps', 'Period_Symbol']; break;
			default: // Otherwise check key code
				switch (e.code) {
					// Convert Left ALT to Shift
					case 'AltLeft': mappedKeys = ['Shift_Caps']; break;
					// Convert '.' to Period
					case 'Period': mappedKeys = ['Period_Symbol']; break;
				}
		}
	}

	// Default key press:
	if (!mappedKeys) {
		mappedKeys = [e.code];
	}
	// Execute key press
	for (const key of mappedKeys) {
		const cell = findCell(key);
		cellSelect(cell, on);
	}
}


// Handle key down presses.
document.addEventListener('keydown', keydown);
function keydown(e) {
	keySelect(e, true);
}


// Handle key up presses.
document.addEventListener('keyup', keyup);
function keyup(e) {
	keySelect(e, false);
}

window.addEventListener('focus', focus);
function focus() {
	if(keyboard) keyboard.classList.add("focus");
}

window.addEventListener('blur', blur);
function blur() {
	if(keyboard) keyboard.classList.remove("focus");
}

// Handle initial load.
window.addEventListener('load', () => {
	// Inform vscode that page was loaded.
	vscode.postMessage({
		command: 'loaded'
	});
});
