import {ExtensionContext, window} from 'vscode';
import {NpmExplorerProvider} from './activityBarView';
import {NpmRegistryWebView} from './npmRegWebView';

export const searchNpmRegistry: (npmExplorerProvider: NpmExplorerProvider, context: ExtensionContext) => Promise<void> = async (npmExplorerProvider, context) => {
    const searchTerm: string | undefined = await window.showInputBox({placeHolder: 'Search Packages...'});
    if (!searchTerm) {
        return;
    }
    new NpmRegistryWebView(npmExplorerProvider, context, undefined, searchTerm);
};
