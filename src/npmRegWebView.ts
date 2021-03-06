import {ColorTheme, ColorThemeKind, ExtensionContext, Uri, ViewColumn, Webview, WebviewPanel, window} from 'vscode';
import axios from 'axios';
import {marked} from 'marked';
import {BaseItem, Dependency, NpmExplorerProvider} from './activityBarView';
import {installDependency} from './taskCommands';
import * as path from 'path';

type PackageDownloads = {downloads: number, day: string};
type DateDiff = {days: number, months: number, years: number};

enum SearchType {
    Optimal = 'Optimal',
    Popularity = 'Popularity',
    Quality = 'Quality',
    Maintenance = 'Maintenance'
}

export class NpmRegistryWebView {

    private panel: WebviewPanel;
    private npmExplorerProvider: NpmExplorerProvider;
    private context: ExtensionContext;
    private dependency: Dependency | undefined;
    private searchText: string | undefined;
    private isDisposed: boolean;
    private searchResultsFrom: number;
    private activePage: number;
    private totalPages: number;
    private searchSize: number;
    private weeklyDownloads: {start: string, end: string, downloads: number}[];
    private searchType: string;

    constructor(npmExplorerProvider: NpmExplorerProvider, context: ExtensionContext, dependency?: Dependency, searchText?: string) {
        this.panel = window.createWebviewPanel(
            'npmRegistry',
            'Npm Registry',
            ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableFindWidget: true
            }
        );

        this.dependency = dependency;
        this.npmExplorerProvider = npmExplorerProvider;
        this.context = context;
        this.searchText = searchText;
        this.isDisposed = false;
        this.weeklyDownloads = [];
        this.searchResultsFrom = 0;
        this.activePage = 1;
        this.totalPages = 0;
        this.searchSize = 20;
        this.searchType = SearchType.Optimal;

        this.panel.onDidDispose(() => this.isDisposed = true);

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
                    case 'keywordClicked':
                        this.openSearchFromKeyword(message.keyword);
                        return;
                    case 'previousPageClicked':
                        this.previousPageClicked();
                        return;
                    case 'nextPageClicked':
                        this.nextPageClicked();
                        return;
                    case 'pageClicked':
                        this.pageClicked(parseInt(message.page));
                        return;
                    case 'sortPackagesOptimal':
                        this.sortResults(SearchType.Optimal);
                        return;
                    case 'sortPackagesPopularity':
                        this.sortResults(SearchType.Popularity);
                        return;
                    case 'sortPackagesQuality':
                        this.sortResults(SearchType.Quality);
                        return;
                    case 'sortPackagesMaintenance':
                        this.sortResults(SearchType.Maintenance);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );

        this.panel.iconPath = Uri.file(
            path.join(__filename, '..', '..', 'images', 'view-icon.svg')
        );
        this.panel.webview.html = this.getLoadingSpinner(this.panel.webview, this.context);
        this.refreshContent();

        window.onDidChangeActiveColorTheme((colorTheme: ColorTheme) => {
            this.updateSelectClass(colorTheme);
        });
    }

    // Actions triggered from the view
    private async sortResults(searchType: SearchType): Promise<void> {
        if (searchType === this.searchType) {
            return;
        }
        this.panel.webview.html = this.getLoadingSpinner(this.panel.webview, this.context);
        this.searchType = searchType;
        await this.refreshContent();
    }

    private async nextPageClicked(): Promise<void> {
        if (this.activePage === this.totalPages) {
            return;
        }
        this.pageClicked(++this.activePage);
    }

    private async previousPageClicked(): Promise<void> {
        if (this.activePage === 1) {
            return;
        }
        this.pageClicked(--this.activePage);
    }

    private async pageClicked(page: number): Promise<void> {
        this.panel.webview.html = this.getLoadingSpinner(this.panel.webview, this.context);
        this.activePage = page;
        this.searchResultsFrom = (this.activePage - 1) * this.searchSize;
        await this.refreshContent();
    }

    private openSearchFromKeyword(keyword: string): void {
        new NpmRegistryWebView(this.npmExplorerProvider, this.context, undefined, `keywords:${keyword}`);
    }

    private async searchForPackages(searchtext: string): Promise<void> {
        if (!searchtext || searchtext === this.searchText) {
            return;
        }
        this.panel.webview.html = this.getLoadingSpinner(this.panel.webview, this.context);
        this.dependency = undefined;
        this.activePage = 1;
        this.searchResultsFrom = 0;
        this.searchSize = 20;
        this.searchText = searchtext;
        this.searchType = SearchType.Optimal;
        await this.refreshContent();
    }

    private async selectPackage(packageName: string): Promise<void> {
        await this.updateLoadingState(true);
        let installedDependency: Dependency | undefined = await this.getInstalledDependency(this.dependency, packageName);

        if (!installedDependency) {
            installedDependency = {name: packageName, isInstalled: false};
        }
        new NpmRegistryWebView(this.npmExplorerProvider, this.context, installedDependency, undefined);
        await this.updateLoadingState(false);
    }

    private async installVersion(version: string): Promise<void> {
        if (!this.dependency || !this.dependency.name) {
            window.showInformationMessage('Something went wrong, no dependency to update');
            return;
        }
        if (!this.dependency.isInstalled) {
            return;
        }
        this.panel.webview.html = this.getLoadingSpinner(this.panel.webview, this.context);
        const versionToUpdateTo: string = version.replace(' (latest)', '');
        await installDependency(this.dependency.name, this.npmExplorerProvider, versionToUpdateTo, this.dependency.isDev);
        this.npmExplorerProvider.onDidChangeTreeData(async () => {
            if (!this.isDisposed) {
                setTimeout(async () => {
                    const installedDependency: Dependency | undefined = await this.getInstalledDependency(this.dependency);
                    this.dependency = installedDependency ? {...installedDependency, isInstalled: true} : undefined;
                    this.searchText = undefined;
                    this.refreshContent();
                }, 1000);
            }
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
        await installDependency(this.dependency.name, this.npmExplorerProvider, versionToUpdateTo, isDev);
        this.npmExplorerProvider.onDidChangeTreeData(async () => {
            if (!this.isDisposed) {
                setTimeout(async () => {
                    const installedDependency: Dependency | undefined = await this.getInstalledDependency(this.dependency);
                    this.dependency = installedDependency ? {...installedDependency, isInstalled: true} : requestedDependency;
                    this.searchText = undefined;
                    this.refreshContent();
                }, 1000);
            }
        });
    }

    // Actions updating the view
    private async updateSelectClass(colorTheme?: ColorTheme): Promise<void> {
        let isDark: boolean = true;
        let activeColorTheme: ColorTheme = colorTheme ? colorTheme : window.activeColorTheme;
        if (activeColorTheme.kind === ColorThemeKind.Light || activeColorTheme.kind === ColorThemeKind.HighContrastLight) {
            isDark = false;
        }
        await this.panel.webview.postMessage({command: 'updateVersionSelectOptionClass', isDark: isDark});
    }

    private async updateGraph(): Promise<void> {
        if (!this.weeklyDownloads || this.weeklyDownloads.length === 0) {
            return;
        }
        const xValues: string[] = [];
        const yValues: number[] = [];
        this.weeklyDownloads.map(item => {
            xValues.push(`${item.start} to ${item.end}`);
            yValues.push(item.downloads);
        });
        await this.panel.webview.postMessage({command: 'buildGraph', xValues: xValues, yValues: yValues, initialDownloadValue: yValues[yValues.length - 1].toLocaleString('en-US')});
    }

    private async updateLoadingState(show: boolean): Promise<void> {
        if (show) {
            await this.panel.webview.postMessage({command: 'showLoading'});
        } else {
            await this.panel.webview.postMessage({command: 'hideLoading'});
        }
    }

    private async refreshContent(): Promise<void> {
        this.getContent(this.panel.webview, this.context, this.dependency, this.searchText)
            .then(async (value) => {
                this.panel.webview.html = value;
                await this.updateSelectClass();
                if (this.dependency) {
                    await this.updateGraph();
                }
            })
            .catch(reason => this.panel.webview.html = reason);
    }

    // Html content methods
    private async getContent(webview: Webview, context: ExtensionContext, dependency?: Dependency, searchText?: string): Promise<string> {
        const nonce: string = this.getNonce();
        let res: any;
        let resDownloads: any;
        let error: any;
        let initialSearchText: string = '';
        if (searchText) {
            initialSearchText = searchText;
            try {
                res = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${searchText}&size=${this.searchSize}&from=${this.searchResultsFrom}${this.getSortingForSearch()}`);
            } catch (err: any) {
                error = err.response;
            }
        } else if (dependency) {
            try {
                res = await axios.get(`https://registry.npmjs.org/${dependency.name}`);
                resDownloads = await axios.get(`https://api.npmjs.org/downloads/range/last-year/${dependency.name}`);
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
        const chartScript: Uri = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'webView', 'scripts', 'chart.min.js'));
        const codiconsUri: Uri = webview.asWebviewUri(Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

        return `
            <html lang="en">
                <head>
                    <meta charset="utf-8">
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} \'unsafe-inline\'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
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
                        <input value="${initialSearchText}" id="search" type="text" id="package" placeholder="Search Packages...">
                        <button id="search-btn">
                            <i id="search-btn-icon" class="codicon codicon-search"></i>
                        </button>
                    </div>
                    ${searchText ? this.getSearchContent(res) : ''}
                    ${dependency ? await this.getPackageContent(dependency, res, resDownloads) : ''}
                    <script nonce="${nonce}" src="${script}"></script>
                    <script nonce="${nonce}" src="${chartScript}"></script>
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
                        <h1>Server responded with ${error.status} ${this.cleanHtmlCode(error.statusText)}!</h1>
                    </div>
                </body>
            </html>
        `;
    }

    private getSearchContent(res: any): string {
        if (!res && !res.data) {
            return '';
        }

        const totalPages: number = Math.ceil(res.data.total / this.searchSize);
        this.totalPages = totalPages;

        const content: string = Object.entries(res.data.objects).map((entry: any) => {
            if (entry[1].package) {
                return `
                    <li class="result-list-item">
                        <button class="result-list-item-btn">
                            <div class="result-list-item-header-wrapper">
                                <h3 class="result-list-item-header">${this.cleanHtmlCode(entry[1].package.name)}</h3>
                                <div class="result-list-item-version-wrapper">
                                    <p class="result-list-item-version">${this.cleanHtmlCode(entry[1].package.version)}</p>
                                    ${entry[1].package.name === this.searchText ? '<p class="result-list-item-match-label">exact match</p>' : ''}
                                </div>
                            </div>
                            <p class="result-list-item-details-description">${this.cleanHtmlCode(entry[1].package.description)}</p>
                            <div class="result-list-item-details-wrapper">
                                ${entry[1].package.publisher
                                    ? `<p>${this.cleanHtmlCode(entry[1].package.publisher.username)}</p>`
                                    : '<p id="no-publisher">No publisher provided</p>'}
                                <p class="result-list-item-details-date">${this.calcLastPublishDate(entry[1].package.date)}</p>
                            </div>
                            <div id="package-stats-wrapper">
                                <li class="package-stats-item">
                                    <p class="package-stats-title">p</p>
                                    <div class="package-stats-item-bar" style="background-color: #29abe2; transform: scaleX(${entry[1].score.detail.popularity});"></div>
                                </li>
                                <li class="package-stats-item">
                                    <p class="package-stats-title">q</p>
                                    <div class="package-stats-item-bar" style="background-color: #8956ff; transform: scaleX(${entry[1].score.detail.quality});"></div>
                                </li>
                                <li class="package-stats-item">
                                    <p class="package-stats-title">m</p>
                                    <div class="package-stats-item-bar" style="background-color: #cb3837; transform: scaleX(${entry[1].score.detail.maintenance});"></div>
                                </li>
                            </div>
                        </button>
                    </li>
                `;
            }
        }).join('');

        const sortPackagesEl: string = `
            <div id="sort-packages-wrapper">
                <h2 id="sort-packages-header">Sort Packages</h2>
                    <ul id="sort-packages-list">
                        <li id="sort-packages-optimal-item" class="sort-list-item"><div class="sort-list-item-text">Optimal</div></li>
                        <li id="sort-packages-popularity-item" class="sort-list-item"><div class="sort-list-item-text">Popularity</div></li>
                        <li id="sort-packages-quality-item" class="sort-list-item"><div class="sort-list-item-text">Quality</div></li>
                        <li id="sort-packages-maintenance-item" class="sort-list-item"><div class="sort-list-item-text">Maintenance</div></li>
                    </ul>
                </div>
            `;

        return `
            <div id="search-content">
                ${content
                    ? `
                        <div id="total-results">${res.data.total} packages found</div>
                        ${this.buildPagination(totalPages)}
                        <div>
                            ${sortPackagesEl}
                            <ul id="result-list">${content}</ul>
                        </div>
                        ${this.buildPagination(totalPages)}
                    `
                    : `<div class="centered-message">
                            <h1>No results found!</h1>
                        </div>`
                }
            </div>
        `;
    }

    private buildPagination(last: number): string {
        const pages: string[] = this.pages(last, 1);
        const pagesEl: string = pages.map(page => {
            if (page === '...') {
                return '<a class="inactive-link">...</a>';
            } else {
                return parseInt(page) === this.activePage ? `<a class="active page-link">${page}</a>` : `<a class="page-link">${page}</a>`;
            }
        }).join('');
        return `
            <div class="pagination">
                ${this.activePage === 1 ? `<a class="disabled-link page-previous">&laquo;</a>` : `<a class="page-previous">&laquo;</a>`}
                ${pagesEl}
                ${this.activePage === last ? `<a class="disabled-link page-next">&raquo;</a>` : `<a class="page-next">&raquo;</a>`}
            </div>
        `;
    }

    private pages(last: number, onSides: number = 3): string[] {
        const pages: string[] = [];
        for (let i: number = 1; i <= last; i++) {
            let offset: number = (i === 1 || last) ? onSides + 1 : onSides;
            if (i === 1 || (this.activePage - offset <= i && this.activePage + offset >= i) || 
                i === this.activePage || i === last) {
                pages.push(i.toString());
            } else if (i === this.activePage - (offset + 1) || i === this.activePage + (offset + 1)) {
                pages.push('...');
            }
        }
        return pages;
    }

    private async getPackageContent(dependency: Dependency, res: any, resDownloads: any): Promise<string> {
        if (!res && !res.data) {
            return '';
        }

        const latestVersionTag: string = res.data['dist-tags'].latest;
        const npmUrl: string = `https://www.npmjs.com/package/${dependency.name}`;
        const versions: any[] = Object.entries(res.data.versions).reverse().map((entry: any) => ({versionTag: entry[0], details: entry[1]}));
        const selectOptions: string = versions
                .map((version: any) => {
                    return `${version.versionTag === latestVersionTag
                            ? `<option class="version-select-option" selected>` : `<option class="version-select-option">`}
                                ${version.versionTag === latestVersionTag ? `${version.versionTag} (latest)` : version.versionTag}</option>\n`;
                })
                .join('');
        let repoUrl: string = '';
        if (res.data.repository?.url) {
            // Sometimes repo urls start with git+ or git://
            repoUrl = `https${res.data.repository.url.match(/:\/\/.*/, 'gm')}`;
        }

        let keywordsEl: string = '';
        if (res.data.keywords) {
            keywordsEl = res.data.keywords.map((keyword: string) => `<a class="keyword-link">${this.cleanHtmlCode(keyword)}</a>\n`).join('');
        }

        const lastYearDownloads: PackageDownloads[] = resDownloads.data.downloads;
        const weeklyDownloadsLocal: {start: string, end: string, downloads: number}[] = [];
        const chunkSize: number = 7;
        for (let i: number = lastYearDownloads.length; i > 0; i -= chunkSize) {
            const chunk: PackageDownloads[] = lastYearDownloads.slice(i - chunkSize, i);
            if (chunk.length < chunkSize) {
                break;
            }
            const start: string = chunk[0].day;
            const end: string = chunk[chunk.length - 1].day;
            const downloads: number = chunk.reduce((partialSum, a) => partialSum + a.downloads, 0);
            weeklyDownloadsLocal.unshift({start: this.formatDate(start), end: this.formatDate(end), downloads: downloads});
        }
        this.weeklyDownloads = weeklyDownloadsLocal;
        const lastWeekDownloads: string = this.weeklyDownloads[this.weeklyDownloads.length - 1].downloads.toLocaleString('en-US');

        let readmeParsed: string = marked.parse(res.data.readme);

        if (!readmeParsed) {
            // Sometimes the latest readme is not there (npm registry issue again), try and get it from one of the previous versions
            if (versions[0].details?.readme) {
                readmeParsed = marked.parse(versions[0].details.readme);
            } else if (versions[1].details?.readme) {
                readmeParsed = marked.parse(versions[1].details.readme);
            }
        }

        if (!readmeParsed && repoUrl) {
            // If readme still not found in npm registry try to get it from the github repo (only works for github)
            const regexResult: RegExpExecArray | null = (/git@|https:\/\/[\w\.@]+(?:\/|:)([\w,\-,\_]+)\/([\w,\-,\_]+).git/gm).exec(repoUrl);
            if (regexResult) {
                const res: any = await axios.get(`https://api.github.com/repos/${regexResult[1]}/${regexResult[2]}/readme`);
                if (res && res.data) {
                    const readmeContent: string = Buffer.from(res.data.content, res.data.encoding).toString();
                    readmeParsed = marked.parse(readmeContent);
                }
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

        let lastPublish: string = '';
        if (res.data.time) {
            lastPublish = this.calcLastPublishDate(res.data.time[versions[0].versionTag]);
        }

        return `
            <div id="content">
                <div id="content-info">
                    <div id="content-info-header">
                        <i id="content-info-icon" class="codicon codicon-package"></i>
                        <div id="content-info-package-det">
                            <h2 id="content-info-name">${this.cleanHtmlCode(dependency.name)}</h2>
                            ${author ? `<h3 id="content-info-author">${this.cleanHtmlCode(author)}</h3>` : ''}
                        </div>
                    </div>
                    ${res.data.description ? `<h4 id="content-info-desc">${this.cleanHtmlCode(res.data.description)}</h4>` : ''}
                    ${dependency.isInstalled
                        ? `<div>
                            <div class="content-info-version">
                                <i class="details-section-icon codicon codicon-verified content-info-version-icon"></i>
                                <i id="content-info-installed-version">Version (${this.cleanHtmlCode(installedVersion)}) installed${isDev ? ' as dev dependency' : ''}</i>
                            </div>
                            ${dependency.isOutdated && dependency.wantedVersion ? `<div class="content-info-version">
                                <i class="details-section-icon codicon codicon-info content-info-version-icon"></i>
                                <i id="content-info-wanted-version">Wanted version (as derived from package.json): <a title="Select Version" href="">${dependency.wantedVersion === latestVersionTag ? `${dependency.wantedVersion} (latest)` : dependency.wantedVersion}</a></i>
                            </div>` : ''}
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
                            <a class="details-section-link" href="${this.cleanHtmlCode(npmUrl)}">${this.cleanHtmlCode(npmUrl)}</a>
                        </div>
                        ${repoUrl ? `<div class="details-section">
                            <div class="details-section-desc">
                                <i class="details-section-icon codicon codicon-source-control"></i>
                                <h3>Repository</h3>
                            </div>
                            <a class="details-section-link" href="${this.cleanHtmlCode(repoUrl)}">${this.cleanHtmlCode(repoUrl)}</a>
                        </div>` : ''}
                        ${res.data.homepage ? `<div class="details-section">
                            <div class="details-section-desc">
                                <i class="details-section-icon codicon codicon-link"></i>
                                <h3>Homepage</h3>
                            </div>
                            <a class="details-section-link" href="${this.cleanHtmlCode(res.data.homepage)}">${this.cleanHtmlCode(res.data.homepage)}</a>
                        </div>` : ''}
                    </div>
                    <div id="content-package-details">
                        <div id="content-license">
                            <h3>License</h3>
                            ${this.cleanHtmlCode(res.data.license) || 'No license found'}
                        </div>
                        <div id="content-updated">
                            <h3>Last publish</h3>
                            ${lastPublish || 'No data found'}
                        </div>
                    </div>
                    <div>
                        <h3 id="weekly-downloads-header">Downloads</h3>
                        <div id="weekly-downloads-section-wrapper">
                            <i class="weekly-downloads-icon codicon codicon-cloud-download"></i>
                            <h3 id="weekly-downloads-week">Weekly Downloads:</h3>
                            <p id="weekly-downloads">${lastWeekDownloads}</p>
                        </div>
                        <canvas id="weekly-downloads-plot"></canvas>
                    </div>
                    ${keywordsEl ? `<div id="keywords-wrapper">
                        <h3 id="keywords-header">Keywords</h3>
                        ${keywordsEl}
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

    private cleanHtmlCode(html: string | undefined): string | undefined {
        if (!html) {
            return undefined;
        }
        return html.replaceAll('\<', '&lt').replaceAll('\>', '&gt');
    }

    private formatDate(dateString: string): string {
        const date: Date = new Date(dateString);
        const year: number = date.getFullYear();
        let month: number | string = date.getMonth() + 1;
        let day: number | string = date.getDate();

        if (day < 10) {
            day = '0' + day;
        }

        if (month < 10) {
            month = '0' + month;
        }

        return `${day}-${month}-${year}`;
    }

    private calcLastPublishDate(lastPublish: string): string {
        if (typeof(lastPublish) !== 'string') {
            return '';
        }
        const dateDiff: DateDiff = this.calcDateDiff(lastPublish);

        if (dateDiff.months < 1 && dateDiff.years < 1) {
            if (dateDiff.days === 1) {
                return 'a day ago';
            }
            return `${dateDiff.days} days ago`;
        }

        if (dateDiff.years < 1) {
            let month: number = dateDiff.days < 16 ? dateDiff.months : dateDiff.months + 1;
            if (month === 1) {
                return 'a month ago';
            }
            return `${month} months ago`;
        }

        let year: number = dateDiff.months < 7 ? dateDiff.years : dateDiff.years + 1;
        if (year === 1) {
            return 'a year ago';
        }
        return `${year} years ago`;
    }

    private calcDateDiff(lastPublish: string): DateDiff {
        let dateNow: Date = new Date(Date.now());
        let lastPublishDate: Date = new Date(lastPublish);
        let dateDiff: DateDiff = {days: 0, months: 0, years: 0};

        if (dateNow === lastPublishDate) {
            return dateDiff;
        }

        if (dateNow > lastPublishDate) {
            const dateTemp: Date = lastPublishDate;
            lastPublishDate = dateNow;
            dateNow = dateTemp;
        }

        const year1: number = dateNow.getFullYear();
        const year2: number = lastPublishDate.getFullYear();
        const month1: number = dateNow.getMonth();
        const month2: number = lastPublishDate.getMonth();
        const day1: number = dateNow.getDate();
        const day2: number = lastPublishDate.getDate();

        dateDiff.years = year2 - year1;
        dateDiff.months = month2 - month1;
        dateDiff.days = day2 - day1;

        if (dateDiff.days < 0) {
            const dateTemp: Date = new Date(dateNow.getFullYear(), dateNow.getMonth() + 1, 1, 0, 0, -1);
            const numDays: number = dateTemp.getDate();

            dateDiff.months -= 1;
            dateDiff.days += numDays;
        }

        if (dateDiff.months < 0) {
            dateDiff.months += 12;
            dateDiff.years -= 1;
        }

        return dateDiff;
    }

    private getSortingForSearch(): string {
        if (this.searchType === SearchType.Popularity) {
            return '&quality=0.0&maintenance=0.0&popularity=1.0';
        }
        if (this.searchType === SearchType.Quality) {
            return '&quality=1.0&maintenance=0.0&popularity=0.0';
        }
        if (this.searchType === SearchType.Maintenance) {
            return '&quality=0.0&maintenance=1.0&popularity=0.0';
        }
        return '';
    }
}
