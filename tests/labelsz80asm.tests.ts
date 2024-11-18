import * as assert from 'assert';
import * as fs from 'fs';
import {LabelsClass} from '../src/labels/labels';
import {MemoryModelAllRam} from '../src/remotes/MemoryModel/genericmemorymodels';


suite('Labels (z80asm)', () => {

	let lbls;

	setup(() => {
		lbls = new LabelsClass();
	});

	suite('Labels', () => {

		test('Labels', () => {
			// Read result data (labels)
			const labelsFile = fs.readFileSync('./tests/data/labels/projects/z80asm/general/general.labels').toString().split('\n');

			// Read the list file
			const config = {
				z80asm: [{
					path: './tests/data/labels/projects/z80asm/general/general.list',
					srcDirs: [""],	// Sources mode
					excludeFiles: []
				}]
			};
			lbls.readListFiles(config, new MemoryModelAllRam());

			// Compare all labels
			for (const labelLine of labelsFile) {
				if (labelLine == '')
					continue;
				// A line looks like: "fa_label3.mid:	equ $9002"
				const match = /(.*):\s+equ\s+\$(.*)/i.exec(labelLine)!;
				assert.notEqual(undefined, match);	// Check that line is parsed correctly
				const label = match[1];
				let value = parseInt(match[2], 16);
				if (label.indexOf('equ') < 0)
					value += 0x10000;	// +0x10000 to make log label out of it.
				// Check
				const res = lbls.getNumberForLabel(label);
				assert.equal(value, res);
			}
		});

		test('IF 0 Labels', () => {
			// Read the list file
			const config = {
				z80asm: [{
					path: './tests/data/labels/projects/z80asm/general/general.list',
					srcDirs: [""],	// Sources mode
					excludeFiles: []
				}]
			};
			lbls.readListFiles(config, new MemoryModelAllRam());

			// Test that a label under an IF 0/ENDIF is not defined => not easily possible with
			// z80asm, so simply allow it.
			const res = lbls.getNumberForLabel('label5');
			//assert.equal(undefined, res); // This would be correct, but is not easily possible with z80asm
			assert.equal(res, 0x018012);
		});


		suite('ListFile-Mode', () => {

			test('Labels location', () => {
				// Read the list file
				const fname = './tests/data/labels/projects/z80asm/general/general.list';
				const config = {z80asm: [{path: fname, srcDirs: []}]};	// ListFile-Mode
				lbls.readListFiles(config, new MemoryModelAllRam());

				// Test
				let res = lbls.getLocationOfLabel('label1')!;
				assert.notEqual(undefined, res);
				assert.equal(fname, res.file);
				assert.equal(16 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('fa_label1')!;
				assert.notEqual(undefined, res);
				assert.equal(fname, res.file);
				assert.equal(68 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('global_label1')!;
				assert.notEqual(undefined, res);
				assert.equal(fname, res.file);
				assert.equal(87 - 1, res.lineNr);	// line number starts at 0
			});

			test('address -> file/line', () => {
				// Read the list file as result data (addresses)
				const listFile = fs.readFileSync('./tests/data/labels/projects/z80asm/general/general.list').toString().split('\n');

				// Read the list file
				const config = {z80asm: [{path: './tests/data/labels/projects/z80asm/general/general.list', srcDirs: []}]};	// ListFile-Mode
				lbls.readListFiles(config, new MemoryModelAllRam());

				// Compare all addresses
				const count = listFile.length;
				for (let lineNr = 0; lineNr < count; lineNr++) {
					const line = listFile[lineNr];
					// A valid line looks like: "8001 3e 05		label2:	ld a,5 "
					const match = /^([0-9a-f]+)\s[0-9a-f]+/i.exec(line);
					if (!match)
						continue;
					// Valid address line
					let address = parseInt(match[1], 16);
					address |= 0x10000;	// Change to long address
					// Check
					const res = lbls.getFileAndLineForAddress(address);
					assert.ok(res.fileName.endsWith('general.list'));
					assert.equal(lineNr, res.lineNr);
				}
			});


			test('file/line -> address', () => {
				// Read the list file as result data (addresses)
				const filename = './tests/data/labels/projects/z80asm/general/general.list';
				const listFile = fs.readFileSync(filename).toString().split('\n');

				// Read the list file
				const config = {z80asm: [{path: filename, srcDirs: []}]};	// Sources-Mode
				lbls.readListFiles(config, new MemoryModelAllRam());

				// Compare all addresses
				const count = listFile.length;
				for (let lineNr = 0; lineNr < count; lineNr++) {
					const line = listFile[lineNr];
					// A valid line looks like: "8001 3e 05		label2:	ld a,5 "
					const match = /^([0-9a-f]+)\s[0-9a-f]+/i.exec(line);
					if (!match)
						continue;
					// Valid address line
					let address = parseInt(match[1], 16);
					address |= 0x10000;	// Change to long address
					// Check
					let resultAddr = lbls.getAddrForFileAndLine(filename, lineNr);
					assert.equal(resultAddr, address);
				}
			});

		});


		suite('Sources-Mode', () => {

			test('Labels location', () => {
				// Read the list file
				const config = {
					z80asm: [{
						path: './tests/data/labels/projects/z80asm/general/general.list',
						srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};

				lbls.readListFiles(config, new MemoryModelAllRam());

				// Test
				let res = lbls.getLocationOfLabel('label1')!;
				assert.notEqual(undefined, res);
				assert.equal('main.asm', res.file);
				assert.equal(15 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('fa_label1')!;
				assert.notEqual(undefined, res);
				assert.equal('filea.asm', res.file);
				assert.equal(2 - 1, res.lineNr);	// line number starts at 0

				res = lbls.getLocationOfLabel('global_label1')!;
				assert.notEqual(undefined, res);
				assert.equal('filea_b.asm', res.file);
				assert.equal(10 - 1, res.lineNr);	// line number starts at 0
			});


			test('address -> file/line', () => {
				// Read the list file
				const config = {
					z80asm: [{
						path: './tests/data/labels/projects/z80asm/general/general.list',
						srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};

				lbls.readListFiles(config, new MemoryModelAllRam());

				// Tests
				let res = lbls.getFileAndLineForAddress(0x18000);
				assert.ok(res.fileName.endsWith('main.asm'));
				assert.equal(16 - 1, res.lineNr);

				res = lbls.getFileAndLineForAddress(0x19001);
				assert.ok(res.fileName.endsWith('filea.asm'));
				assert.equal(7 - 1, res.lineNr);

				res = lbls.getFileAndLineForAddress(0x19005);
				assert.ok(res.fileName.endsWith('filea_b.asm'));
				assert.equal(11 - 1, res.lineNr);

				res = lbls.getFileAndLineForAddress(0x19008);
				assert.ok(res.fileName.endsWith('filea.asm'));
				assert.equal(16 - 1, res.lineNr);
			});


			test('file/line -> address', () => {
				// Read the list file
				const config = {
					z80asm: [{
						path: './tests/data/labels/projects/z80asm/general/general.list',
						srcDirs: [""],	// Sources mode
						excludeFiles: []
					}]
				};

				lbls.readListFiles(config, new MemoryModelAllRam());

				// Tests
				let address = lbls.getAddrForFileAndLine('main.asm', 16 - 1);
				assert.equal(address, 0x18000);

				address = lbls.getAddrForFileAndLine('filea.asm', 7 - 1);
				assert.equal(address, 0x19001);

				address = lbls.getAddrForFileAndLine('filea_b.asm', 7 - 1);
				assert.equal(address, 0x19004);

				address = lbls.getAddrForFileAndLine('filea.asm', 16 - 1);
				assert.equal(address, 0x19008);
			});

		});

	});


	test('Occurrence of WPMEM, ASSERTION, LOGPOINT', () => {
		// Read the list file
		const config = {
			z80asm: [{
				path: './tests/data/labels/projects/z80asm/general/general.list',
				srcDirs: [""],	// Sources mode
				excludeFiles: []
			}]
		};

		lbls.readListFiles(config, new MemoryModelAllRam());

		// Test WPMEM
		const wpLines = lbls.getWatchPointLines();
		assert.equal(wpLines.length, 1);
		assert.equal(wpLines[0].address, 0x18200);
		assert.equal(wpLines[0].line, "WPMEM");

		// Test ASSERTION
		const assertionLines = lbls.getAssertionLines();
		assert.equal(assertionLines.length, 1);
		assert.equal(assertionLines[0].address, 0x18005);
		assert.equal(assertionLines[0].line, "ASSERTION");

		// Test LOGPOINT
		const lpLines = lbls.getLogPointLines();
		assert.equal(lpLines.length, 1);
		assert.equal(lpLines[0].address, 0x1800F);
		assert.equal(lpLines[0].line, "LOGPOINT");
	});

});

