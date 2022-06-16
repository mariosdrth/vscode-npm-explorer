import {EditorView, WebView, By, WebElement, VSBrowser, ActivityBar, SideBarView, CustomTreeSection, ViewItem, InputBox, Workbench} from 'vscode-extension-tester';
import {expect} from 'chai';
import * as path from 'path';
import {waitForTreeProgress, waitForWebview} from './testUtils';

const webViewTitle: string = 'Npm Registry';
const npmExplorerTitle: string = 'Npm Explorer';

describe('Npm Registry Web View Initial Page Tests', () => {

    let view: WebView;

    before(async function(): Promise<void> {
        this.timeout(20000);
        await VSBrowser.instance.waitForWorkbench();
        await new Workbench().executeCommand('Open Npm Registry');
        await waitForWebview();
        view = new WebView();
        await view.switchToFrame();
    });

    after(async () => {
        await view.switchBack();
        await new EditorView().closeAllEditors();
    });

    it('Check the search page opens', async () => {
        const title: string = await view.getDriver().getTitle();
        expect(title).is.string(webViewTitle);
    });

    it('Check the search page loads correctly', async () => {
        const search: WebElement = await view.findWebElement(By.id('search'));
        expect(await search.isEnabled()).to.be.true;

        await search.sendKeys('mocha');

        const searchButton: WebElement = await view.findWebElement(By.id('search-btn'));
        await searchButton.click();
        
        // Wait for page reload
        await new Promise(res => setTimeout(res, 500));

        expect(await search.getAttribute('value')).is.string('mocha');
        expect(await searchButton.isEnabled()).to.be.true;
    });
});

describe('Npm Registry Web View Search Page Tests', () => {

    let view: WebView;

    before(async function(): Promise<void> {
        this.timeout(20000);
        await VSBrowser.instance.waitForWorkbench();
        const prompt: InputBox = await new Workbench().openCommandPrompt() as InputBox;
        await prompt.setText('>Search Npm Registry');
        await prompt.confirm();
        await prompt.setText('mocha');
        await prompt.confirm();
        await waitForWebview();
        view = new WebView();
        await view.switchToFrame();
    });

    after(async () => {
        await view.switchBack();
        await new EditorView().closeAllEditors();
    });

    it('Check the results page opens', async () => {
        const title: string = await view.getDriver().getTitle();
        expect(title).is.string(webViewTitle);
    });

    it('Check the results page loads with all expected elements', async () => {
        const search: WebElement = await view.findWebElement(By.id('search'));
        expect(await search.isEnabled()).to.be.true;

        const resultsWrapper: WebElement = await view.findWebElement(By.id('search-content'));
        expect(await resultsWrapper.isDisplayed()).to.be.true;

        const totalResults: WebElement = await view.findWebElement(By.id('total-results'));
        expect(await totalResults.getText()).has.string('packages found');

        const paginations: WebElement[] = await view.findWebElements(By.className('pagination'));
        expect(paginations.length).to.equal(2);
        for (const pagination of paginations) {
            expect(await pagination.isDisplayed()).to.be.true;
        }

        const packagesWrapper: WebElement = await view.findWebElement(By.id('sort-packages-wrapper'));
        expect(await packagesWrapper.isDisplayed()).to.be.true;
    });

    it('Check results load as expected', async () => {
        const resultHeaders: WebElement[] = await view.findWebElements(By.className('result-list-item-header-wrapper'));
        const firstResultHeaderText: WebElement = await resultHeaders[0].findElement(By.css('h3'));
        expect(await firstResultHeaderText.getText()).is.string('mocha');

        const firstResultHeaderLabel: WebElement = (await resultHeaders[0].findElements(By.className('result-list-item-match-label')))[0];
        expect(await firstResultHeaderLabel.getText()).is.string('exact match');

        // The label should exist only on the first search result
        for (const resultHeader of resultHeaders.slice(1)) {
            const exactMatchLabel: WebElement[] = await resultHeader.findElements(By.className('result-list-item-match-label'));
            expect(exactMatchLabel.length).to.equal(0);
        }
    });

    it('Check the pagination loads as expected', async () => {
        const totalResults: WebElement = await view.findWebElement(By.id('total-results'));
        const results: number = parseInt(((await totalResults.getText()).match(/(.*) packages found/) as RegExpMatchArray)[0]);
        const totalPages: number = Math.ceil(results / 20);
        const paginations: WebElement[] = await view.findWebElements(By.className('pagination'));

        for (const pagination of paginations) {
            const pageNumbers: WebElement[] = await pagination.findElements(By.className('page-link'));
            expect(parseInt(await pageNumbers[0].getText())).to.equal(1);
            expect(await pageNumbers[0].getAttribute('class')).to.have.string('active');
            expect(parseInt(await pageNumbers[pageNumbers.length - 1].getText())).to.equal(totalPages);

            // Only the first page (initially)  should be active
            for (const pageNumber of pageNumbers.slice(1)) {
                expect(await pageNumber.getAttribute('class')).to.not.have.string('active');
            }
            expect((await pagination.findElements(By.className('disabled-link page-previous'))).length).to.equal(1);
            expect((await pagination.findElements(By.className('page-next'))).length).to.equal(1);
        }
    });

    it('Check the sorting loads as expected', async () => {
        const sortPackagesHeader: WebElement = await view.findWebElement(By.id('sort-packages-header'));
        expect(await sortPackagesHeader.getText()).to.be.string('Sort Packages');
        
        const sortPackagesList: WebElement = await view.findWebElement(By.id('sort-packages-list'));
        const sortPackagesListElements: WebElement[] = await sortPackagesList.findElements(By.css('li'));
        expect(sortPackagesListElements.length).to.equal(4);
        expect(await sortPackagesListElements[0].getText()).to.be.string('Optimal');
        expect(await sortPackagesListElements[1].getText()).to.be.string('Popularity');
        expect(await sortPackagesListElements[2].getText()).to.be.string('Quality');
        expect(await sortPackagesListElements[3].getText()).to.be.string('Maintenance');
    });
});

describe('Npm Registry Web View Dependency Page Tests', () => {

    let view: WebView;
    let mochaDependency: ViewItem  | undefined;
    let npmExplorerSection: CustomTreeSection;

    before(async function(): Promise<void> {
        this.timeout(30000);
        await VSBrowser.instance.openResources(path.join('out', 'ui-test', 'resources'));
        await VSBrowser.instance.waitForWorkbench();
        const explorerView: SideBarView | undefined = await (await new ActivityBar().getViewControl('Explorer'))?.openView();
        if (!explorerView) {
            throw new Error('Npm Explorer View Not There!');
        }

        await (await explorerView.getContent().getSection('resources')).collapse();
        npmExplorerSection = await explorerView.getContent().getSection(npmExplorerTitle) as CustomTreeSection;
        await npmExplorerSection.expand();
        // Wait for content to load
        await waitForTreeProgress(npmExplorerSection);

        await npmExplorerSection.click();
        mochaDependency = await npmExplorerSection.findItem('mocha');
        await mochaDependency?.click();
        await mochaDependency?.findElement(By.css('[title="Open Npm Registry with Dependency"]'))?.click();
        await waitForWebview();

        view = new WebView();
    });

    after(async () => {
        await view.switchBack();
        await new EditorView().closeAllEditors();
    });

    it('Check the dependency page opens', async () => {
        const title: string = await view.getDriver().getTitle();
        expect(title).is.string(webViewTitle);
    });

    it('Check the dependency page loads as expected', async () => {
        await npmExplorerSection.click();
        await waitForTreeProgress(npmExplorerSection, 500);
        let mochaVersion: WebElement | undefined = await mochaDependency?.findElement(By.className('label-description'));
        expect(await mochaVersion?.getText()).to.be.string('Current version: ^9.2.0');

        await view.switchToFrame();
        const contentInfoName: WebElement = await view.findWebElement(By.id('content-info-name'));
        expect(await contentInfoName.getText()).to.be.string('mocha');

        const contentInfoInstalledVersion: WebElement = await view.findWebElement(By.id('content-info-installed-version'));
        expect(await contentInfoInstalledVersion.getText()).to.be.string('Version (^9.2.0) installed as dev dependency');

        const detailsSectionDescEls: WebElement[] = await view.findWebElements(By.className('details-section-desc'));
        for (const [index, value] of detailsSectionDescEls.entries()) {
            const header: WebElement = await value.findElement(By.css('h3'));
            if (index === 0) {
                expect(await header.getText()).to.be.string('Npm Page');
            }
            if (index === 1) {
                expect(await header.getText()).to.be.string('Repository');
            }
            if (index === 2) {
                expect(await header.getText()).to.be.string('Homepage');
            }
        }

        const weeklyDownloadsHeader: WebElement = await view.findWebElement(By.id('weekly-downloads-header'));
        expect(await weeklyDownloadsHeader.getText()).to.be.string('Downloads');

        const keywordsHeader: WebElement = await view.findWebElement(By.id('keywords-header'));
        expect(await keywordsHeader.getText()).to.be.string('Keywords');

        const keywords: WebElement[] = await view.findWebElements(By.className('keyword-link'));
        expect(await keywords[0].getText()).to.be.string('mocha');

        // Check readme is there but no content as it changes
        const readmeContent: WebElement = await view.findWebElement(By.id('content-md'));
        expect(await readmeContent.isDisplayed()).to.be.true;

        const versionToInstall: string = (await (await view.findWebElement(By.id('version'))).findElement(By.css('[selected]')).getText()).replace(' (latest)', '');

        const installBtn: WebElement = await view.findWebElement(By.id('install-btn'));
        await installBtn.click();
        await new Promise(res => setTimeout(res, 15000));
        await view.switchBack();

        await npmExplorerSection.click();
        await waitForTreeProgress(npmExplorerSection, 500);
        mochaDependency = await npmExplorerSection.findItem('mocha');
        await mochaDependency?.click();
        await waitForTreeProgress(npmExplorerSection, 500);
        mochaVersion = await mochaDependency?.findElement(By.className('label-description'));
        expect(await mochaVersion?.getText()).to.not.have.string('9.2.0');
        expect(await mochaVersion?.getText()).to.have.string(versionToInstall);
    });
});