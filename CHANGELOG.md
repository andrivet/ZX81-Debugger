# Changelog

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
