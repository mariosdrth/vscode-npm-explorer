import {Terminal, window, workspace} from 'vscode';
import {Dependency} from './activityBarView';

export const updateDependency: (dependency: Dependency) => Promise<void> = async (dependency) => {
    let extraArguments: string = workspace.getConfiguration('npmExplorer').get<string>('updateCommandArguments', '');
    if (extraArguments) {
        extraArguments = ` ${extraArguments}`;
    }
    const terminal: Terminal = window.createTerminal();

    terminal.show();
    terminal.sendText(`npm update${getPathPrefix()}${extraArguments} ${dependency.name}`);
};

export const uninstallDependency: (dependency: Dependency) => Promise<void> = async (dependency) => {
    let extraArguments: string = workspace.getConfiguration('npmExplorer').get<string>('uninstallCommandArguments', '');
    if (extraArguments) {
        extraArguments = ` ${extraArguments}`;
    }
    
    const terminal: Terminal = window.createTerminal();
    
    terminal.show();
    terminal.sendText(`npm uninstall${getPathPrefix()}${extraArguments} ${dependency.name}`);
};

export const checkOutdated: () => Promise<void> = async () => {
    const terminal: Terminal = window.createTerminal();
    
    terminal.show();
    terminal.sendText(`npm${getPathPrefix()} outdated`);
};

export const npmInstall: () => Promise<void> = async () => {
    let relativePath: string = workspace.getConfiguration('npmExplorer').get<string>('relativePath', '');
    const terminal: Terminal = window.createTerminal();

    if (relativePath) {
        relativePath = ` ${relativePath}`;
    }
    
    terminal.show();
    terminal.sendText(`npm install${relativePath}`);
};

const getPathPrefix: () => string = () => {
    let prefix: string = '';
    const relativePath: string = workspace.getConfiguration('npmExplorer').get<string>('relativePath', '');

    if (relativePath) {
        prefix = ` --prefix ${relativePath}`;
    }

    return prefix;
};
