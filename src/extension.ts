import fs = require('fs');
import path = require('path');
import * as vscode from 'vscode';

const createFolderIfNotExists = (folderPath: string) => {
    try {
        fs.accessSync(folderPath);
        console.log('Folder already exists');
    } catch (error) {
        console.log('Folder does not exist, creating...');
        fs.mkdirSync(folderPath, { recursive: true });
        console.log('Folder created');
    }
};

//vscode.window.showInformationMessage('adding note');
		

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const rootPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
	? vscode.workspace.workspaceFolders[0].uri.fsPath
	: '';

	function getNotesPath(): string {
		const settings = vscode.workspace.getConfiguration('vscode-notes');
		return settings.get<string>('notesLocation') || context.globalStorageUri.fsPath;
	}

	const notesDataProvider = new NotesDataProvider(context, getNotesPath);

	const notesTreeView = vscode.window.createTreeView('mdNotes', {
		treeDataProvider: notesDataProvider
	});

	console.log('Congratulations, your extension "vscode-notes" is now active!');

	let addNodeCommand = vscode.commands.registerCommand('vscode-notes.addNote', async () => {
		const selectedItem = notesTreeView.selection[0];
		
		let folderPath = getNotesPath();

		if (selectedItem && selectedItem.contextValue === 'folder') {
			folderPath = path.join(folderPath, selectedItem.label);
		}
		createFolderIfNotExists(folderPath);
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		const noteName = await vscode.window.showInputBox({ prompt: 'Enter the note name' });
		if (noteName) {
			const notePath = path.join(folderPath, `${noteName}.md`);
			fs.writeFileSync(notePath, '');
			vscode.window.showTextDocument(vscode.Uri.file(notePath), { preview: false });
			notesDataProvider.refresh(); // Refresh the tree to show the newly added note
		}
	});
	let addFolderCommand = vscode.commands.registerCommand('vscode-notes.addFolder', async () => {
		const folderName = await vscode.window.showInputBox({ prompt: 'Enter the folder name' });
		if (folderName) {
			const folderPath = path.join(getNotesPath(), folderName);
			createFolderIfNotExists(folderPath);
			notesDataProvider.refresh();
		}
	});
	let deleteEntryCommand = vscode.commands.registerCommand('vscode-notes.deleteEntry', async (resource) => {
		if (resource) {
			const entryPath = path.join(getNotesPath(), resource.label);
			const stats = fs.statSync(entryPath);
			// delete file using fs sync
			if (resource.contextValue === 'folder') {
				fs.rmSync(entryPath, { recursive: true });
			} else {
				fs.unlinkSync(entryPath);
			}
			notesDataProvider.refresh();
		}
	});
	let renameFileCommand = vscode.commands.registerCommand('vscode-notes.renameEntry', async (resource) => {
		if (resource) {
			const entryPath = path.join(getNotesPath(), resource.label);
			const stats = fs.statSync(entryPath);
			console.log(resource.parent);
			// rename file using fs sync
			const newName = await vscode.window.showInputBox({ prompt: 'Enter the new name' });
			if (newName) {
				const newPath = path.join(getNotesPath(), newName);
				fs.renameSync(entryPath, newPath);
				notesDataProvider.refresh();
			}
		}
	});


	const openSettingsCommand = vscode.commands.registerCommand('vscode-notes.openSettings', async () => {
		vscode.commands.executeCommand('workbench.action.openSettings', 'NotesMD');
	});

	vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('vscode-notes.notesLocation')) {
			console.log("notesLocation changed", e);
            notesDataProvider.refresh();
        }
    });

	context.subscriptions.push(addNodeCommand);
	context.subscriptions.push(openSettingsCommand);
	context.subscriptions.push(addFolderCommand);
	context.subscriptions.push(deleteEntryCommand);
	context.subscriptions.push(renameFileCommand);

}


class Note extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public command?: vscode.Command
    ) {
        super(label, collapsibleState);
    }
}

class Folder extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
    }
}

type NoParamsReturnString = () => string;



class NotesDataProvider implements vscode.TreeDataProvider<Note> {
    private _onDidChangeTreeData: vscode.EventEmitter<Note | undefined | null | void> = new vscode.EventEmitter<Note | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Note | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private readonly context: vscode.ExtensionContext, private readonly pathFn: NoParamsReturnString) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Note): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Note): Thenable<Note[]> {
		const globalPath = this.pathFn();
        if (!element) {
            const globalStoragePath = globalPath;
            return Promise.resolve(this.getNotesInDirectory(globalStoragePath));
        } else if (element.contextValue === 'folder') {
			const directoryPath = path.join(globalPath, element.label);
			return Promise.resolve(this.getNotesInDirectory(directoryPath));
		}
        return Promise.resolve([]);
    }

    private getNotesInDirectory(directoryPath: string): Note[] {
		createFolderIfNotExists(directoryPath);
        const filesAndDirs = fs.readdirSync(directoryPath);

		const files = filesAndDirs
		.filter(file => !fs.statSync(path.join(directoryPath, file)).isDirectory())
		.sort();

		const dirs = filesAndDirs
		.filter(file => fs.statSync(path.join(directoryPath, file)).isDirectory())
		.sort();

		const sortedFilesAndDirs = dirs.concat(files);
		// TODO: optimize it.
        return sortedFilesAndDirs.map((file) => {
            const filePath = path.join(directoryPath, file);
            const stat = fs.statSync(filePath);
            const item = new Note(
                file,
                stat.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            );
			//vscode.ThemeIcon.File;
			if (stat.isDirectory()) {
				//item.iconPath = new vscode.ThemeIcon('folder');
				item.contextValue = 'folder';
			} else {
				item.iconPath = new vscode.ThemeIcon('markdown');
				item.contextValue = 'note';
				item.command = {
					command: 'vscode.open',
					title: 'Open File',
					arguments: [vscode.Uri.file(filePath)],
				};
			}
			return item;
        });
    }
}

// This method is called when your extension is deactivated
export function deactivate() {}
