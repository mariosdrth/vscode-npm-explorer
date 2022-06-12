import {DecorationOptions, Event, EventEmitter, Position, Range, RelativePattern, TextDocument, TextEditor, TextEditorDecorationType, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, window, workspace, WorkspaceFolder} from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

export type NpmExplorerTreeItem = BaseItem | NpmTask | Dependency;

interface OutdatedDependency {
    name: string;
    wanted: string;
}

const pathIcon: string = path.join(__filename, '..', '..', 'images', 'warning.svg');
const tabDecorationType: TextEditorDecorationType = window.createTextEditorDecorationType({
    isWholeLine: true,
    gutterIconPath: pathIcon ? pathIcon : '',
    gutterIconSize: '70%'
});

export class NpmExplorerProvider implements TreeDataProvider<NpmExplorerTreeItem> {
    private _onDidChangeTreeData: EventEmitter<NpmExplorerTreeItem | undefined | void> = new EventEmitter<NpmExplorerTreeItem | undefined | void>();
	readonly onDidChangeTreeData: Event<NpmExplorerTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {
    }

    refresh(): void {
		this._onDidChangeTreeData.fire();
        refreshDecorators();
	}

    getTreeItem(element: NpmExplorerTreeItem): TreeItem {
        return element;
    }

    getChildren(element?: NpmExplorerTreeItem | undefined): Thenable<NpmExplorerTreeItem[]> {
        if (element instanceof BaseItem) {
            return Promise.resolve(element.children);
        }
        return Promise.resolve(getTree());
    }
}

export class BaseItem extends TreeItem {
    children: NpmTask[] | Dependency[];

    constructor(label: string, children: NpmTask[] | Dependency[]) {
        super(label, !children ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Expanded);
        this.children = children;
    }
}

export class Dependency extends TreeItem {
    name: string;
    isInstalled: boolean;
    version?: string;
    isOutdated?: boolean;
    wantedVersion?: string;
    isDev?: boolean;

    constructor(name: string, version: string, isOutdated: boolean, wantedVersion: string, isInstalled: boolean, isDev?: boolean) {
        super(name, TreeItemCollapsibleState.None);
        this.description = `Current version: ${version}${isOutdated ? ` - Newer version ${wantedVersion}` : ''}`;
        this.name = name;
        this.version = version;
        this.isOutdated = !!isOutdated;
        this.wantedVersion = wantedVersion;
        this.isDev = !!isDev;
        this.isInstalled = isInstalled;

        this.iconPath = {
            light: isOutdated ? path.join(__filename, '..', '..', 'images', 'light', 'dependency_outdated.svg') : path.join(__filename, '..', '..', 'images', 'light', 'dependency.svg'),
            dark: isOutdated ? path.join(__filename, '..', '..', 'images', 'dark', 'dependency_outdated.svg') : path.join(__filename, '..', '..', 'images', 'dark', 'dependency.svg')
        };

        this.contextValue = 'dependency';
    }
}

export class NpmTask extends TreeItem {
    script: string;

    constructor(label: string, script: string) {
        super(label, TreeItemCollapsibleState.None);
        this.script = script;
    }

    iconPath: {light: string; dark: string} = {
		light: path.join(__filename, '..', '..', 'images', 'light', 'run.svg'),
		dark: path.join(__filename, '..', '..', 'images', 'dark', 'run.svg')
	};

    contextValue: string = 'npmTask';
}

export const markPackages: (textEditor?: TextEditor) => Promise<void> = async (textEditor) => {
    const shouldShowGutter: boolean = workspace.getConfiguration('npmExplorer').get<boolean>('showGutterInPackageJson', true);
    if (!shouldShowGutter) {
        return;
    }
    const document: TextDocument | undefined = textEditor ? textEditor.document : window.activeTextEditor?.document;
    if (!document) {
        return;
    }
    if (!document.fileName.includes('package.json')) {
        window.activeTextEditor?.setDecorations(tabDecorationType, []);
        return;
    }
    const outdatedDependencies: OutdatedDependency[] = await getOutdatedDependencies();
    const content: string = document.getText();
    const tabs: DecorationOptions[] = [];

    if (!outdatedDependencies || outdatedDependencies.length === 0) {
        return;
    }

    outdatedDependencies.forEach(dependency => {
        const match: RegExpExecArray | null = new RegExp(`dependencies":\\s*{.*"${dependency.name}":\\s*"`, 'gmsi').exec(content);
        if (match && match.index) {
            const position: Position = document.positionAt(match.index + match[0].length);
            const decoration: DecorationOptions = {
                range: new Range(position, position)
            };
            tabs.push(decoration);
        }
    });

    textEditor ? textEditor.setDecorations(tabDecorationType, tabs) : window.activeTextEditor?.setDecorations(tabDecorationType, tabs);
};

const refreshDecorators: () => void = () => {
    window.activeTextEditor?.setDecorations(tabDecorationType, []);
    markPackages();
};

export const getPackageJsonUri: () => Promise<Uri | null> = async () => {
    let relativePattern: RelativePattern;
    let uris: Uri[];

    const relativePath: string = workspace.getConfiguration('npmExplorer').get<string>('relativePath', '');
    if (!relativePath) {
        if (!workspace.workspaceFolders) {
            return null;
        }
        const folder: WorkspaceFolder = workspace.workspaceFolders[0];
        relativePattern = new RelativePattern(folder, 'package.json');
        uris = await workspace.findFiles(relativePattern);
    } else {
        uris = await workspace.findFiles(`${relativePath}/package.json`);
    }
    if (uris.length === 1) {
        return uris[0];
    }
    return null;
};

export const getPackageJsonDocument: () => Promise<TextDocument | null> = async () => {
    const uri: Uri | null = await getPackageJsonUri();
    if (!uri) {
        return null;
    }
    const document: TextDocument = await workspace.openTextDocument(uri);
    return document;
};

const getTree: () => Promise<BaseItem[]> = async () => {
    const npmTasks: NpmTask[] = await getNpmTasks();
    const outdatedDependencies: OutdatedDependency[] = await getOutdatedDependencies();
    const npmDependencies: Dependency[] = await getNpmDependencies(outdatedDependencies);
    const npmDevDependencies: Dependency[] = await getNpmDevDependencies(outdatedDependencies);
    const items: BaseItem[] = [];

    npmTasks && npmTasks.length > 0 && items.push(new BaseItem('Tasks', npmTasks));
    npmDependencies && npmDependencies.length > 0 && items.push(new BaseItem('Dependencies', npmDependencies));
    npmDevDependencies && npmDevDependencies.length > 0 && items.push(new BaseItem('Dev Dependencies', npmDevDependencies));

    return items;
};

const getNpmTasks: () => Promise<NpmTask[]> = async () => {
    const content: string = await getPackageJsonContent();
    if (!content) {
        return [];
    }
    const scripts: any = JSON.parse(content).scripts;
    if (!scripts) {
        return [];
    }
    return Object.entries(scripts).map(entry => new NpmTask(entry[0], entry[1] as string));
};

const getNpmDependencies: (outdatedDependencies: OutdatedDependency[]) => Promise<Dependency[]> = async (outdatedDependencies) => {
    const content: string = await getPackageJsonContent();
    if (!content) {
        return [];
    }
    const dependencies: any = JSON.parse(content).dependencies;
    if (!dependencies) {
        return [];
    }
    return Object.entries(dependencies).map((entry: any) => {
        const outdatedDependency: OutdatedDependency = outdatedDependencies.filter(dep => dep.name === entry[0])[0];
        const isOutdated: boolean = outdatedDependency && !entry[1].includes(outdatedDependency.wanted);
        let wantedVersion: string = '';
        if (isOutdated) {
            wantedVersion = outdatedDependency.wanted;
        }
        return new Dependency(entry[0], entry[1], isOutdated, wantedVersion, true);
    });
};

const getNpmDevDependencies: (outdatedDependencies: OutdatedDependency[]) => Promise<Dependency[]> = async (outdatedDependencies) => {
    const content: string = await getPackageJsonContent();
    if (!content) {
        return [];
    }
    const devDependencies: any = JSON.parse(content).devDependencies;
    if (!devDependencies) {
        return [];
    }
    return Object.entries(devDependencies).map((entry: any) => {
        const outdatedDependency: OutdatedDependency = outdatedDependencies.filter(dep => dep.name === entry[0])[0];
        const isOutdated: boolean = outdatedDependency && !entry[1].includes(outdatedDependency.wanted);
        let wantedVersion: string = '';
        if (isOutdated) {
            wantedVersion = outdatedDependency.wanted;
        }
        return new Dependency(entry[0], entry[1], isOutdated, wantedVersion, true, true);
    });
};

const getPackageJsonContent: () => Promise<string> = async () => {
    const uri: Uri | null = await getPackageJsonUri();
    if (!uri) {
        return '';
    }
    const document: TextDocument | null = await getPackageJsonDocument();

    if (!document) {
        return '';
    }
    return document.getText();
};

const getOutdatedDependencies: () => Promise<OutdatedDependency[]> = async () => {
    const relativePath: string = workspace.getConfiguration('npmExplorer').get<string>('relativePath', '');
    let workspaceRootPath: string | undefined = workspace.workspaceFolders && workspace.workspaceFolders[0].uri.fsPath;
    let commandPrefix: string = '--prefix';

    if (workspaceRootPath) {
        if (relativePath) {
            commandPrefix = ` ${commandPrefix} "${workspaceRootPath}/${relativePath}"`;
        } else {
            commandPrefix = ` ${commandPrefix} "${workspaceRootPath}"`;
        }

        return Object.entries(JSON.parse(await execShell(`npm ${commandPrefix} outdated --json`)))
        .filter((entry: any) => entry[1].wanted !== 'linked' && entry[1].wanted !== 'git' && entry[1].current !== entry[1].wanted)
        .map((entry: any) => ({name: entry[0], wanted: entry[1].wanted}));
    }

    return [];
};

const execShell: (cmd: string) => Promise<string> = (cmd: string) => {
    return new Promise<string>((resolve) => {
        cp.exec(cmd, (err, out) => {
            if (out) {
                return resolve(out);
            }
            return resolve('');
        });
    });
};
