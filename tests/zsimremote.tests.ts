import * as assert from 'assert';
import {ZSimRemote} from '../src/remotes/zsimulator/zsimremote';
import {Settings} from '../src/settings/settings';
import {Utility} from '../src/misc/utility';
import {Z80RegistersClass} from '../src/remotes/z80registers';



suite('ZSimRemote', () => {
	let zsim: ZSimRemote;
	let zsimAny: any; // Same as any

	suite('48k', () => {

		setup(() => {
			Utility.setExtensionPath('.');
			const cfg: any = {
				remoteType: 'zsim',
				zsim: {
					zxKeyboard: true,
					visualMemory: true,
					ulaScreen: "spectrum",
					cpuLoad: 1,
					Z80N: false,
					memoryModel: "ZX48K"
				},
				history: {
					reverseDebugInstructionCount: 0,
					spotCount: 0,
					codeCoverageEnabled: false
				}
			};
			const launch = Settings.Init(cfg);
			Z80RegistersClass.createRegisters(launch);
			zsim = new ZSimRemote(launch);
			zsimAny = zsim as any;
			zsimAny.configureMachine(Settings.launch.zsim);
		});

		test('Check ROM', () => {
			// Check first 2 bytes
			let value = zsim.memory.read8(0x0000);
			assert.equal(0xF3, value);
			value = zsim.memory.read8(0x0001);
			assert.equal(0xAF, value);

			// Check last 2 bytes
			value = zsim.memory.read8(0x3FFE);
			assert.equal(0x42, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x3C, value);
		});
	});


	suite('memoryPagingControl, ZX128K', () => {

		setup(() => {
			Utility.setExtensionPath('.');
			const cfg: any = {
				zsim: {
					zxKeyboard: true,
					visualMemory: true,
					ulaScreen: "spectrum",
					cpuLoad: 1,
					Z80N: false,
					memoryModel: "ZX128K"
				},
				history: {
					reverseDebugInstructionCount: 0,
					spotCount: 0,
					codeCoverageEnabled: false
				}
			};
			const launch = Settings.Init(cfg);
			Z80RegistersClass.createRegisters(launch);
			Utility.setRootPath('/');	// Does not matter but must be set.
			zsim = new ZSimRemote(launch);
			zsimAny = zsim as any;
			zsimAny.configureMachine(Settings.launch.zsim);
		});

		test('Check ROM 0 / 1', () => {
			// The editor ROM (0) is enabled by default

			// Check first 2 bytes
			let value = zsim.memory.read8(0x0000);
			assert.equal(0xF3, value);
			value = zsim.memory.read8(0x0001);
			assert.equal(0x01, value);

			// Check last 2 bytes
			value = zsim.memory.read8(0x3FFE);
			assert.equal(0x00, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x01, value);

			// Switch to 48K ROM
			zsim.ports.write(0x7FFD, 0b010000);

			// Check first 2 bytes
			value = zsim.memory.read8(0x0000);
			assert.equal(0xF3, value);
			value = zsim.memory.read8(0x0001);
			assert.equal(0xAF, value);

			// Check last 2 bytes
			value = zsim.memory.read8(0x3FFE);
			assert.equal(0x42, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x3C, value);

			// Switch to 128k ROM
			zsim.ports.write(0x7FFD, 0);

			// Check first 2 bytes
			value = zsim.memory.read8(0x0000);
			assert.equal(0xF3, value);
			value = zsim.memory.read8(0x0001);
			assert.equal(0x01, value);

			// Check last 2 bytes
			value = zsim.memory.read8(0x3FFE);
			assert.equal(0x00, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x01, value);
		});



		test('bank switching', () => {
			// Address used for writing/reading
			const address = 0xC000;

			// Put unique number in each bank
			for (let bank = 0; bank < 8; bank++) {
				// Do memory switch to bank x
				zsim.ports.write(0x7FFD, bank);
				// Write unique number
				zsim.memory.write8(address, 10 + bank);
			}

			// Now read the addresses and check
			for (let bank = 0; bank < 8; bank++) {
				// Do memory switch to bank x
				zsim.ports.write(0x7FFD, bank);
				// Read unique number
				const value = zsim.memory.read8(address);
				assert.equal(10 + bank, value);
			}

			// Check additionally the screen
			const value = zsim.memory.read8(address + 0x4000 - 0xC000);
			assert.equal(10 + 5, value);
		});



		test('paging disable', () => {
			// Disable memory paging
			zsim.ports.write(0x7FFD, 0b0100000);

			// Try a switch to 48k ROM
			zsim.ports.write(0x7FFD, 0b010000);

			// Check that this did not happen
			let value = zsim.memory.read8(0x0001);
			assert.equal(0x01, value);
			value = zsim.memory.read8(0x3FFF);
			assert.equal(0x01, value);
		});

	});
});

