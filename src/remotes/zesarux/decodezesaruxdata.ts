import {DecodeRegisterData, RegisterData} from '../decoderegisterdata';
import {Utility} from '../../misc/utility';



/**
 * The specific handling of Z80 registers in ZEsarUX format.
 * The routines work completely on the cached register string received from ZEsarUX.
 * The cache is set and cleared only from outside this class while e.g. stepping or
 * reverse debugging.
 * This class does not communicate with the zesarux socket on its own.
 */
export class DecodeZesaruxRegisters extends DecodeRegisterData {

	/**
	 * A Line from ZEsarUX, e.g.
	 * "PC=812c SP=8418 AF=03ff BC=02ff HL=99a2 DE=ffff IX=ffff IY=5c3a AF'=0044 BC'=174b HL'=107f DE'=0006 I=00 R=2c  F=SZ5H3PNC F'=-Z---P-- MEMPTR=0000 IM0 IFF-- VPS: 0 "
	 *
	 * A line from history:
	 * PC=0038 SP=ff46 AF=005c BC=ffff HL=10a8 DE=5cb9 IX=ffff IY=5c3a AF'=0044 BC'=174b HL'=107f DE'=0006 I=3f R=5b IM1 IFF-- (PC)=f5e52a78 (SP)=10b4 MMU=80008001000a000b0004006400000001
	 *
	 * Note: The MMU info is added to the "normal" zesarux line by DeZog,
	 * e.g.:
	 * "PC=812c SP=8418 AF=03ff BC=02ff HL=99a2 DE=ffff IX=ffff IY=5c3a AF'=0044 BC'=174b HL'=107f DE'=0006 I=00 R=2c  F=SZ5H3PNC F'=-Z---P-- MEMPTR=0000 IM0 IFF-- VPS: 0 MMU=80008001000a000b0004006400000001"
	 * please note that both lines have a different offset.
	 */


	// Indices for first time search.
	protected pcIndex: number;
	protected spIndex: number;
	protected afIndex: number;
	protected bcIndex: number;
	protected hlIndex: number;
	protected deIndex: number;
	protected ixIndex: number;
	protected iyIndex: number;
	protected af2Index: number;
	protected bc2Index: number;
	protected hl2Index: number;
	protected de2Index: number;
	protected iIndex: number;
	protected rIndex: number;
	protected imIndex: number;

	// Number of slots used for the 64k. 64k/slots is the used bank size.
	protected countSlots: number;


	/**
	 * Constructor.
	 * Called during the launchRequest.
	 * @param countSlots Number of slots used for the 64k.
	 */
	constructor(countSlots: number) {
		super();
		Utility.assert(countSlots);	// 0 is not allowed

		this.countSlots = countSlots;
		// Indices for first time search.
		this.pcIndex = -1;
		this.spIndex = -1;
		this.afIndex = -1;
		this.bcIndex = -1;
		this.deIndex = -1;
		this.hlIndex = -1;
		this.ixIndex = -1;
		this.iyIndex = -1;
		this.af2Index = -1;
		this.bc2Index = -1;
		this.hl2Index = -1;
		this.de2Index = -1;
		this.iIndex = -1;
		this.rIndex = -1;
		this.imIndex = -1;
	}


	/**
	 * Parses the zesarux register output for PC etc.
	 * @param data The output from zesarux.
	 * @returns The value.
	 */
	public parsePC(data: RegisterData): number {
		// Is 2-3 times faster than a regex
		if (this.pcIndex < 0) {
			this.pcIndex = data.indexOf('PC=');
			Utility.assert(this.pcIndex >= 0);
			this.pcIndex += 3;
		}
		const res = parseInt(data.substring(this.pcIndex, this.pcIndex + 4), 16);
		return res;
	}

	public parseSP(data: RegisterData): number {
		if (this.spIndex < 0) {
			this.spIndex = data.indexOf('SP=');
			Utility.assert(this.spIndex >= 0);
			this.spIndex += 3;
		}
		const res = parseInt(data.substring(this.spIndex, this.spIndex + 4), 16);
		return res;
	}

	public parseAF(data: RegisterData): number {
		if (this.afIndex < 0) {
			this.afIndex = data.indexOf('AF=');
			Utility.assert(this.afIndex >= 0);
			this.afIndex += 3;
		}
		const res = parseInt(data.substring(this.afIndex, this.afIndex + 4), 16);
		return res;
	}

	public parseBC(data: RegisterData): number {
		if (this.bcIndex < 0) {
			this.bcIndex = data.indexOf('BC=');
			Utility.assert(this.bcIndex >= 0);
			this.bcIndex += 3;
		}
		const res = parseInt(data.substring(this.bcIndex, this.bcIndex + 4), 16);
		return res;
	}

	public parseHL(data: RegisterData): number {
		if (this.hlIndex < 0) {
			this.hlIndex = data.indexOf('HL=');
			Utility.assert(this.hlIndex >= 0);
			this.hlIndex += 3;
		}
		const res = parseInt(data.substring(this.hlIndex, this.hlIndex + 4), 16);
		return res;
	}

	public parseDE(data: RegisterData): number {
		if (this.deIndex < 0) {
			this.deIndex = data.indexOf('DE=');
			Utility.assert(this.deIndex >= 0);
			this.deIndex += 3;
		}
		const res = parseInt(data.substring(this.deIndex, this.deIndex + 4), 16);
		return res;
	}

	public parseIX(data: RegisterData): number {
		if (this.ixIndex < 0) {
			this.ixIndex = data.indexOf('IX=');
			Utility.assert(this.ixIndex >= 0);
			this.ixIndex += 3;
		}
		const res = parseInt(data.substring(this.ixIndex, this.ixIndex + 4), 16);
		return res;
	}

	public parseIY(data: RegisterData): number {
		if (this.iyIndex < 0) {
			this.iyIndex = data.indexOf('IY=');
			Utility.assert(this.iyIndex >= 0);
			this.iyIndex += 3;
		}
		const res = parseInt(data.substring(this.iyIndex, this.iyIndex + 4), 16);
		return res;
	}

	public parseAF2(data: RegisterData): number {
		if (this.af2Index < 0) {
			this.af2Index = data.indexOf("AF'=");
			Utility.assert(this.af2Index >= 0);
			this.af2Index += 4;
		}
		const res = parseInt(data.substring(this.af2Index, this.af2Index + 4), 16);
		return res;
	}

	public parseBC2(data: RegisterData): number {
		if (this.bc2Index < 0) {
			this.bc2Index = data.indexOf("BC'=");
			Utility.assert(this.bc2Index >= 0);
			this.bc2Index += 4;
		}
		const res = parseInt(data.substring(this.bc2Index, this.bc2Index + 4), 16);
		return res;
	}

	public parseHL2(data: RegisterData): number {
		if (this.hl2Index < 0) {
			this.hl2Index = data.indexOf("HL'=");
			Utility.assert(this.hl2Index >= 0);
			this.hl2Index += 4;
		}
		const res = parseInt(data.substring(this.hl2Index, this.hl2Index + 4), 16);
		return res;
	}

	public parseDE2(data: RegisterData): number {
		if (this.de2Index < 0) {
			this.de2Index = data.indexOf("DE'=");
			Utility.assert(this.de2Index >= 0);
			this.de2Index += 4;
		}
		const res = parseInt(data.substring(this.de2Index, this.de2Index + 4), 16);
		return res;
	}

	public parseI(data: RegisterData): number {
		if (this.iIndex < 0) {
			this.iIndex = data.indexOf('I=');
			Utility.assert(this.iIndex >= 0);
			this.iIndex += 2;
		}
		const res = parseInt(data.substring(this.iIndex, this.iIndex + 2), 16);
		return res;
	}

	public parseR(data: string): number {
		if (this.rIndex < 0) {
			this.rIndex = data.indexOf('R=');
			Utility.assert(this.rIndex >= 0);
			this.rIndex += 2;
		}
		const res = parseInt(data.substring(this.rIndex, this.rIndex + 2), 16);
		return res;
	}

	public parseIM(data: string): number {
		if (this.imIndex < 0) {
			this.imIndex = data.indexOf('IM');
			Utility.assert(this.imIndex >= 0);
			this.imIndex += 2;
		}
		const char = data.codePointAt(this.imIndex) as number;
		const res: number = char - 48;
		return res;
	}

	// Override this function.
	// Decode ZEsarUX MMU info:
	// Bit 15 stands for ROM.
	// I.e. $8000 and $8001 are ROM.
	public parseSlots(data: string): number[] {
		return [0];	// Correspondents to MemoryModelUnknown
	}
}


// Decoder for the Zx48K.
export class DecodeZesaruxRegistersZx48k extends DecodeZesaruxRegisters {
	constructor() {
		super(2);	// 2 slots: ROM, RAM
	}

	public parseSlots(data: string): number[] {
		// For ZX16K and ZX48K the slots are always fixed.
		// Zesarux returns this fixed set:
		// Only the first 4 slots are valid.
		// ZX48K:  "MMU=8001 0005 0002 0000 0004 0005 0000 0001"
		// ZX16K:  "MMU=8001 0005 0002 0000 0004 0005 0000 0001"
		// But because it is fixed, it can be ignored.
		return [0, 1];
	}
}


// Decoder for the Zx16K.
export class DecodeZesaruxRegistersZx16k extends DecodeZesaruxRegisters {
	constructor() {
		super(3);	// 3 slots: ROM, RAM, UNASSIGNED
	}

	public parseSlots(data: string): number[] {
		// For ZX16K and ZX48K the slots are always fixed.
		// Zesarux returns this fixed set:
		// Only the first 4 slots are valid.
		// ZX48K:  "MMU=8001 0005 0002 0000 0004 0005 0000 0001"
		// ZX16K:  "MMU=8001 0005 0002 0000 0004 0005 0000 0001"
		// But because it is fixed, it can be ignored.
		return [0, 1, 2];
	}
}
