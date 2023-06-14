import * as assert from 'assert';
import {readFileSync} from 'fs';
import {Format} from '../../src/disassembler/core/format';
import {AsmNode} from '../../src/disassembler/core/asmnode';
import {SmartDisassembler} from '../../src/disassembler/smartdisassembler';
import {Utility} from '../../src/misc/utility';
import {Settings} from '../../src/settings/settings';
import {Z80Registers, Z80RegistersClass} from '../../src/remotes/z80registers';
import {Z80RegistersStandardDecoder} from '../../src/remotes/z80registersstandarddecoder';
import {Opcode} from '../../src/disassembler/core/opcode';



suite('Disassembler', () => {

	// Function that cann strip the main label from a local label.
	function ll(label: string): string {
		const localLabel = label.replace(/\w+\./, '.');
		return localLabel;
		// const k = label.indexOf('.');
		// if (k >= 0)
		// 	return label.substring(k);
		// return label;
	}


	/** Reads a memory area as binary from a file.
	 * @param dng The disassembler object.
	 * @param path The file path to a binary file.
	 */
	function readBinFile(dng: SmartDisassembler, path: string) {
		const bin = new Uint8Array(readFileSync(path));
		dng.setMemory(0, bin);
	}


	suite('General', () => {
		test('Constructor', () => {
			new SmartDisassembler();
		});
	});


	suite('nodes', () => {

		let dng: SmartDisassembler;
		let dngNodes: Map<number, AsmNode>;
		setup(() => {
			// Initialize Settings
			const cfg: any = {
				remoteType: 'zsim'
			};
			Settings.launch = Settings.Init(cfg);
			Z80RegistersClass.createRegisters();
			Z80Registers.decoder = new Z80RegistersStandardDecoder();
			Opcode.InitOpcodes();
			dng = new SmartDisassembler();
			dng.funcGetLabel = addr => undefined;
			dng.funcFormatAddress = addr => addr.toString(16);
			readBinFile(dng,'./tests/disassembler/projects/nodes/main.bin');
			dngNodes = (dng as any).nodes;
		});


		test('Simple', () => {
			dng.getFlowGraph([0x0000], []);
			assert.equal(dngNodes.size, 1);
			let node = dng.getNodeForAddress(0x0000)!;
			assert.notEqual(node, undefined);
			assert.equal(node.instructions.length, 7);
			assert.equal(node.length, 7);
			assert.equal(node.callers.length, 0);
			assert.equal(node.predecessors.length, 0);
			assert.equal(node.callee, undefined);
			assert.equal(node.branchNodes.length, 0);
		});

		test('Simple, multiple addresses', () => {
			dng.getFlowGraph([6, 5, 4, 3, 2, 1, 0], []);
			assert.equal(dngNodes.size, 1);
			let node = dng.getNodeForAddress(0x0000)!;
			assert.notEqual(node, undefined);
			assert.equal(node.instructions.length, 7);
			assert.equal(node.length, 7);
			assert.equal(node.callers.length, 0);
			assert.equal(node.predecessors.length, 0);
			assert.equal(node.callee, undefined);
			assert.equal(node.branchNodes.length, 0);
		});

		test('Branch', () => {
			dng.getFlowGraph([0x0100], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(0x0100)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(0x0105)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(0x0107)!;
			assert.notEqual(node3, undefined);

			assert.equal(node1.instructions.length, 3);
			assert.equal(node1.length, 5);
			assert.equal(node1.callers.length, 0);
			assert.equal(node1.predecessors.length, 0);
			assert.equal(node1.callee, undefined);
			assert.equal(node1.branchNodes.length, 2);
			assert.ok(node1.branchNodes.includes(node2));
			assert.ok(node1.branchNodes.includes(node3));

			assert.equal(node2.instructions.length, 1);
			assert.equal(node2.length, 2);
			assert.equal(node2.callers.length, 0);
			assert.equal(node2.predecessors.length, 1);
			assert.ok(node2.predecessors.includes(node1));
			assert.equal(node2.callee, undefined);
			assert.equal(node2.branchNodes.length, 1);
			assert.ok(node1.branchNodes.includes(node3));

			assert.equal(node3.instructions.length, 1);
			assert.equal(node3.length, 1);
			assert.equal(node3.callers.length, 0);
			assert.equal(node3.predecessors.length, 2);
			assert.ok(node3.predecessors.includes(node1));
			assert.ok(node3.predecessors.includes(node2));
			assert.equal(node3.callee, undefined);
			assert.equal(node3.branchNodes.length, 0);
		});

		test('JR after RET', () => {
			dng.getFlowGraph([0x0200], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(0x0200)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(0x0205)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(0x0209)!;
			assert.notEqual(node3, undefined);

			assert.equal(node1.instructions.length, 3);
			assert.equal(node1.length, 5);
			assert.equal(node1.callers.length, 0);
			assert.equal(node1.predecessors.length, 0);
			assert.equal(node1.callee, undefined);
			assert.equal(node1.branchNodes.length, 2);
			assert.ok(node1.branchNodes.includes(node2));
			assert.ok(node1.branchNodes.includes(node3));

			assert.equal(node2.instructions.length, 2);
			assert.equal(node2.length, 3);
			assert.equal(node2.callers.length, 0);
			assert.equal(node2.predecessors.length, 1);
			assert.ok(node2.predecessors.includes(node1));
			assert.equal(node2.callee, undefined);
			assert.equal(node2.branchNodes.length, 0);

			assert.equal(node3.instructions.length, 2);
			assert.equal(node3.length, 2);
			assert.equal(node3.callers.length, 0);
			assert.equal(node3.predecessors.length, 1);
			assert.ok(node3.predecessors.includes(node1));
			assert.equal(node3.callee, undefined);
			assert.equal(node3.branchNodes.length, 0);
		});

		test('LOOP', () => {
			dng.getFlowGraph([0x0300], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(0x0300)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(0x0302)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(0x0305)!;
			assert.notEqual(node3, undefined);

			assert.equal(node1.instructions.length, 1);
			assert.equal(node1.length, 2);
			assert.equal(node1.callers.length, 0);
			assert.equal(node1.predecessors.length, 0);
			assert.equal(node1.callee, undefined);
			assert.equal(node1.branchNodes.length, 1);
			assert.ok(node1.branchNodes.includes(node2));

			assert.equal(node2.instructions.length, 2);
			assert.equal(node2.length, 3);
			assert.equal(node2.callers.length, 0);
			assert.equal(node2.predecessors.length, 2);
			assert.ok(node2.predecessors.includes(node1));
			assert.ok(node2.predecessors.includes(node2));
			assert.equal(node2.callee, undefined);
			assert.equal(node2.branchNodes.length, 2);
			assert.ok(node2.branchNodes.includes(node2));
			assert.ok(node2.branchNodes.includes(node3));

			assert.equal(node3.instructions.length, 1);
			assert.equal(node3.length, 1);
			assert.equal(node3.callers.length, 0);
			assert.equal(node3.predecessors.length, 1);
			assert.ok(node3.predecessors.includes(node2));
			assert.equal(node3.callee, undefined);
			assert.equal(node3.branchNodes.length, 0);
		});

		test('LOOP self', () => {
			dng.getFlowGraph([0x0400], []);
			assert.equal(dngNodes.size, 2);

			const node2 = dng.getNodeForAddress(0x0400)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(0x0403)!;
			assert.notEqual(node3, undefined);

			assert.equal(node2.instructions.length, 2);
			assert.equal(node2.length, 3);
			assert.equal(node2.callers.length, 0);
			assert.equal(node2.predecessors.length, 1);
			assert.ok(node2.predecessors.includes(node2));
			assert.equal(node2.callee, undefined);
			assert.equal(node2.branchNodes.length, 2);
			assert.ok(node2.branchNodes.includes(node2));
			assert.ok(node2.branchNodes.includes(node3));

			assert.equal(node3.instructions.length, 1);
			assert.equal(node3.length, 1);
			assert.equal(node3.callers.length, 0);
			assert.equal(node3.predecessors.length, 1);
			assert.ok(node3.predecessors.includes(node2));
			assert.equal(node3.callee, undefined);
			assert.equal(node3.branchNodes.length, 0);
		});

		test('2 subs, same block', () => {
			dng.getFlowGraph([0x0500, 0x520], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(0x0500)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(0x0502)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(0x0520)!;
			assert.notEqual(node3, undefined);

			assert.equal(node1.instructions.length, 1);
			assert.equal(node1.length, 2);
			assert.equal(node1.callers.length, 0);
			assert.equal(node1.predecessors.length, 0);
			assert.equal(node1.callee, undefined);
			assert.equal(node1.branchNodes.length, 1);
			assert.ok(node1.branchNodes.includes(node2));

			assert.equal(node2.instructions.length, 2);
			assert.equal(node2.length, 3);
			assert.equal(node2.callers.length, 0);
			assert.equal(node2.predecessors.length, 2);
			assert.ok(node2.predecessors.includes(node1));
			assert.ok(node2.predecessors.includes(node3));
			assert.equal(node2.callee, undefined);
			assert.equal(node2.branchNodes.length, 0);

			assert.equal(node3.instructions.length, 2);
			assert.equal(node3.length, 5);
			assert.equal(node3.callers.length, 0);
			assert.equal(node3.predecessors.length, 0);
			assert.equal(node3.callee, undefined);
			assert.equal(node3.branchNodes.length, 1);
			assert.ok(node3.branchNodes.includes(node2));
		});

		test('2 subs, same block, reverse', () => {
			dng.getFlowGraph([0x0520, 0x500], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(0x0500)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(0x0502)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(0x0520)!;
			assert.notEqual(node3, undefined);

			assert.equal(node1.instructions.length, 1);
			assert.equal(node1.length, 2);
			assert.equal(node1.callers.length, 0);
			assert.equal(node1.predecessors.length, 0);
			assert.equal(node1.callee, undefined);
			assert.equal(node1.branchNodes.length, 1);
			assert.ok(node1.branchNodes.includes(node2));

			assert.equal(node2.instructions.length, 2);
			assert.equal(node2.length, 3);
			assert.equal(node2.callers.length, 0);
			assert.equal(node2.predecessors.length, 2);
			assert.ok(node2.predecessors.includes(node1));
			assert.ok(node2.predecessors.includes(node3));
			assert.equal(node2.callee, undefined);
			assert.equal(node2.branchNodes.length, 0);

			assert.equal(node3.instructions.length, 2);
			assert.equal(node3.length, 5);
			assert.equal(node3.callers.length, 0);
			assert.equal(node3.predecessors.length, 0);
			assert.equal(node3.callee, undefined);
			assert.equal(node3.branchNodes.length, 1);
			assert.ok(node3.branchNodes.includes(node2));
		});

		test('Simple call', () => {
			dng.getFlowGraph([0x0600], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(0x0600)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(0x0605)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(0x0606)!;
			assert.notEqual(node3, undefined);

			assert.equal(node1.instructions.length, 2);
			assert.equal(node1.length, 5);
			assert.equal(node1.callers.length, 0);
			assert.equal(node1.predecessors.length, 0);
			assert.equal(node1.callee, node3);
			assert.equal(node1.branchNodes.length, 1);
			assert.ok(node1.branchNodes.includes(node2));

			assert.equal(node2.instructions.length, 1);
			assert.equal(node2.length, 1);
			assert.equal(node2.callers.length, 0);
			assert.equal(node2.predecessors.length, 1);
			assert.ok(node2.predecessors.includes(node1));
			assert.equal(node2.callee, undefined);
			assert.equal(node2.branchNodes.length, 0);

			assert.equal(node3.instructions.length, 2);
			assert.equal(node3.length, 3);
			assert.equal(node3.callers.length, 1);
			assert.ok(node3.callers.includes(node1));
			assert.equal(node3.predecessors.length, 0);
			assert.equal(node3.callee, undefined);
			assert.equal(node3.branchNodes.length, 0);
		});

		test('2 calls, same sub', () => {
			dng.getFlowGraph([0x0700], []);
			assert.equal(dngNodes.size, 4);

			const node1 = dng.getNodeForAddress(0x0700)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(0x0705)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(0x0708)!;
			assert.notEqual(node3, undefined);
			const node4 = dng.getNodeForAddress(0x0709)!;
			assert.notEqual(node4, undefined);

			assert.equal(node1.instructions.length, 2);
			assert.equal(node1.length, 5);
			assert.equal(node1.callers.length, 0);
			assert.equal(node1.predecessors.length, 0);
			assert.equal(node1.callee, node4);
			assert.equal(node1.branchNodes.length, 1);
			assert.ok(node1.branchNodes.includes(node2));

			assert.equal(node2.instructions.length, 1);
			assert.equal(node2.length, 3);
			assert.equal(node2.callers.length, 0);
			assert.equal(node2.predecessors.length, 1);
			assert.ok(node2.predecessors.includes(node1));
			assert.equal(node2.callee, node4);
			assert.equal(node2.branchNodes.length, 1);
			assert.ok(node2.branchNodes.includes(node3));

			assert.equal(node3.instructions.length, 1);
			assert.equal(node3.length, 1);
			assert.equal(node3.callers.length, 0);
			assert.equal(node3.predecessors.length, 1);
			assert.ok(node3.predecessors.includes(node2));
			assert.equal(node3.callee, undefined);
			assert.equal(node3.branchNodes.length, 0);

			assert.equal(node4.instructions.length, 2);
			assert.equal(node4.length, 3);
			assert.equal(node4.callers.length, 2);
			assert.ok(node4.callers.includes(node1));
			assert.ok(node4.callers.includes(node2));
			assert.equal(node4.predecessors.length, 0);
			assert.equal(node4.callee, undefined);
			assert.equal(node4.branchNodes.length, 0);
		});

		test('Recursive call', () => {
			dng.getFlowGraph([0x0800], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(0x0800)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(0x0803)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(0x0807)!;
			assert.notEqual(node3, undefined);

			assert.equal(node1.instructions.length, 2);
			assert.equal(node1.length, 3);
			assert.equal(node1.callers.length, 1);
			assert.ok(node1.callers.includes(node2));
			assert.equal(node1.predecessors.length, 0);
			assert.equal(node1.callee, undefined);
			assert.equal(node1.branchNodes.length, 1);
			assert.ok(node1.branchNodes.includes(node2));

			assert.equal(node2.instructions.length, 2);
			assert.equal(node2.length, 4);
			assert.equal(node2.callers.length, 0);
			assert.equal(node2.predecessors.length, 1);
			assert.ok(node2.predecessors.includes(node1));
			assert.equal(node2.callee, node1);
			assert.equal(node2.branchNodes.length, 1);
			assert.ok(node2.branchNodes.includes(node3));

			assert.equal(node3.instructions.length, 1);
			assert.equal(node3.length, 1);
			assert.equal(node3.callers.length, 0);
			assert.equal(node3.predecessors.length, 1);
			assert.ok(node3.predecessors.includes(node2));
			assert.equal(node3.callee, undefined);
			assert.equal(node3.branchNodes.length, 0);

		});

		test('Subroutine inside subroutine', () => {
			dng.getFlowGraph([0x0900, 0x0920], []);
			assert.equal(dngNodes.size, 4);

			const node1 = dng.getNodeForAddress(0x0900)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(0x0902)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(0x0920)!;
			assert.notEqual(node3, undefined);
			const node4 = dng.getNodeForAddress(0x0923)!;
			assert.notEqual(node4, undefined);

			assert.equal(node1.instructions.length, 1);
			assert.equal(node1.length, 2);
			assert.equal(node1.callers.length, 0);
			assert.equal(node1.predecessors.length, 0);
			assert.equal(node1.callee, undefined);
			assert.equal(node1.branchNodes.length, 1);
			assert.ok(node1.branchNodes.includes(node2));

			assert.equal(node2.instructions.length, 2);
			assert.equal(node2.length, 2);
			assert.equal(node2.callers.length, 1);
			assert.ok(node2.callers.includes(node3));
			assert.equal(node2.predecessors.length, 1);
			assert.ok(node2.predecessors.includes(node1));
			assert.equal(node2.callee, undefined);
			assert.equal(node2.branchNodes.length, 0);

			assert.equal(node3.instructions.length, 1);
			assert.equal(node3.length, 3);
			assert.equal(node3.callers.length, 0);
			assert.equal(node3.predecessors.length, 0);
			assert.equal(node3.callee, node2);
			assert.equal(node3.branchNodes.length, 1);
			assert.ok(node3.branchNodes.includes(node4));

			assert.equal(node4.instructions.length, 1);
			assert.equal(node4.length, 1);
			assert.equal(node4.callers.length, 0);
			assert.equal(node4.predecessors.length, 1);
			assert.ok(node4.predecessors.includes(node3));
			assert.equal(node4.callee, undefined);
			assert.equal(node4.branchNodes.length, 0);
		});

		test('jr $', () => {
			dng.getFlowGraph([0x0A00], []);
			assert.equal(dngNodes.size, 2);

			const node1 = dng.getNodeForAddress(0x0A00)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(0x0A01)!;
			assert.notEqual(node2, undefined);

			assert.equal(node1.instructions.length, 1);
			assert.equal(node1.length, 1);
			assert.equal(node1.callers.length, 0);
			assert.equal(node1.predecessors.length, 0);
			assert.equal(node1.callee, undefined);
			assert.equal(node1.branchNodes.length, 1);
			assert.ok(node1.branchNodes.includes(node2));

			assert.equal(node2.instructions.length, 1);
			assert.equal(node2.length, 2);
			assert.equal(node2.callers.length, 0);
			assert.equal(node2.predecessors.length, 2);
			assert.ok(node2.predecessors.includes(node1));
			assert.ok(node2.predecessors.includes(node2));
			assert.equal(node2.callee, undefined);
			assert.equal(node2.branchNodes.length, 1);
			assert.ok(node2.branchNodes.includes(node2));
		});


		test('getNodesForAddresses', () => {
			const n1 = new AsmNode();
			const n2 = new AsmNode();
			const n3 = new AsmNode();
			dngNodes.set(0x0100, n1);
			dngNodes.set(0x0200, n2);
			dngNodes.set(0x0300, n3);
			const addrNodes = dng.getNodesForAddresses([0x200, 0x300, 0x400]);
			assert.equal(addrNodes.length, 2);
			assert.ok(addrNodes.includes(n2));
			assert.ok(addrNodes.includes(n3));
		});
	});


	suite('partitionBlocks', () => {

		let dng: SmartDisassembler;
		let dngNodes: Map<number, AsmNode>;
		setup(() => {
			// Initialize Settings
			const cfg: any = {
				remoteType: 'zsim'
			};
			Settings.launch = Settings.Init(cfg);
			Z80RegistersClass.createRegisters();
			Z80Registers.decoder = new Z80RegistersStandardDecoder();
			Opcode.InitOpcodes();
			dng = new SmartDisassembler();
			dng.funcGetLabel = addr => undefined;
			dng.funcFormatAddress = addr => addr.toString(16);
			readBinFile(dng,'./tests/disassembler/projects/partition_blocks/main.bin');
			dngNodes = (dng as any).nodes;
		});

		// Checks if the addresses outside the block are all undefinded.
		function checkUndefined(blockStart: number, blockLength: number) {
			// Before
			for (let addr = 0; addr < blockStart; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, undefined, "Address=" + addr.toString(16));
			}

			// After
			for (let addr = blockStart + blockLength; addr < 0x10000; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, undefined, "Address=" + addr.toString(16));
			}
		}


		test('Simple block', () => {
			const startAddr = 0x0000;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 1);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);

			for (let addr = startAddr; addr < startAddr + 7; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node1, "Address=" + addr.toString(16));
			}

			checkUndefined(0, 7);
		});

		test('1 branch', () => {
			const startAddr = 0x0100;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);

			for (let addr = startAddr; addr < startAddr + 8; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node1, "Address=" + addr.toString(16));
			}

			checkUndefined(startAddr, 8);
		});

		test('JR after RET (2 blocks)', () => {
			const startAddr = 0x0200;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 9)!;
			assert.notEqual(node2, undefined);

			// node1
			for (let addr = startAddr; addr < startAddr + 8; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node1, "Address=" + addr.toString(16));
			}

			// node2
			for (let addr = startAddr + 9; addr < startAddr + 0x0B; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node2, "Address=" + addr.toString(16));
			}

			// Undefined
			const nop = (dng as any).blocks[startAddr + 8];
			assert.equal(nop, undefined, "Address=" + (startAddr + 8).toString(16));
			checkUndefined(startAddr, 0x0B);
		});

		test('Sub in sub', () => {
			const startAddr = 0x0300;
			dng.getFlowGraph([startAddr, startAddr + 4], []);
			assert.equal(dngNodes.size, 4);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 2)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node3, undefined);

			// node1
			let addr;
			for (addr = startAddr; addr < startAddr + 2; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node1, "Address=" + addr.toString(16));
			}

			// node2
			for (; addr < startAddr + 4; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node2, "Address=" + addr.toString(16));
			}

			// node3
			for (; addr < startAddr + 8; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node3, "Address=" + addr.toString(16));
			}

			// Undefined
			checkUndefined(startAddr, 8);
		});

		test('Complex jumping', () => {
			const startAddr = 0x0400;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 5)
			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);

			// node1
			for (let addr = startAddr; addr < startAddr + 0x0E; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node1, "Address=" + addr.toString(16));
			}

			// Undefined
			checkUndefined(startAddr, 0x0E);
		});

		test('2 subs, sharing block', () => {
			const startAddr = 0x0500;
			dng.getFlowGraph([startAddr, startAddr + 0x20], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 0x20)!;
			assert.notEqual(node2, undefined);

			// node1
			let addr;
			for (addr = startAddr; addr < startAddr + 5; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node1, "Address=" + addr.toString(16));
			}

			// Undefined
			for (; addr < startAddr + 0x20; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, undefined, "Address=" + addr.toString(16));
			}

			// node2
			for (; addr < startAddr + 0x25; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node2, "Address=" + addr.toString(16));
			}

			checkUndefined(startAddr, 0x25);
		});

		test('Loop', () => {
			const startAddr = 0x0600;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);

			// node1
			let addr;
			for (addr = startAddr; addr < startAddr + 6; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node1, "Address=" + addr.toString(16));
			}

			checkUndefined(startAddr, 6);
		});

		test('Recursive call', () => {
			const startAddr = 0x1000;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);

			// node1
			let addr;
			for (addr = startAddr; addr < startAddr + 8; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node1, "Address=" + addr.toString(16));
			}

			checkUndefined(startAddr, 8);
		});

		test('JP', () => {
			const startAddr = 0x1100;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 2);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 5)!;
			assert.notEqual(node2, undefined);

			// node1
			let addr = startAddr;
			for (; addr < startAddr + 5; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node1, "Address=" + addr.toString(16));
			}

			// node2
			for (; addr < startAddr + 1; addr++) {
				const node = (dng as any).blocks[addr];
				assert.equal(node, node2, "Address=" + addr.toString(16));
			}

			checkUndefined(startAddr, 8);
		});
	});



	suite('assignLabels', () => {

		let dng: SmartDisassembler;
		let dngNodes: Map<number, AsmNode>;
		setup(() => {
			// Initialize Settings
			const cfg: any = {
				remoteType: 'zsim'
			};
			Settings.launch = Settings.Init(cfg);
			Z80RegistersClass.createRegisters();
			Z80Registers.decoder = new Z80RegistersStandardDecoder();
			Opcode.InitOpcodes();
			dng = new SmartDisassembler();
			dng.funcGetLabel = addr64k => undefined;
			dng.funcFormatAddress = addr64k => addr64k.toString(16);
			readBinFile(dng,'./tests/disassembler/projects/assign_labels/main.bin');
			dng.labelLblPrefix = 'LLBL_';
			dng.labelSubPrefix = 'SSUB_';
			dng.labelLocalLoopPrefix = 'LLOOP';
			dng.labelLocalLabelPrefix = 'LL';
			dng.labelRstPrefix = 'RRST_';
			dngNodes = (dng as any).nodes;
		});

		test('Simple', () => {
			const startAddr = 0x0000;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 1);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);

			assert.equal(node1.label, undefined);
		});

		test('1 branch, global label', () => {
			const startAddr = 0x0100;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 5)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(startAddr + 7)!;
			assert.notEqual(node2, undefined);

			assert.equal(node1.label, undefined);
			assert.equal(node2.label, undefined);
			assert.equal(node3.label, 'LLBL_0107');
		});

		test('1 branch, local label', () => {
			const startAddr = 0x0180;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 5);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(startAddr + 0x0B)!;
			assert.notEqual(node2, undefined);

			assert.equal(node1.label, undefined);
			assert.equal(node2.label, 'SSUB_0184');
			assert.equal(node3.label, 'SSUB_0184.LL1');
		});

		test('JR after RET', () => {
			const startAddr = 0x0200;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 9)!;
			assert.notEqual(node2, undefined);

			assert.equal(node1.label, undefined);
			assert.equal(node2.label, 'SSUB_0209');
		});

		test('JR after RET, sub', () => {
			const startAddr = 0x0280;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 5);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 0x0D)!;
			assert.notEqual(node2, undefined);

			assert.equal(node1.label, undefined);
			assert.equal(node2.label, 'SSUB_028D');
		});

		test('Sub in sub', () => {
			const startAddr = 0x0300;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 5);

			const node1 = dng.getNodeForAddress(startAddr + 7)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 9)!;
			assert.notEqual(node2, undefined);

			assert.equal(node1.label, 'SSUB_0307');
			assert.equal(node2.label, 'SSUB_0309');
		});

		test('Complex jumping', () => {
			const startAddr = 0x0400;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 7);

			const node1 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 9)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(startAddr + 0x0A)!;
			assert.notEqual(node3, undefined);
			const node4 = dng.getNodeForAddress(startAddr + 0x0C)!;
			assert.notEqual(node4, undefined);
			const node5 = dng.getNodeForAddress(startAddr + 0x0F)!;
			assert.notEqual(node5, undefined);

			assert.equal(node1.label, 'SSUB_0404');
			assert.equal(node2.label, undefined);
			assert.equal(node3.label, 'SSUB_0404.LL1');
			assert.equal(node4.label, 'SSUB_0404.LL2');
			assert.equal(node5.label, undefined);
		});

		test('2 subs, sharing block', () => {
			const startAddr = 0x0500;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 6);

			const node1 = dng.getNodeForAddress(startAddr + 7)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 9)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(startAddr + 0x20)!;
			assert.notEqual(node3, undefined);

			assert.equal(node1.label, 'SSUB_0507');
			assert.equal(node2.label, 'SSUB_0507.LL1');
			assert.equal(node3.label, 'SSUB_0520');
		});

		test('Loop', () => {
			const startAddr = 0x0600;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 5);

			const node1 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 6)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(startAddr + 9)!;
			assert.notEqual(node3, undefined);

			assert.equal(node1.label, 'SSUB_0604');
			assert.equal(node2.label, 'SSUB_0604.LLOOP');
			assert.equal(node3.label, undefined);
		});

		test('Nested loops', () => {
			const startAddr = 0x0700;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 7);

			const node1 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 6)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(startAddr + 7)!;
			assert.notEqual(node3, undefined);
			const node4 = dng.getNodeForAddress(startAddr + 0x0A)!;
			assert.notEqual(node4, undefined);
			const node5 = dng.getNodeForAddress(startAddr + 0x0D)!;
			assert.notEqual(node5, undefined);

			assert.equal(node1.label, 'SSUB_0704');
			assert.equal(node2.label, 'SSUB_0704.LLOOP1');
			assert.equal(node3.label, 'SSUB_0704.LLOOP2');
			assert.equal(node4.label, undefined);
			assert.equal(node5.label, undefined);
		});

		test('Nested loops, same label', () => {
			const startAddr = 0x0800;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 6);

			const node1 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 6)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(startAddr + 0x0A)!;
			assert.notEqual(node3, undefined);
			const node4 = dng.getNodeForAddress(startAddr + 0x0D)!;
			assert.notEqual(node4, undefined);

			assert.equal(node1.label, 'SSUB_0804');
			assert.equal(node2.label, 'SSUB_0804.LLOOP');
			assert.equal(node3.label, undefined);
			assert.equal(node4.label, undefined);
		});

		test('Recursive call', () => {
			const startAddr = 0x1000;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 3);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 3)!;
			assert.notEqual(node2, undefined);
			const node3 = dng.getNodeForAddress(startAddr + 7)!;
			assert.notEqual(node3, undefined);

			assert.equal(node1.label, 'SSUB_1000');
			assert.equal(node2.label, undefined);
			assert.equal(node3.label, undefined);
		});

		test('JP', () => {
			const startAddr = 0x1100;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 4);

			const node1 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 9)!;
			assert.notEqual(node2, undefined);

			assert.equal(node1.label, 'SSUB_1104');
			assert.ok(node1.isSubroutine);
			assert.equal(node2.label, 'SSUB_1104.LL1');
			assert.ok(node2.isSubroutine);
		});

		test('JR $', () => {
			const startAddr = 0x1200;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 2);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 1)!;
			assert.notEqual(node2, undefined);

			assert.equal(node1.label, undefined);
			assert.ok(!node1.isSubroutine);
			assert.equal(node2.label, 'LLBL_1201');
			assert.ok(!node2.isSubroutine);
		});

		test('JR $ / CALL', () => {
			const startAddr = 0x1300;
			dng.getFlowGraph([startAddr], []);
			assert.equal(dngNodes.size, 4);

			const node1 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node1, undefined);
			const node2 = dng.getNodeForAddress(startAddr + 5)!;
			assert.notEqual(node2, undefined);

			assert.equal(node1.label, 'SSUB_1304');
			assert.ok(node1.isSubroutine);
			assert.equal(node2.label, 'SSUB_1304.LLOOP');
			assert.ok(!node2.isSubroutine);
		});
	});

	suite('disassembleNodes', () => {

		let dng: SmartDisassembler;
		//let dngNodes: Map<number, AsmNode>;
		setup(() => {
			// Initialize Settings
			const cfg: any = {
				remoteType: 'zsim'
			};
			Settings.launch = Settings.Init(cfg);
			Z80RegistersClass.createRegisters();
			Z80Registers.decoder = new Z80RegistersStandardDecoder();
			dng = new SmartDisassembler();
			dng.funcGetLabel = addr64k => undefined;
			dng.funcFormatAddress = addr64k => addr64k.toString(16);
			readBinFile(dng,'./tests/disassembler/projects/disassemble_nodes/main.bin');
			dng.labelLblPrefix = 'LLBL_';
			dng.labelSubPrefix = 'SSUB_';
			dng.labelLocalLoopPrefix = 'LLOOP';
			dng.labelLocalLabelPrefix = 'LL';
			dng.labelDataLblPrefix = "DDATA_";
			dng.labelRstPrefix = "RRST_";
			Format.hexFormat = '$';
			Opcode.InitOpcodes();
		});

		/**
		 * Checks if the instruction disassemlbies contain the text
		 * in 'lines'.
		 */
		function checkInstructions(node: AsmNode, lines: string[]) {
			let l = 0;
			const instrs = node.instructions.map(i => i.disassembledText);
			for (const instr of instrs) {
				const line = lines[l];
				assert.equal(instr, line, 'Line: ' + l + ' of ["' + instrs.join('", "') + '"] should be ["' + lines.join('", "') + '"]');
				l++;
			}
			// Check for same number of lines
			assert.equal(node.instructions.length, lines.length, "Expected number of lines");
		}

		/**
		 * Outputs a simple disassembly.
		 */
		function dbgDisassembly(nodes: Map<number, AsmNode>) {
			// Sort nodes by address
			const sortedNodes = Array.from(nodes.values());
			 sortedNodes.sort((a, b) => a.start - b.start);
			// Loop over all nodes
			for (const node of sortedNodes) {
				// Print label and address:
				let addr = node.start;
				console.log(Utility.getHexString(addr, 4) + ' ' + node.label + ':');
				// Loop over all instructions
				for (const opcode of node.instructions) {
					console.log(Utility.getHexString(addr, 4) + '\t' + opcode.disassembledText);
					// Next
					addr += opcode.length;
				}
				console.log();
			}
		}


		test('From single bank to multi bank', () => {
			const startAddr = 0x0100;
			dng.getFlowGraph([startAddr, 0x0000, 0x4000, 0x8000], []);
			dng.disassembleNodes();

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			checkInstructions(node1, [
				"LD A,$05",
				"LD DE,$0000",
				"LD HL,(RRST_00)",
				"CALL RRST_00"
			]);

			const node2 = dng.getNodeForAddress(startAddr + 0x0B)!;
			assert.notEqual(node2, undefined);
			checkInstructions(node2, [
				"LD B,C",
				"LD DE,SSUB_4000",
				"LD HL,(SSUB_4000)",
				"CALL SSUB_4000"
			]);

			const node3 = dng.getNodeForAddress(startAddr + 0x15)!;
			assert.notEqual(node3, undefined);
			checkInstructions(node3, [
				"LD DE,$8010",
				"LD HL,($8010)",
				"CALL $8000"
			]);

			const node4 = dng.getNodeForAddress(startAddr + 0x1E)!;
			assert.notEqual(node4, undefined);
			checkInstructions(node4, [
				"NOP",
				"RET"
			]);
		});

		test('From multi bank to single bank', () => {
			const startAddr = 0x8100;
			dng.getFlowGraph([startAddr, 0x0000, 0x4000, 0x8000], []);
			dng.disassembleNodes();

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			checkInstructions(node1, [
				"CALL RRST_00"
			]);

			const node2 = dng.getNodeForAddress(startAddr + 3)!;
			assert.notEqual(node2, undefined);
			checkInstructions(node2, [
				"CALL SSUB_4000"
			]);

			const node3 = dng.getNodeForAddress(startAddr + 6)!;
			assert.notEqual(node3, undefined);
			checkInstructions(node3, [
				"CALL SSUB_8000"
			]);

			const node4 = dng.getNodeForAddress(startAddr + 9)!;
			assert.notEqual(node4, undefined);
			checkInstructions(node4, [
				"RET"
			]);
		});

		test('Loop: Label prior to subroutine, misc references', () => {
			const startAddr = 0xD000;
			dng.getFlowGraph([startAddr], []);
			dng.disassembleNodes();

			dbgDisassembly((dng as any).nodes);

			const node0 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node0, undefined);
			checkInstructions(node0, [
				"LD A,$08",
			]);

			const node0b = dng.getNodeForAddress(startAddr + 6)!;
			assert.notEqual(node0b, undefined);
			checkInstructions(node0b, [
				"NOP",
			]);

			const node1 = dng.getNodeForAddress(startAddr + 7)!;
			assert.notEqual(node1, undefined);
			checkInstructions(node1, [
				"LD (IX+5),A",
			]);

			const node1b = dng.getNodeForAddress(startAddr + 0x0A)!;
			assert.notEqual(node1b, undefined);
			checkInstructions(node1b, [
				"LD A,(IY-7)",
				ll("JR Z,SSUB_D007.LLOOP"),
			]);

			const node2 = dng.getNodeForAddress(startAddr + 0x0F)!;
			assert.notEqual(node2, undefined);
			checkInstructions(node2, [
				"BIT 7,(IX+0)",
				ll("JR NZ,SSUB_D007.LL1"),
			]);

			const node3 = dng.getNodeForAddress(startAddr + 0x15)!;
			assert.notEqual(node3, undefined);
			checkInstructions(node3, [
				"LD BC,(DDATA_D100)",
			]);

			const node4 = dng.getNodeForAddress(startAddr + 0x19)!;
			assert.notEqual(node4, undefined);
			checkInstructions(node4, [
				"LD (DDATA_D102),DE",
				"LD IY,(DDATA_D104)",
				ll("JP P,SSUB_D007.LL2"),
			]);

			const node5 = dng.getNodeForAddress(startAddr + 0x24)!;
			assert.notEqual(node5, undefined);
			checkInstructions(node5, [
				"RET",
			]);

			const node6 = dng.getNodeForAddress(startAddr + 0x25)!;
			assert.notEqual(node6, undefined);
			checkInstructions(node6, [
				"NEG",
				"JR Z,LLBL_D004"
			]);

			const node7 = dng.getNodeForAddress(startAddr + 0x29)!;
			assert.notEqual(node7, undefined);
			checkInstructions(node7, [
				"JP NC,LLBL_D004.LLOOP"
			]);

			const node8 = dng.getNodeForAddress(startAddr + 0x2C)!;
			assert.notEqual(node8, undefined);
			checkInstructions(node8, [
				"RET"
			]);
		});


		test('2 subroutines merged', () => {
			const startAddr = 0xD200;
			dng.getFlowGraph([startAddr], []);
			dng.disassembleNodes();

			dbgDisassembly((dng as any).nodes);

			const node1 = dng.getNodeForAddress(startAddr + 7)!;
			assert.notEqual(node1, undefined);
			assert.equal(node1.label, 'SSUB_D207');

			const node2 = dng.getNodeForAddress(startAddr + 0x09)!;
			assert.notEqual(node2, undefined);
			assert.equal(node2.label, 'SSUB_D209');

			checkInstructions(node1, [
				"LD A,$01",
			]);
			checkInstructions(node2, [
				"LD A,$02",
				"RET"
			]);
		});

		test('2 subroutines merged, sharing tail', () => {
			const startAddr = 0xD300;
			dng.getFlowGraph([startAddr], []);
			dng.disassembleNodes();

			dbgDisassembly((dng as any).nodes);

			const node1 = dng.getNodeForAddress(startAddr + 7)!;
			assert.notEqual(node1, undefined);
			assert.equal(node1.label, 'SSUB_D307');

			const node2 = dng.getNodeForAddress(startAddr + 0x0B)!;
			assert.notEqual(node2, undefined);
			assert.equal(node2.label, 'SSUB_D30B');

			const node3 = dng.getNodeForAddress(startAddr + 0x0D)!;
			assert.notEqual(node3, undefined);
			assert.equal(node3.label, 'SSUB_D30B.LL1');

			checkInstructions(node1, [
				"LD A,$01",
				"JR SSUB_D30B.LL1"
			]);
			checkInstructions(node2, [
				"LD A,$02"
			]);
			checkInstructions(node3, [
				"RET"
			]);
		});


		test('Subroutine with jumps < subroutine address, with additional JP', () => {
			const startAddr = 0xD500;
			dng.getFlowGraph([startAddr], []);
			dng.disassembleNodes();

			dbgDisassembly((dng as any).nodes);

			const node1 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node1, undefined);
			assert.equal(node1.label, 'LLBL_D504');

			const node2 = dng.getNodeForAddress(startAddr + 9)!;
			assert.notEqual(node2, undefined);
			assert.equal(node2.label, 'SSUB_D509');


			checkInstructions(node1, [
				"LD A,$01",
				"JP SSUB_D509"
			]);
			checkInstructions(node2, [
				"LD A,$02",
				"JP NC,LLBL_D504"
			]);
		});

		test('Subroutine with jumps < subroutine address, with additional JP with hole', () => {
			const startAddr = 0xD600;
			dng.getFlowGraph([startAddr], []);
			dng.disassembleNodes();

			dbgDisassembly((dng as any).nodes);

			const node1 = dng.getNodeForAddress(startAddr + 4)!;
			assert.notEqual(node1, undefined);
			assert.equal(node1.label, 'LLBL_D604');

			const node2 = dng.getNodeForAddress(startAddr + 0x0A)!;
			assert.notEqual(node2, undefined);
			assert.equal(node2.label, 'SSUB_D60A');

			checkInstructions(node1, [
				"LD A,$01",
				"JP SSUB_D60A"
			]);
			checkInstructions(node2, [
				"LD A,$02",
				"JP NC,LLBL_D604"
			]);
		});


		test('Self modifying code', () => {
			const startAddr = 0xE000;
			dng.getFlowGraph([startAddr], []);
			dng.disassembleNodes();

			dbgDisassembly((dng as any).nodes);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			assert.equal(node1.label, undefined);

			const node2 = dng.getNodeForAddress(startAddr + 9)!;
			assert.notEqual(node2, undefined);
			assert.equal(node2.label, 'SSUB_E009');

			checkInstructions(node1, [
				"LD A,$01",
				"LD (SSUB_E009.CODE_E00B+1),A",
				"CALL SSUB_E009"
			]);
			checkInstructions(node2, [
				"LD A,$02",
				"LD B,$00",
				"RET"
			]);
		});

		test('Self modifying code through bank border', () => {
			const startAddr = 0x6000;
			dng.getFlowGraph([startAddr], []);
			dng.disassembleNodes();

			dbgDisassembly((dng as any).nodes);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			assert.equal(node1.label, undefined);

			checkInstructions(node1, [
				"LD A,$01",
				"LD ($E00C),A",
				"CALL $E009"
			]);
		});


		test('Label names from outside', () => {
			const startAddr = 0xE100;
			dng.getFlowGraph([startAddr], []);
			dng.funcGetLabel = (addr64k: number) => {
				if (addr64k == 0xE107)
					return "MY_DATA";
				return undefined;
			};
			dng.disassembleNodes();
			dbgDisassembly((dng as any).nodes);

			const node1 = dng.getNodeForAddress(startAddr)!;
			assert.notEqual(node1, undefined);
			assert.equal(node1.label, undefined);

			checkInstructions(node1, [
				"LD A,(MY_DATA)",
				"LD HL,MY_DATA",
				"RET"
			]);
		});
	});
});
