import {ColorThemeKind, Disposable, ExtensionContext, Uri, ViewColumn, Webview, WebviewPanel, window} from 'vscode';
import axios from 'axios';
import {marked} from 'marked';
import {Dependency} from './activityBarView';

const SEARCH_SIZE: number = 100;

interface NpmDependency extends Partial<Dependency> {
    isInstalled: boolean;
}

export class NpmRegistryWebView {

    private panel: WebviewPanel;
    private disposables: Disposable[] = [];
    isOpen: boolean;

    constructor(context: ExtensionContext, dependency?: Dependency) {
        this.panel = window.createWebviewPanel(
            'npmRegistry',
            'Npm Registry',
            ViewColumn.Active,
            {enableScripts: true}
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.isOpen = true;

        // const npmDependency: NpmDependency | undefined = dependency ? {...dependency, isInstalled: true} : undefined;
        const npmDependency: NpmDependency = {
            name: 'mocha',
            version: '^9.2.2',
            isDev: true,
            isInstalled: true
        };

        // this.panel.webview.html = this.getLoadingSpinner(this.panel.webview, context);

        // setTimeout(() => {
        //     this.getContent(this.panel.webview, context, npmDependency)
        //     .then((value) => this.panel.webview.html = value)
        //     .catch(reason => this.panel.webview.html = reason);
        // }, 5000);
        // this.getContent(this.panel.webview, context, npmDependency)
        //     .then((value) => this.panel.webview.html = value)
        //     .catch(reason => this.panel.webview.html = reason);

        this.updateContent(this.panel.webview, context, npmDependency);

        //TODO update color of select correctly
        // window.onDidChangeActiveColorTheme(() => {
        //     if (this.isOpen) {
        //         this.updateContent(this.panel.webview, context, npmDependency);
        //     }
        // });
    }

    private async updateContent(webview: Webview, context: ExtensionContext, npmDependency?: NpmDependency, searchText?: string): Promise<void> {
        webview.html = this.getLoadingSpinner(this.panel.webview, context);
        this.getContent(webview, context, npmDependency)
            .then((value) => webview.html = value)
            .catch(reason => webview.html = reason);
    }

    showPanel() {
        if (this.panel) {
            this.panel.reveal(ViewColumn.Active);
        }
    }

    // private updateInnerClass(webview: Webview, context: ExtensionContext, colorTheme: ColorTheme) {
    //     const currentHtml: string = webview.html;
    //     webview.html = this.getLoadingSpinner(this.panel.webview, context);
    //     let selectOptionStyle: string = 'background-color: rgba(0, 0, 0, 0.8);';
    //     if (colorTheme.kind === ColorThemeKind.Light || colorTheme.kind === ColorThemeKind.HighContrastLight) {
    //         selectOptionStyle = 'background-color: rgba(100, 100, 100, 0.3);';
    //     }
    //     webview.html = currentHtml.replace()
    // }


    private async getContent(webview: Webview, context: ExtensionContext, npmDependency?: NpmDependency, searchText?: string): Promise<string> {
        const nonce = this.getNonce();
        let res: any;
        if (searchText) {
            res = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${searchText}&size=${SEARCH_SIZE}`);
        } else if (npmDependency) {
            res = await axios.get(`https://registry.npmjs.org/${npmDependency.name}`);
        }

        const styles = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'webView', 'styles', 'styles.css'));
        const script = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'webView', 'scripts', 'main.js'));
        const codiconsUri = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'node_modules', 'vscode-codicons', 'dist', 'codicon.css'));

        return `
            <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} \'unsafe-inline\'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
                    <link href="${styles}" rel="stylesheet"/>
                    <link href="${codiconsUri}" rel="stylesheet"/>
                    <title>Npm Registry</title>
                </head>
                <body>
                    <div id="search-wrapper">
                        <input id="search" type="text" id="package" placeholder="Search Package...">
                        <i id="search-btn-icon" class="codicon codicon-search"></i>
                    </div>
                    ${searchText ? this.getSearchContent(res) : ''}
                    ${npmDependency ? this.getPackageContent(npmDependency, res) : ''}
                    <script nonce="${nonce}" src="${script}"></script>
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
                            ${entry[1].package.author ? `<p>${entry[1].package.author.name}</p>` : ''}
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

    private getPackageContent(npmDependency: NpmDependency, res: any): string {
        if (!res && !res.data) {
            return '';
        }

        const latestVersionTag: string = res.data["dist-tags"].latest;
        const url: string = res.data.repository?.url.replace('git+', '');
        const npmUrl: string = `https://www.npmjs.com/package/${npmDependency.name}`;
        let selectOptionStyle: string = 'background-color: rgba(0, 0, 0, 0.8);';
        if (window.activeColorTheme.kind === ColorThemeKind.Light || window.activeColorTheme.kind === ColorThemeKind.HighContrastLight) {
            selectOptionStyle = 'background-color: rgba(100, 100, 100, 0.3);';
        }
        const versions: any[] = Object.entries(res.data.versions).reverse().map((entry: any) => ({versionTag: entry[0], details: entry[1]}));
        const selectOptions: string = versions
                .map((version: any) => {
                    return `${version.versionTag === latestVersionTag
                            ? `<option style="${selectOptionStyle}" selected>` : `<option style="${selectOptionStyle}">`}
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
        if (npmDependency.isInstalled) {
            installedVersion = npmDependency.version;
            isDev = npmDependency.isDev;
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
                            <h2 id="content-info-name">${npmDependency.name}</h2>
                            ${author ? `<h3 id="content-info-author">${author}</h3>` : ''}
                        </div>
                    </div>
                    ${res.data.description ? `<h4 id="content-info-desc">${res.data.description}</h4>` : ''}
                    ${npmDependency.isInstalled
                        ? `<div id="content-info-version">
                                <i id="content-info-version-icon" class="details-section-icon codicon codicon-verified"></i>
                                <i>Version (${installedVersion}) installed${isDev ? ' as dev dependency' : ''}</i>
                            </div>`
                        : ''}
                    <div id="version-wrapper">
                        <select id="version">
                            ${selectOptions}
                        </select>
                        ${npmDependency.isInstalled ? `<button id="update-btn" class="version-btn">Update</button>` : `<button id="install-btn" class="version-btn">Install</button>`}
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
        const nonce = this.getNonce();
        const styles = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'webView', 'styles', 'spinner.css'));

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

    private getViewScript(): string {


        return '';
    }

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    private dispose() {
		this.panel.dispose();
        this.isOpen = false;

		while (this.disposables.length) {
			const disposable: Disposable | undefined = this.disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}
}
