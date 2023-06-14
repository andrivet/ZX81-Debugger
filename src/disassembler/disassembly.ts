/**
 * ZX81 Debugger
 * 
 * File:			disassembly.ts
 * Description:		Encapsulates a few disassembling functions
 * Author:			Sebastien Andrivet, based on Dezog my Thomas Busse (Maziac)
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 * 					DeZog Copyright (C) 2023 Maziac
 */
import {Format} from "./core/format";
import {Opcode} from "./core/opcode";
import {RenderHint, RenderText} from "./rendertext";
import {SmartDisassembler} from "./smartdisassembler";
import {Labels} from "../labels/labels";
import {Utility} from "../misc/utility";
import {Settings} from '../settings/settings';
import {MemAttribute} from './core/memory';
import {Remote} from '../remotes/remotebase';


/// The filename used for the temporary disassembly. ('./.tmp/disasm.list')
const TmpDasmFileName = 'disasm.list';


/**
 * This class encapsulates a few disassembling functions.
 * Used in ZX81 Debugger when no file is associated with code.
 *
 * The disassembly works on the complete 64k memory space.
 * At start the 64k memory is fetched from the remote and disassembled.
 * A new fetch is done if the memory at the current PC
 * has changed or if the user presses the refresh button.
 * A new disassembly is done if the memory is refreshed or if there are new addresses to disassemble.
 * If the disassembly is not recent the refresh button is enabled for indication.
 *
 * The last PC values are stored because these values are known to be code locations and are used
 * for the disassembly.
 * A special handling is done for the callstack: The caller of the current subroutine cannot be
 * determined to 100%.
 * I.e. the stack might be misinterpreted.
 * Therefore the stack addresses are stored in a different array. This array is cleared when the refresh button is pressed.
 * I.e. if something looks strange the user can reload the disassembly.
 */
export class DisassemblyClass extends SmartDisassembler {

	/**
	 * Create the disassembler singleton.
	 */
	public static createDisassemblySingleton() {
		Disassembly = new DisassemblyClass();
		Disassembly.funcGetLabel = (addr64k: number) => {
			// Check if label already known
			const labels = Labels.getLabelsForAddress(addr64k);
			if (labels.length == 0)
				return undefined;
			return labels[0];	// Just return first label
		};
		Format.hexFormat = 'h';	// For all disassemblers
		// Lower or upper case
		Opcode.InitOpcodes();
		if (Settings.launch.smartDisassemblerArgs.lowerCase)
			Opcode.makeLowerCase();
	}


	/**
	 * Returns the file path of the temporary disassembly file.
	 * @returns The relative file path, e.g. ".tmp/disasm.list".
	 * Or undefined if Settings.launch not yet created.
	 */
	public static getAbsFilePath(): string {
		if (!Settings.launch)
			return undefined as any;
		const relPath = Utility.getRelTmpFilePath(TmpDasmFileName);
		const absPath = Utility.getAbsFilePath(relPath);
		return absPath;
	}


	/// An array of last PC addresses.
	protected pcAddressesHistory: number[] = [];

	/// An array of addresses from the callstack. The addresses might overlap with the pcAddressesHistory array.
	protected callStackAddresses: number[] = [];

	/// Stores last disassembled text.
	protected disassemblyText: string = '';

	// Map with the address to line number relationship and vice versa.
	protected addrLineMap = new Map<number, number>();
	protected lineAddrArray = new Array<number | undefined>();


	/** Adds the address to this.pcAddressesHistory
	 * if not existing already.
	 * @param pc The new pc value.
	 */
	public pushPcAddress(pc: number) {
		if(!this.pcAddressesHistory.includes(pc))
			this.pcAddressesHistory.push(pc);
	}


	/** Returns the last disassembled text.
	 * @returns text from last call to RenderText.renderSync().
	 */
	public getDisassemblyText(): string {
		return this.disassemblyText;
	}


	/** Returns the line number for a given address.
	 * @param address The address.
	 * @returns The corresponding line number (beginning at 0) or undefined if no such line exists.
	 */
	public getLineForAddress(address: number): number | undefined {
		return this.addrLineMap.get(address);
	}


	/**
	 * Returns the line numbers for given addresses.
	 * @param addresses An array with addresses.
	 * @returns An array with corresponding lines.
	 */
	public getLinesForAddresses(addresses: Set<number>): number[] {
		const lines = new Array<number>();
		const map = this.addrLineMap;
		// Check whichever has lower number of elements
		if (addresses.size > map.size) {
			// Loop over map
			map.forEach((value, key) => {
				if (addresses.has(key))
					lines.push(value);
			});
		}
		else {
			// Loop over addresses
			for (const address of addresses) {
				const line = map.get(address);
				if (line)
					lines.push(line);
			}
		}
		return lines;
	}


	/**
	 * Returns the address for a given line number.
	 * @param lineNr The line number starting at 0.
	 * @returns The address or -1 if none exists for the line.
	 */
	public getAddressForLine(lineNr: number): number {
		if (lineNr >= this.lineAddrArray.length)
			return -1;
		const address = this.lineAddrArray[lineNr];
		if (address == undefined)
			return -1;
		return address;
	}


	/** Fetches the complete 64k memory from the Remote.
	 */
	protected async fetch64kMemory(): Promise<void> {
		// Fetch memory
		const mem = await Remote.readMemoryDump(0, 0x10000);
		this.memory.clearAttributes();
		this.setMemory(0, mem);
	}


	/** Clears the stored call stack addresses and
	 * clears so that on next call to 'setNewAddresses'
	 * new memory is loaded and a new disassembly is done.
	 * Done on a manual refresh.
	 */
	public prepareRefresh() {
		this.callStackAddresses = [];
	}


	/** Invalidates the current disassembly.
	 * This will trigger a new disassembly and a new memory fetch when setNewAddresses is called.
	 */
	public invalidateDisassembly() {
	}


	/** Called when a stack trace request is done. Ie. when a new PC with call stack
	 * is available.
	 * The first call stack address is the current PC.
	 * @param callStackAddresses The call stack.
	 * @returns true if a new disassembly was done.
	 */
	public async setNewAddresses(callStackAddresses: number[]): Promise<boolean> {
		let disasmRequired = false;
		let pcAddr64k;

		// Check if addresses passed
		const len = callStackAddresses.length;
		if (len > 0) {
			// Note: the current PC address is for sure paged in.
			// The other call stack addresses most probably are but there is some chance
			// that they are in a different bank.
			// We need to check if they can be disassembled safely.
			pcAddr64k = callStackAddresses[0] & 0xFFFF;
		}

		// Check if memory at current PC has changed, e.g. because of self modifying code.
		if (pcAddr64k != undefined) {
			// Fetch one byte
			const pcData = await Remote.readMemoryDump(pcAddr64k, 1);
			// Compare
			const prevData = this.memory.getValueAt(pcAddr64k);
			if (pcData[0] != prevData)
				disasmRequired = true;
		}

		// Fetch memory?
		if (disasmRequired) {
			await this.fetch64kMemory();	// Clears also attributes
		}

		// Check current pc
		if (pcAddr64k != undefined) {
			// Check if PC address needs to be added
			const attr = this.memory.getAttributeAt(pcAddr64k);
			if (!(attr & MemAttribute.CODE_FIRST)) {
				// Is an unknown address, add it
				this.pushPcAddress(callStackAddresses[0]);
				disasmRequired = true;
			}
		}

		// Check if call stack addresses need to be added
		for (let i = 1; i < len; i++) {
			const addr64k = callStackAddresses[i];
			const attr = this.memory.getAttributeAt(addr64k);
			if (!(attr & MemAttribute.CODE_FIRST)) {
				// Is an unknown address, add it
				this.callStackAddresses.push(addr64k);
				disasmRequired = true;
			}
		}

		// Now a complex check:
		// If user just breaked manually the PC can be at a position where
		// no disassembly of the previous line(s) exist.
		// This is not so nice as we cannot see where the program flow came
		// from.
		// So we check if the address above the PC is already known to be
		// CODE.
		// If not we get a trace back from the Remote (only zsim) and add
		// that to the addresses that should be disassembled.
		let traceBackAddrs: number[] = [];
		if (pcAddr64k != undefined) {
			const attrPrev = this.memory.getAttributeAt((pcAddr64k-1) & 0xFFFF);
			if (!(attrPrev & MemAttribute.CODE)) {
				// No CODE yet
				traceBackAddrs = await Remote.getTraceBack();	// Long addresses
			}
		}

		// Check if disassembly is required
		if (disasmRequired) {
			const codeAddresses = Labels.getCodeAddresses();
			// Add all addresses
			const allAddrs = [
				...traceBackAddrs,
				...this.pcAddressesHistory,
				...this.callStackAddresses,
				...codeAddresses, // Also add any CODE addresses, given by the user from the rev-eng.list file
			];
			// Convert to 64k addresses
			const addrs64k = allAddrs;

			// Get all skip addresses and convert to 64k
			const skipAddresses = Labels.getSkipAddresses();
			this.skipAddrs64k = skipAddresses;

			// Collect all address labels and convert to 64k
			const labels = this.get64kLabels();
			// Disassemble
			this.getFlowGraph(addrs64k, labels);
			this.disassembleNodes();

			// Convert to start nodes
			const startNodes = this.getNodesForAddresses(addrs64k);
			// Get max depth
			const {depth, } = this.getSubroutinesFor(startNodes);	// Only depth is required at this point.

			// Clear line arrays
			this.lineAddrArray = [];
			this.addrLineMap.clear();
			// Render text
			const renderer = new RenderText(this,
				(addr64k: number) => {
					// Check if entry already exists (is filtered in this case
					const entry = Labels.getSourceFileEntryForAddress(addr64k);
					let render: RenderHint = RenderHint.RENDER_EVERYTHING;
					if (entry) {
						render = (entry.size) ? RenderHint.RENDER_NOTHING : RenderHint.RENDER_DATA_AND_DISASSEMBLY;
					}

					// Returns:
					// RENDER_EVERYTHING = Render label, data and disassembly
					// RENDER_DATA_AND_DISASSEMBLY = Render no label
					// RENDER_NOTHING = Do not render the current line at all
					return render;
				},
				(lineNr: number, addr64k: number, bytesCount: number) => {
					// Add to arrays
					while (this.lineAddrArray.length <= lineNr)
						this.lineAddrArray.push(addr64k);
					// Add all bytes
					this.addrLineMap.set(addr64k, lineNr);
					for (let i = 1; i < bytesCount; i++) {
						addr64k++;
						if (addr64k > 0xFFFF)
							break;	// Overflow from 0xFFFF
						this.addrLineMap.set(addr64k, lineNr);
					}
				});
			this.disassemblyText = renderer.renderSync(startNodes, depth);
		}

		return disasmRequired;
	}
}


// Used for the singleton.
export let Disassembly: DisassemblyClass;
