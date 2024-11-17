import { DebugProtocol } from "@vscode/debugprotocol";
import { ShallowVar } from "./shallowvar";
import { Remote } from "../remotes/remotebase";
import { Utility } from "../misc/utility";

type SystemVariableDef = {
	name: string;
	address: number;
	size: number;
};

/**
 * The SystemVariablesVar class knows how to retrieve the system variables from Remote.
 */
export class SystemVariablesVar extends ShallowVar {

	/**
	 * Communicates with the remote to retrieve system variables.
	 * @returns A Promise with the system variables.
	 * A list with all system variables is passed (as variables).
	 */
	public async getContent(start: number, count: number): Promise<Array<DebugProtocol.Variable>> {
		start = start || 0;
		const variables = this.variables();
		count = count || (variables.length - start);

		const memory = await Remote.readMemoryDump(0x4000, 0x7D);

		const vars = new Array<DebugProtocol.Variable>(count);
		for (let i = 0; i < count; i++) {
			const variable = variables[i + start];
			vars[i] = {
				name: variable.name,
				value: this.formatVariable(memory, variable, 0x4000),
				variablesReference: 0
			};
		}
		return vars;
	}

	private formatVariable(memory: Uint8Array, variable: SystemVariableDef, offset: number) {
		if(variable.size <= 2) {
			const data = Utility.getUintFromMemory(memory, variable.address - offset, variable.size);
			return Utility.numberFormattedSync(data, variable.size, '${hex}h, ${unsigned}u${, :labelsplus|, }', false);
		}

		const start = variable.address - offset;
		const data = memory.subarray(start, start + variable.size);
		return data.reduce((acc, value) => acc + Utility.getHexString(value, 1), "") + 'h';
	}


	/**
	 * Sets the value of the variable.
	 * The formatted read data is returned in the Promise.
	 * @param name The name of the variable
	 * @param value The value to set.
	 * @returns A Promise with the formatted string.
	 */
	public async setValue(name: string, value: number): Promise<string> {
		const variable = this.variables().find(v => v.name == name);
		if(variable == null) return "?";

		if (!isNaN(value) && variable.size <= 2) {
			// Write data
			const dataWrite = new Uint8Array(variable.size);
			Utility.setUintToMemory(value, dataWrite, 0, variable.size);
			await Remote.writeMemoryDump(variable.address, dataWrite);
			ShallowVar.memoryChanged = true;
		}

		// Retrieve memory values, to see if they really have been set.
		const dataRead = await Remote.readMemoryDump(variable.address, variable.size);

		// Pass formatted string to vscode
		return this.formatVariable(dataRead, variable, variable.address);
	}

	/**
	 * Checks if allowed to change the value.
	 * If not returns a string with an error message.
	 * @param name The name of data.
	 * @returns 'Altering values not allowed in time-travel mode.' or undefined.
	 */
	public changeable(name: string): string | undefined {
		const variable = this.variables().find(v => v.name == name);
		if (variable == null || variable.size > 2)
			return "This variable can't be modified directly, the value is too big";
		// Otherwise allow
		return undefined;
	}

	/**
	 * Returns the system variables names to show.
	 */
	protected variables(): Array<SystemVariableDef> {
		return [
			{name: "ERR_NR", address: 0x4000, size: 1},
			{name: "FLAGS", address: 0x4001, size: 1},
			{name: "ERR_SP", address: 0x4002, size: 2},
			{name: "RAMTOP", address: 0x4004, size: 2},
			{name: "MODE", address: 0x4006, size: 1},
			{name: "PPC", address: 0x4007, size: 2},
			{name: "VERSN", address: 0x4009, size: 1},
			{name: "E_PPC", address: 0x400A, size: 2},
			{name: "D_FILE", address: 0x400C, size: 2},
			{name: "DF_CC", address: 0x400E, size: 2}, 
			{name: "VARS", address: 0x4010, size: 2}, 
			{name: "DEST", address: 0x4012, size: 2}, 
			{name: "E_LINE", address: 0x4014, size: 2}, 
			{name: "CH_ADD", address: 0x4016, size: 2}, 
			{name: "X_PTR", address: 0x4018, size: 2},
			{name: "STKBOT", address: 0x401A, size: 2}, 
			{name: "STKEND", address: 0x401C, size: 2}, 
			{name: "BERG", address: 0x401E, size: 1}, 
			{name: "MEM", address: 0x401F, size: 2}, 
			{name: "SPARE1", address: 0x4021, size: 1}, 
			{name: "DF_SZ", address: 0x4022, size: 1}, 
			{name: "S_TOP", address: 0x4023, size: 2}, 
			{name: "LAST_K", address: 0x4025, size: 2},
			{name: "DB_ST", address: 0x4027, size: 1}, 
			{name: "MARGIN", address: 0x4028, size: 1}, 
			{name: "NXTLIN", address: 0x4029, size: 2}, 
			{name: "OLDPPC", address: 0x402b, size: 2}, 
			{name: "FLAGX", address: 0x402D, size: 1}, 
			{name: "STRLEN", address: 0x402E, size: 2}, 
			{name: "T_ADDR", address: 0x4030, size: 2}, 
			{name: "SEED", address: 0x4032, size: 2}, 
			{name: "FRAMES", address: 0x4034, size: 2}, 
			{name: "COORD_X", address: 0x4036, size: 1}, 
			{name: "COORD_Y", address: 0x4037, size: 1}, 
			{name: "PR_CC", address: 0x4038, size: 1}, 
			{name: "S_POSN_C", address: 0x4039, size: 1}, 
			{name: "S_POSN_L", address: 0x403A, size: 1}, 
			{name: "CDFLAG", address: 0x403B, size: 1},
			{name: "PRBUF", address: 0x403C, size: 0x21}, 
			{name: "MEMBOT", address: 0x405D, size: 0x1E}, 
			{name: "SPARE2", address: 0x407B, size: 2}
		];
	}
}
