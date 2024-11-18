# A ZX81 Debugger for Visual Studio Code

![ZX81](assets/ZX81.png)

This project provides a Visual Studio Extension to develop programs written in Z80 assembly language for the Sinclair ZX81. In particular:

* You can assemble Z80 programs without any other external software.
* You can debug your programs within Visual Studio Code, stepping, putting breakpoints, etc.
* Your program runs in an internal simulator, and the debugger displays a simulated display and accepts inputs from the keyboard.
* If you prefer, you can use an external (and more accurate) simulator such as Zesarux.

This Extension is only for the ZX81 computer. If you are looking for an Extension for the ZX-Spectrum, [look at DeZog](https://marketplace.visualstudio.com/items?itemName=maziac.dezog). The ZX81 Debugger is based [on this Extension](https://github.com/maziac/DeZog).

![ZX81 Debugger](assets/ZX81-Debugger.png)

# Quick Start

Apart from [Visual Studio Code](https://code.visualstudio.com/download), there is no prerequisite. In Visual Studio Code, click on [the Extensions icons on the Activity Bar on the side](https://code.visualstudio.com/docs/editor/extension-marketplace) and search for "ZX81-Debugger" (andrivet.zx81-debugger). Click on **Install**.

The Extension is ready, and you can start to write, compile and debug your programs. Look at the [Walkthrough](./docs/walkthrough.md) to see how to use ZX81-Debugger.

# Assembler

The ZX81 Debugger uses the [Z80 Assembler in Typescript Library](https://github.com/andrivet/z80-assembler). For more information about the assembly language supported, [see its documentation](https://github.com/andrivet/z80-assembler/blob/master/docs/assembler.md).

# Limitations

* It supports only programs written in Z80 assembly language. There is no support for BASIC programs.
* For the moment, only the internal simulator is supported. In the future, it will also support the [ZEsarUX emulator](https://github.com/chernandezba/zesarux).

# Copyrights

* ZX81-Debugger, Copyright &copy; 2023 Sebastien Andrivet.
* [Z80 Assembler in Typescript Library](https://github.com/andrivet/z80-assembler), Copyright &copy; 2023 Sebastien Andrivet.
* [DeZog](https://github.com/maziac/DeZog), Copyright &copy; Thomas Busse.
* [Z80.js simulator](https://github.com/DrGoldfire/Z80.js) Copyright &copy; Molly Howell
* ZX81 ROM Copyright &copy; 1981 Nine Tiles - Included with the permission of Nine Tiles.

# License

* ZX81-Debugger is licensed under GPLv3.
* Z80 Assembler in Typescript Library is licensed under GPLv3.
* DeZog is licensed under the MIT license.
* Z80.js simulator is licensed under the MIT license.
