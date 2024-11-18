
import * as assert from 'assert';
import {BankType, MemoryModel} from '../src/remotes/MemoryModel/memorymodel';
import {Z80Registers, Z80RegistersClass} from '../src/remotes/z80registers';
import {Settings} from '../src/settings/settings';
import { MemoryModelZX81_16k, MemoryModelZX81_48k } from '../src/remotes/MemoryModel/zx81memorymodels';

suite('MemoryModel', () => {

	suite('createBankName', () => {
		test('normal usage', () => {
			const mm = new MemoryModel({slots: []}) as any;
			assert.equal(mm.createBankName(undefined, 1), undefined);
			assert.equal(mm.createBankName('normal', 1), 'normal');
		});

		test('evaluate', () => {
			const mm = new MemoryModel({slots: []}) as any;
			assert.equal(mm.createBankName('bank${index}', 2), 'bank2');
		});
	});

	suite('createBankShortName', () => {
		test('normal usage', () => {
			const mm = new MemoryModel({slots: []}) as any;
			assert.equal(mm.createBankShortName(undefined, 1), undefined);
			assert.equal(mm.createBankShortName('normal', 1), 'normal');
		});

		test('evaluate', () => {
			const mm = new MemoryModel({slots: []}) as any;
			assert.equal(mm.createBankShortName('bank${index}', 2), 'bank2');
		});
	});


	suite('slot ranges', () => {

		test('empty slot range', () => {
			const mm = new MemoryModel({slots: []}) as any;
			assert.equal(mm.slotRanges.length, 1);
			assert.equal(mm.slotRanges[0].start, 0x0000);
			assert.equal(mm.slotRanges[0].end, 0xFFFF);
			assert.equal(mm.slotRanges[0].ioMMu, undefined);
			assert.equal(mm.initialSlots.length, 1);
			assert.equal(mm.initialSlots[0], 0);
			assert.equal(mm.banks.length, 1);
		});

		test('1 slot range', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0xFFFF],
						banks: [
							{
								index: 7
							}
						]
					}
				]
			}) as any;
			assert.equal(mm.slotRanges.length, 1);
			assert.equal(mm.slotRanges[0].start, 0x0000);
			assert.equal(mm.slotRanges[0].end, 0xFFFF);
			assert.equal(mm.slotRanges[0].ioMMu, undefined);
			assert.equal(mm.initialSlots.length, 1);
			assert.equal(mm.initialSlots[0], 7);
			assert.equal(mm.banks.length, 8);
		});

		test('3 slot ranges', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x1000, 0x7FFF],
						banks: [
							{
								index: 0
							}
						]
					},
					{
						range: [0xA000, 0xAFFF],
						banks: [
							{
								index: 1
							}
						]
					},
					{
						range: [0xB000, 0xEFFF],
						banks: [
							{
								index: 2
							}
						]
					}
				]
			}) as any;
			assert.equal(mm.slotRanges.length, 6);
			assert.equal(mm.slotRanges[0].start, 0x0000);
			assert.equal(mm.slotRanges[0].end, 0x0FFF);
			assert.equal(mm.slotRanges[0].ioMMu, undefined);
			assert.equal(mm.slotRanges[1].start, 0x1000);
			assert.equal(mm.slotRanges[1].end, 0x7FFF);
			assert.equal(mm.slotRanges[1].ioMMu, undefined);
			assert.equal(mm.slotRanges[2].start, 0x8000);
			assert.equal(mm.slotRanges[2].end, 0x9FFF);
			assert.equal(mm.slotRanges[2].ioMMu, undefined);
			assert.equal(mm.slotRanges[3].start, 0xA000);
			assert.equal(mm.slotRanges[3].end, 0xAFFF);
			assert.equal(mm.slotRanges[3].ioMMu, undefined);
			assert.equal(mm.slotRanges[4].start, 0xB000);
			assert.equal(mm.slotRanges[4].end, 0xEFFF);
			assert.equal(mm.slotRanges[4].ioMMu, undefined);
			assert.equal(mm.slotRanges[5].start, 0xF000);
			assert.equal(mm.slotRanges[5].end, 0xFFFF);
			assert.equal(mm.slotRanges[5].ioMMu, undefined);

			assert.equal(mm.initialSlots.length, 6);
			assert.equal(mm.initialSlots[0], 3);
			assert.equal(mm.initialSlots[1], 0);
			assert.equal(mm.initialSlots[2], 4);
			assert.equal(mm.initialSlots[3], 1);
			assert.equal(mm.initialSlots[4], 2);
			assert.equal(mm.initialSlots[5], 5);

			assert.equal(mm.banks.length, 6);
		});
	});



	suite('slot banks', () => {

		test('empty slot range', () => {
			const mm = new MemoryModel({slots: []}) as any;
			assert.equal(mm.slotRanges.length, 1);
			assert.equal(mm.slotRanges[0].banks.size, 1);
			assert.equal(mm.getBanksFor(0x1000).size, 1);
		});

		test('A few banks', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0xFFFF],
						banks: [
							{
								index: 0
							},
							{
								index: 1
							},
							{
								index: [2, 9]
							}
						]
					}
				]
			}) as any;
			assert.equal(mm.slotRanges.length, 1);
			assert.equal(mm.slotRanges[0].banks.size, 10);

			const banks = mm.getBanksFor(0xFFFF);
			assert.equal(banks.size, 10);
			for (let i = 0; i < banks.size; i++)
				assert.ok(banks.has(i));
		});


		test('Mixed', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x1000, 0x7FFF],
						banks: [
							{
								index: 0
							},
							{
								index: 5
							}
						]
					},
					{
						range: [0xA000, 0xBFFF],
						banks: [
							{
								index: [10, 20]
							}
						]
					}
				]
			}) as any;

			assert.equal(mm.slotRanges.length, 5);

			assert.equal(mm.slotRanges[0].banks.size, 1);
			assert.equal(mm.slotRanges[1].banks.size, 2);
			assert.equal(mm.slotRanges[2].banks.size, 1);
			assert.equal(mm.slotRanges[3].banks.size, 11);
			assert.equal(mm.slotRanges[4].banks.size, 1);

			assert.equal(mm.getBanksFor(0x0000).size, 1);
			assert.equal(mm.getBanksFor(0x0FFF).size, 1);
			assert.equal(mm.getBanksFor(0x1000).size, 2);
			assert.equal(mm.getBanksFor(0x7FFF).size, 2);
			assert.equal(mm.getBanksFor(0x8000).size, 1);
			assert.equal(mm.getBanksFor(0x9FFF).size, 1);
			assert.equal(mm.getBanksFor(0xA000).size, 11);
			assert.equal(mm.getBanksFor(0xBFFF).size, 11);
			assert.equal(mm.getBanksFor(0xC000).size, 1);
			assert.equal(mm.getBanksFor(0xFFFF).size, 1);
		});
	});



	suite('slot/address association', () => {

		test('assigned and unassigned', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x1000, 0x7F11],
						banks: [
							{
								index: 0
							}
						]
					},
					{
						range: [0xA123, 0xAF00],
						banks: [
							{
								index: 1
							}
						]
					},
					{
						range: [0xB000, 0xEFFF],
						banks: [
							{
								index: 2
							}
						]
					}
				]
			}) as any;

			assert.equal(mm.slotRanges.length, 7);
			assert.equal(mm.slotAddress64kAssociation[0x0000], 0);	// Slot 0, bank 3, UNUSED
			assert.equal(mm.slotAddress64kAssociation[0x0FFF], 0);	// Slot 0, bank 3, UNUSED
			assert.equal(mm.slotAddress64kAssociation[0x1000], 1);	// Slot 1, bank 0
			assert.equal(mm.slotAddress64kAssociation[0x7F11], 1);	// Slot 1, bank 0
			assert.equal(mm.slotAddress64kAssociation[0x7F12], 2);	// Slot 2, bank 4, UNUSED
			assert.equal(mm.slotAddress64kAssociation[0xA122], 2);	// Slot 2, bank 4, UNUSED
			assert.equal(mm.slotAddress64kAssociation[0xA123], 3);	// Slot 3, bank 1
			assert.equal(mm.slotAddress64kAssociation[0xAF00], 3);	// Slot 3, bank 1
			assert.equal(mm.slotAddress64kAssociation[0xAF01], 4);	// Slot 4, bank 5, UNUSED
			assert.equal(mm.slotAddress64kAssociation[0xAFFF], 4);	// Slot 4, bank 5, UNUSED
			assert.equal(mm.slotAddress64kAssociation[0xB000], 5);	// Slot 5, bank 2
			assert.equal(mm.slotAddress64kAssociation[0xEFFF], 5);	// Slot 5, bank 2
			assert.equal(mm.slotAddress64kAssociation[0xF000], 6);	// Slot 6, bank 6, UNUSED
			assert.equal(mm.slotAddress64kAssociation[0xFFFF], 6);	// Slot 6, bank 6, UNUSED
		});
	});


	suite('banks', () => {

		test('2 banks', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0xFFFF],
						name: "slotROM",
						banks: [
							{
								index: 0,
								name: 'ROM0',
								shortName: 'R0'
							},
							{
								index: 1,
								name: 'ROM1',
								shortName: 'R1',
							}
						]
					}
				],
				ioMmu: "slotROM = 0;"
			}) as any;
			assert.equal(mm.slotRanges.length, 1);
			assert.equal(mm.slotRanges[0].start, 0x0000);
			assert.equal(mm.slotRanges[0].end, 0xFFFF);
			assert.equal(mm.initialSlots.length, 1);

			assert.equal(mm.initialSlots[0], 0);

			assert.equal(mm.banks.length, 2);
			assert.equal(mm.banks[0].name, "ROM0");
			assert.equal(mm.banks[0].shortName, "R0");
			assert.equal(mm.banks[1].name, "ROM1");
			assert.equal(mm.banks[1].shortName, "R1");

			assert.notEqual(mm.ioMmu, undefined);
		});

		test('2 banks, default names', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0xFFFF],
						banks: [
							{
								index: 0
							},
							{
								index: 1
							}
						],
						initialBank: 1
					},
				],
				ioMmu: "slotROM = 0;"
			}) as any;

			assert.equal(mm.initialSlots[0], 1);
		});


		test('initialBank', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0xFFFF],
						banks: [
							{
								index: 0
							},
							{
								index: 1
							}
						]
					}
				],
				ioMmu: "slotROM = 0;"
			}) as any;

			assert.equal(mm.banks.length, 2);
			assert.equal(mm.banks[0].name, "BANK0");
			assert.equal(mm.banks[0].shortName, "0");
			assert.equal(mm.banks[1].name, "BANK1");
			assert.equal(mm.banks[1].shortName, "1");
		});


		test('bank size', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0x3FFF],
						banks: [
							{
								index: 0
							}
						]
					},
					{
						range: [0x8000, 0xFFFF],
						banks: [
							{
								index: 1
							}
						]
					}
				]
			}) as any;

			assert.equal(mm.banks.length, 3);
			assert.equal(mm.banks[0].size, 0x4000);
			assert.equal(mm.banks[1].size, 0x8000);
			assert.equal(mm.banks[2].size, 0x4000);	// UNUSED
		});


		test('same bank, 2 sizes', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0x3FFF],
						banks: [
							{
								index: 0
							}
						]
					},
					{
						range: [0x8000, 0xFFFF],
						banks: [
							{
								index: 0
							}
						]
					}
				]
			}) as any;

			assert.equal(mm.banks.length, 2);
			assert.equal(mm.banks[0].size, 0x8000);
			assert.equal(mm.banks[1].size, 0x4000);	// UNUSED
		});


		test('same bank, 2 different names', () => {
			// First name is used, second name is ignored
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0x3FFF],
						banks: [
							{
								index: 0,
								name: "MYBANK"
							}
						]
					},
					{
						range: [0x8000, 0xFFFF],
						banks: [
							{
								index: 0,
								name: "MYOTHERNAMEDBANK"
							}
						]
					}
				]
			}) as any;

			assert.equal(mm.banks.length, 2);
			assert.equal(mm.banks[0].name, "MYBANK");
		});


		test('same bank, 2 different short names', () => {
			// First name is used, second name is ignored
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0x3FFF],
						banks: [
							{
								index: 0,
								shortName: "MYSHORTBANK"
							},
							{
								index: 1
							}
						]
					},
					{
						range: [0x8000, 0xFFFF],
						banks: [
							{
								index: 0,
								shortName: "MYSHORTOTHERNAMEDBANK"
							},
							{
								index: 1
							}
						]
					}
				]
			}) as any;

			assert.equal(mm.banks.length, 3);
			assert.equal(mm.banks[0].shortName, "MYSHORTBANK");
		});

		test('short names, unused', () => {
			// shortNames are unused if there is only one bank in one slot.
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0x3FFF],
						banks: [
							{
								index: 0,
								shortName: "MYSHORTBANK"
							}
						]
					},
					{
						range: [0x8000, 0xFFFF],
						banks: [
							{
								index: [1, 2],
								shortName: "M${index}"
							}
						]
					}
				]
			}) as any;

			assert.equal(mm.banks.length, 4);
			assert.equal(mm.banks[0].shortName, "MYSHORTBANK");
			assert.equal(mm.banks[1].shortName, "M1");
			assert.equal(mm.banks[2].shortName, "M2");
		});

		test('different banks, same names', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0x3FFF],
						banks: [
							{
								index: 0,
								name: "MYBANK"
							}
						]
					},
					{
						range: [0x8000, 0xFFFF],
						banks: [
							{
								index: 2,
								name: "MYBANK"
							}
						]
					}
				]
			}) as any;

			assert.equal(mm.banks.length, 4);
			assert.equal(mm.banks[0].name, "MYBANK");
			assert.equal(mm.banks[2].name, "MYBANK");	// Makes no sense but is allowed
		});


		test('different banks, same short names', () => {
			assert.throws(() => {
				new MemoryModel({	// NOSONAR
					slots: [
						{
							range: [0x0000, 0x3FFF],
							banks: [
								{
									index: 0,
									shortName: "MYSHORTBANK"
								},
								{
									index: 3
								}
							]
						},
						{
							range: [0x8000, 0xFFFF],
							banks: [
								{
									index: 2,
									shortName: "MYSHORTBANK"
								},
								{
									index: 4
								}
							]
						}
					]
				});
			}, Error);
		});


		test('bank range', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0xFFFF],
						banks: [
							{
								index: [0, 19]
							}
						]
					}
				],
				ioMmu: "slotROM = 0;"
			}) as any;

			assert.equal(mm.banks.length, 20);
			assert.equal(mm.banks[0].name, "BANK0");
			assert.equal(mm.banks[0].shortName, "0");
			assert.equal(mm.banks[19].name, "BANK19");
			assert.equal(mm.banks[19].shortName, "19");
		});

	});



	suite('errors', () => {

		test('Range-start lower or equal than last range-end', () => {
			assert.throws(() => {
				new MemoryModel({
					slots: [
						{
							range: [0x0000, 0x7FFF],
							banks: [{index: 0}]
						},
						{
							range: [0x6000, 0xFFFF],
							banks: [{index: 1}]
						}
					]
				}) as any;
			});
		});

		test('Range-end lower than range-start.', () => {
			assert.throws(() => {
				new MemoryModel({
					slots: [
						{
							range: [0x8000, 0x7FFF],
							banks: [{index: 0}]
						}
					]
				}) as any;
			});
		});

		test('No banks specified for range.', () => {
			assert.throws(() => {
				new MemoryModel({
					slots: [
						{
							range: [0x0000, 0xFFFF],
							banks: []
						}
					]
				}) as any;
			},
				Error("No banks specified for range."));
		});

		test('Bank index < 0.', () => {
			assert.throws(() => {
				new MemoryModel({
					slots: [
						{
							range: [0x0000, 0xFFFF],
							banks: [{index: -1}]
						}
					]
				}) as any;
			},
				Error("Bank index < 0."));
		});

		test('Bank index too high.', () => {
			assert.throws(() => {
				new MemoryModel({
					slots: [
						{
							range: [0x0000, 0xFFFF],
							banks: [{index: 1000}]
						}
					]
				}) as any;
			},
				Error("Bank index too high."));
		});

		test('Bank range: first index bigger than last index.', () => {
			assert.throws(() => {
				new MemoryModel({
					slots: [
						{
							range: [0x0000, 0xFFFF],
							banks: [{
								index: [5, 3]
							}]
						}
					]
				}) as any;
			},
				Error("Bank range: first index bigger than last index."));
		});
	});



	suite('predefined memory models', () => {

		test('ZX16K', () => {
			const mm = new MemoryModelZX81_16k() as any;
			assert.equal(mm.slotRanges.length, 3);
			assert.equal(mm.slotRanges[0].start, 0x0000);
			assert.equal(mm.slotRanges[0].end, 0x3FFF);
			assert.equal(mm.slotRanges[0].ioMMu, undefined);
			assert.equal(mm.slotRanges[1].start, 0x4000);
			assert.equal(mm.slotRanges[1].end, 0x7FFF);
			assert.equal(mm.slotRanges[1].ioMMu, undefined);
			assert.equal(mm.slotRanges[2].start, 0x8000);
			assert.equal(mm.slotRanges[2].end, 0xFFFF);
			assert.equal(mm.slotRanges[2].ioMMu, undefined);

			assert.equal(mm.initialSlots.length, 3);
			assert.equal(mm.initialSlots[0], 0);
			assert.equal(mm.initialSlots[1], 1);
			assert.equal(mm.initialSlots[2], 2);	// UNUSED

			assert.equal(mm.banks.length, 3);
			assert.equal(mm.banks[0].name, "ROM");
			assert.equal(mm.banks[1].name, "RAM");
			assert.equal(mm.banks[2].name, "UNUSED");
			assert.equal(mm.banks[0].shortName, "0");
			assert.equal(mm.banks[1].shortName, "1");
			assert.equal(mm.banks[2].shortName, "");
			assert.equal(mm.banks[0].bankType, BankType.ROM);
			assert.equal(mm.banks[1].bankType, BankType.RAM);
			assert.equal(mm.banks[2].bankType, BankType.UNUSED);

			const memBanks = mm.getMemoryBanks([0, 1, undefined]);
			assert.equal(memBanks.length, 3);
			assert.equal(memBanks[0].start, 0x0000);
			assert.equal(memBanks[0].end, 0x3FFF);
			assert.equal(memBanks[0].name, "ROM");
			assert.equal(memBanks[1].start, 0x4000);
			assert.equal(memBanks[1].end, 0x7FFF);
			assert.equal(memBanks[1].name, "RAM");
			assert.equal(memBanks[2].start, 0x8000);
			assert.equal(memBanks[2].end, 0xFFFF);
			assert.equal(memBanks[2].name, "UNASSIGNED");
		});


		test('ZX48K', () => {
			const mm = new MemoryModelZX81_48k() as any;
			assert.equal(mm.slotRanges.length, 2);
			assert.equal(mm.slotRanges[0].start, 0x0000);
			assert.equal(mm.slotRanges[0].end, 0x3FFF);
			assert.equal(mm.slotRanges[0].ioMMu, undefined);
			assert.equal(mm.slotRanges[1].start, 0x4000);
			assert.equal(mm.slotRanges[1].end, 0xFFFF);
			assert.equal(mm.slotRanges[1].ioMMu, undefined);

			assert.equal(mm.initialSlots.length, 2);
			assert.equal(mm.initialSlots[0], 0);
			assert.equal(mm.initialSlots[1], 1);

			assert.equal(mm.banks.length, 2);
			assert.equal(mm.banks[0].name, "ROM");
			assert.equal(mm.banks[1].name, "RAM");

			assert.equal(mm.banks.length, 2);
			assert.equal(mm.banks[0].name, "ROM");
			assert.equal(mm.banks[1].name, "RAM");
			assert.equal(mm.banks[0].shortName, "0");
			assert.equal(mm.banks[1].shortName, "1");
			assert.equal(mm.banks[0].bankType, BankType.ROM);
			assert.equal(mm.banks[1].bankType, BankType.RAM);

			const memBanks = mm.getMemoryBanks([0, 1, undefined]);
			assert.equal(memBanks.length, 2);
			assert.equal(memBanks[0].start, 0x0000);
			assert.equal(memBanks[0].end, 0x3FFF);
			assert.equal(memBanks[0].name, "ROM");
			assert.equal(memBanks[1].start, 0x4000);
			assert.equal(memBanks[1].end, 0xFFFF);
			assert.equal(memBanks[1].name, "RAM");
		});

	});


	suite('long address and slot calculations', () => {

		let launch;
		setup(() => {
			const cfgEmpty: any = {
			};
			launch = Settings.Init(cfgEmpty);
		});

		test('ZX16K', () => {
			const mm = new MemoryModelZX81_16k() as any;
			assert.equal(mm.slotRanges.length, 3);
			const slots = [0, 1, 2];	// 0 = ROM (0-0x3FFF), 1 = RAM (0x4000-0x7FFF), 2 = UNUSED (0x8000-0xFFFF)

			// Z80Registers
			Z80RegistersClass.createRegisters(launch);
			mm.init();

			// Long address
			assert.equal(Z80Registers.createLongAddress(0x0000, slots), 0x010000); // 0x01... = bank 0
			assert.equal(Z80Registers.createLongAddress(0x3FFF, slots), 0x013FFF); // 0x01... = bank 0
			assert.equal(Z80Registers.createLongAddress(0x4000, slots), 0x024000); // 0x02... = bank 1
			assert.equal(Z80Registers.createLongAddress(0x7FFF, slots), 0x027FFF); // 0x02... = bank 1
			assert.equal(Z80Registers.createLongAddress(0x8000, slots), 0x038000); // 0x03... = bank 2, UNUSED
			assert.equal(Z80Registers.createLongAddress(0xFFFF, slots), 0x03FFFF); // 0x03... = bank 2, UNUSED

			// Slots
			assert.equal(Z80Registers.getSlotFromAddress(0x0000), 0);
			assert.equal(Z80Registers.getSlotFromAddress(0x3FFF), 0);
			assert.equal(Z80Registers.getSlotFromAddress(0x4000), 1);
			assert.equal(Z80Registers.getSlotFromAddress(0x7FFF), 1);
			assert.equal(Z80Registers.getSlotFromAddress(0x8000), 2);
			assert.equal(Z80Registers.getSlotFromAddress(0xFFFF), 2);
		});

		test('ZX48K', () => {
			const mm = new MemoryModelZX81_48k() as any;
			assert.equal(mm.slotRanges.length, 2);
			const slots = [0, 1];	// 0 = ROM (0-0x3FFF), 1 = RAM (0x4000-0x7FFF)

			// Z80Registers
			Z80RegistersClass.createRegisters(launch);
			mm.init();

			// Long address
			assert.equal(Z80Registers.createLongAddress(0x0000, slots), 0x010000); // 0x01... = bank 0
			assert.equal(Z80Registers.createLongAddress(0x3FFF, slots), 0x013FFF); // 0x01... = bank 0
			assert.equal(Z80Registers.createLongAddress(0x4000, slots), 0x024000); // 0x02... = bank 1
			assert.equal(Z80Registers.createLongAddress(0xFFFF, slots), 0x02FFFF); // 0x02... = bank 1

			// Slots
			assert.equal(Z80Registers.getSlotFromAddress(0x0000), 0);
			assert.equal(Z80Registers.getSlotFromAddress(0x3FFF), 0);
			assert.equal(Z80Registers.getSlotFromAddress(0x4000), 1);
			assert.equal(Z80Registers.getSlotFromAddress(0xFFFF), 1);
		});
	});



	suite('parse', () => {

		test('empty slot range', () => {
			const mm = new MemoryModel({slots: []}) as any;

			assert.throws(() => {
				mm.parseBank(0x0000, '0');
			}, Error);

			assert.throws(() => {
				mm.parseBank(0x0000, 'abcd');
			}, Error);
		});

		test('different banks', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0x7FFF],
						banks: [
							{
								index: 0,
								shortName: 'R0'
							},
							{
								index: 1,
								shortName: 'R1',
							}
						]
					},
					{
						range: [0x8000, 0xFFFF],
						banks: [
							{
								index: 2,
								shortName: 'CUSTOMNAME${index}'
							},
							{
								index: 3,
								shortName: 'CUSTOMNAME_B'
							},
							{
								index: [10, 15],
								shortName: 'BANK${index}',
							}
						]
					},
				]
			}) as any;
			assert.equal(mm.slotRanges.length, 2);
			assert.equal(mm.slotRanges[0].banks.size, 2);
			assert.equal(mm.slotRanges[1].banks.size, 8);

			let banks = mm.getBanksFor(0x0000);
			assert.equal(banks.size, 2);
			assert.ok(banks.has(0));
			assert.ok(banks.has(1));

			banks = mm.getBanksFor(0xFFFF);
			assert.equal(banks.size, 8);
			for (let b = 2; b <= 3; b++) {
				assert.ok(banks.has(b), b.toString());
			}
			for (let b = 10; b <= 15; b++) {
				assert.ok(banks.has(b), b.toString());
			}

			assert.equal(mm.parseShortNameForBank('R0'), 0);
			assert.equal(mm.parseShortNameForBank('R1'), 1);
			assert.equal(mm.parseShortNameForBank('CUSTOMNAME2'), 2);
			assert.equal(mm.parseShortNameForBank('CUSTOMNAME_B'), 3);

			for (let b = 10; b <= 15; b++) {
				assert.equal(mm.parseShortNameForBank('BANK' + b), b);
			}
		});


		test('no switched banks', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0x7FFF],
						banks: [
							{
								index: 0,
							}
						]
					},
				]
			});

			// No bank info required
			assert.equal(mm.parseBank(0x0000, ''), 0);
		});


		test('errors', () => {
			const mm = new MemoryModel({
				slots: [
					{
						range: [0x0000, 0x3FFF],
						banks: [
							{
								index: 0,
								shortName: 'R0'
							},
							{
								index: 1,
								shortName: 'R1',
							}
						]
					},
					{
						range: [0x8000, 0xFFFF],
						banks: [
							{
								index: 2,
								shortName: 'CUSTOMNAME${index}'
							},
							{
								index: 3,
								shortName: 'CUSTOMNAME_B'
							},
							{
								index: [10, 15],
								shortName: 'BANK${index}',
							}
						]
					},
				]
			}) as any;

			assert.throws(() => {
				// "Bank with shortName does not exist ..."
				mm.parseShortNameForBank('R0xxx');
			}, Error);

			assert.throws(() => {
				// "Bank with shortName does not exist ..."
				mm.parseBank(0x0000, 'R0xxx');
			}, Error);

			assert.throws(() => {
				// "Bank is not reachable ..."
				mm.parseBank(0x8000, 'R0');
			}, Error);

			// Should not throw:
			mm.parseBank(0x4000, '');

			assert.throws(() => {
				// "... lacks bank info ..."
				mm.parseBank(0x8000, '');
			}, Error);

			assert.throws(() => {
				// "Bank with shortName does not exist ..."
				mm.parseBank(0x0000, 'R0xxx');
			}, Error);
		});
	});
});

