import {Event, EventEmitter, RelativePattern, TextDocument, TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, workspace, WorkspaceFolder} from 'vscode';
import * as path from 'path';

type NpmExplorerTreeItem = BaseItem | NpmTask | Dependency;

export class NpmExplorerProvider implements TreeDataProvider<NpmExplorerTreeItem> {
    private _onDidChangeTreeData: EventEmitter<NpmExplorerTreeItem | undefined | void> = new EventEmitter<NpmExplorerTreeItem | undefined | void>();
	readonly onDidChangeTreeData: Event<NpmExplorerTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {
    }

    refresh(): void {
		this._onDidChangeTreeData.fire();
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

class BaseItem extends TreeItem {
    children: NpmTask[] | Dependency[];

    constructor(label: string, children: NpmTask[] | Dependency[]) {
        super(label, !children ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Expanded);
        this.children = children;
    }
}

export class Dependency extends TreeItem {
    name: string;
    version: string;
    isDev: boolean;

    constructor(name: string, version: string, isDev?: boolean) {
        super(`${name}: "${version}"`, TreeItemCollapsibleState.None);
        this.name = name;
        this.version = version;
        this.isDev = !!isDev;
    }

    iconPath: {light: string; dark: string} = {
		light: path.join(__filename, '..', '..', 'images', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'images', 'dark', 'dependency.svg')
	};

    contextValue: string = 'dependency';
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
    const npmDependencies: Dependency[] = await getNpmDependencies();
    const npmDevDependencies: Dependency[] = await getNpmDevDependencies();
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

const getNpmDependencies: () => Promise<Dependency[]> = async () => {
    const content: string = await getPackageJsonContent();
    if (!content) {
        return [];
    }
    const dependencies: any = JSON.parse(content).dependencies;
    if (!dependencies) {
        return [];
    }
    return Object.entries(dependencies).map(entry => new Dependency(entry[0], entry[1] as string));
};

const getNpmDevDependencies: () => Promise<Dependency[]> = async () => {
    const content: string = await getPackageJsonContent();
    if (!content) {
        return [];
    }
    const devDependencies: any = JSON.parse(content).devDependencies;
    if (!devDependencies) {
        return [];
    }
    return Object.entries(devDependencies).map(entry => new Dependency(entry[0], entry[1] as string, true));
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
