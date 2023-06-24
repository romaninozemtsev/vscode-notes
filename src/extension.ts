import * as fs from 'fs/promises';
import path = require('path');
import * as vscode from 'vscode';

const createFolderIfNotExists = async (folderPath: string) => {
    try {
        await fs.access(folderPath);
        //console.log('Folder already exists');
    } catch (error) {
        //console.log('Folder does not exist, creating...');
        await fs.mkdir(folderPath, { recursive: true });
        //console.log('Folder created');
    }
};

//vscode.window.showInformationMessage('adding note');
		

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

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

	// console.log('Congratulations, your extension "vscode-notes" is now active!');

	function getResourcePath(resource: Note) {
		return resource.resourceUri?.fsPath || path.join(getNotesPath(), resource.label);
	}

	let addNodeCommand = vscode.commands.registerCommand('vscode-notes.addNote', async () => {
		const selectedItem = notesTreeView.selection[0];
		
		let folderPath = getNotesPath();

		if (selectedItem && selectedItem.contextValue === 'folder') {
			folderPath = getResourcePath(selectedItem);
		}
		createFolderIfNotExists(folderPath);
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		const noteName = await vscode.window.showInputBox({ prompt: 'Enter the note name' });
		if (noteName) {
			const notePath = path.join(folderPath, `${noteName}.md`);
			await fs.writeFile(notePath, '');
			await vscode.window.showTextDocument(vscode.Uri.file(notePath), { preview: false });
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
			const entryPath = getResourcePath(resource);
			const stats = await fs.stat(entryPath);
			// delete file using fs sync
			if (resource.contextValue === 'folder') {
				await fs.rm(entryPath, { recursive: true });
			} else {
				await fs.unlink(entryPath);
			}
			notesDataProvider.refresh();
		}
	});


	let renameFileCommand = vscode.commands.registerCommand('vscode-notes.renameEntry', async (resource) => {
		if (resource) {
			const oldPath =  getResourcePath(resource);
			// console.log("parent", resource.parent, typeof resource);
			// ensuring that the file exists
			const stats = await fs.stat(oldPath);
			// rename file using fs sync
			// await vscode.workspace.saveAll(false);
			let newName = await vscode.window.showInputBox({ prompt: 'Enter the new name', 'value': resource.label });
			if (!newName) {
				return;
			}

			let shouldOpenFile = false;
			let oldCopyClosed = false;

			// if the document we are changing is an active document:
			if (vscode.window.activeTextEditor?.document.uri.fsPath === oldPath) {
				if (vscode.window.activeTextEditor?.document.isDirty) {
					await vscode.window.activeTextEditor?.document.save();
				}
				// we also need to close it and reopen it
				await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

				shouldOpenFile = true;
				oldCopyClosed = true;
			}


			const dirname = path.dirname(oldPath);
			let newPath = path.join(dirname, newName);
			if (path.extname(newPath) === '') {
				newPath = newPath + '.md';
			}
			
			await fs.rename(oldPath, newPath);
			if (shouldOpenFile) {
				await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(newPath));
			}
			notesDataProvider.refresh();
			
			if (!oldCopyClosed) {
				for (const tabGroup of vscode.window.tabGroups.all) {
					//console.info("tabGroup", tabGroup);
					for (const tab of tabGroup.tabs) {
						if (tab.input instanceof vscode.TabInputText) {
							//console.info("tab", tab.input.uri);
							if (tab.input.uri.fsPath === oldPath) {
								// console.info("closing tab", tab.input.uri);
								await vscode.window.tabGroups.close(tab);
							}
						}
					}
				}
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

	let previousEditor: vscode.TextEditor | undefined;

	vscode.window.onDidChangeActiveTextEditor(async (editor) => {
		let oldName = '';
		let newName = '';
		
		if (previousEditor) {
			oldName = previousEditor.document.fileName;
			if (previousEditor.document.isDirty && oldName.includes(getNotesPath())) {
				// auto save notes upon switching to another editor
				console.log('autosaving old doc');
				await previousEditor.document.save();
			}
			// The document property of a TextEditor refers to the document that the editor is currently showing.
			// await previousEditor.document.save();
		}
		if (editor) {
			newName = editor.document.fileName;
		}
		// Update previous editor
		previousEditor = editor;
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

    private async getNotesInDirectory(directoryPath: string): Promise<Note[]> {
		createFolderIfNotExists(directoryPath);
        const filesAndDirs = await fs.readdir(directoryPath);

		const filesAndDirsFullName = filesAndDirs.map(file => path.join(directoryPath, file));
		const stats = await Promise.all(filesAndDirsFullName.map(filePath => fs.stat(filePath)));
		const filesAndDirsStats = filesAndDirsFullName.map((filePath, index) => ({ fileName: filesAndDirs[index], filePath, stat: stats[index] }));
		const files = filesAndDirsStats
		.filter(({filePath, stat}) => !stat.isDirectory())
		.sort();

		const dirs = filesAndDirsStats
		.filter(({filePath, stat}) => stat.isDirectory())
		.sort();

		const sortedFilesAndDirs = dirs.concat(files);
		// TODO: optimize it.
        return sortedFilesAndDirs.map(({fileName, filePath, stat}) => {
            const item = new Note(
                fileName,
                stat.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            );
			item.resourceUri = vscode.Uri.file(filePath);
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
export function deactivate() {
	console.log("deactivate!!!");
}
