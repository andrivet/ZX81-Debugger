import * as assert from 'assert';
import {MemBuffer} from '../src/misc/membuffer';
import {SimulatedMemory} from '../src/remotes/zsimulator/simulatedmemory';

// Simply publicly expose protected members
class MemBufferInt extends MemBuffer {
	public getReadOffset() {
		return this.readOffset;
	}
}

suite('SimulatedMemory', () => {

	test('serialize/deserialize', () => {
		let memBuffer: MemBufferInt;
		let writeSize: number;
		{
			const mem = new SimulatedMemory();

			// Set some memory
			mem.write8(0x0000, 10);
			mem.write8(0x0010, 11);
			mem.write8(0x1FFF, 12);
			mem.write8(0x2000, 13);
			mem.write8(0x4000, 14);
			mem.write8(0x6000, 15);
			mem.write8(0x8000, 16);
			mem.write8(0xA000, 17);
			mem.write8(0xC000, 18);
			mem.write8(0xE000, 19);
			mem.write8(0xFFFF, 20);

			// Get size
			writeSize = mem.getSerializedSize();

			// Serialize
			memBuffer = new MemBufferInt(writeSize);
			mem.serialize(memBuffer);
		}

		// Create a new object
		const rMem = new SimulatedMemory();
		rMem.deserialize(memBuffer);

		// Check size
		const readSize = memBuffer.getReadOffset();
		assert.equal(readSize, writeSize);SimulatedMemory

		// Test the memory
		assert.equal(rMem.read8(0x0000), 10);
		assert.equal(rMem.read8(0x0010), 11);
		assert.equal(rMem.read8(0x1FFF), 12);
		assert.equal(rMem.read8(0x2000), 13);
		assert.equal(rMem.read8(0x4000), 14);
		assert.equal(rMem.read8(0x6000), 15);
		assert.equal(rMem.read8(0x8000), 16);
		assert.equal(rMem.read8(0xA000), 17);
		assert.equal(rMem.read8(0xC000), 18);
		assert.equal(rMem.read8(0xE000), 19);
		assert.equal(rMem.read8(0xFFFF), 20);
	});


	test('writeBlock/readBlock', () => {
		const mem = new SimulatedMemory();

		mem.writeBlock(0x0000, new Uint8Array([0xAB]));
		let result = mem.readBlock(0x0000, 2);
		assert.equal(result[0], 0xAB);
		assert.equal(result[1], 0);

		mem.writeBlock(0x1000, new Uint8Array([0xAB, 0x12, 0x13, 0x14, 0x15]));
		result = mem.readBlock(0x1000, 5);
		assert.equal(result[0], 0xAB);
		assert.equal(result[1], 0x12);
		assert.equal(result[2], 0x13);
		assert.equal(result[3], 0x14);
		assert.equal(result[4], 0x15);

		mem.writeBlock(0xFFFF, new Uint8Array([0xC0]));
		result = mem.readBlock(0xFFFF, 1);
		assert.equal(result[0], 0xC0);
		result = mem.readBlock(0x0000, 1);
		assert.equal(result[0], 0xAB);

		mem.writeBlock(0xFFFF, new Uint8Array([0xD1, 0xD2]));
		result = mem.readBlock(0xFFFF, 2);
		assert.equal(result[0], 0xD1);
		assert.equal(result[1], 0xD2);

		mem.writeBlock(0xFFFF, Buffer.from([0xE1, 0xE2]));
		result = mem.readBlock(0xFFFF, 2);
		assert.equal(result[0], 0xE1);
		assert.equal(result[1], 0xE2);

		mem.writeBlock(0x3FFE, Buffer.from([0xF1, 0xF2, 0xF3, 0xF4]));
		result = mem.readBlock(0x3FFE, 4);
		assert.equal(result[0], 0xF1);
		assert.equal(result[1], 0xF2);
		assert.equal(result[2], 0xF3);
		assert.equal(result[3], 0xF4);
	});

	suite('rom file', () => {
		test('read raw ROM file', () => {
			const mem = new SimulatedMemory() as any;
			const path = './data/zx81.rom';
			const data = mem.readRomFile(path);
			assert.equal(data[0], 243);
			assert.equal(data[0x3FFF], 60);
		});


		test('readIntelHexFromFile', () => {
			const mem = new SimulatedMemory() as any;
			const path = './tests/data/intelhex/PLU10.HEX';
			const data = mem.readRomFile(path);
			assert.equal(data[16384], 243);
			assert.equal(data[31100], 205);
		});

	});
});

