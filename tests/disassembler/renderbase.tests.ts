import * as assert from 'assert';
import {Opcode} from '../../src/disassembler/core/opcode';
import {AsmNode} from '../../src/disassembler/core/asmnode';
import {Utility} from '../../src/misc/utility';
import {RenderBase} from '../../src/disassembler/renderbase';
import {SmartDisassembler} from '../../src/disassembler/smartdisassembler';



suite('Disassembler - RenderBase', () => {

	let r: any;
	setup(() => {
		const disasm = new SmartDisassembler();
		disasm.funcGetLabel = addr64k => undefined;
		disasm.funcFormatAddress = addr64k => 'LONG' + Utility.getHexString(addr64k, 4);
		r = new RenderBase(disasm);
	});

	suite('misc', () => {
		test('getDotId', () => {
			const n = new AsmNode();
			n.start = 0x0001;
			assert.equal(r.getDotId(n), 'dot1');
			n.start = 0xF1FA;
			assert.equal(r.getDotId(n), 'dotf1fa');
		});

		test("addControls, don't crash", () => {
			r.addControls([''], false);
			r.addControls(['', ''], false);
			r.addControls([''], true);
			r.addControls(['', ''], true);
		});

		test("renderLines, don't crash", () => {
			r.renderLines(['']);
			r.renderLines(['', '']);
		});
	});

	suite('getAllRefAddressesFor', () => {
		test('AsmNode', () => {
			const n = new AsmNode();
			n.start = 0x8000;
			assert.equal(r.getAllRefAddressesFor(n), '');
			n.instructions.push(new Opcode(0x3E, "LD A,#n"));	// LD A,n
			assert.equal(r.getAllRefAddressesFor(n), 'LONG8000;');
			n.instructions.push(new Opcode(0xC1, "POP BC"));	// POP BC
			assert.equal(r.getAllRefAddressesFor(n), 'LONG8000;LONG8002;');
		});
	});

	suite('adjustSvg', () => {
		test('colors', () => {
			const text = '#00FEFE,#01FEFE,#02FEFE,#03FEFE,#04FEFE';
			assert.equal(r.adjustSvg(text), 'var(--zx81debugger-fg-color),var(--zx81debugger-emphasize-color1),var(--zx81debugger-emphasize-color2),var(--zx81debugger-emphasize-color3),var(--zx81debugger-emphasize-color4)');
		});

		test('xlink:title', () => {
			const text = 'xlink:title="AAA",xlink:title="BB"';
			assert.equal(r.adjustSvg(text), 'xlink:title="",xlink:title=""');
		});

		test('<title>', () => {
			const text = '<title>XXXX<\/title>,<title>YY<\/title>';
			assert.equal(r.adjustSvg(text), ',');
		});
	});
});
