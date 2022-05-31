import {ColorTheme, ColorThemeKind, ExtensionContext, Uri, ViewColumn, Webview, WebviewPanel, window} from 'vscode';
import axios from 'axios';
import {marked} from 'marked';
import {BaseItem, Dependency, NpmExplorerProvider} from './activityBarView';
import {installDependency} from './taskCommands';

const SEARCH_SIZE: number = 100;

export class NpmRegistryWebView {

    private panel: WebviewPanel;
    private npmExplorerProvider: NpmExplorerProvider;
    private context: ExtensionContext;
    private dependency: Dependency | undefined;
    private searchText: string | undefined;

    constructor(npmExplorerProvider: NpmExplorerProvider, context: ExtensionContext, dependency?: Dependency, searchText?: string) {
        this.panel = window.createWebviewPanel(
            'npmRegistry',
            'Npm Registry',
            ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.dependency = dependency;
        this.npmExplorerProvider = npmExplorerProvider;
        this.context = context;
        this.searchText = searchText;

        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'installVersion':
                        this.installVersion(message.version);
                        return;
                    case 'installVersionForNewPackage':
                        this.installVersionForNewPackage(message.version, message.isDev);
                        return;
                    case 'searchResultSelected':
                        this.selectPackage(message.packageName);
                        return;
                    case 'search':
                        this.searchForPackages(message.searchtext);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );

        this.panel.webview.html = this.getLoadingSpinner(this.panel.webview, this.context);
        this.refreshContent();

        window.onDidChangeActiveColorTheme((colorTheme: ColorTheme) => {
            this.updateSelectClass(colorTheme);
        });
    }

    // Actions triggered from the view
    private searchForPackages(searchtext: string): void {
        if (!searchtext) {
            return;
        }
        this.panel.webview.html = this.getLoadingSpinner(this.panel.webview, this.context);
        this.dependency = undefined;
        this.searchText = searchtext;
        this.refreshContent();
    }

    private async selectPackage(packageName: string): Promise<void> {
        this.updateLoadingState(true);
        let installedDependency: Dependency | undefined = await this.getInstalledDependency(this.dependency, packageName);

        if (!installedDependency) {
            installedDependency = {name: packageName, isInstalled: false};
        }
        new NpmRegistryWebView(this.npmExplorerProvider, this.context, installedDependency, undefined);
        this.updateLoadingState(false);
    }

    private async installVersion(version: string): Promise<void> {
        if (!this.dependency || !this.dependency.name) {
            window.showInformationMessage('Something went wrong, no dependency to update');
            return;
        }
        if (!this.dependency.isInstalled) {
            return;
        }
        this.updateLoadingState(true);
        const versionToUpdateTo: string = version.replace(' (latest)', '');
        installDependency(this.dependency.name, this.npmExplorerProvider, versionToUpdateTo, this.dependency.isDev);
        this.npmExplorerProvider.onDidChangeTreeData(async () => {
            const installedDependency: Dependency | undefined = await this.getInstalledDependency(this.dependency);
            this.dependency = installedDependency ? {...installedDependency, isInstalled: true} : undefined;
            this.panel.webview.postMessage({command: 'updateVersion', newVersion: this.dependency?.version, isdev: this.dependency?.isDev});
            this.updateLoadingState(false);
        });
    }

    private async installVersionForNewPackage(version: string, isDev: boolean): Promise<void> {
        if (!this.dependency || !this.dependency.name) {
            window.showInformationMessage('Something went wrong, no dependency to update');
            return;
        }
        this.panel.webview.html = this.getLoadingSpinner(this.panel.webview, this.context);
        const versionToUpdateTo: string = version.replace(' (latest)', '');
        const requestedDependency: Dependency = this.dependency;
        installDependency(this.dependency.name, this.npmExplorerProvider, versionToUpdateTo, isDev);
        this.npmExplorerProvider.onDidChangeTreeData(async () => {
            const installedDependency: Dependency | undefined = await this.getInstalledDependency(this.dependency);
            this.dependency = installedDependency ? {...installedDependency, isInstalled: true} : requestedDependency;
            this.searchText = undefined;
            this.refreshContent();
        });
    }

    // Actions updating the view
    private updateSelectClass(colorTheme?: ColorTheme): void {
        let isDark: boolean = true;
        let activeColorTheme: ColorTheme = colorTheme ? colorTheme : window.activeColorTheme;
        if (activeColorTheme.kind === ColorThemeKind.Light || activeColorTheme.kind === ColorThemeKind.HighContrastLight) {
            isDark = false;
        }
        this.panel.webview.postMessage({command: 'updateVersionSelectOptionClass', isDark: isDark});
    }

    private updateLoadingState(show: boolean): void {
        if (show) {
            this.panel.webview.postMessage({command: 'showLoading'});
        } else {
            this.panel.webview.postMessage({command: 'hideLoading'});
        }
    }

    private async refreshContent(): Promise<void> {
        this.getContent(this.panel.webview, this.context, this.dependency, this.searchText)
            .then((value) => {
                this.panel.webview.html = value;
                this.updateSelectClass();
            })
            .catch(reason => this.panel.webview.html = reason);
    }

    // Html content methods
    private async getContent(webview: Webview, context: ExtensionContext, dependency?: Dependency, searchText?: string): Promise<string> {
        const nonce: string = this.getNonce();
        let res: any;
        let error: any;
        let initialSearchText: string = '';
        if (searchText) {
            initialSearchText = searchText;
            try {
                res = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${searchText}&size=${SEARCH_SIZE}`);
            } catch (err: any) {
                error = err.response;
            }
        } else if (dependency) {
            try {
                res = await axios.get(`https://registry.npmjs.org/${dependency.name}`);
            } catch (err: any) {
                error = err.response;
            }
        }

        if (error) {
            return this.getErrorPage(webview, context, error);
        }

        const styles: Uri = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'webView', 'styles', 'styles.css'));
        const loadingStyles: Uri = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'webView', 'styles', 'spinner.css'));
        const script: Uri = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'webView', 'scripts', 'main.js'));
        const codiconsUri: Uri = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

        return `
            <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                    <link href="${styles}" rel="stylesheet"/>
                    <link href="${codiconsUri}" rel="stylesheet"/>
                    <link href="${loadingStyles}" rel="stylesheet"/>
                    <title>Npm Registry</title>
                </head>
                <body>
                    <div id="loader-wrapper" class="invisible">
                        <div class="spinner-wrapper">
                            <div class="lds-roller"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
                        </div>
                    </div>
                    <div id="search-wrapper">
                        <input value="${initialSearchText}" id="search" type="text" id="package" placeholder="Search Package...">
                        <button id="search-btn">
                            <i id="search-btn-icon" class="codicon codicon-search"></i>
                        </button>
                    </div>
                    ${searchText ? this.getSearchContent(res) : ''}
                    ${dependency ? this.getPackageContent(dependency, res) : ''}
                    <script nonce="${nonce}" src="${script}"></script>
                </body>
            </html>
        `;
    }

    private getErrorPage(webview: Webview, context: ExtensionContext, error: any): string {
        const styles: Uri = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'webView', 'styles', 'error.css'));

        return `
            <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src 'none'; style-src ${webview.cspSource}; img-src 'none'; script-src 'none';">
                    <link href="${styles}" rel="stylesheet"/>
                <body>
                    <div id="error-container">
                        <h1>Server responded with ${error.status} ${error.statusText}!</h1>
                    </div>
                </body>
            </html>
        `;
    }

    private getSearchContent(res: any): string {
        if (!res && !res.data) {
            return '';
        }

        let searchMessage: string = '';
        if (res.data.total > SEARCH_SIZE) {
            searchMessage = `First ${SEARCH_SIZE} resuls are shown`;
        }

        const content: string = Object.entries(res.data.objects).map((entry: any) => {
            if (entry[1].package) {
                return `
                    <li class="result-list-item">
                        <button class="result-list-item-btn">
                            <div class="result-list-item-header-wrapper">
                                <h3 class="result-list-item-header">${entry[1].package.name}</h3>
                                <p class="result-list-item-version">${entry[1].package.version}</p>
                            </div>
                            <p>${entry[1].package.description}</p>
                            ${entry[1].package.author ? `<p>${entry[1].package.author.name}</p>` : '<p id="no-author">No author provided</p>'}
                        </button>
                    </li>
                `;
            }
        }).join('');

        return `
            ${searchMessage ? `<i id="search-message-limit">${searchMessage}</i>` : ''}
            <ul id="result-list">
                ${content}
            </ul>
        `;
    }

    private getPackageContent(dependency: Dependency, res: any): string {
        if (!res && !res.data) {
            return '';
        }

        const latestVersionTag: string = res.data['dist-tags'].latest;
        const url: string = res.data.repository?.url.replace('git+', '');
        const npmUrl: string = `https://www.npmjs.com/package/${dependency.name}`;
        const versions: any[] = Object.entries(res.data.versions).reverse().map((entry: any) => ({versionTag: entry[0], details: entry[1]}));
        const selectOptions: string = versions
                .map((version: any) => {
                    return `${version.versionTag === latestVersionTag
                            ? `<option class="version-select-option" selected>` : `<option class="version-select-option">`}
                                ${version.versionTag === latestVersionTag ? `${version.versionTag} (latest)` : version.versionTag}</option>`;
                })
                .join('');
        let readmeParsed: string = marked.parse(res.data.readme);

        if (!readmeParsed) {
            //Sometimes the latest readme is not there (npm registry issue), try and get it from the previous version
            if (versions[1].details?.readme) {
                readmeParsed = marked.parse(versions[1].details.readme);
            }
        }

        let installedVersion: string | undefined;
        let isDev: boolean | undefined;
        if (dependency.isInstalled) {
            installedVersion = dependency.version;
            isDev = dependency.isDev;
        }

        let author: string = '';
        if (res.data.author) {
            if (typeof(res.data.author) === 'string') {
                author = res.data.author;
            } else {
                if (res.data.author.name) {
                    author = res.data.author.name;
                }
            }
        }

        return `
            <div id="content">
                <div id="content-info">
                    <div id="content-info-header">
                        <i id="content-info-icon" class="codicon codicon-package"></i>
                        <div id="content-info-package-det">
                            <h2 id="content-info-name">${dependency.name}</h2>
                            ${author ? `<h3 id="content-info-author">${author}</h3>` : ''}
                        </div>
                    </div>
                    ${res.data.description ? `<h4 id="content-info-desc">${res.data.description}</h4>` : ''}
                    ${dependency.isInstalled
                        ? `<div id="content-info-version">
                                <i id="content-info-version-icon" class="details-section-icon codicon codicon-verified"></i>
                                <i id="content-info-installed-version">Version (${installedVersion}) installed${isDev ? ' as dev dependency' : ''}</i>
                            </div>`
                        : ''}
                    <div id="version-wrapper">
                        <select id="version">
                            ${selectOptions}
                        </select>
                        <button id="install-btn" class="${dependency.isInstalled ? 'install-btn-hover' : 'install-btn-no-hover'}">Install</button>
                        ${!dependency.isInstalled ? `<div id="install-btn-dropdown">
                            <button id="install-btn-arrow">
                                <i id="install-btn-arrow-icon" class="codicon codicon-fold-down"></i>
                            </button>
                            <div id="install-btn-dropdown-content">
                                <a id="install-btn-dep" class="install-btn-dropdown-content-link" href="">As Dependency</a>
                                <a id="install-btn-dev-dep" class="install-btn-dropdown-content-link" href="">As Dev Dependency</a>
                            </div>
                        </div>` : ''}
                    </div>
                    <div id="details">
                        <div class="details-section">
                            <div class="details-section-desc">
                                <i class="details-section-icon codicon codicon-globe"></i>
                                <h3>Npm Page</h3>
                            </div>
                            <a class="details-section-link" href="${npmUrl}">${npmUrl}</a>
                        </div>
                        ${url ? `<div class="details-section">
                            <div class="details-section-desc">
                                <i class="details-section-icon codicon codicon-source-control"></i>
                                <h3>Repository</h3>
                            </div>
                            <a class="details-section-link" href="${url}">${url}</a>
                        </div>` : ''}
                        ${res.data.homepage ? `<div class="details-section">
                            <div class="details-section-desc">
                                <i class="details-section-icon codicon codicon-link"></i>
                                <h3>Homepage</h3>
                            </div>
                            <a class="details-section-link" href="${res.data.homepage}">${res.data.homepage}</a>
                        </div>` : ''}
                    </div>
                    ${res.data.license ? `<div id="content-license">
                        <h3>License</h3>
                        ${res.data.license}
                    </div>` : ''}
                </div>
                ${readmeParsed
                    ? `<div id="content-md">${readmeParsed}</div>`
                    : `<div id="content-message"><i id="no-md-message">No Readme found for this package</i></div>`}
            </div>
        `;
    }

    private getLoadingSpinner(webview: Webview, context: ExtensionContext): string {
        const nonce: string = this.getNonce();
        const styles: Uri = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'webView', 'styles', 'spinner.css'));

        return `
            <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                    <link href="${styles}" rel="stylesheet"/>
                    <title>Npm Registry</title>
                </head>
                <body>
                    <div class="spinner-wrapper">
                        <div class="lds-roller"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
                    </div>
                </body>
            </html>
        `;
    }

    // Util methods
    private async getInstalledDependency(dependency?: Dependency, dependencyName?: string): Promise<Dependency | undefined> {
        let baseItems: BaseItem[] = await this.npmExplorerProvider.getChildren() as BaseItem[];
        const allDependencies: Dependency[] = [];
        const devDependencies: BaseItem = baseItems.filter(baseItem => baseItem instanceof BaseItem && baseItem.label === 'Dev Dependencies')[0];
        const dependencies: BaseItem = baseItems.filter(baseItem => baseItem instanceof BaseItem && baseItem.label === 'Dependencies')[0];
        let installedDependencyName: string | undefined = '';

        if (!dependency) {
            if (devDependencies) {
                allDependencies.push(...devDependencies.children as Dependency[]);
            }

            if (dependencies) {
                allDependencies.push(...dependencies.children as Dependency[]);
            }
        } else if (dependency.isDev) {
            if (devDependencies) {
                allDependencies.push(...devDependencies.children as Dependency[]);
            }
        } else {
            if (dependencies) {
                allDependencies.push(...dependencies.children as Dependency[]);
            }
        }

        if (dependency) {
            installedDependencyName = dependency.name;
        } else if (dependencyName) {
            installedDependencyName = dependencyName;
        }

        const newDependency: Dependency = allDependencies.filter(dep => dep.label === installedDependencyName)[0];

        if (!newDependency) {
            return undefined;
        }

        return newDependency;
    }

    private getNonce(): string {
        let text: string = '';
        const possible: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i: number = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}