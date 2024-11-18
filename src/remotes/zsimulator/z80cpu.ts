import {Z80Ports} from './z80ports';
import {Z80RegistersClass} from '../z80registers';
import {MemBuffer, Serializable} from '../../misc/membuffer'
import {ZSimType} from '../../settings/settings';
import * as Z80 from '../../3rdparty/z80.js/Z80.js';
import {SimulatedMemory} from './simulatedmemory';
import {ExecuteInterface} from './executeinterface';
import {ZSimRemote} from './zsimremote';



export class Z80Cpu implements Serializable, ExecuteInterface {
	// Pointer to the Z80.js (Z80.ts) simulator
	protected z80: any;

	// Time until next interrupt.
	protected remainingInterruptTstates: number;

	// Time for interrupt in T-States
	protected INTERRUPT_TIME_AS_T_STATES: number;

	// Use for cpu load calculation:
	// The number of passed t-states of the CPU.
	// Includes HALT.
	protected passedTstates: number;
	// The t-states when the last interrupt occurred.
	protected prevTstatesOnInterrupt: number;
	// The t-states for all HALTs are accumulated until next interrupt.
	protected haltTstates: number;
	// The cpu load calculated by 1.0 - haltTstates/(intTstates-prevTstatesOnInterrupt)
	public cpuLoad: number;
	// The number of interrupts to calculate the average from.
	protected cpuLoadRange: number;
	// Counts the current number of interrupts.
	protected cpuLoadRangeCounter: number;

	// The number of extra t-states per instruction.
	public extraTstatesPerInstruction: number;

	// At the moment just a constant. CPU frequency.
	public cpuFreq: number;

	// Memory
	public memory: SimulatedMemory;

	// Ports
	public ports: Z80Ports;

	// The previous HALT state.
	protected prevHalted: boolean;

	// Used to indicate an error in peripherals, i.e. an error in the custom javascript code.
	// Will make the program break.
	// undefined = no error
	public error: string | undefined;



	/** Constructor.
	 * @param memory The Z80 memory.
	 * @param ports The Z80 ports.
	 */
	constructor(memory: SimulatedMemory, ports: Z80Ports, zsim: ZSimType) {
		this.error = undefined;
		this.memory = memory;
		this.ports = ports;
		this.cpuFreq = zsim.cpuFrequency;	// e.g. 3500000.0 for 3.5MHz.
		this.INTERRUPT_TIME_AS_T_STATES = 0.02 * this.cpuFreq;  // 20ms * 3.5 MHz
		this.remainingInterruptTstates = this.INTERRUPT_TIME_AS_T_STATES;
		/*
		IM 0: Executes an instruction that is placed on the data bus by a peripheral.
		IM 1: Jumps to address &0038
		IM 2: Uses an interrupt vector table, indexed by value on data bus.
		*/
		this.extraTstatesPerInstruction = 0;
		this.haltTstates = 0;
		this.passedTstates = 0;
		this.prevTstatesOnInterrupt = 0;
		this.cpuLoad = 1.0;	// Start with full load
		this.cpuLoadRangeCounter = 0;
		this.cpuLoadRange = zsim.cpuLoad;
		this.prevHalted = false;

		// Initialize Z80, call constructor
		this.z80 = new (Z80.Z80 as any)({
			m1_mem_read: address => memory.m1Read8(address),
			mem_read: address => memory.read8(address),
			mem_write: (address, val) => memory.write8(address, val),
			io_read: address => {
				try {
					return ports.read(address);
				}
				catch (e) {
					this.error = "io_read: " + e.message;
					return 0;
				}
			},
			io_write: (address, val) => {
				try {
					ports.write(address, val);
				}
				catch (e) {
					this.error = "io_write: " + e.message;
				}
			},
			z80n_enabled: false
		});
	}


	/** Executes one instruction.
	 * @Uses The number of t-states used for execution.
	 */
	public execute(zsim: ZSimRemote) {
		// Check if another component already occupied tstates
		if (zsim.executeTstates !== 0)
			return;

		// Handle instruction
		const z80 = this.z80;
		const tStates = z80.run_instruction() + this.extraTstatesPerInstruction;
		this.passedTstates += tStates;

		// For CPU load calculation
		if (z80.halted) {
			if (this.prevHalted !== z80.halted) {
				// Calc cpu-load
				this.calculateLoad();
			}
			// Count HALT instructions
			this.haltTstates += tStates;
		}
		this.prevHalted = z80.halted;

		zsim.executeTstates = tStates;
	}


	/** Properties.
	 */
	set pc(value) {
		this.z80.pc = value;
	}
	get pc() {return this.z80.pc;}
	set sp(value) {this.z80.sp = value;}
	get sp() {return this.z80.sp;}
	get i() {return this.z80.i;}
	get de() {return 256 * this.z80.d +this.z80.e;}

	set af(value) {
		const r = this.z80.getState();
		r.a = value >>> 8;
		r.flags = this.revConvertFlags(value & 0xFF);
		this.z80.setState(r);
	}
	set bc(value) {
		const r = this.z80.getState();
		r.b = value >>> 8;
		r.c = value & 0xFF;
		this.z80.setState(r);
	}
	set de(value) {
		const r = this.z80.getState();
		r.d = value >>> 8;
		r.e = value & 0xFF;
		this.z80.setState(r);
	}
	set hl(value) {
		const r = this.z80.getState();
		r.h = value >>> 8;
		r.l = value & 0xFF;
		this.z80.setState(r);
	}

	set ix(value) {
		const r = this.z80.getState();
		r.ix = value;
		this.z80.setState(r);
	}
	set iy(value) {
		const r = this.z80.getState();
		r.iy = value;
		this.z80.setState(r);
	}


	set af2(value) {
		const r = this.z80.getState();
		r.a_prime = value >>> 8;
		r.flags_prime = this.revConvertFlags(value & 0xFF);
		this.z80.setState(r);
	}
	set bc2(value) {
		const r = this.z80.getState();
		r.b_prime = value >>> 8;
		r.c_prime = value & 0xFF;
		this.z80.setState(r);
	}
	set de2(value) {
		const r = this.z80.getState();
		r.d_prime = value >>> 8;
		r.e_prime = value & 0xFF;
		this.z80.setState(r);
	}
	set hl2(value) {
		const r = this.z80.getState();
		r.h_prime = value >>> 8;
		r.l_prime = value & 0xFF;
		this.z80.setState(r);
	}

	set im(value) {
		const r = this.z80.getState();
		r.imode = value;
		this.z80.setState(r);
	}
	set iff1(value) {
		const r = this.z80.getState();
		r.iff1 = value;
		this.z80.setState(r);
	}
	set iff2(value) {
		const r = this.z80.getState();
		r.iff2 = value;
		this.z80.setState(r);
	}
	set r(value) {
		const r = this.z80.getState();
		r.r = value;
		this.z80.setState(r);
	}
	//get r() {return this.z80.getState().r;}
	get r() {
		return this.z80.r;
	}

	set i(value) {
		const r = this.z80.getState();
		r.i = value;
		this.z80.setState(r);
	}

	set a(value) {
		const r = this.z80.getState();
		r.a = value;
		this.z80.setState(r);
	}
	set f(value) {
		const r = this.z80.getState();
		r.f = this.revConvertFlags(value);
		this.z80.setState(r);
	}
	set b(value) {
		const r = this.z80.getState();
		r.b = value;
		this.z80.setState(r);
	}
	set c(value) {
		const r = this.z80.getState();
		r.c = value;
		this.z80.setState(r);
	}
	set d(value) {
		const r = this.z80.getState();
		r.d = value;
		this.z80.setState(r);
	}
	set e(value) {
		const r = this.z80.getState();
		r.e = value;
		this.z80.setState(r);
	}
	set h(value) {
		const r = this.z80.getState();
		r.h = value;
		this.z80.setState(r);
	}
	set l(value) {
		const r = this.z80.getState();
		r.l = value;
		this.z80.setState(r);
	}
	set ixl(value) {
		const r = this.z80.getState();
		r.ix = (r.ix & 0xFF00) + value;
		this.z80.setState(r);
	}
	set ixh(value) {
		const r = this.z80.getState();
		r.ix = (r.ix & 0xFF) + 256 * value;
		this.z80.setState(r);
	}
	set iyl(value) {
		const r = this.z80.getState();
		r.iy = (r.iy & 0xFF00) + value;
		this.z80.setState(r);
	}
	set iyh(value) {
		const r = this.z80.getState();
		r.iy = (r.iy & 0xFF) + 256 * value;
		this.z80.setState(r);
	}

	set a2(value) {
		const r = this.z80.getState();
		r.a_prime = value;
		this.z80.setState(r);
	}
	set f2(value) {
		const r = this.z80.getState();
		r.f_prime = this.revConvertFlags(value);
		this.z80.setState(r);
	}
	set b2(value) {
		const r = this.z80.getState();
		r.b_prime = value;
		this.z80.setState(r);
	}
	set c2(value) {
		const r = this.z80.getState();
		r.c_prime = value;
		this.z80.setState(r);
	}
	set d2(value) {
		const r = this.z80.getState();
		r.d = value;
		this.z80.setState(r);
	}
	set e2(value) {
		const r = this.z80.getState();
		r.e_prime = value;
		this.z80.setState(r);
	}
	set h2(value) {
		const r = this.z80.getState();
		r.h_prime = value;
		this.z80.setState(r);
	}
	set l2(value) {
		const r = this.z80.getState();
		r.l_prime = value;
		this.z80.setState(r);
	}

	get isHalted() {
		return this.z80.halted;
	}

	// T. Busse, Sep-2022: Added to break on an interrupt.
	set interruptOccurred(value) {this.z80.interruptOccurred = value;}
	get interruptOccurred() {return this.z80.interruptOccurred;}


	/** Forward interrupt generation.
	 * @param non_maskable - true if this is a non - maskable interrupt.
	 * @param data - the value to be placed on the data bus, if needed.
	 */
	public interrupt(non_maskable: boolean, data: number) {
		this.z80.interrupt(non_maskable, data);
	}


	/** Calculates the CPU load from the processed HALT instructions compared
	 * to all instructions.
	 * Called on a HALT.
	 */
	public calculateLoad() {
		// Measure CPU load
		if (this.cpuLoadRange > 0) {
			this.cpuLoadRangeCounter++;
			if (this.cpuLoadRangeCounter >= this.cpuLoadRange) {
				const intTstatesDiff = this.passedTstates - this.prevTstatesOnInterrupt;
				this.cpuLoad = (intTstatesDiff === 0) ? 0 : (1 - this.haltTstates / intTstatesDiff);
				// Next
				this.haltTstates = 0;
				this.prevTstatesOnInterrupt = this.passedTstates;
				this.cpuLoadRangeCounter = 0;
			}
		}
	}


	/** Changes the cpu frequency, e.g. called when the tbblue REG_TURBO_MODE
	 * is set.
	 * Also corrects the remainingInterruptTstates.
	 * @param cpuFrequency The used CPU frequency, e.g. 3500000 Hz.
	*/
	public setCpuFreq(cpuFrequency: number) {
		this.INTERRUPT_TIME_AS_T_STATES = 0.02 * cpuFrequency;  // 20ms * 3.5 Mhz
		const remainingTime = this.remainingInterruptTstates / this.cpuFreq;
		this.remainingInterruptTstates = remainingTime * cpuFrequency;
		this.cpuFreq = cpuFrequency;
	}


	/** Sets the number of extra t-states per instruction.
	 * Is used for ZX Next and 28Mhz where 1 extra cycle needs to be added.
	 * @param extraTstates 0...N. Normally 0 or 1.
	*/
	public setExtraTstatesPerInstruction(extraTstates: number) {
		this.extraTstatesPerInstruction = extraTstates;
	}


	/** Converts the Z80 flags object into a number.
	 */
	protected convertFlags(flags: {
		S: number,
		Z: number,
		Y: number,
		H: number,
		X: number,
		P: number,
		N: number,
		C: number
	}): number {
		const f = 128 * flags.S + 64 * flags.Z + 32 * flags.Y + 16 * flags.H + 8 * flags.X + 4 * flags.P + 2 * flags.N + flags.C;
		return f;
	}


	/** Returns all registers.
	 */
	protected getAllRegisters(): {
		pc: number,
		sp: number,
		af: number,
		bc: number,
		de: number,
		hl: number,
		ix: number,
		iy: number,
		af2: number,
		bc2: number,
		de2: number,
		hl2: number,
		i: number,
		r: number,
		im: number,
		iff1: number,
		iff2: number,
	} {
		const r = this.z80.getState();
		const flags = this.convertFlags(r.flags);
		const flags2 = this.convertFlags(r.flags_prime);
		const regs = {
			pc: r.pc,
			sp: r.sp,
			af: r.a * 256 + flags,
			bc: r.b * 256 + r.c,
			de: r.d * 256 + r.e,
			hl: r.h * 256 + r.l,
			ix: r.ix,
			iy: r.iy,
			af2: r.a_prime * 256 + flags2,
			bc2: r.b_prime * 256 + r.c_prime,
			de2: r.d_prime * 256 + r.e_prime,
			hl2: r.h_prime * 256 + r.l_prime,
			i: r.i,
			r: r.r,
			im: r.imode,
			iff1: r.iff1,
			iff2: r.iff2
		};
		return regs;
	}


	/** Returns the register data in the Z80Registers format.
	 */
	public getRegisterData(): Uint16Array {
		const r = this.getAllRegisters();
		// Convert regs
		const slots = this.memory.getSlots() || [];
		const regData = Z80RegistersClass.getRegisterData(
			r.pc, r.sp,
			r.af, r.bc, r.de, r.hl,
			r.ix, r.iy,
			r.af2, r.bc2, r.de2, r.hl2,
			r.i, r.r, r.im,
			slots
		);
		return regData;
	}


	/** Returns the register, opcode and sp contents data,
	 */
	public getHistoryData(): Uint16Array {
		// Get registers
		const regData = this.getRegisterData();
		// Add opcode and sp contents
		const startHist = regData.length;
		const histData = new Uint16Array(startHist + 3);
		// Copy registers
		histData.set(regData);
		// Store opcode (4 bytes)
		const z80 = this.z80;
		const pc = z80.pc;
		const opcodes = this.memory.getMemory32(pc);
		histData[startHist] = opcodes & 0xFFFF;
		histData[startHist + 1] = opcodes >>> 16;
		// Store sp contents (2 bytes)
		const sp = z80.sp;
		const spContents = this.memory.getMemory16(sp);
		histData[startHist + 2] = spContents;
		// return
		return histData;
	}


	/** Converts the Z80 flags object into a number.
	 */
	protected revConvertFlags(flags: number): {
		S: number,
		Z: number,
		Y: number,
		H: number,
		X: number,
		P: number,
		N: number,
		C: number
	} {
		const f = {
			S: (flags >>> 7) & 0x01,
			Z: (flags >>> 6) & 0x01,
			Y: (flags >>> 5) & 0x01,
			H: (flags >>> 4) & 0x01,
			X: (flags >>> 3) & 0x01,
			P: (flags >>> 2) & 0x01,
			N: (flags >>> 1) & 0x01,
			C: flags & 0x01,
		};
		return f;
	}


	/** Serializes the object.
	 */
	public serialize(memBuffer: MemBuffer) {
		// Save all registers etc.
		const r = this.getAllRegisters();
		// Store
		memBuffer.write16(r.pc);
		memBuffer.write16(r.sp);
		memBuffer.write16(r.af);
		memBuffer.write16(r.bc);
		memBuffer.write16(r.de);
		memBuffer.write16(r.hl);
		memBuffer.write16(r.ix);
		memBuffer.write16(r.iy);
		memBuffer.write16(r.af2);
		memBuffer.write16(r.bc2);
		memBuffer.write16(r.de2);
		memBuffer.write16(r.hl2);
		// Also the 1 byte data is stored in 2 bytes for simplicity:
		memBuffer.write8(r.i);
		memBuffer.write8(r.r);
		memBuffer.write8(r.im);
		memBuffer.write8(r.iff1);
		memBuffer.write8(r.iff2);

		// Additional
		const s = this.z80.getState();
		memBuffer.write8(Number(s.halted));
		memBuffer.write8(Number(s.do_delayed_di));
		memBuffer.write8(Number(s.do_delayed_ei));
		//memBuffer.write8(s.cycle_counter);

		// Additional state
		memBuffer.writeNumber(this.remainingInterruptTstates);

		// Write values for cpu load
		memBuffer.writeNumber(this.passedTstates);
		memBuffer.writeNumber(this.prevTstatesOnInterrupt);
		memBuffer.writeNumber(this.haltTstates);
		memBuffer.writeNumber(this.cpuLoad);
	}


	/** Deserializes the object.
	 */
	public deserialize(memBuffer: MemBuffer) {
		// Read
		let r = new Object() as any;
		r.pc = memBuffer.read16();
		r.sp = memBuffer.read16();
		const af = memBuffer.read16();
		r.a = af >>> 8;
		r.flags = this.revConvertFlags(af & 0xFF);
		const bc = memBuffer.read16();
		r.b = bc >>> 8;
		r.c = bc & 0xFF;
		const de = memBuffer.read16();
		r.d = de >>> 8;
		r.e = de & 0xFF;
		const hl = memBuffer.read16();
		r.h = hl >>> 8;
		r.l = hl & 0xFF;
		r.ix = memBuffer.read16();
		r.iy = memBuffer.read16();

		const af2 = memBuffer.read16();
		r.a_prime = af2 >>> 8;
		r.flags_prime = this.revConvertFlags(af2 & 0xFF);
		const bc2 = memBuffer.read16();
		r.b_prime = bc2 >>> 8;
		r.c_prime = bc2 & 0xFF;
		const de2 = memBuffer.read16();
		r.d_prime = de2 >>> 8;
		r.e_prime = de2 & 0xFF;
		const hl2 = memBuffer.read16();
		r.h_prime = hl2 >>> 8;
		r.l_prime = hl2 & 0xFF;

		// Also the 1 byte data is stored in 2 bytes for simplicity:
		r.i = memBuffer.read8();
		r.r = memBuffer.read8();
		r.imode = memBuffer.read8();
		r.iff1 = memBuffer.read8();
		r.iff2 = memBuffer.read8();

		// Additional
		r.halted = (memBuffer.read8() != 0);
		r.do_delayed_di = (memBuffer.read8() != 0);
		r.do_delayed_ei = (memBuffer.read8() != 0);
		r.cycle_counter = 0;

		// Restore all registers etc.
		const z80 = this.z80;
		z80.setState(r);

		// Additional state
		this.remainingInterruptTstates = memBuffer.readNumber();

		// Read values for cpu load
		this.passedTstates = memBuffer.readNumber();
		this.prevTstatesOnInterrupt = memBuffer.readNumber();
		this.haltTstates = memBuffer.readNumber();
		this.cpuLoad = memBuffer.readNumber();
	}
}
