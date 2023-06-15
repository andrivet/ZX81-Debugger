/**
 * ZX81 Debugger
 * 
 * File:			simulatedmemory.ts
 * Description:		Represents the simulated memory.
 * Author:			Sebastien Andrivet, based on Dezog my Thomas Busse (Maziac)
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 * 					DeZog Copyright (C) 2023 Maziac
 */
import {MemBuffer, Serializable} from '../../misc/membuffer';
import {Utility} from '../../misc/utility';
import * as fs from "fs";

/**
 * Watchpoint class used by 'watchPointMemory'.
 */
interface SimWatchpoint {
	// read/write are counters. They are reference counts and count how many
	// read/write access points have been set. If 0 then no watchpoint is set.
	read: number;
	write: number;
}

/**
 * Represents the simulated memory.
 * It is a base class to allow memory paging etc.
 */
export class SimulatedMemory implements Serializable {
	// Function used to add an error to the diagnostics.
	public static addDiagnosticsErrorFunc: ((message: string, severity: 'error' | 'warning', filepath: string, line: number, column: number) => void) | undefined;

	// The memory
	protected memory: Uint8Array;

	// Flag that is set if a watchpoint was hot.
	// Has to be reset manually before the next turn.
	public watchpointHit: boolean;

	// If watchpointHit was set the address where the hit occurred.
	// -1 if no hit.
	public hitAddress: number;

	// The kind of access, 'r'ead or 'w'rite.
	public hitAccess: string;

	// An array of 0-0xFFFF entries, one for each address.
	// If an address has no watchpoint it is undefined.
	// If it has it points to a SimWatchpoint.
	// Note: as watchpoints are areas, several addresses might share the same SimWatchpoint.
	protected watchPointMemory: Array<SimWatchpoint>;

	/**
	 * Constructor.
	 */
	constructor() {
		this.memory = new Uint8Array(64 * 1024);
		const romData = this.readRomFile(Utility.getExtensionPath() + '/data/zx81.rom');
		if(romData) this.memory.set(romData);

		// Breakpoints
		this.clearHit();
		// Create watchpoint area
		this.watchPointMemory = Array.from({length: 0x10000}, () => ({read: 0, write: 0}));
	}


	/**
	 * Clears the whole memory (all banks) with 0s.
	 * So far only used by unit tests.
	 */
	public clear() {
		this.memory.fill(0);
	}


	/**
	 * Returns the size the serialized object would consume.
	 */
	public getSerializedSize(): number {
		// Create a MemBuffer to calculate the size.
		const memBuffer = new MemBuffer();
		// Serialize object to obtain size
		this.serialize(memBuffer);
		// Get size
		const size = memBuffer.getSize();
		return size;
	}


	/**
	 * Serializes the object.
	 */
	public serialize(memBuffer: MemBuffer) {
		memBuffer.writeArrayBuffer(this.memory);
	}


	/**
	 * Deserializes the object.
	 */
	public deserialize(memBuffer: MemBuffer) {
		this.memory.set(memBuffer.readArrayBuffer());
	}


	/**
	 * Adds a watchpoint address range.
	 * @param address The watchpoint long address.
	 * @param size The size of the watchpoint. address+size-1 is the last address for the watchpoint.
	 * @param access 'r', 'w' or 'rw'.
	 */
	public setWatchpoint(address: number, size: number, access: string) {
		const readAdd = access.includes('r') ? 1 : 0;
		const writeAdd = access.includes('w') ? 1 : 0;
		// Set area
		for (let i = 0; i < size; i++) {
			const wp = this.watchPointMemory[address & 0xFFFF];
			wp.read += readAdd;
			wp.write += writeAdd;
			address++;
		}
	}


	/**
	 * Removes a watchpoint address range.
	 * @param address The watchpoint long address.
	 * @param size The size of the watchpoint. address+size-1 is the last address for the watchpoint.
	 * @param access 'r', 'w' or 'rw'.
	 */
	public removeWatchpoint(address: number, size: number, access: string) {
		const readAdd = access.includes('r') ? 1 : 0;
		const writeAdd = access.includes('w') ? 1 : 0;
		// remove area
		for (let i = 0; i < size; i++) {
			const wp = this.watchPointMemory[address & 0xFFFF];
			if (wp.read > 0)
				wp.read -= readAdd;
			if (wp.write > 0)
				wp.write -= writeAdd;
			address++;
		}
	}


	/**
	 * Clears the hit flag and the arrays.
	 */
	public clearHit() {
		this.hitAddress = -1;
		this.hitAccess = '';
	}


	// Read 1 byte.
	// This is used by the Z80 CPU.
	// Note: no special check is done reading UNUSED memory. As this cannot be
	// written a read will always return the default value (0).
	public read8(addr64k: number): number {
		// Check for watchpoint access
		const wp = this.watchPointMemory[addr64k];
		if (wp) {
			// Check access
			if ((this.hitAddress < 0) && wp.read > 0) {
				// Read access
				this.hitAddress = addr64k;
				this.hitAccess = 'r';
			}
		}

		// Read
		return this.memory[addr64k];
	}

	// Write 1 byte.
	// This is used by the Z80 CPU.
	public write8(addr64k: number, val: number) {
		// Check for watchpoint access
		const wp = this.watchPointMemory[addr64k];
		if (wp) {
			// Check access
			if ((this.hitAddress < 0) && wp.write > 0) {
				// Write access
				this.hitAddress = addr64k;
				this.hitAccess = 'w';
			}
		}

		// Don't write if non-writable, e.g. ROM
		if(addr64k >= 0x2000)
			this.memory[addr64k] = val;
	}

	// Reads a value from the memory. Value can span over several bytes.
	// This is **not** used by the Z80 CPU.
	// Used to read the WORD at SP or to read a 4 byte opcode.
	// @param addr64k The 64k start address
	// @param size The length of the value in bytes.
	// @returns The value (little endian)
	public getMemoryValue(addr64k: number, size: number): number {
		let value = 0;
		let shift = 1;

		for (let i = size; i > 0; i--) {
			// Read
			const val8 = this.memory[addr64k];
			// Store
			value += val8 * shift;
			// Next
			addr64k = (addr64k + 1) & 0xFFFF;
			shift *= 256;
		}

		return value;
	}


	// Reads 2 bytes.
	// This is **not** used by the Z80 CPU.
	// Used to read the WORD at SP.
	public getMemory16(addr64k: number): number {
		return this.getMemoryValue(addr64k, 2);
	}

	// Reads 4 bytes.
	// This is **not** used by the Z80 CPU.
	// Used to read an opcode which is max. 4 bytes.
	public getMemory32(addr64k: number): number {
		return this.getMemoryValue(addr64k, 4);
	}


	/**
	 * Write to memoryData directly into memory.
	 * Is e.g. used during .P file loading.
	 * @param data The data to write.
	 * @param dataOffset Offset into the data buffer.
	 * @param size The number of bytes to write.
	 */
	public writeMemoryData(data: Uint8Array, dataOffset: number, size: number) {
		// Write
		this.memory.set(data.slice(dataOffset, dataOffset + size));
	}

	/**
	 * Reads a block of bytes.
	 * @param startAddr64k The 64k start address
	 * @param size The length of the data in bytes.
	 * @returns The data as Uint8Array (a new array is returned.)
	 */
	public readBlock(startAddr64k: number, size: number): Uint8Array {
		const data = new Uint8Array(size);
		data.set(this.memory.slice(startAddr64k, startAddr64k + size));
		return data;
	}


	/**
	 * Writes a block of bytes.
	 * @param startAddress The 64k start address.
	 * @param data The block to write.
	 */
	public writeBlock(startAddr64k: number, data: Buffer | Uint8Array) {
		if (!(data instanceof Uint8Array))
			data = new Uint8Array(data);
		
		this.memory.set(data, startAddr64k);
	}

	/**
	 * Reads a ROM file.
	 * @param filePath Absolute path to raw data file.
	 * @returns An Uint8Array with the data.
	 */
	protected readRomFile(filePath: string): Uint8Array | null {
		if(!fs.statSync(filePath, {throwIfNoEntry: false})) return null;
		const romBuffer = fs.readFileSync(filePath);
		return new Uint8Array(romBuffer.buffer);
	}
}
