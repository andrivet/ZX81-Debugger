# Building the ZX81 Debugger from sources

## Clone

Clone e.g. via https:
~~~bash
git clone https://github.com/andrivet/ZX81-Debugger.git
~~~


## Build

Open folder 'ZX81-Debugger' in vscode (>= 1.74). Open a terminal and install all required packages.
~~~bash
npm i
~~~

Run the build task
~~~bash
npm run watch
~~~

This can be accomplished also by running it from the menu ("Terminal->Run build task ...").
The build task is setup for incremental building and watches any file changes.
I.e. you don't need to compile manually everytime.

(Alternatively ```npm run compile``` should also do.)

# Creating a vsix package

The package that is used for releasing.
Is about 17 MB in size.

Run
~~~bash
vsce package
~~~

or the npm script

~~~bash
npm run package
~~~
