import * as vscode from 'vscode';
import {HelpView} from './helpview';
//import {UnifiedPath} from '../misc/unifiedpath';


/**
 * Shows the help table of contents in the side bar.
 */
export class HelpProvider implements vscode.WebviewViewProvider {
	// The webview is stored here.
	protected webview: vscode.Webview;


	/**
	 * Called by vscode.
	 */
	resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken): void | Thenable<void> {
		// Store webview
		this.webview = webviewView.webview;

		// Allow scripts in the webview
		this.webview.options = {enableScripts: true};

		// Handle messages from the webview
		this.webview.onDidReceiveMessage(message => {
			switch (message.command) {
				case 'linkClicked':
					// Strip chapter from link
					const link = message.data;
					const index = link.lastIndexOf('#');
					if (index >= 0) {
						const chapter = link.substring(index);
						// E.g. "#support"
						this.navigateToChapter(chapter);
					}
					break;
			}
		});

		// Create html code
		this.setMainHtml();
	}


	/**
	 * Returns the html code to display the DeZog help.
	 */
	public setMainHtml() {
		if (!this.webview)
			return;

		// Get the TOC
		const toc = HelpView.getTocHtml();

		// Add html around
		let mainHtml = `
<!DOCTYPE HTML>
<html>
<head>
	<meta charset="utf-8" >
	<title>DeZog Help</title>
</head>

<style>

/* Normal text color for links and no underline. */
a {
	color: var(--vscode-editor-foreground);
	text-decoration: none;
}

a:hover {
	color: var(--vscode-editor-foreground);
    font-weight: bold;
}

.tooltip {
  display: none;
}

/* No bullets for list. */
ul {
	list-style: none;
    padding-left: 0.5em;
}
li > ul {
    padding-left: 1.5em;
}

</style>

<body>

${toc}

</body>
<script>

const vscode = acquireVsCodeApi();


/*
 * A link to a chapter has been clicked.
 */
function linkClicked() {
	vscode.postMessage({command: 'linkClicked', data: this.href});
    return false;
}


/*
 * Avoid tooltip on hover by removing all titles.
 * And add function call to each click.
 */
function initAnchors() {
	const links = document.getElementsByTagName('a');
	for (let i = 0; i < links.length; i++) {
		// Remove tooltip
		links[i].title = '';
		// Add function call
		links[i].onclick = linkClicked;
	}
}


/**
 * Copies the complete html of the document to the clipboard.
 */
function copyHtmlToClipboard() {
	const copyText = document.documentElement.innerHTML;
	navigator.clipboard.writeText(copyText);
}


// Init all anchors.
initAnchors();

</script>
</html>
`;
		// Add a Reload and Copy button for debugging
		//mainHtml = mainHtml.replace('<body>', '<body><button onclick="initAnchors()">Init</button><button onclick="copyHtmlToClipboard()">Copy HTML to clipboard</button>');

		// Set content
		this.webview.html = mainHtml;
	}

	/**
	 * Creates a help view window with contents
	 * and makes it visible.
	 */
	public createHelpView() {
		const helpView = HelpView.getHelpView();
		// Make sure the view is visible
		helpView.reveal();
	}


	/**
	 * User has clicked on a link.
	 * The help view is opened and it is jumped to the chapter.
	 */
	protected navigateToChapter(chapter: string) {
		// Create a new help view if it does not exist yet.
		const helpView = HelpView.getHelpView();
		// Jump to chapter
		helpView.navigateToChapter(chapter);
	}
}
