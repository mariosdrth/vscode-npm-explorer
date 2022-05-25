import {commands, ExtensionContext, window, workspace} from 'vscode';
import {NpmTask, NpmExplorerProvider, Dependency} from './activityBarView';
import {deleteDependency, deleteTask} from './deleteEntryCommand';
import {editDependency, editTask} from './editEntryCommands';
import {checkOutdated, uninstallDependency, updateDependency} from './npmTerminalCommands';
import {runTask} from './runTaskCommand';

export function activate(context: ExtensionContext): void {
	const npmExplorerProvider: NpmExplorerProvider = new NpmExplorerProvider();
	context.subscriptions.push(
		window.registerTreeDataProvider('npmExplorer', npmExplorerProvider),
		commands.registerCommand('npmExplorer.refresh', () => npmExplorerProvider.refresh()),
		commands.registerCommand('npmExplorer.checkOutdated', () => checkOutdated()),
		commands.registerCommand('npmExplorer.updateDependency', (dependency: Dependency) => updateDependency(dependency)),
		commands.registerCommand('npmExplorer.uninstallDependency', (dependency: Dependency) => uninstallDependency(dependency)),
		commands.registerCommand('npmExplorer.editDependency', (dependency: Dependency) => editDependency(dependency)),
		commands.registerCommand('npmExplorer.deleteDependency', (dependency: Dependency) => deleteDependency(dependency)),
		commands.registerCommand('npmExplorer.runTask', (task: NpmTask) => runTask(task)),
		commands.registerCommand('npmExplorer.editTask', (task: NpmTask) => editTask(task)),
		commands.registerCommand('npmExplorer.deleteTask', (task: NpmTask) => deleteTask(task)),
		workspace.onDidSaveTextDocument((document) => document.fileName.includes('package.json') && npmExplorerProvider.refresh())
	);
}