import { CustomMemoryType } from './../src/settings/settingscustommemory';

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {LabelsClass, SourceFileEntry} from '../src/labels/labels';
import {SjasmplusMemoryModel, SjasmplusSldLabelParser} from '../src/labels/sjasmplussldlabelparser';
import {MemoryModel} from '../src/remotes/MemoryModel/memorymodel';
import {MemoryModelAllRam, MemoryModelUnknown} from '../src/remotes/MemoryModel/genericmemorymodels';
import { MemoryModelZX81_48k } from '../src/remotes/MemoryModel/zx81memorymodels';


suite('Labels (sjasmplus)', () => {

	suite('Labels', () => {

		test('Labels', () => {
			// Read result data (labels)
			const labelsFile = fs.readFileSync('./tests/data/labels/projects/sjasmplus/general/general.labels').toString().split('\n');

			// Read the list file
			const config: any = {
				sjasmplus: [{
					path: './tests/data/labels/projects/sjasmplus/general/general.sld', srcDirs: [""],	// Sources mode
					excludeFiles: []
				}]
			};
			const lbls = new LabelsClass();
			lbls.readListFiles(config, new MemoryModelUnknown());

			// Compare all labels
			// Note: All NOSLOT64K labels are now mapped to 1 bank internally
			for (const labelLine of labelsFile) {
				if (labelLine == '')
					continue;
				// A line looks like: "modfilea.fa_label3.mid.local: equ 0x00009003"
				const match = /@?(.*):\s+equ\s+(.*)/i.exec(labelLine)!;
				assert.notEqual(undefined, match);	// Check that line is parsed correctly
				const label = match[1];
				const value = parseInt(match[2], 16);
				// Check
				const res = lbls.getNumberForLabel(label);
				assert.equal(value, res!, label);
			}
		});

		test('IF 0 Labels', () => {
			// Read the list file
			const config: any = {
				sjasmplus: [{
					path: './tests/data/labels/projects/sjasmplus/general/general.sld',
					srcDirs: [""],	// Sources mode
					excludeFiles: []
				}]
			};
			const lbls = new LabelsClass();
			lbls.readListFiles(config, new MemoryModelUnknown());

			// Test that a label under an IF 0/ENDIF is not defined
			const res = lbls.getNumberForLabel('label5');
			assert.equal(undefined, res);
		});


		suite('Sources-Mode', () => {

			test('Labels location', () => {
				// Read the list file
				const config: any = {
					sjasmplus: [{
						path: './tests/data/labels/projects/sjasmplus/general/general.sld',
						srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};
				const lbls = new LabelsClass();
				lbls.readListFiles(config, new MemoryModelUnknown());

				// Test
				let res = lbls.getLocationOfLabel('label1')!;
				assert.notEqual(undefined, res);
				assert.equal('main.asm', res.file);
				assert.equal(18 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('fa_label1')!;
				assert.notEqual(undefined, res);
				assert.equal('filea.asm', res.file);
				assert.equal(2 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('modfilea.fa_label2')!;
				assert.notEqual(undefined, res);
				assert.equal('filea.asm', res.file);
				assert.equal(6 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('modfilea.fa_label3.mid')!;
				assert.notEqual(undefined, res);
				assert.equal('filea.asm', res.file);
				assert.equal(9 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('modfilea.fab_label1')!;
				assert.notEqual(undefined, res);
				assert.equal('filea_b.asm', res.file);
				assert.equal(3 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('modfilea.modfileb.fab_label2')!;
				assert.notEqual(undefined, res);
				assert.equal('filea_b.asm', res.file);
				assert.equal(8 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('global_label1')!;
				assert.notEqual(undefined, res);
				assert.equal('filea_b.asm', res.file);
				assert.equal(12 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('global_label2')!;
				assert.notEqual(undefined, res);
				assert.equal('filea_b.asm', res.file);
				assert.equal(14 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('modfilea.fab_label_equ1')!;
				assert.notEqual(undefined, res);
				assert.equal('filea_b.asm', res.file);
				assert.equal(22 - 1, res.lineNr);	// line number starts at 0
			});


			test('address -> file/line', () => {
				// Read the list file
				const config: any = {
					sjasmplus: [{
						path: './tests/data/labels/projects/sjasmplus/general/general.sld',
						srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};
				const lbls = new LabelsClass();
				lbls.readListFiles(config, new MemoryModelUnknown());

				// Tests
				let res = lbls.getFileAndLineForAddress(0x10000 + 0x8000);
				assert.ok(res.fileName.endsWith('main.asm'));
				assert.equal(19 - 1, res.lineNr);

				res = lbls.getFileAndLineForAddress(0x10000 + 0x9001);
				assert.ok(res.fileName.endsWith('filea.asm'));
				assert.equal(7 - 1, res.lineNr);

				res = lbls.getFileAndLineForAddress(0x10000 + 0x9005);
				assert.ok(res.fileName.endsWith('filea_b.asm'));
				assert.equal(4 - 1, res.lineNr);

				res = lbls.getFileAndLineForAddress(0x10000 + 0x900B);
				assert.ok(res.fileName.endsWith('filea.asm'));
				assert.equal(17 - 1, res.lineNr);
			});


			test('file/line -> address', () => {
				// Read the list file
				const config: any = {
					sjasmplus: [{
						path: './tests/data/labels/projects/sjasmplus/general/general.sld', srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};
				const lbls = new LabelsClass();
				lbls.readListFiles(config, new MemoryModelUnknown());

				// Tests
				let address = lbls.getAddrForFileAndLine('main.asm', 19 - 1);
				assert.equal(0x10000 + 0x8000, address);

				address = lbls.getAddrForFileAndLine('filea.asm', 7 - 1);
				assert.equal(0x10000 + 0x9001, address);

				address = lbls.getAddrForFileAndLine('filea_b.asm', 4 - 1);
				assert.equal(0x10000 + 0x9005, address);

				address = lbls.getAddrForFileAndLine('filea.asm', 17 - 1);
				assert.equal(0x10000 + 0x900B, address);
			});

		});

	});


	test('Occurrence of WPMEM, ASSERTION, LOGPOINT', () => {
		// Read the list file
		const config: any = {
			sjasmplus: [{
				path: './tests/data/labels/projects/sjasmplus/general/general.sld', srcDirs: [""],	// Sources mode
				excludeFiles: []
			}]
		};
		const lbls = new LabelsClass();
		lbls.readListFiles(config, new MemoryModelUnknown());

		// Test WPMEM
		const wpLines = lbls.getWatchPointLines();
		assert.equal(wpLines.length, 1);
		assert.equal(wpLines[0].address, 0x10000 + 0x8200);
		assert.equal(wpLines[0].line, "WPMEM");

		// Test ASSERTION
		const assertionLines = lbls.getAssertionLines();
		assert.equal(assertionLines.length, 1);
		assert.equal(assertionLines[0].address, 0x10000 + 0x8005);
		assert.equal(assertionLines[0].line, "ASSERTION");

		// Test LOGPOINT
		const lpLines = lbls.getLogPointLines();
		assert.equal(lpLines.length, 1);
		assert.equal(lpLines[0].address, 0x10000 + 0x800F);
		assert.equal(lpLines[0].line, "LOGPOINT");
	});

	suite('Self modifying code', () => {

		let lbls;

		setup(() => {
			// Read the list file
			const config: any = {
				sjasmplus: [{
					path: './tests/data/labels/projects/sjasmplus/sld_self_modifying_code/main.sld', srcDirs: [""],	// Sources mode
					excludeFiles: []
				}]
			};
			lbls = new LabelsClass();
			lbls.readListFiles(config, new MemoryModelZX81_48k());
		});

		test('Start addresses found', () => {
			// Note 0x8000 is at bank 4. So: 0x05....

			// 0x8000
			let entry = lbls.getFileAndLineForAddress(0x058000);
			assert.notEqual(entry.fileName, '');	// Known

			// 0x8100
			entry = lbls.getFileAndLineForAddress(0x058100);
			assert.notEqual(entry.fileName, '');	// Known

			// 0x8200, 0x8201, 0x8203, 0x8206, 0x800A
			entry = lbls.getFileAndLineForAddress(0x058200);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x058201);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x058203);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x058206);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x05820A);
			assert.notEqual(entry.fileName, '');	// Known

			// 0x8300
			entry = lbls.getFileAndLineForAddress(0x058300);
			assert.notEqual(entry.fileName, '');	// Known
		});

		test('Address ranges (after start address) found', () => {
			// Note 0x8000 is at bank 4. So: 0x05....

			// 0x8001-0x8002
			let entry = lbls.getFileAndLineForAddress(0x058001);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x058002);
			assert.notEqual(entry.fileName, '');	// Known

			// 0x8101-0x8102
			entry = lbls.getFileAndLineForAddress(0x058101);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x058102);
			assert.notEqual(entry.fileName, '');	// Known

			// 0x8202, 0x8004, 0x8005, 0x8007, 0x8008, 0x8009
			entry = lbls.getFileAndLineForAddress(0x058202);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x058204);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x058205);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x058207);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x058208);
			assert.notEqual(entry.fileName, '');	// Known
			entry = lbls.getFileAndLineForAddress(0x058209);
			assert.notEqual(entry.fileName, '');	// Known

			// 0x8301
			entry = lbls.getFileAndLineForAddress(0x058301);
			assert.notEqual(entry.fileName, '');	// Known
		});

	});


	suite('checkMappingToTargetMemoryModel', () => {
		let tmpFile;
		let parser: any;
		let sldText;

		setup(() => {
			// File path for a temporary file.
			tmpFile = path.join(os.tmpdir(), 'dezog_labels_test.sld');
		});

		function createSldFile(mm: MemoryModel) {
			// Prepare sld file:
			fs.writeFileSync(tmpFile, sldText);
			// Read the list file
			const config: any = {
				path: tmpFile,
				srcDirs: [],
				excludeFiles: []
			};
			parser = new SjasmplusSldLabelParser(
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


		suite('sjasmplus: unsupported', () => {
			// DEVICE NONE

			setup(() => {
				// Prepare sld file:
				sldText =	// A ZXSPECTRUM256 for example is not supported
					`|SLD.data.version|1
||K|KEYWORDS|WPMEM,LOGPOINT,ASSERTION
main.asm|12||0|-1|-1|Z|pages.size:16384,pages.count:16,slots.count:4,slots.adr:0,16384,32768,49152
`;
			});

			test('sourceMemoryModel', () => {
				const mm = new MemoryModelUnknown();
				assert.throws(() => {
					createSldFile(mm);
				}, Error("Unsupported sjasmplus memory model (DEVICE)."));
			});
		});


		suite('sjasmplus: NONE', () => {
			// DEVICE NONE

			setup(() => {
				// Prepare sld file:
				sldText =
					`|SLD.data.version|1
||K|KEYWORDS|WPMEM,LOGPOINT,ASSERTION
`;
			});

			test('sourceMemoryModel', () => {
				const mm = new MemoryModelUnknown();
				assert.throws(() => {
					createSldFile(mm);
				}, Error);
			});
		});

		suite('sjasmplus: NOSLOT64K', () => {
			// Just one 64k Bank.

			setup(() => {
				// Prepare sld file:
				sldText =
					`|SLD.data.version|1
||K|KEYWORDS|WPMEM,LOGPOINT,ASSERTION
main.asm|12||0|-1|-1|Z|pages.size:65536,pages.count:32,slots.count:1,slots.adr:0
`;
			});

			test('sourceMemoryModel', () => {
				const mm = new MemoryModelUnknown();
				createSldFile(mm);

				assert.equal(parser.sourceMemoryModel(), SjasmplusMemoryModel.NOSLOT64K);
			});

			test('Target: MemoryModelUnknown', () => {
				const mm = new MemoryModelUnknown();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x1C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x1E000);
			});

			test('Target: MemoryModelAll', () => {
				const mm = new MemoryModelAllRam();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x1C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x1E000);
			});

			test('Target: MemoryModelZx48k', () => {
				const mm = new MemoryModelZX81_48k();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x26000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x28000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x2A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x2E000);
			});


			test('Target: MemoryModelCustom', () => {
				const cfg: CustomMemoryType = {
					"slots": [
						{
							"range": [ 0x0000, 0x7FFF ],
							"banks": [
								{
									"index": 0
								}
							]
						},
						{
							"range": [ 0x8000, 0xBFFF ],
							"banks": [
								{
									"index": [5, 9]
								}
							],
						},
						{
							"range": [ 0xC000, 0xFFFF ],
							"banks": [
								{
									"index": [1, 4]
								}
							],
							"initialBank": 3
						},
					]
				};
				const mm = new MemoryModel(cfg);
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x68000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x6A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x4C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x4E000);
			});
		});


		suite('sjasmplus: ZX48K', () => {
			setup(() => {
				// Prepare sld file:
				sldText =
					`|SLD.data.version|1
||K|KEYWORDS|WPMEM,LOGPOINT,ASSERTION
main.asm|12||0|-1|-1|Z|pages.size:16384,pages.count:4,slots.count:4,slots.adr:0,16384,32768,49152
`;
			});

			test('sourceMemoryModel', () => {
				const mm = new MemoryModelUnknown();
				createSldFile(mm);

				assert.equal(parser.sourceMemoryModel(), SjasmplusMemoryModel.NOSLOT64K);
			});

			test('Target: MemoryModelUnknown', () => {	// NOSONAR
				const mm = new MemoryModelUnknown();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x1C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x1E000);
			});

			test('Target: MemoryModelAll', () => {	// NOSONAR
				const mm = new MemoryModelAllRam();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x1C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x1E000);
			});

			test('Target: MemoryModelZx48k', () => {	// NOSONAR
				const mm = new MemoryModelZX81_48k();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x26000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x28000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x2A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x2E000);
			});

			test('Target: MemoryModelCustom', () => {
				const cfg: CustomMemoryType = {
					"slots": [
						{
							"range": [ 0x0000, 0x7FFF ],
							"banks": [
								{
									"index": 0
								}
							]
						},
						{
							"range": [ 0x8000, 0xBFFF ],
							"banks": [
								{
									"index": [5, 9]
								}
							],
						},
						{
							"range": [ 0xC000, 0xFFFF ],
							"banks": [
								{
									"index": [1, 4]
								}
							],
							"initialBank": 3
						},
					]
				};
				const mm = new MemoryModel(cfg);
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x68000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x6A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x4C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x4E000);
			});
		});


		suite('sjasmplus: ZX128K', () => {
			setup(() => {
				// Prepare sld file:
				sldText =
					`|SLD.data.version|1
||K|KEYWORDS|WPMEM,LOGPOINT,ASSERTION
main.asm|11||0|-1|-1|Z|pages.size:16384,pages.count:8,slots.count:4,slots.adr:0,16384,32768,49152
`;
			});

			test('sourceMemoryModel', () => {
				const mm = new MemoryModelUnknown();
				createSldFile(mm);

				assert.equal(parser.sourceMemoryModel(), SjasmplusMemoryModel.NOSLOT64K);
			});

			test('Target: MemoryModelUnknown', () => {	// NOSONAR
				const mm = new MemoryModelUnknown();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x1C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x1E000);
			});

			test('Target: MemoryModelAll', () => {	// NOSONAR
				const mm = new MemoryModelAllRam();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x1C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x1E000);
			});

			test('Target: MemoryModelZx48k', () => {	// NOSONAR
				const mm = new MemoryModelZX81_48k();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x26000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x28000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x2A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x2E000);
			});

			test('Target: MemoryModelCustom', () => {
				const cfg: CustomMemoryType = {
					"slots": [
						{
							"range": [ 0x0000, 0x7FFF ],
							"banks": [
								{
									"index": 0
								}
							]
						},
						{
							"range": [ 0x8000, 0xBFFF ],
							"banks": [
								{
									"index": [5, 9]
								}
							],
						},
						{
							"range": [ 0xC000, 0xFFFF ],
							"banks": [
								{
									"index": [1, 4]
								}
							],
							"initialBank": 3
						},
					]
				};
				const mm = new MemoryModel(cfg);
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x68000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x6A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x4C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x4E000);
			});
		});


		suite('sjasmplus: ZXNEXT', () => {

			setup(() => {
				// Prepare sld file:
				sldText =
					`|SLD.data.version|1
||K|KEYWORDS|WPMEM,LOGPOINT,ASSERTION
main.asm|14||0|-1|-1|Z|pages.size:8192,pages.count:224,slots.count:8,slots.adr:0,8192,16384,24576,32768,40960,49152,57344
`;
			});

			test('sourceMemoryModel', () => {
				const mm = new MemoryModelUnknown();
				createSldFile(mm);

				assert.equal(parser.sourceMemoryModel(), SjasmplusMemoryModel.NOSLOT64K);
			});

			test('Target: MemoryModelUnknown', () => {	// NOSONAR
				const mm = new MemoryModelUnknown();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x1C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x1E000);
			});

			test('Target: MemoryModelAll', () => {	// NOSONAR
				const mm = new MemoryModelAllRam();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x18000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x1A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x1C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x1E000);
			});

			test('Target: MemoryModelZx48k', () => {	// NOSONAR
				const mm = new MemoryModelZX81_48k();
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x24000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x26000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x28000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x2A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x2C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x2E000);
			});

			test('Target: MemoryModelCustom', () => {
				const cfg: CustomMemoryType = {
					"slots": [
						{
							"range": [ 0x0000, 0x7FFF ],
							"banks": [
								{
									"index": 0
								}
							]
						},
						{
							"range": [ 0x8000, 0xBFFF ],
							"banks": [
								{
									"index": [5, 9]
								}
							],
						},
						{
							"range": [ 0xC000, 0xFFFF ],
							"banks": [
								{
									"index": [1, 4]
								}
							],
							"initialBank": 3
						},
					]
				};
				const mm = new MemoryModel(cfg);
				createSldFile(mm);

				assert.equal(parser.createLongAddress(0x0000, 0), 0x10000);
				assert.equal(parser.createLongAddress(0x2000, 0), 0x12000);
				assert.equal(parser.createLongAddress(0x4000, 0), 0x14000);
				assert.equal(parser.createLongAddress(0x6000, 0), 0x16000);
				assert.equal(parser.createLongAddress(0x8000, 0), 0x68000);
				assert.equal(parser.createLongAddress(0xA000, 0), 0x6A000);
				assert.equal(parser.createLongAddress(0xC000, 0), 0x4C000);
				assert.equal(parser.createLongAddress(0xE000, 0), 0x4E000);
			});
		});
	});
});
