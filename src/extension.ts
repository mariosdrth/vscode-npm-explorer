import {commands, ExtensionContext, window, workspace} from 'vscode';
import {NpmTask, NpmExplorerProvider, Dependency} from './activityBarView';
import {deleteDependency, deleteTask} from './deleteEntryCommand';
import {editDependency, editTask} from './editEntryCommands';
import {NpmRegistryWebView} from './npmRegistryWebView';
import {checkOutdated, npmInstall, runTask, uninstallDependency, updateAll, updateDependency} from './taskCommands';

export function activate(context: ExtensionContext): void {
	const npmExplorerProvider: NpmExplorerProvider = new NpmExplorerProvider();
	let npmRegistry: NpmRegistryWebView;
	context.subscriptions.push(
		window.registerTreeDataProvider('npmExplorer', npmExplorerProvider),
		commands.registerCommand('npmExplorer.refresh', () => npmExplorerProvider.refresh()),
		commands.registerCommand('npmExplorer.openNpmRegistry', () => new NpmRegistryWebView(npmExplorerProvider, context)),
		commands.registerCommand('npmExplorer.updateAll', () => updateAll(npmExplorerProvider)),
		commands.registerCommand('npmExplorer.npmInstall', () => npmInstall(npmExplorerProvider)),
		commands.registerCommand('npmExplorer.checkOutdated', () => checkOutdated(npmExplorerProvider)),
		commands.registerCommand('npmExplorer.openNpmRegistryWithDependency', (dependency: Dependency) => new NpmRegistryWebView(npmExplorerProvider, context, dependency)),
		commands.registerCommand('npmExplorer.updateDependency', (dependency: Dependency) => updateDependency(dependency, npmExplorerProvider)),
		commands.registerCommand('npmExplorer.uninstallDependency', (dependency: Dependency) => uninstallDependency(dependency, npmExplorerProvider)),
		commands.registerCommand('npmExplorer.editDependency', (dependency: Dependency) => editDependency(dependency)),
		commands.registerCommand('npmExplorer.deleteDependency', (dependency: Dependency) => deleteDependency(dependency)),
		commands.registerCommand('npmExplorer.runTask', (task: NpmTask) => runTask(task)),
		commands.registerCommand('npmExplorer.editTask', (task: NpmTask) => editTask(task)),
		commands.registerCommand('npmExplorer.deleteTask', (task: NpmTask) => deleteTask(task)),
		workspace.onDidSaveTextDocument((document) => document.fileName.includes('package.json') && npmExplorerProvider.refresh())
	);
}

// const showNpmRegistryView: (npmExplorerProvider: NpmExplorerProvider, npmRegistry: NpmRegistryWebView, context: ExtensionContext, dependency?: Dependency) => void = (npmExplorerProvider, npmRegistry, context, dependency) => {
// 	if (!npmRegistry || !npmRegistry.isOpen) {
// 		npmRegistry = new NpmRegistryWebView(npmExplorerProvider, context, dependency);
// 	} else {
// 		npmRegistry.showPanel();
// 	}
// };