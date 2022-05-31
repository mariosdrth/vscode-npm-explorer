import {ShellExecution, Task, tasks, TaskScope, workspace} from 'vscode';
import {Dependency, NpmExplorerProvider, NpmTask} from './activityBarView';

enum NpmTasks {
    NPM_UPDATE = 'npm update',
    NPM_OUTDATED = 'npm outdated',
    NPM_INSTALL = 'npm install',
    NPM_UNINSTALL = 'npm uninstall',
}

export const runTask: (npmTask: NpmTask) => Promise<void> = async (npmTask) => {
    const allTasks: Task[] = await tasks.fetchTasks();
    const task: Task = allTasks.filter(_task => _task.definition.script === npmTask.label)[0];

    if (!task) {
        return;
    }
    
    await tasks.executeTask(task);
};

export const checkOutdated: (npmExplorerProvider: NpmExplorerProvider) => Promise<void> = async (npmExplorerProvider) => {
    runNpmTask(npmExplorerProvider, NpmTasks.NPM_OUTDATED, false);
};

export const updateAll: (npmExplorerProvider: NpmExplorerProvider) => Promise<void> = async (npmExplorerProvider) => {
    runNpmTask(npmExplorerProvider, NpmTasks.NPM_UPDATE);
};

export const npmInstall: (npmExplorerProvider: NpmExplorerProvider) => Promise<void> = async (npmExplorerProvider) => {
    let extraArguments: string = workspace.getConfiguration('npmExplorer').get<string>('installCommandArguments', '');
    if (extraArguments) {
        extraArguments = ` ${extraArguments}`;
    }
    runNpmTask(npmExplorerProvider, NpmTasks.NPM_INSTALL + extraArguments);
};

export const updateDependency: (dependency: Dependency, npmExplorerProvider: NpmExplorerProvider) => Promise<void> = async (dependency, npmExplorerProvider) => {
    let extraArguments: string = dependency.isDev ? workspace.getConfiguration('npmExplorer').get<string>('updateDevCommandArguments', '') : workspace.getConfiguration('npmExplorer').get<string>('updateCommandArguments', '');
    if (extraArguments) {
        extraArguments = ` ${extraArguments}`;
    } else if (dependency.isDev) {
        extraArguments = ' --save-dev';
    }

    runNpmTask(npmExplorerProvider, NpmTasks.NPM_UPDATE + extraArguments + ` ${dependency.name}`);
};

export const installDependency: (dependencyName: string, npmExplorerProvider: NpmExplorerProvider, versionToUpdateTo?: string, asDev?: boolean) => Promise<void> = async (dependencyName, npmExplorerProvider, versionToUpdateTo, asDev) => {
    let extraArguments: string = '';
    if (asDev) {
        extraArguments = ' --save-dev';
    }

    let dependencyNameAndVersion: string = dependencyName;
    if (versionToUpdateTo) {
        dependencyNameAndVersion = `${dependencyNameAndVersion}@${versionToUpdateTo}`;
    }

    runNpmTask(npmExplorerProvider, NpmTasks.NPM_INSTALL + extraArguments + ` ${dependencyNameAndVersion}`);
};

export const uninstallDependency: (dependency: Dependency, npmExplorerProvider: NpmExplorerProvider) => Promise<void> = async (dependency, npmExplorerProvider) => {
    let extraArguments: string = dependency.isDev ? workspace.getConfiguration('npmExplorer').get<string>('uninstallDevCommandArguments', '') : workspace.getConfiguration('npmExplorer').get<string>('uninstallCommandArguments', '');
    if (extraArguments) {
        extraArguments = ` ${extraArguments}`;
    } else if (dependency.isDev) {
        extraArguments = ' --save-dev';
    }
    
    runNpmTask(npmExplorerProvider, NpmTasks.NPM_UNINSTALL + extraArguments + ` ${dependency.name}`);
};

const runNpmTask: (npmExplorerProvider: NpmExplorerProvider, command: string, shouldRefresh?: boolean) => Promise<void> = async (npmExplorerProvider, command, shouldRefresh = true) => {
    const relativePath: string = workspace.getConfiguration('npmExplorer').get<string>('relativePath', '');
    const shellExecution: ShellExecution = relativePath ? new ShellExecution(command, {cwd: relativePath}) : new ShellExecution(command);
    const task: Task = new Task({type: 'npm'}, TaskScope.Workspace, command, 'npm', shellExecution);

    await tasks.executeTask(task);
    if (shouldRefresh) {
        tasks.onDidEndTaskProcess(event => {
            if (event.execution.task.name === task.name) {
                npmExplorerProvider.refresh();
            }
        });
    }
};