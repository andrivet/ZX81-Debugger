import {EventEmitter} from 'events';
import {BaseView} from '../../views/baseview';
import {ZSimRemote} from './zsimremote';
import {Settings} from '../../settings';
import {Utility} from '../../misc/utility';
import {readFileSync} from 'fs';

/**
 * A Webview that shows the simulated peripherals.
 * E.g. in case of the Spectrum the ULA screen or the keyboard.
 */
export class ZSimulationView extends BaseView {

	// Holds the gif image a string.
	protected screenGifString;

	/// We listen for 'update' on this emitter to update the html.
	protected parent: EventEmitter;

	// A pointer to the simulator.
	protected simulator: ZSimRemote;

	// Taken from Settings. Path to the extra javascript code.
	protected customUiPath: string;

	// Is set when a 'portGet' query is send to the webview.
	// And is called when the response (the port value) is
	// received from the webview.
	protected genericInPortResolve: ((value: number) => void)|undefined;


	/**
	 * Factory method which creates a new view and handles it's lifecycle.
	 * I.e. the events.
	 * @param simulator The simulator Remote which emits the signals.
	 */
	public static SimulationViewFactory(simulator: ZSimRemote) {
		// Safety check
		if (!simulator)
			return;

		// Create new instance
		let zxview: ZSimulationView|undefined=new ZSimulationView(simulator);
		simulator.once('closed', () => {
			zxview?.close();
			zxview=undefined;
		});
		simulator.on('update', async (reason) => {
			await zxview?.update();
		});
	}


	/**
	 * Creates the basic view.
	 * @param memory The memory of the CPU.
	 */
	constructor(simulator: ZSimRemote) {
		super(false);
		// Init
		this.simulator=simulator;

		// Set all ports
		// TODO: Make dependend of zx keyboard
		const ports=simulator.ports;
		ports.setPortValue(0xFEFE, 0xFF);
		ports.setPortValue(0xFDFE, 0xFF);
		ports.setPortValue(0xFBFE, 0xFF);
		ports.setPortValue(0xF7FE, 0xFF);
		ports.setPortValue(0xEFFE, 0xFF);
		ports.setPortValue(0xDFFE, 0xFF);
		ports.setPortValue(0xBFFE, 0xFF);
		ports.setPortValue(0x7FFE, 0xFF);

		// Add title
		Utility.assert(this.vscodePanel);
		this.vscodePanel.title='Z80 Simulator - '+Settings.launch.zsim.memoryModel;

		// Read path for additional javascript code
		this.customUiPath=Settings.launch.zsim.customUiPath;

		// Initial html page.
		this.setHtml();
		//this.update(); Is done by the webview
	}


	/**
	 * Closes the view.
	 */
	public close() {
		this.vscodePanel.dispose();
	}


	/**
	 * Dispose the view (called e.g. on close).
	 * Use this to clean up additional stuff.
	 * Normally not required.
	 */
	public disposeView() {
	}


	/**
	 * The web view posted a message to this view.
	 * @param message The message. message.command contains the command as a string. E.g. 'keyChanged'
	 */
	protected webViewMessageReceived(message: any) {
		switch (message.command) {
			case 'updateRequest':
				// The webview requests an update, e.g. because it has been
				// moved from background to foreground (vscode does not preserve the state)
				this.update();	// No need to call 'await'
				break;
			case 'keyChanged':
				this.keyChanged(message.key, message.value);
				break;
			case 'setPortBit':
				// Can be called by user's js code to set a port.
				this.setPortBit(message.port, message.bit, message.on);
				break;
			case 'refreshJsCode':
				// In debug mode this is received to recreate the complete html.
				// And with this the user's java script file is read as well.
				this.setHtml();
				break;
			case 'portGetValue':
				// Return on a 'portGet' postMessage.
				// Returns the value for a port.
				this.portGetValue(message.value);
				break;
			default:
				super.webViewMessageReceived(message);
				break;
		}
	}


	/**
	 * A 'portGet' was sent to the webview and now it's value
	 * in 'portGetValue' has been returned.
	 * @param value The value for the port.
	 */
	protected portGetValue(value: number) {
		Utility.assert(this.genericInPortResolve); // If not set then there was no request.
		this.genericInPortResolve!(value);
	}


	/**
	 * Called on key press or key release.
	 * Sets/clears the corresponding port bits.
	 * @param key E.g. "key_Digit2", "key_KeyQ", "key_Enter", "key_Space", "key_ShiftLeft" (CAPS) or "key_ShiftRight" (SYMBOL).
	 * @param on true=pressed, false=released
	 */
	protected keyChanged(key: string, on: boolean) {
		// Determine port
		let port;
		switch (key) {
			case 'key_Digit1':
			case 'key_Digit2':
			case 'key_Digit3':
			case 'key_Digit4':
			case 'key_Digit5':
				port=0xF7FE;
				break;
			case 'key_Digit6':
			case 'key_Digit7':
			case 'key_Digit8':
			case 'key_Digit9':
			case 'key_Digit0':
				port=0xEFFE;
				break;
			case 'key_KeyQ':
			case 'key_KeyW':
			case 'key_KeyE':
			case 'key_KeyR':
			case 'key_KeyT':
				port=0xFBFE;
				break;
			case 'key_KeyY':
			case 'key_KeyU':
			case 'key_KeyI':
			case 'key_KeyO':
			case 'key_KeyP':
				port=0xDFFE;
				break;
			case 'key_KeyA':
			case 'key_KeyS':
			case 'key_KeyD':
			case 'key_KeyF':
			case 'key_KeyG':
				port=0xFDFE;
				break;
			case 'key_KeyH':
			case 'key_KeyJ':
			case 'key_KeyK':
			case 'key_KeyL':
			case 'key_Enter':
				port=0xBFFE;
				break;
			case 'key_ShiftLeft':	// CAPS
			case 'key_KeyZ':
			case 'key_KeyX':
			case 'key_KeyC':
			case 'key_KeyV':
				port=0xFEFE;
				break;
			case 'key_KeyB':
			case 'key_KeyN':
			case 'key_KeyM':
			case 'key_ShiftRight':	// SYMBOL
			case 'key_Space':
				port=0x7FFE;
				break;
			default:
				Utility.assert(false);
		}
		Utility.assert(port);

		// Determine bit
		let bit;
		switch (key) {
			case 'key_ShiftLeft':	// CAPS
			case 'key_KeyA':
			case 'key_KeyQ':
			case 'key_Digit1':
			case 'key_Digit0':
			case 'key_KeyP':
			case 'key_Enter':
			case 'key_Space':
				bit=0b00001;
				break;
			case 'key_KeyZ':
			case 'key_KeyS':
			case 'key_KeyW':
			case 'key_Digit2':
			case 'key_Digit9':
			case 'key_KeyO':
			case 'key_KeyL':
			case 'key_ShiftRight':	// SYMBOL
				bit=0b00010;
				break;
			case 'key_KeyX':
			case 'key_KeyD':
			case 'key_KeyE':
			case 'key_Digit3':
			case 'key_Digit8':
			case 'key_KeyI':
			case 'key_KeyK':
			case 'key_KeyM':
				bit=0b00100;
				break;
			case 'key_KeyC':
			case 'key_KeyF':
			case 'key_KeyR':
			case 'key_Digit4':
			case 'key_Digit7':
			case 'key_KeyU':
			case 'key_KeyJ':
			case 'key_KeyN':
				bit=0b01000;
				break;
			case 'key_Keyv':
			case 'key_KeyG':
			case 'key_KeyT':
			case 'key_Digit5':
			case 'key_Digit6':
			case 'key_KeyY':
			case 'key_KeyH':
			case 'key_KeyB':
				bit=0b10000;
				break;
			default:
				Utility.assert(false);
		}
		Utility.assert(bit);

		// Get port value
		let value=this.simulator.ports.getPortValue(port);
		if (on)
			value&=~bit;
		else
			value|=bit;
		// And set
		this.simulator.ports.setPortValue(port, value);
	}

	/**
	 * Is called by user's java script code to set a port.
	 * @param port The port to set. e.g. 0xA23F
	 * @param bit The bit to set [0;7]
	 * @param on Set the bit to 1 (true) or 0 (false).
	 */
	protected setPortBit(port: number, bit: number, on: boolean) {
		console.log("port=0x"+Utility.getHexString(port, 4)+", bit="+bit+": "+(on? "1":"0"));
	}


	/**
	 * Converts an image into a base64 string.
	 */
	public createBase64String(imgBuffer: number[]): string {
		let screenGifString='';
		try {
			// Create gif
			const buf=Buffer.from(imgBuffer);
			screenGifString='data:image/gif;base64,'+buf.toString('base64');
		}
		catch {}
		return screenGifString;
	}


	/**
	 * Retrieves the screen memory content and displays it.
	 * @param reason Not used.
	 */
	public async update(): Promise<void> {
		try {
			let cpuLoad;
			let slots;
			let slotNames;
			let visualMemImg;
			let screenImg;
			// Update values
			if (Settings.launch.zsim.cpuLoadInterruptRange>0)
				cpuLoad=(this.simulator.z80Cpu.cpuLoad*100).toFixed(0).toString();

			// Visual Memory
			if (Settings.launch.zsim.visualMemory) {
				slots=this.simulator.getSlots();
				const banks=this.simulator.memoryModel.getMemoryBanks(slots);
				slotNames=banks.map(bank => bank.name);
				visualMemImg=this.createBase64String(this.simulator.memory.getVisualMemoryImage());
			}
			/* TODO: Remove
			if (Settings.launch.zsim.visualMemory=="ZX128") {
				slots=this.simulator.memory.getSlots();
				// ZX128 has 16k slots/banks
				slotNames=new Array<string>();
				for (let i=0; i<8; i+=2) {
					const bankA=Math.floor(slots[i]/2);
					const bankB=Math.floor(slots[i+1]/2);
					let name;
					if (bankA==127||bankB==127) {
						// Use name "ROM"
						name="ROM";
						if (bankA<127)
							name+="/"+bankA;	// pathologic case.
						if (bankB<127)
							name+="/"+bankB;	// pathologic case.
					}
					else {
						// Use name "BANKx"
						name="BANK"+bankB
						if (bankA!=bankB)
							name+="/"+bankB;	// This only happens if e.g. ZXNext 8k slots banks are used.
					}
					slotNames.push(name);
				}
			}
			else if (Settings.launch.zsim.visualMemory=="ZXNEXT") {
				slots=this.simulator.memory.getSlots();
				slotNames=slots.map(bank => (bank>=254)? "ROM":"BANK"+bank);
			}
			if (Settings.launch.zsim.visualMemory!="none") {
				// The same for all
				visualMemImg=this.createBase64String(this.simulator.memory.getVisualMemoryImage());
			}
			*/

			if (Settings.launch.zsim.ulaScreen)
				screenImg=this.createBase64String(this.simulator.ulaScreen.getUlaScreen());
			// Create message to update the webview
			let message={
				command: 'update',
				cpuLoad,
				slotNames,
				visualMemImg,
				screenImg

			};
			this.sendMessageToWebView(message);
			// Clear
			this.simulator.memory.clearVisualMemory();
		}
		catch {}
	}


	/**
	 * Sets the html code to display the ula screen, visual memory etc.
	 * Depending on the Settings selection.
	 */
	protected setHtml() {
		let html=
`<html>

<style>
.td_on {border: 3px solid;
margin:0em;
padding:0em;
text-align:center;
border-color:black;
background:red;
width:70px;
}

.td_off {border: 3px solid;
margin:0em;
padding:0em;
text-align:center;
border-color:black;
width:70px;
}


.div_on {
color:white;
}

.div_off {
color:black;
}
</style>


  <script>

	const vscode = acquireVsCodeApi();

	//---- On start send request to vscode to update itself. --------
	// Otherwise the images are empty when switching from back- to foreground.
	vscode.postMessage({
		command: 'updateRequest'
	});


	//---- Handle Messages from vscode extension --------
	window.addEventListener('message', event => {
		const message = event.data;

		switch (message.command) {
			case 'update':
			{
				if(message.cpuLoad != undefined)
					cpuLoad.innerHTML = message.cpuLoad;

				if(message.slotNames) {
					let i=0;
					for(slotString of message.slotNames) {
						const slot=slots[i++];
						if(slot)
							slot.textContent = slotString;
					}
				}

				if(message.visualMemImg)
					visualMemImg.src = message.visualMemImg;

				if(message.screenImg)
					screenImg.src = message.screenImg;
			}
			break;
		}
	});


	// Set cell to selected or unselected.
    function cellSelect(cell, on) {
		cell.tag=on;
		if(on) {
		cell.className="td_on";
		}
		else {
		cell.className="td_off";
		}

		// Send request to vscode
		vscode.postMessage({
			command: 'keyChanged',
			value: on,
			key: cell.id
		});
    }


    // Toggle the cell.
    function cellClicked(cell) {
      	//log.textContent += "clicked ";
      	cell.tag=!cell.tag;
      	cellSelect(cell, cell.tag);
    }


    // Find right cell for keycode.
	function findCell(keyCode) {
    	// Find correspondent cell
        cell=document.getElementById("key_"+keyCode);
     	return cell;
    }


	// Sets 'bit' on 'port' address to 'on' (true/false).
	function setPortBit(port, bit, on) {
		// Send request to vscode
		vscode.postMessage({
			command: 'setPortBit',
			port: port,
			bit: bit,
			on: on
		});
	}


	// Toggles the visibility of an element.
	/*
	function toggleVisibility(id) {
		const x = document.getElementById(id);
		if (x.style.display === "none") {
			x.style.display = "block";
		} else {
			x.style.display = "none";
		}
	}
	*/

	// Handle key down presses.
	document.addEventListener('keydown', keydown);
	function keydown(e) {
       	// Find correspondent cell
        cell=findCell(e.code);
        cellSelect(cell, true);
       	//log.textContent += e.code + ", ";
    }


	// Handle key up presses.
	document.addEventListener('keyup', keyup);
	function keyup(e) {
    	// Find correspondent cell
        cell=findCell(e.code);
        cellSelect(cell, false);
    }


  </script>

<body>

`;

		if (Settings.launch.zsim.cpuLoadInterruptRange>0) {
			html+=
				`<!-- Z80 CPU load -->
<p>
	<label>Z80 CPU load:</label>
	<label id="cpu_load_id">100</label>
	<label>%</label>
</p>
<script>
	<!-- Store the cpu_load_id -->
	var cpuLoad=document.getElementById("cpu_load_id");
</script>

`;
		}

		// Memory Pages / Visual Memory
		const zx=Settings.launch.zsim.memoryModel.includes("ZX");
		const slots=this.simulator.getSlots();
		const banks=this.simulator.memoryModel.getMemoryBanks(slots);
		html+=
				`<!-- Visual Memory (memory activity) -->
<!-- Legend, Slots -->
<div style="position:relative; width:100%; height:4.5em;">
    <style>
        .border {
            outline: 1px solid var(--vscode-foreground);
            outline-offset: 0;
            height:1em;
            position:absolute;
            text-align: center;
		}
		.slot {
			height:2em;
			background: gray
        }
		.transparent {
			height:2em;
			background: transparent
        }
    </style>

	<!-- Legend -->
    <span style="position:absolute; top: 0em; left:0%">
		<label style="background:blue">&ensp;&ensp;</label><label>&nbsp;PROG &ensp;&ensp;</label>
		<label style="background:yellow">&ensp;&ensp;</label><label>&nbsp;READ &ensp;&ensp;</label>
		<label style="background:red">&ensp;&ensp;</label><label>&nbsp;WRITE</label>
	</span>

	<!-- Address labels -->
	<label style="position:absolute; top:2em; left:0%">0x0000</label>
	<label style="position:absolute; top:2em; left:12.5%">0x2000</label>`;
		// ZX screen memory marker
		if (zx) {
			html+=`
	<label style="position:absolute; top:1.1em; left:25%">0x4000</label>
	<label style="position:absolute; top:1.1em; left:35.5%">0x5B00</label>`;
		}
		else {
			html+=`
			<label style="position:absolute; top:2em; left:25%">0x4000</label>`;
		}

		html+=`
	<label style="position:absolute; top:2em; left:37.5%">0x6000</label>
	<label style="position:absolute; top:2em; left:50%">0x8000</label>
	<label style="position:absolute; top:2em; left:62.5%">0xA000</label>
	<label style="position:absolute; top:2em; left:75%">0xC000</label>
	<label style="position:absolute; top:2em; left:87.5%">0xE000</label>

    <!-- Marker ticks -->
	<span class="border" style="top: 3em; left:0%; height: 1.7em"></span>
	<span class="border" style="top: 3em; left:12.5%; height:1em;"></span>`;
		if (zx) {
			// ZX screen memory marker
			html+=`
	<span class="border" style="top: 2.0em; left:25%; height:2.5em;"></span>
	<span class="border" style="top: 2.0em; left:34.4%; height:2.5em;"></span> <!-- 0x5800 -->
	<span class="border" style="top: 2.0em; left:35.5%; height:2.5em;"></span> <!-- 0x5B00 -->`;
		}
		else {
			// ZX screen memory marker
			html+=`
	<span class="border" style="top: 3em; left:25%; height:1em;"></span>`;
		}

		html+=`
	<span class="border" style="top: 3em; left:37.5%; height:1em;"></span>
	<span class="border" style="top: 3em; left:50%; height:1em;"></span>
	<span class="border" style="top: 3em; left:62.5%; height:1em;"></span>
	<span class="border" style="top: 3em; left:75%; height:1em;"></span>
    <span class="border" style="top: 3em; left:87.5%; height:1em;"></span>
`;
		if (zx) {
			// Markers for display
			html+=`
	<!-- Extra "Screen" range display -->
    <div class="border slot" style="top:2.2em; left:25%; width:9.4%;">SCREEN</div>
	<div class="border slot" style="top:2.2em; left:34.4%; width:1.1%;"></div>`;
		}

		html+=`
	<!-- Visual memory image, is mainly transparent and put on top -->
	<img class="slot" id="visual_mem_img_id" style="image-rendering:pixelated; position:absolute; top:3.5em; left:0; width:100%;">

	<!-- Slots  2nd -->
	`;
		const count=banks.length;
		for (let i=0; i<count; i++) {
			const bank=banks[i];
			const pos=bank.start*100/0x10000;
			const width=(bank.end+1-bank.start)*100/0x10000;
			const add=`<div class="border transparent" id="slot${i}_id" style="top:3.5em; left:${pos}%; width:${width}%;">${bank.name}</div>
			`;
			html+=add;
		}

		html+=`
    <script>
        <!-- Store the visual mem image source -->
        var visualMemImg=document.getElementById("visual_mem_img_id");
	    <!-- Store the slots -->
	    var slots = [
			`;

		for (let i=0; i<count; i++) {
			const add=`document.getElementById("slot${i}_id"),
			`;
			html+=add;
		}

		html+=`
		];
 	</script>
</div>
<br><br>
`;


		if (Settings.launch.zsim.ulaScreen) {
			html+=
				`<!-- Display the screen gif -->
<img id="screen_img_id" style="image-rendering:pixelated; width:100%;">
<script>
	<!-- Store the screen image source -->
	var screenImg=document.getElementById("screen_img_id");
</script>
`;
		}


		if (Settings.launch.zsim.zxKeyboard) {
			html+=
`<!-- Keyboard -->
<details open="true">
  <summary>ZX Keyboard</summary>

	<table style="width:100%">

	<tr>
		<td id="key_Digit1" class="td_off" onClick="cellClicked(this)">1</td>
		<td id="key_Digit2" class="td_off" onClick="cellClicked(this)">2</td>
		<td id="key_Digit3" class="td_off" onClick="cellClicked(this)">3</td>
		<td id="key_Digit4" class="td_off" onClick="cellClicked(this)">4</td>
		<td id="key_Digit5" class="td_off" onClick="cellClicked(this)">5</td>
		<td id="key_Digit6" class="td_off" onClick="cellClicked(this)">6</td>
		<td id="key_Digit7" class="td_off" onClick="cellClicked(this)">7</td>
		<td id="key_Digit8" class="td_off" onClick="cellClicked(this)">8</td>
		<td id="key_Digit9" class="td_off" onClick="cellClicked(this)">9</td>
		<td id="key_Digit0" class="td_off" onClick="cellClicked(this)">0</td>
	</tr>

	<tr>
		<td id="key_KeyQ" class="td_off" onClick="cellClicked(this)">Q</td>
		<td id="key_KeyW" class="td_off" onClick="cellClicked(this)">W</td>
		<td id="key_KeyE" class="td_off" onClick="cellClicked(this)">E</td>
		<td id="key_KeyR" class="td_off" onClick="cellClicked(this)">R</td>
		<td id="key_KeyT" class="td_off" onClick="cellClicked(this)">T</td>
		<td id="key_KeyY" class="td_off" onClick="cellClicked(this)">Y</td>
		<td id="key_KeyU" class="td_off" onClick="cellClicked(this)">U</td>
		<td id="key_KeyI" class="td_off" onClick="cellClicked(this)">I</td>
		<td id="key_KeyO" class="td_off" onClick="cellClicked(this)">O</td>
		<td id="key_KeyP" class="td_off" onClick="cellClicked(this)">P</td>
	</tr>

	<tr>
		<td id="key_KeyA" class="td_off" onClick="cellClicked(this)">A</td>
		<td id="key_KeyS" class="td_off" onClick="cellClicked(this)">S</td>
		<td id="key_KeyD" class="td_off" onClick="cellClicked(this)">D</td>
		<td id="key_KeyF" class="td_off" onClick="cellClicked(this)">F</td>
		<td id="key_KeyG" class="td_off" onClick="cellClicked(this)">G</td>
		<td id="key_KeyH" class="td_off" onClick="cellClicked(this)">H</td>
		<td id="key_KeyJ" class="td_off" onClick="cellClicked(this)">J</td>
		<td id="key_KeyK" class="td_off" onClick="cellClicked(this)">K</td>
		<td id="key_KeyL" class="td_off" onClick="cellClicked(this)">L</td>
		<td id="key_Enter" class="td_off" onClick="cellClicked(this)">ENTER</td>
	</tr>

	<tr>
		<td id="key_ShiftLeft" class="td_off" onClick="cellClicked(this)">CAPS S.</td>
		<td id="key_KeyZ" class="td_off" onClick="cellClicked(this)">Z</td>
		<td id="key_KeyX" class="td_off" onClick="cellClicked(this)">X</td>
		<td id="key_KeyC" class="td_off" onClick="cellClicked(this)">C</td>
		<td id="key_KeyV" class="td_off" onClick="cellClicked(this)">V</td>
		<td id="key_KeyB" class="td_off" onClick="cellClicked(this)">B</td>
		<td id="key_KeyN" class="td_off" onClick="cellClicked(this)">N</td>
		<td id="key_KeyM" class="td_off" onClick="cellClicked(this)">M</td>
		<td id="key_ShiftRight" class="td_off" onClick="cellClicked(this)">SYMB. S.</td>
		<td id="key_Space" class="td_off" onClick="cellClicked(this)">SPACE</td>
	</tr>

	</table>
</details>

`;
		}

		html+=
`<p id="log"></p>
`;

		// Custom javascript code area
		let jsCode='';
		if (this.customUiPath) {
			try {
				jsCode=readFileSync(this.customUiPath).toString();
			}
			catch (e) {
				jsCode="<b>Error: reading file '"+this.customUiPath+"':"+e.message+"</b>";
			}
		}

		html+=
`<!-- Room for extra/user editable javascript/html code -->
<p>
	<div id="js_code_id">
	${jsCode}
	</div>
</p>

`;

		if (Settings.launch.zsim.debug) {
			html+=
`<!-- Debug Area -->
<hr>

<details open="true">
    <summary>Debug Area</summary>

	<!-- "Copy all HTML" button -->
	<script>
		// Copies the complete html of the document to the clipboard.
		function copyHtmlToClipboard() {
			const copyText = document.documentElement.innerHTML;
			navigator.clipboard.writeText(copyText);
		}
	</script>

	<script>
		// Use the entered javascript code.
		function refreshJsCode() {
			// Send request to vscode
			vscode.postMessage({
				command: 'refreshJsCode'
			});
		}
	</script>

	<button onclick="refreshJsCode()">Refresh javascript code</button>
	&nbsp;&nbsp;
	<button onclick="copyHtmlToClipboard()">Copy all HTML to clipboard</button>


</details>

`;
		}

		html+=
`</body>
</html>
`;

		this.vscodePanel.webview.html=html;
	}
}
