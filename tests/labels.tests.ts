import * as assert from 'assert';
import {LabelsClass, SourceFileEntry} from '../src/labels/labels';
import {MemoryModelAllRam, MemoryModelUnknown} from '../src/remotes/MemoryModel/genericmemorymodels';
import {MemoryModelZX81_1k, MemoryModelZX81_2k, MemoryModelZX81_16k, MemoryModelZX81_32k, MemoryModelZX81_48k, MemoryModelZX81_56k} from '../src/remotes/MemoryModel/zx81memorymodels';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {LabelParserBase} from '../src/labels/labelparserbase';
import {MemoryModel} from '../src/remotes/MemoryModel/memorymodel';


suite('Labels', () => {

	suite('Files/lines vs list file', () => {

		suite('z80asm', () => {

			test('getFileAndLineForAddress', () => {
				const config: any = {
					z80asm: [{
						path: './tests/data/labels/test1.list',
						srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};
				const lbls = new LabelsClass();
				lbls.readListFiles(config, new MemoryModelAllRam());

				// Checks
				let res = lbls.getFileAndLineForAddress(0x17700);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 0, "Expected line wrong.");

				res = lbls.getFileAndLineForAddress(0x17710);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 1, "Expected line wrong.");


				res = lbls.getFileAndLineForAddress(0x17721);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 2, "Expected line wrong.");

				res = lbls.getFileAndLineForAddress(0x17721);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 2, "Expected line wrong.");

				res = lbls.getFileAndLineForAddress(0x17723);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 2, "Expected line wrong.");


				res = lbls.getFileAndLineForAddress(0x18820);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 2, "Expected line wrong.");

				res = lbls.getFileAndLineForAddress(0x18831);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 3, "Expected line wrong.");

				res = lbls.getFileAndLineForAddress(0x18833);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 3, "Expected line wrong.");

				res = lbls.getFileAndLineForAddress(0x18834);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 4, "Expected line wrong.");

				res = lbls.getFileAndLineForAddress(0x18837);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 6, "Expected line wrong.");


				res = lbls.getFileAndLineForAddress(0x18841);
				assert.equal(res.fileName, 'zxspectrum.asm', "Path wrong.");
				assert.equal(res.lineNr, 9, "Expected line wrong.");


				res = lbls.getFileAndLineForAddress(0x18843);
				assert.equal(res.fileName, 'main.asm', "Path wrong.");
				assert.equal(res.lineNr, 5, "Expected line wrong.");

			});


			test('getAddrForFileAndLine', () => {
				const config: any = {
					z80asm: [{
						path: './tests/data/labels/test1.list',
						srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};
				const labels = new LabelsClass();
				labels.readListFiles(config, new MemoryModelAllRam());

				// main.asm
				let addr = labels.getAddrForFileAndLine('main.asm', 0);
				assert.equal(addr, 0x17700, "Expected address wrong.");

				addr = labels.getAddrForFileAndLine('main.asm', 1);
				assert.equal(addr, 0x17710, "Expected address wrong.");

				addr = labels.getAddrForFileAndLine('main.asm', 2);
				assert.equal(addr, 0x17721, "Expected address wrong.");


				addr = labels.getAddrForFileAndLine('zxspectrum.asm', 2);
				assert.equal(addr, 0x18820, "Expected address wrong.");

				addr = labels.getAddrForFileAndLine('zxspectrum.asm', 4);
				assert.equal(addr, 0x18834, "Expected address wrong.");

				addr = labels.getAddrForFileAndLine('zxspectrum.asm', 6);
				assert.equal(addr, 0x18837, "Expected address wrong.");

				addr = labels.getAddrForFileAndLine('zxspectrum.asm', 9);
				assert.equal(addr, 0x18841, "Expected address wrong.");


				addr = labels.getAddrForFileAndLine('main.asm', 5);
				assert.equal(addr, 0x18843, "Expected address wrong.");
			});


			test('get label values from list file', () => {
				const config: any = {
					z80asm: [{
						path: './tests/data/labels/test2.list',
						srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};
				const labels = new LabelsClass();
				labels.readListFiles(config, new MemoryModelAllRam());

				let value = labels.getNumberForLabel('screen_top');
				assert.equal(value, 0x16000, "Expected address wrong.");

				value = labels.getNumberForLabel('PAUSE_TIME');
				assert.equal(value, 5000, "Expected value wrong.");

				value = labels.getNumberForLabel('pause_loop_l2');
				assert.equal(value, 0x16004, "Expected address wrong.");

				value = labels.getNumberForLabel('pause_loop_l1');
				assert.equal(value, 0x16006, "Expected address wrong.");

				value = labels.getNumberForLabel('BCKG_LINE_SIZE');
				assert.equal(value, 32, "Expected value wrong.");

				value = labels.getNumberForLabel('BLACK');
				assert.equal(value, 0, "Expected value wrong.");

				value = labels.getNumberForLabel('MAGENTA');
				assert.equal(value, 3 << 3, "Expected address wrong.");	// NOSONAR

			});


			test('get labels for a value from list file', () => {
				const config: any = {
					z80asm: [{
						path: './tests/data/labels/test2.list',
						srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};
				const lbls = new LabelsClass();
				lbls.readListFiles(config, new MemoryModelAllRam());

				let labels = lbls.getLabelsForNumber64k(0x6000);
				assert.equal(labels[0], 'screen_top', "Expected label wrong.");

				labels = lbls.getLabelsForNumber64k(0x6004);
				assert.equal(labels[0], 'pause_loop_l2', "Expected label wrong.");

				labels = lbls.getLabelsPlusIndexForNumber64k(0x6008);
				assert.equal(labels[0], 'pause_loop_l1+2', "Expected label+index wrong.");

			});


		});	// z80asm

	});


	suite('List files', () => {

		suite('z80asm', () => {

			test('z80asm.list', () => {
				const config: any = {
					z80asm: [{
						path: './tests/data/labels/z80asm.list', srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};
				const labels = new LabelsClass();
				labels.readListFiles(config, new MemoryModelAllRam());

				// Checks
				let res = labels.getNumberForLabel("check_score_for_new_ship");
				assert.equal(0x17015, res, "Label wrong.");

				res = labels.getNumberForLabel("ltest1");
				assert.equal(0x1701C, res, "Label wrong.");

				res = labels.getNumberForLabel("SCREEN_COLOR");
				assert.equal(0x15800, res, "Label wrong.");

				res = labels.getNumberForLabel("SCREEN_SIZE");
				assert.equal(0x1800, res, "Label wrong.");
			});

			test('rom.list', () => {
				const config: any = {z80asm: [{path: './tests/data/labels/rom.list', srcDirs: []}]};
				const labels = new LabelsClass();
				labels.readListFiles(config, new MemoryModelAllRam());

				// Checks
				let res = labels.getNumberForLabel("L0055");
				assert.equal(0x10055, res, "Label wrong.");

				res = labels.getNumberForLabel("L022C");
				assert.equal(0x1022C, res, "Label wrong.");
			});
		});


		suite('z88dk', () => {

			test('z88dk.lis', () => {
				const config: any = {
					z88dk: [{
						path: './tests/data/labels/z88dk.lis',
						mapFile: './tests/data/labels/z88dk_empty.map',
						srcDirs: [""],	// Sources mode
						excludeFiles: [],
						version: "1"
					}]
				};
				const labels = new LabelsClass();
				labels.readListFiles(config, new MemoryModelAllRam());

				// Checks
				let res = labels.getNumberForLabel("ct_ui_first_table");
				assert.equal(res, 0x1000B);
				res = labels.getNumberForLabel("display_hor_zero_markers");
				assert.equal(res, 0x109A7);
				res = labels.getNumberForLabel("display_hor_a_address");
				assert.equal(res, 0x109A1);

				// defc (=equ) is not supported
				res = labels.getNumberForLabel("MAGENTA");
				assert.notEqual(res, 3);

				// defc (=equ) is not supported
				res = labels.getNumberForLabel("CS_ROM_VALUE");
				assert.notEqual(res, 0xF1);
			});


			test('z88dk map file (currah)', () => {
				const config: any = {
					z88dk: [{
						path: './tests/data/labels/currah_uspeech_tests.lis', mapFile: './tests/data/labels/currah_uspeech_tests.map',
						srcDirs: [""],	// Sources mode
						excludeFiles: [],
						version: "1"
					}]
				};
				const labels = new LabelsClass();
				labels.readListFiles(config, new MemoryModelAllRam());

				// Checks
				let res = labels.getNumberForLabel("ct_input_l2");
				assert.equal(0x180A6, res, "Label wrong.");

				res = labels.getNumberForLabel("main");
				assert.equal(0x18000, res, "Label wrong.");

				// defc (=equ) is not supported
				res = labels.getNumberForLabel("print_number_address");
				assert.equal(undefined, res, "Label wrong.");

				res = labels.getNumberForLabel("SCREEN_COLOR");
				assert.equal(undefined, res, "Label wrong.");
			});
		});
	});



	suite('Misc', () => {

		suite('calculateLabelDistances', () => {

			let labels;

			setup(() => {
				labels = new LabelsClass();
			});

			function initNumberforLabels(addresses: Array<number>) {
				labels.numberForLabel = new Map<string, number>();
				labels.distanceForLabelAddress = new Map<number, number>();
				for (let address of addresses) {
					// LAbel name does not matter
					labels.numberForLabel.set("does_not_matter_"+address, address);
				}
				labels.calculateLabelDistances();
			}

			test('64k addresses', () => {
				// Test empty array (no labels)
				initNumberforLabels([]);
				assert.equal(labels.distanceForLabelAddress.size, 0);

				// Test one label
				initNumberforLabels([0x8000]);
				assert.equal(labels.distanceForLabelAddress.size, 0);

				// Test two label
				initNumberforLabels([0x8000, 0x8001]);
				assert.equal(labels.distanceForLabelAddress.size, 1);
				assert.equal(labels.distanceForLabelAddress.get(0x8000).distance, 1);

				// Test several labels
				initNumberforLabels([0x8000, 0x8001, 0x8003, 0x8006, 0x8106]);
				assert.equal(labels.distanceForLabelAddress.size, 4);
				assert.equal(labels.distanceForLabelAddress.get(0x8000).distance, 1);
				assert.equal(labels.distanceForLabelAddress.get(0x8001).distance, 2);
				assert.equal(labels.distanceForLabelAddress.get(0x8003).distance, 3);
				assert.equal(labels.distanceForLabelAddress.get(0x8006).distance, 0x100);
				assert.equal(labels.distanceForLabelAddress.get(0x8106), undefined);

				// Test same bank, lower (e.g. an EQU). Is not the correct size but may happen.
				initNumberforLabels([0x8000, 0x8003, 0x7000, 0x8004]);
				assert.equal(labels.distanceForLabelAddress.size, 2);
				assert.equal(labels.distanceForLabelAddress.get(0x8000).distance, 3);
				assert.equal(labels.distanceForLabelAddress.get(0x7000).distance, 0x1004);
			});

			test('long addresses', () => {
				// Test one label
				initNumberforLabels([0x018000]);
				assert.equal(labels.distanceForLabelAddress.size, 0);

				// Test two label
				initNumberforLabels([0x018000, 0x018001]);
				assert.equal(labels.distanceForLabelAddress.size, 1);
				assert.equal(labels.distanceForLabelAddress.get(0x018000).distance, 1);

				// Test several labels
				initNumberforLabels([0x028000, 0x028001, 0x028003, 0x028006, 0x028106]);
				assert.equal(labels.distanceForLabelAddress.size, 4);
				assert.equal(labels.distanceForLabelAddress.get(0x028000).distance, 1);
				assert.equal(labels.distanceForLabelAddress.get(0x028001).distance, 2);
				assert.equal(labels.distanceForLabelAddress.get(0x028003).distance, 3);
				assert.equal(labels.distanceForLabelAddress.get(0x028006).distance, 0x100);
				assert.equal(labels.distanceForLabelAddress.get(0x028106), undefined);

				// Different banks (consecutive)
				initNumberforLabels([0x018000, 0x028001, 0x038003, 0x048006, 0x058106]);
				assert.equal(labels.distanceForLabelAddress.size, 4);
				assert.equal(labels.distanceForLabelAddress.get(0x018000).distance, 1);
				assert.equal(labels.distanceForLabelAddress.get(0x028001).distance, 2);
				assert.equal(labels.distanceForLabelAddress.get(0x038003).distance, 3);
				assert.equal(labels.distanceForLabelAddress.get(0x048006).distance, 0x100);
				assert.equal(labels.distanceForLabelAddress.get(0x058106), undefined);

				// Different banks (lower). Note: this results in incorrect sizes. E.g.
				// If an equ was defined between the labels.
				initNumberforLabels([0x018000, 0x028001, 0x037000, 0x028004]);
				assert.equal(labels.distanceForLabelAddress.size, 2);
				assert.equal(labels.distanceForLabelAddress.get(0x018000).distance, 1);
				assert.equal(labels.distanceForLabelAddress.get(0x028001), undefined);
				assert.equal(labels.distanceForLabelAddress.get(0x037000).distance, 0x1004);
				assert.equal(labels.distanceForLabelAddress.get(0x028004), undefined);
			});

		});

	});


	suite('LabelParserBase: checkMappingToTargetMemoryModel', () => {
		// There are a few tests in here for different memory models.
		// However, probably one test would be sufficent as now there is only
		// a generic implementation for all memory models in LabelParserBase.

		class MockLabelParserBase extends LabelParserBase {
			protected parseLabelAndAddress(line: string) {
				//
			}
			protected parseFileAndLineNumber(line: string) {
				//
			}
		}

		let tmpFile;
		let parser: any;

		setup(() => {
			// File path for a temporary file.
			tmpFile = path.join(os.tmpdir(), 'dezog_labels_test_empty.list');
			// Write empty file. We just need n empty file no labels.
			fs.writeFileSync(tmpFile, "");
		});

		function createParser(mm: MemoryModel) {
			// Read the empty list file
			const config: any = {
				path: tmpFile,
				srcDirs: [""],	// Sources mode
				excludeFiles: []
			};
			parser = new MockLabelParserBase(
				mm,
				new Map<number, SourceFileEntry>(),
				new Map<string, Array<number>>(),
				new Array<any>(),
				new Map<number, Array<string>>(),
				new Map<string, number>(),
				new Map<string, {file: string, lineNr: number, address: number}>(),
				new Array<{address: number, line: string}>(),
				new Array<{address: number, line: string}>(),
				new Array<{address: number, line: string}>(),
				(issue) => {});	// NOSONAR
			parser.loadAsmListFile(config);
		}

		// Cleanup
		teardown(() => {
			fs.unlinkSync(tmpFile);
		});


		test('Target: MemoryModelUnknown', () => {
			const mm = new MemoryModelUnknown();
			createParser(mm);

			assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
			assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
			assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
			assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
			assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);
			assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);
			assert.equal(parser.createLongAddress(0xC000, 0), 0x1C000);
			assert.equal(parser.createLongAddress(0xE000, 0), 0x1E000);
		});

		test('Target: MemoryModelAllRam', () => {
			const mm = new MemoryModelAllRam();
			createParser(mm);

			assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
			assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
			assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
			assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
			assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);
			assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);
			assert.equal(parser.createLongAddress(0xC000, 0), 0x1C000);
			assert.equal(parser.createLongAddress(0xE000, 0), 0x1E000);
		});


		test('Target: MemoryModelZX81_1k', () => {
			const mm = new MemoryModelZX81_1k();
			createParser(mm);

			assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
			assert.equal(parser.createLongAddress(0x1FFF, 0), 0x11FFF);
			assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x2FFF, 0), 0x12FFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
			assert.equal(parser.createLongAddress(0x43FF, 0), 0x243FF);
			assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x9FFF, 0), 0x19FFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0xBFFF, 0), 0x1BFFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);	// Mirrored RAM
			assert.equal(parser.createLongAddress(0xC3FF, 0), 0x2C3FF);	// Mirrored RAM

			// Not existing:
			assert.equal(parser.createLongAddress(0x4400, 0), 0x34400);
			assert.equal(parser.createLongAddress(0x6000, 0), 0x36000);
			assert.equal(parser.createLongAddress(0xC400, 0), 0x4C400);
			assert.equal(parser.createLongAddress(0xE000, 0), 0x4E000);
			assert.equal(parser.createLongAddress(0xFFFF, 0), 0x4FFFF);
		});

		test('Target: MemoryModelZX81_2k', () => {
			const mm = new MemoryModelZX81_2k();
			createParser(mm);

			assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
			assert.equal(parser.createLongAddress(0x1FFF, 0), 0x11FFF);
			assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x2FFF, 0), 0x12FFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
			assert.equal(parser.createLongAddress(0x47FF, 0), 0x247FF);
			assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x9FFF, 0), 0x19FFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0xBFFF, 0), 0x1BFFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);	// Mirrored RAM
			assert.equal(parser.createLongAddress(0xC7FF, 0), 0x2C7FF);	// Mirrored RAM

			// Not existing:
			assert.equal(parser.createLongAddress(0x4800, 0), 0x34800);
			assert.equal(parser.createLongAddress(0x6000, 0), 0x36000);
			assert.equal(parser.createLongAddress(0xC800, 0), 0x4C800);
			assert.equal(parser.createLongAddress(0xE000, 0), 0x4E000);
			assert.equal(parser.createLongAddress(0xFFFF, 0), 0x4FFFF);
		});

		test('Target: MemoryModelZX81_16k', () => {
			const mm = new MemoryModelZX81_16k();
			createParser(mm);

			assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
			assert.equal(parser.createLongAddress(0x1FFF, 0), 0x11FFF);
			assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x2FFF, 0), 0x12FFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
			assert.equal(parser.createLongAddress(0x7FFF, 0), 0x27FFF);
			assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x9FFF, 0), 0x19FFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0xBFFF, 0), 0x1BFFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);	// Mirrored RAM
			assert.equal(parser.createLongAddress(0xFFFF, 0), 0x2FFFF);	// Mirrored RAM
		});

		test('Target: MemoryModelZX81_32k', () => {
			const mm = new MemoryModelZX81_32k();
			createParser(mm);

			assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
			assert.equal(parser.createLongAddress(0x1FFF, 0), 0x11FFF);
			assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x2FFF, 0), 0x12FFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
			assert.equal(parser.createLongAddress(0x7FFF, 0), 0x27FFF);
			assert.equal(parser.createLongAddress(0x8000, 0), 0x38000);
			assert.equal(parser.createLongAddress(0xBFFF, 0), 0x3BFFF);
			assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);	// Mirrored RAM
			assert.equal(parser.createLongAddress(0xFFFF, 0), 0x2FFFF);	// Mirrored RAM
		});

		test('Target: MemoryModelZX81_48k', () => {
			const mm = new MemoryModelZX81_48k();
			createParser(mm);

			assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
			assert.equal(parser.createLongAddress(0x1FFF, 0), 0x11FFF);
			assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x2FFF, 0), 0x12FFF);	// Mirrored ROM
			assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
			assert.equal(parser.createLongAddress(0x6000, 0), 0x26000);
			assert.equal(parser.createLongAddress(0x8000, 0), 0x28000);
			assert.equal(parser.createLongAddress(0xA000, 0), 0x2A000);
			assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);
			assert.equal(parser.createLongAddress(0xE000, 0), 0x2E000);
			assert.equal(parser.createLongAddress(0xFFFF, 0), 0x2FFFF);
		});

		test('Target: MemoryModelZX81_56k', () => {
			const mm = new MemoryModelZX81_56k();
			createParser(mm);

			assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
			assert.equal(parser.createLongAddress(0x2000, 0), 0x22000);
			assert.equal(parser.createLongAddress(0x2FFF, 0), 0x22FFF);
			assert.equal(parser.createLongAddress(0x3FFF, 0), 0x23FFF);
			assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
			assert.equal(parser.createLongAddress(0x6000, 0), 0x26000);
			assert.equal(parser.createLongAddress(0x8000, 0), 0x28000);
			assert.equal(parser.createLongAddress(0xA000, 0), 0x2A000);
			assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);
			assert.equal(parser.createLongAddress(0xE000, 0), 0x2E000);
			assert.equal(parser.createLongAddress(0xFFFF, 0), 0x2FFFF);
		});


		test('Target: MemoryModelZx16k', () => {
			const mm = new MemoryModelZX81_16k();
			createParser(mm);

			assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
			assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
			assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
			assert.equal(parser.createLongAddress(0x6000, 0), 0x26000);
			// Not existing bank 2 (0x30000):
			assert.equal(parser.createLongAddress(0x8000, 0), 0x38000);
			assert.equal(parser.createLongAddress(0xA000, 0), 0x3A000);
			assert.equal(parser.createLongAddress(0xC000, 0), 0x3C000);
			assert.equal(parser.createLongAddress(0xE000, 0), 0x3E000);
		});

		test('Target: MemoryModelZx48k', () => {
			const mm = new MemoryModelZX81_48k();
			createParser(mm);

			assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
			assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
			assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
			assert.equal(parser.createLongAddress(0x6000, 0), 0x26000);
			assert.equal(parser.createLongAddress(0x8000, 0), 0x28000);
			assert.equal(parser.createLongAddress(0xA000, 0), 0x2A000);
			assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);
			assert.equal(parser.createLongAddress(0xE000, 0), 0x2E000);
		});

	});

});
