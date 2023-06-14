/**
 * ZX81 Debugger
 * 
 * File:			timewait.ts
 * Description:		A class to wait for some time.
 * Author:			Sebastien Andrivet, based on Dezog my Thomas Busse (Maziac)
 * License:			GPLv3
 * Copyrights: 		ZX81 Debugger Copyright (C) 2023 Sebastien Andrivet
 * 					DeZog Copyright (C) 2023 Maziac
 */
import {Utility} from "./utility";


export class TimeWait {

	// THe
	protected time: number;

	// The delta time.
	protected intervalMs: number;

	// The time to wait.
	protected waitTimeMs: number;

	/**
	 * Constructor.
	 * The object should be called periodically. It takes care of the time by itself.
	 * If the interval time is exceeded. It will execute a wait for 'waitTimeMs'.
	 * @param startDelayMs The time to wait the first time. This can be higher, e.g. 1 second, because it normally tkaes a human some time to react.
	 * @param intervalMs The time between to waits.
	 * @param waitTimeMs The wait time.
	 */
	constructor(startDelayMs: number, intervalMs: number, waitTimeMs: number) {
		this.time=Date.now();
		this.intervalMs=intervalMs;
		this.waitTimeMs=waitTimeMs;
		this.time=Date.now()+startDelayMs;
	}

	/**
	 * If time is up it will wait for waitTimeMs.
	 * Otherwise it returns immediately.
	 * The first time this is called it does immediately wait.
	 */
	public async waitAtInterval(): Promise<void> {
		const currentTime=Date.now();
		if (currentTime<this.time)
			return;
		// Execute wait
		await Utility.timeout(this.waitTimeMs);
		// New time
		this.time=Date.now()+this.intervalMs;
	}
}
