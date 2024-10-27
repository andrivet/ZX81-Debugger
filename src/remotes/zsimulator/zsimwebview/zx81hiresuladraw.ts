import {Zx81UlaDraw} from "./zx81uladraw";	// For the palette

/** Draws a ZX81 (HiRes) screen of size 256*192.
 */
export class Zx81HiResUlaDraw {
	// Screen height
	public static SCREEN_HEIGHT = 192;

	// Screen width
	public static SCREEN_WIDTH = 256;

	/** Draws a ZX81 ULA screen into the given canvas.
	 * @param ctx The canvas 2d context to draw to.
	 * @param imgData A reusable array to create the pixel data in.
	 * @param ulaScreen The ULA screen data. B/W pixels.
	 * @param colorData The correspondent color data.
	 * @param debug true if debug mode is on. Shows grey background if
	 * dfile is not elapsed.
	 */
	public static drawUlaScreen(ctx: CanvasRenderingContext2D, imgData: ImageData, ulaScreen: Uint8Array, colorData: Uint8Array, backgroundColor: string) {
		// Safety check
		if (!ulaScreen)
			return;

		// Get pixels memory (Get a 32bit view of the buffer)
		const pixels = new Uint32Array(imgData.data.buffer);
		let pixelIndex = 0;

		// Default is transparent
		pixels.fill(0xFFFF0000);

		// Whole screen is converted by evaluating blocks that are equal to the color attributes.
		const screenWidth = 416;
		const screenHeight = imgData.height
		//const width8 = Zx81HiResUlaDraw.SCREEN_WIDTH / 8;
		const width8 = screenWidth / 8;
		let index = 0;
		let colorIndex = 0;
		let len = width8;
		let xAdd = 0;
		let fgRed = 0, fgGreen = 0, fgBlue = 0;
		let bgRed = 0xFF, bgGreen = 0xFF, bgBlue = 0xFF;

		let lineCounter = 0;
		while (index < ulaScreen.length) {
			// Get length of line
			len = ulaScreen[index++];
			// Loop over line
			for (let x = len; x > 0; x--) {
				const xTstates = ulaScreen[index++];
				xAdd = xTstates * 2;
				pixelIndex = (lineCounter * 416 + xAdd);
				// Get color
				if (colorData) {
					const color = colorData[colorIndex++];
					// fg color
					let cIndex = (color & 0x0F) * 3;
					fgRed = Zx81UlaDraw.chroma81Palette[cIndex];
					fgGreen = Zx81UlaDraw.chroma81Palette[cIndex + 1];
					fgBlue = Zx81UlaDraw.chroma81Palette[cIndex + 2];
					// bg color
					cIndex = (color >>> 4) * 3;
					bgRed = Zx81UlaDraw.chroma81Palette[cIndex];
					bgGreen = Zx81UlaDraw.chroma81Palette[cIndex + 1];
					bgBlue = Zx81UlaDraw.chroma81Palette[cIndex + 2];
				}
				// Get screen data
				const byteValue = ulaScreen[index++];
				// Loop over bits
				let mask = 128;
				while (mask >= 1) {	// 8x
					if (byteValue & mask) {
						// Foreground color
						pixels[pixelIndex++] = 0xFF000000 + 65536 * fgBlue + fgGreen * 256 + fgRed;
					}
					else {
						// Background color
						pixels[pixelIndex++] = 0xFF000000 + 65536 * bgBlue + bgGreen * 256 + bgRed;
					}
					// Next pixel
					mask /= 2;
				}
			}
			// Next line
			lineCounter++;
		}

		// Show HSYNC
		Zx81HiResUlaDraw.drawVertLine(pixels, 192, screenWidth, screenHeight, 0xFF, 0, 0);
		// Show left and right border
		Zx81HiResUlaDraw.drawVertLine(pixels, 32, screenWidth, screenHeight, 0, 0xFF, 0);
		Zx81HiResUlaDraw.drawVertLine(pixels, 192 - 32, screenWidth, screenHeight, 0, 0xFF, 0);

		// Write image
		ctx.putImageData(imgData, 0, 0);
	}

	
	/** Draws a vertical line. */
	protected static drawVertLine(pixels: Uint32Array, tstates: number, screenWidth: number, screenHeight: number, r: number, g: number, b: number) {
		for (let y = 0; y < screenHeight; y++) {
			let pixelIndex = (y * screenWidth + tstates * 2);
			pixels[pixelIndex++] = 0xFF000000 + 65536 * b + g * 256 + r;
		}
	}

}

