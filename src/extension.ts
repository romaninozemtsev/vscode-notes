// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { readdirSync, statSync, accessSync, mkdirSync, writeFileSync } from 'fs';
import path = require('path');
import * as vscode from 'vscode';
//import { NodeDependenciesProvider } from './nodeDependenciesProvider';

const createFolderIfNotExists = (folderPath: string) => {
    try {
        accessSync(folderPath);
        console.log('Folder already exists');
    } catch (error) {
        console.log('Folder does not exist, creating...');
        mkdirSync(folderPath, { recursive: true });
        console.log('Folder created');
    }
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
	? vscode.workspace.workspaceFolders[0].uri.fsPath
	: '';

	const notesDataProvider = new NotesDataProvider(context);

	vscode.window.registerTreeDataProvider('notes', notesDataProvider);

	// vscode.window.createTreeView('nodeDependencies', {
	// 	treeDataProvider: new NodeDependenciesProvider(rootPath)
	// });

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-notes" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('vscode-notes.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from vscode-notes!');
	});

	let disp2 = vscode.commands.registerCommand('vscode-notes.addNote', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('adding note');
		const noteName = await vscode.window.showInputBox({ prompt: 'Enter the note name' });
		if (noteName) {
			const globalStoragePath = context.globalStorageUri.fsPath;
			const notePath = path.join(globalStoragePath, `${noteName}.txt`);
			writeFileSync(notePath, '');
			vscode.window.showTextDocument(vscode.Uri.file(notePath), { preview: false });
			notesDataProvider.refresh(); // Refresh the tree to show the newly added note
		}
	});
	context.subscriptions.push(disposable);
	context.subscriptions.push(disp2);
	// context.subscriptions.push(vscode.commands.registerCommand('vscode-notes.openFile', async () => {

	// });
}

class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
	onDidChangeTreeData?: vscode.Event<TreeItem|null|undefined>|undefined;
  
	data: TreeItem[];
  
	constructor() {
	  this.data = [new TreeItem('cars', [
		new TreeItem(
			'Ford', [new TreeItem('Fiesta'), new TreeItem('Focus'), new TreeItem('Mustang')]),
		new TreeItem(
			'BMW', [new TreeItem('320'), new TreeItem('X3'), new TreeItem('X5')])
	  ])];
	}
  
	getTreeItem(element: TreeItem): vscode.TreeItem|Thenable<vscode.TreeItem> {
	  return element;
	}
  
	getChildren(element?: TreeItem|undefined): vscode.ProviderResult<TreeItem[]> {
	  if (element === undefined) {
		return this.data;
	  }
	  return element.children;
	}
  }
  
  class TreeItem extends vscode.TreeItem {
	children: TreeItem[]|undefined;
  
	constructor(label: string, children?: TreeItem[]) {
	  super(
		  label,
		  children === undefined ? vscode.TreeItemCollapsibleState.None :
								   vscode.TreeItemCollapsibleState.Expanded);
	  this.children = children;
	}
  }




class Note extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
    }
}



class NotesDataProvider implements vscode.TreeDataProvider<Note> {
    private _onDidChangeTreeData: vscode.EventEmitter<Note | undefined | null | void> = new vscode.EventEmitter<Note | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Note | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private readonly context: vscode.ExtensionContext) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Note): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Note): Thenable<Note[]> {
        if (!element) {
            const globalStoragePath = this.context.globalStorageUri.fsPath;
            return Promise.resolve(this.getNotesInDirectory(globalStoragePath));
        }
        return Promise.resolve([]);
    }

    private getNotesInDirectory(directoryPath: string): Note[] {
		createFolderIfNotExists(directoryPath);
        const files = readdirSync(directoryPath);
        return files.map((file) => {
            const filePath = path.join(directoryPath, file);
            const stat = statSync(filePath);
            const item = new Note(
                file,
                stat.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(filePath)],
                }
            );
			item.iconPath = new vscode.ThemeIcon('markdown');
			//vscode.ThemeIcon.File;
			return item;
        });
    }
}

// This method is called when your extension is deactivated
export function deactivate() {}
