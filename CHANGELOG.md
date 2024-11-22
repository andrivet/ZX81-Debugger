# Changelog

## 2.0.0 - November 21, 2024

* Fork from latest version of DeZog (3.5.1).
* Now use DeZog's excellent ZX81 simulator instead of the previous, partial, one.
* Hi-Res is now supported (ARX, WRX) thanks to DeZog.
* You can now use external assemblers like [sjasmplus](https://github.com/z00m128/sjasmplus).
* Fix [Issue #8](https://github.com/andrivet/ZX81-Debugger/issues/8) - Labels not showing up in call stack, can't be used in watches.
* The virtual ZX81 keyboard is now fully functionning.
* A new `dfile` command displays the content of the `D_FILE` (display file).
* New `binaries` configuration parameter to load memory dumps in RAM.
* Comments and Walkthrough in French are removed.

## 1.3.1 - June 28, 2023

* Remove the exclusion of the ZX81 ROM.

## 1.3.0 - June 28, 2023

### Debugger

* Add ZX81 ROM with permission of Nine Tiles
* Show when the keyboard has the focus (green border)
* Simulate LAST_K when a key is pressed or released
* Generate disassembly in a format compatible with the assembly

### Assembler

* Allow (IX) and (IY) without an explicit offset. 
* Define the pseudo value $ for PC.
* Be more specific when an expression can't be evaluated.
* Recursive labels are now properly detected (max 20 recursions).

## 1.2.0 - June 20, 2023

* Update dependencies
* Solve issue with expression starting with an open parenthesis (z80-assembler)
* Add Step by Step Guides (English and French)

## 1.1.0 - June 15, 2023

* First public version based on DeZog 3.2.3

## 1.0.0 - June 14, 2023

* Private version
