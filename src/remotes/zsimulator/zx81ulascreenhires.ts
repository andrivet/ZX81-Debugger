
import {MemBuffer} from "../../misc/membuffer";
import {Z80Cpu} from "./z80cpu";
import {Zx81UlaScreen} from "./zx81ulascreen";


/** Handles the ZX81 ULA screen.
 * Is derived from the Zx81UlaScreen which simulates the dfile.
 * The Zx81UlaScreenHiRes simulates/emulates the ZX81 ULA more correctly.
 * I.e. it generates the graphics from the data on the CPU bus.
 * Therefore it is capable of High Resolution graphics.
 * Drawback is that for development/debugging changes to the display/dfile
 * are not immediately visible, i.e. not before the vsync.
 *
 * There are 4 basic steps in generation of a screen display:
 * 1.  VSYNC, frame count and keyboard - NMI off
 * 2.  Blank lines/application code    - NMI on
 * 3.  VIDEO DISPLAY routine           - NMI off
 * 4.  Blank lines/application code    - NMI on
 */
export class Zx81UlaScreenHiRes extends Zx81UlaScreen {
	// Holds the data for the screen, i.e. the generated screen.
	// The format is simple: upto 192 lines. Each line begins with a length byte.
	// Followed byte the pixel data (bits of the byte) for the line.
	protected screenData: Uint8Array;

	// The write index into the screen
	protected screenDataIndex: number;

	// The write index pointing to tje line length
	protected screenLineLengthIndex: number;


	/** Constructor.
	 * @param z80Cpu Mainly for the memoryModel and the ports.
	 */
	constructor(z80Cpu: Z80Cpu) {
		super(z80Cpu);
		this.screenDataIndex = 0;
		this.screenLineLengthIndex = 0;
		this.screenData = new Uint8Array(256 * (1 + Zx81UlaScreenHiRes.SCREEN_WIDTH / 8));	// 256: in case more scan lines would be used. TODO: recalculate and limit while writing
	}


	/** Resets the buffer indices */
	protected resetVideoBuffer() {
		this.screenLineLengthIndex = 0;
		this.screenDataIndex = 0;
	}


	/** Intercepts reading from the memory.
	 * For everything where A15 is set and data bit 6 is low, NOPs are returned.
	 * When data bit 6 is set it is expected to be the HALT instruction.
	 */
	protected ulaM1Read8(addr64k: number): number {
		// Read data from memory
		const data = this.memoryRead8(addr64k & 0x7FFF);

		// Check if it is character data
		if (addr64k & 0x8000) {
			// Check if bit 6 is low
			if ((data & 0b01000000) !== 0)
				return data;	// E.g. HALT

			// Interpret data
			const ulaAddrLatch = data & 0b0011_1111;	// 6 bits
			const i = this.z80Cpu.i;
			const ulaAddr = (i & 0xFE) * 256 + ulaAddrLatch * 8 + (this.lineCounter & 0x07);
			// Load byte from character (ROM)
			let videoShiftRegister = this.memoryRead8(ulaAddr);
			// Check to invert the byte
			if (data & 0b1000_0000) {
				videoShiftRegister ^= 0xFF;
			}
			// Add byte to screen
			this.screenData[this.screenDataIndex++] = videoShiftRegister;
			// Increase length
			this.screenData[this.screenLineLengthIndex]++;
			// Return a NOP for the graphics data
			return 0x00;
		}

		// Otherwise return the normal value
		return data;
	}


	/** Returns the screen data.
	 * @returns The screen as a UInt8Array.
	 * Returns only the portion that is written.
	 * At the start this could be undefined.
	 */
	public getUlaScreen(): Uint8Array {
		if (this.noDisplay)
			return Uint8Array.from([]);
		return this.screenData?.slice(0, this.screenDataIndex);
	}


	/** Generate a HSYNC.
	 * Switch to next line in the screen buffer.
	 */
	protected checkHsync(addTstates: number): boolean {
		const lineCounterIncemented = super.checkHsync(addTstates);
		if (lineCounterIncemented) {
			// Next line (graphics output)
			this.screenLineLengthIndex = this.screenDataIndex;
			this.screenData[this.screenLineLengthIndex] = 0;
			this.screenDataIndex++;
		}
		return lineCounterIncemented;
	}


	/** Serializes the object.
	 */
	public serialize(memBuffer: MemBuffer) {
		super.serialize(memBuffer);
		// Write additional data
		memBuffer.writeNumber(this.screenDataIndex);
		memBuffer.writeNumber(this.screenLineLengthIndex);
		memBuffer.writeArrayBuffer(this.screenData);
	}


	/** Deserializes the object.
	 */
	public deserialize(memBuffer: MemBuffer) {
		super.deserialize(memBuffer);
		// Read additional data
		this.screenDataIndex = memBuffer.readNumber();
		this.screenLineLengthIndex = memBuffer.readNumber();
		this.screenData = memBuffer.readArrayBuffer();
	}
}
