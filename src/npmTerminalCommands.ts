import {Terminal, window, workspace} from 'vscode';
import {Dependency} from './activityBarView';

export const updateDependency: (dependency: Dependency) => Promise<void> = async (dependency) => {
    let extraArguments: string = workspace.getConfiguration('npmExplorer').get<string>('updateCommandArguments', '');
    if (extraArguments) {
        extraArguments = ` ${extraArguments}`;
    }
    const terminal: Terminal = window.createTerminal();
    terminal.show();
    terminal.sendText(`npm update${extraArguments} ${dependency.name}`);
};

export const uninstallDependency: (dependency: Dependency) => Promise<void> = async (dependency) => {
    let extraArguments: string = workspace.getConfiguration('npmExplorer').get<string>('uninstallCommandArguments', '');
    if (extraArguments) {
        extraArguments = ` ${extraArguments}`;
    }
    
    const terminal: Terminal = window.createTerminal();
    terminal.show();
    terminal.sendText(`npm uninstall${extraArguments} ${dependency.name}`);
};

export const checkOutdated: () => Promise<void> = async () => {
    const terminal: Terminal = window.createTerminal();
    terminal.show();
    terminal.sendText(`npm outdated`);
};
