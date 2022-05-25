import {Terminal, window, workspace} from 'vscode';
import {Dependency} from './activityBarView';

export const updateDependency: (dependency: Dependency) => Promise<void> = async (dependency) => {
    const relativePath: string = workspace.getConfiguration('npmExplorer').get<string>('relativePath', '');
    let extraArguments: string = workspace.getConfiguration('npmExplorer').get<string>('updateCommandArguments', '');
    if (extraArguments) {
        extraArguments = ` ${extraArguments}`;
    }
    const terminal: Terminal = window.createTerminal();

    if (relativePath) {
        terminal.sendText(`cd ${relativePath}`);
    }
    
    terminal.show();
    terminal.sendText(`npm update${extraArguments} ${dependency.name}`);
};

export const uninstallDependency: (dependency: Dependency) => Promise<void> = async (dependency) => {
    const relativePath: string = workspace.getConfiguration('npmExplorer').get<string>('relativePath', '');
    let extraArguments: string = workspace.getConfiguration('npmExplorer').get<string>('uninstallCommandArguments', '');
    if (extraArguments) {
        extraArguments = ` ${extraArguments}`;
    }
    
    const terminal: Terminal = window.createTerminal();

    if (relativePath) {
        terminal.sendText(`cd ${relativePath}`);
    }
    
    terminal.show();
    terminal.sendText(`npm uninstall${extraArguments} ${dependency.name}`);
};

export const checkOutdated: () => Promise<void> = async () => {
    const relativePath: string = workspace.getConfiguration('npmExplorer').get<string>('relativePath', '');
    const terminal: Terminal = window.createTerminal();

    if (relativePath) {
        terminal.sendText(`cd ${relativePath}`);
    }
    
    terminal.show();
    terminal.sendText(`npm outdated`);
};
