import {ConfigurationTarget, Uri, window, workspace, WorkspaceFolder} from 'vscode';
import {NpmExplorerProvider} from './activityBarView';

export const selectPath: (npmExplorerProvider: NpmExplorerProvider) => Promise<void> = async (npmExplorerProvider) => {
    if (!workspace.workspaceFolders) {
        return;
    }
    const workspaceFolder: WorkspaceFolder = workspace.workspaceFolders[0];
    const relativePath: string = workspace.getConfiguration('npmExplorer').get<string>('relativePath', '');
    const allPackageJsonFiles: Uri[] = await workspace.findFiles('**/package.json', '**/{.vscode-test,.vscode,node_modules}/**');
    const quickPicks: string[] = allPackageJsonFiles.map(uri => {
        return uri.path.toLocaleLowerCase().replace(`${workspaceFolder.uri.path.toLocaleLowerCase()}/`, '');
    });

    let selectedItem: string | undefined;
    const choice: string | undefined = await window.showQuickPick(quickPicks, {canPickMany: false, placeHolder: 'Select package.json path'});
    if (choice) {
        selectedItem = choice.replace(/\/*package.json/, '');
    }

    if (selectedItem === undefined || selectedItem === null || selectedItem === relativePath) {
        return;
    }

    await workspace.getConfiguration('npmExplorer').update('relativePath', selectedItem, ConfigurationTarget.Workspace);
    npmExplorerProvider.refresh();
};
