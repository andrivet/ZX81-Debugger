import * as OrigPath from 'path';



//export const UnifiedPath=OrigPath;
//export const UnifiedPath=OrigPath.posix;


const redirectedPath = OrigPath.posix;

/**
 * Works only on unix style paths regardless on which operating system
 * DeZog is running on.
 * Unix style path (i.e. forward slashes) are recognized by Windows as well.
 * So it is still compatible.
 * Does not provide all functionality of 'path'
 * only the used functions.
 * Use this class everywhere instead of path directly.
 */
export class UnifiedPath {

	// Just pass these functions:
	public static basename = redirectedPath.basename;
	public static dirname = redirectedPath.dirname;
	public static resolve = redirectedPath.resolve;
	public static extname = redirectedPath.extname;

	/**
	 * Needs to check posix and windows.
	 * Required because a path could now start with "c:/..." instead of "/".
	 */
	public static isAbsolute(path: string): boolean {
		if (OrigPath.posix.isAbsolute(path))
			return true;
		if (OrigPath.win32.isAbsolute(path))
			return true;
		return false;
	}


	/**
	 * Like 'join' but afterwards converts to unified path.
	 */
	public static join(...paths: string[]): string {
		const s = redirectedPath.join(...paths);
		return this.getUnifiedPath(s);
	}


	/**
	 * Changes all Windows backslashes "\" into forward slashes "/".
	 * I.e. it creates a unified path.
	 * For window path it also changes the drive letter to lower case (e.g. "C:" to "c:".
	 * @param fpath The file path. May contain "/" or "\" even both.
	 * @return The same path but all '\' converted to '/'.
	 * If fpath is undefined an undefined value is returned.
	 */
	public static getUnifiedPath(fpath: string | undefined): string {
		if (!fpath)
			return undefined as any;
		let uPath = fpath.replace(/\\/g, '/');
		if (uPath.length > 1) {
			// Check for windows path
			let drive = uPath.substring(0, 2);
			if (drive.endsWith(':')) {
				// Change drive letter to lower case
				drive = drive.toLowerCase();
				uPath = drive + uPath.substring(2);
			}
		}
		return uPath;
	}


	/**
	 * Same as getUnifiedPath but works on an array of strings.
	 * @param fpaths Array of relative path strings.
	 * @return An array of path strings but all '\' converted to '/'.
	 * May return undefined if fpaths is undefined.
	 */
	public static getUnifiedPathArray(fpaths: string[]): string[] {
		if (!fpaths)
			return undefined as any;
		const uPath = fpaths.map(fpath =>
			((fpath != undefined) ? fpath.replace(/\\/g, '/') : undefined) as string);
		return uPath;
	}

	public static changeExtension(path: string, extension: string) {
		const basename = UnifiedPath.basename(path, UnifiedPath.extname(path))
		return UnifiedPath.join(UnifiedPath.dirname(path), basename + extension)
	}

}

