import {AsmNode} from "./asmnode";
import {Format} from "./format";
import {RenderBase} from "./renderbase";



/** Class to render disassembly text.
 */
export class RenderText extends RenderBase {

	/// Column areas. E.g. area for the bytes shown before each command
	public clmnsAddress = 5;		///< size for the address at the beginning of each line.
	public clmnsBytes = 4 * 3 + 1;	///< 4* length of hex-byte
	public clmnsOpcodeFirstPart = 4 + 1;	///< First part of the opcodes, e.g. "LD" in "LD A,7" // TODO : Still required?
	public clmsnOpcodeTotal = 5 + 6 + 1;		///< Total length of the opcodes. After this an optional comment may start. // TODO : Still required?


	/** ANCHOR Renders the disassembly text.
	 * @param nodes The nodes to disassemble.
	 * It is expected that this array is sorted by address from low to high.
	 * @returns The text for the complete disassembly.
	 */

	public renderSync(nodes: AsmNode[]): string {
		const lines: string[] = [];
		// Simply loop all nodes
		for (const node of nodes) {
			// Get label
			const nodeAddr = node.start;
			const nodeLabelName = this.disasm.funcGetLabel(nodeAddr) || node.label; // TODO: otherLabels.get()

			// Print label
			if (nodeLabelName) {
				//lines.push(
			}
		}

		return '';
	}


	/** Returns a formatted line with address and label.
	 * With right clmns spaces.
	 * @param addr64k The address for the line. Is converted into a long address.
	 * @param text A text to add. Usually the decoded instruction.
	 * @returns A complete line, e.g. "C000.B1 LABEL1:"
	 */
	protected formatAddressLabel(addr64k: number, text: string): string {
		const addrString = (this.disasm.funcFormatLongAddress(addr64k)).padEnd(this.clmnsAddress - 1) + ' ';
		const s = addrString + text + ':';
		return s;
	}


	/** Returns a formatted line with address bytes and text/opcode.
	 * With right clmns spaces.
	 * @param addr64k The address for the line. Is converted into a long address.
	 * @param bytes The byte to add for the line. Can be empty.
	 * @param text A text to add. Usually the decoded instruction.
	 * @returns A complete line, e.g. "C000.B1 3E 05    LD A,5"
	 */
	protected formatAddressInstruction(addr64k: number, bytes: Uint8Array, text: string): string {
		const addrString = this.disasm.funcFormatLongAddress(addr64k).padEnd(this.clmnsAddress - 1);
		let bytesString = '';
		bytes.forEach(value =>
			bytesString += value.toString(16).toUpperCase().padStart(2, '0') + ' '
		);
		bytesString = bytesString.substring(0, bytesString.length - 1);
		bytesString = Format.getLimitedString(bytesString, this.clmnsBytes - 2);
		const s = addrString + ' ' + bytesString + '  ' + text;
		return s;
	}


	/** Adds a disassembly data block.
	 * @param lines Array of lines. The new text liens are pushed here.
	 * @param add64k The address to start.
	 * @param dataLen The length of the data to print.
	 */
	protected printData(lines: string[], addr64k: number, dataLen: number) {
		lines.push('; Data: ' + Format.getHexFormattedString(addr64k, 4) + '-' + Format.getHexFormattedString(addr64k + dataLen - 1, 4));
	}


	/** ANCHOR Renders the disassembly text.
	 * @param startNodes The nodes to disassemble.
	 * It is expected that this array is sorted by address from low to high.
	 * @returns The text for the complete disassembly.
	 */

	public renderSync2(startNodes: AsmNode[], maxDepth: number): string {
		// Prepare an array for each depth
		const texts: string[] = [];

		// Loop all depths
		for (let depth = 1; depth <= maxDepth; depth++) {
			// Render one call graph (for one deptH)
			const rendered = ''; //this.renderForDepth(startNodes, nodeSubs, depth);
			// Store
			texts.push(rendered);
		}

		return this.addControls(texts);
	}


	/** ANCHOR Renders all given nodes to text.
	 * @param nodes The nodes to disassemble.
	 * @returns The disassembly text.
	 */
	public renderAllNodes(nodes: AsmNode[]): string {
		const lines: string[] = [];

		// Loop over all nodes
		let addr64k = 0x0000;
		for (const node of nodes) {
			// Get node address
			const nodeAddr = node.start;

			// Print data between nodes
			const dataLen = nodeAddr - addr64k;
			if (dataLen > 0) {
				this.printData(lines, nodeAddr, dataLen);
				lines.push('');
				addr64k = nodeAddr;
			}

			// Disassemble node
			for (const opcode of node.instructions) {
				// Check if label exists
				const label = this.disasm.getLabelForAddr64k(addr64k);
				if (label) {
					const labelText = this.formatAddressLabel(addr64k, label);
					lines.push(labelText);
				}

				// Now disassemble instruction
				const len = opcode.length;
				const bytes = this.disasm.memory.getData(addr64k, len);
				const instructionText = this.formatAddressInstruction(addr64k, bytes, opcode.disassembledText);
				lines.push(instructionText);

				// Next
				addr64k += len;
			}

			// Separate blocks
			lines.push('');
		}

		// Return
		const text = lines.join('\n');
		return text;
	}
}
