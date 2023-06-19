import * as assert from 'assert';
import {LabelsClass} from '../src/labels/labels';


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
				lbls.readListFiles(config);

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
				labels.readListFiles(config);

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
				labels.readListFiles(config);

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
				assert.equal(value, 3 << 3, "Expected address wrong.");

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
				lbls.readListFiles(config);

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
				labels.readListFiles(config);

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
				labels.readListFiles(config);

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
				labels.readListFiles(config);

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
				labels.readListFiles(config);

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

		});

	});

});
