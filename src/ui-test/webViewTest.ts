import { Workbench, EditorView, WebView, By, WebElement, InputBox} from 'vscode-extension-tester';
import { expect } from 'chai';

const webViewTitle: string = 'Npm Registry';

describe('Npm Registry Web View Initial Page Tests', () => {

    let view: WebView;

    before(async function(): Promise<void> {
        this.timeout(20000);
        // Wait for VSCode to initialize, it may need to be tweaked locally
        await new Promise(res => setTimeout(res, 2000));
        await new Workbench().executeCommand('Open Npm Registry');
        await new Promise(res => setTimeout(res, 500));
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
        // Wait for VSCode to initialize, it may need to be ticked locally
        await new Promise(res => setTimeout(res, 2000));
        const prompt: InputBox = await new Workbench().openCommandPrompt() as InputBox;
        await prompt.setText('>Search Npm Registry');
        await prompt.confirm();
        await prompt.setText('mocha');
        await prompt.confirm();
        await new Promise(res => setTimeout(res, 2000));
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
            expect(await pageNumbers[0].getAttribute('class')).to.has.string('active');
            expect(parseInt(await pageNumbers[pageNumbers.length - 1].getText())).to.equal(totalPages);

            // Only the first page (initially)  should be active
            for (const pageNumber of pageNumbers.slice(1)) {
                expect(await pageNumber.getAttribute('class')).to.not.has.string('active');
            }
            expect((await pagination.findElements(By.className('disabled-link page-previous'))).length).to.equal(1);
            expect((await pagination.findElements(By.className('page-next'))).length).to.equal(1);
        }
    });

    it('Check the sorting loads as expected', async () => {
        const sortPackagesHeader: WebElement = await view.findWebElement(By.id('sort-packages-header'));
        expect(await sortPackagesHeader.getText()).to.is.string('Sort Packages');
        
        const sortPackagesList: WebElement = await view.findWebElement(By.id('sort-packages-list'));
        const sortPackagesListElements: WebElement[] = await sortPackagesList.findElements(By.css('li'));
        expect(sortPackagesListElements.length).to.equal(4);
        expect(await sortPackagesListElements[0].getText()).to.is.string('Optimal');
        expect(await sortPackagesListElements[1].getText()).to.is.string('Popularity');
        expect(await sortPackagesListElements[2].getText()).to.is.string('Quality');
        expect(await sortPackagesListElements[3].getText()).to.is.string('Maintenance');
    });
});