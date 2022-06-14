import {ActivityBar, BottomBarPanel, By, CustomTreeSection, EditorView, InputBox, Notification, SideBarView, ViewItem, ViewPanelAction, VSBrowser, WebElement, WebView, Workbench} from 'vscode-extension-tester';
import {expect} from 'chai';
import * as path from 'path';

const npmExplorerTitle: string = 'Npm Explorer';
const webViewTitle: string = 'Npm Registry';

describe('Npm Explorer View Tests', () => {
    let npmExplorerSection: CustomTreeSection;

    before(async function(): Promise<void> {
        this.timeout(30000);
        await new Promise(res => setTimeout(res, 2000));
        await VSBrowser.instance.openResources(path.join('out', 'ui-test', 'resources'));
        await new Promise(res => setTimeout(res, 2000));
        const explorerView: SideBarView | undefined = await (await new ActivityBar().getViewControl('Explorer'))?.openView();
        if (!explorerView) {
            throw new Error('Npm Explorer View Not There!');
        }

        await (await explorerView.getContent().getSection('resources')).collapse();
        npmExplorerSection = await explorerView.getContent().getSection(npmExplorerTitle) as CustomTreeSection;
        await npmExplorerSection.expand();
        // Wait for content to load
        await new Promise(res => setTimeout(res, 3000));
    });

    it('Check section is there', async () => {
        expect(await npmExplorerSection.getTitle()).to.is.string(npmExplorerTitle);
    });

    it('Check section opens and the content of package.json loads', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        const contentItems: ViewItem[] = await npmExplorerSection.getVisibleItems();
        expect(contentItems.length).to.be.greaterThan(0);

        // Check view actions show as expected
        const actions: ViewPanelAction[] = await npmExplorerSection.getActions();
        expect(await actions[0].getLabel()).to.is.string('Open Npm Registry');
        expect(await actions[1].getLabel()).to.is.string('Update All Dependencies');
        expect(await actions[2].getLabel()).to.is.string('Npm Install');
        expect(await actions[3].getLabel()).to.is.string('Check Dependencies');
        expect(await actions[4].getLabel()).to.is.string('Refresh');
        expect(await actions[5].getLabel()).to.is.string('Select package.json');

        // Check tree sections show as expected
        const tasks: ViewItem  | undefined = await npmExplorerSection.findItem('Tasks');
        expect(await tasks?.isDisplayed()).to.be.true;
        const dependencies: ViewItem  | undefined = await npmExplorerSection.findItem('Dependencies');
        expect(await dependencies?.isDisplayed()).to.be.true;
        const devDependencies: ViewItem  | undefined = await npmExplorerSection.findItem('Dev Dependencies');
        expect(await devDependencies?.isDisplayed()).to.be.true;

        // Check tree items show as expected
        const items: WebElement[] = await npmExplorerSection.findElements(By.className('monaco-highlighted-label'));
        expect(await items[1].getText()).to.is.string('print');
        expect(await items[3].getText()).to.is.string('eslint');
        expect(await items[5].getText()).to.is.string('mocha');
        expect(await items[6].getText()).to.is.string('@types/chai');
        
        // Check item actions show as expected
        const mochaDependency: ViewItem  | undefined = await npmExplorerSection.findItem('mocha');
        await mochaDependency?.click();
        expect(await (await mochaDependency?.findElement(By.className('actions')))?.isDisplayed()).to.be.true;
        expect(await (await mochaDependency?.findElement(By.css('[title="Open Npm Registry with Dependency"]')))?.isEnabled()).to.be.true;
        expect(await (await mochaDependency?.findElement(By.css('[title="Update"]')))?.isEnabled()).to.be.true;
        expect(await (await mochaDependency?.findElement(By.css('[title="Uninstall"]')))?.isEnabled()).to.be.true;
        expect(await (await mochaDependency?.findElement(By.css('[title="Edit"]')))?.isEnabled()).to.be.true;
        expect(await (await mochaDependency?.findElement(By.css('[title="Delete"]')))?.isEnabled()).to.be.true;

        const printTask: ViewItem  | undefined = await npmExplorerSection.findItem('print');
        await printTask?.click();
        expect(await (await printTask?.findElement(By.className('actions')))?.isDisplayed()).to.be.true;
        expect(await (await printTask?.findElement(By.css('[title="Run"]')))?.isEnabled()).to.be.true;
        expect(await (await printTask?.findElement(By.css('[title="Edit"]')))?.isEnabled()).to.be.true;
        expect(await (await printTask?.findElement(By.css('[title="Delete"]')))?.isEnabled()).to.be.true;
    });

    it('Check npm install action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;

        const bottomBar: BottomBarPanel = new BottomBarPanel();
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const npmInstallAction: ViewPanelAction | undefined = await npmExplorerSection.getAction('Npm Install');
        await npmInstallAction?.click();
        await new Promise(res => setTimeout(res, 5000));

        expect(await bottomBar.isDisplayed()).to.be.true;
        expect(await bottomBar.getText()).to.has.string('npm install - Task');

        await bottomBar.toggle(false);
        // Wait for content to load
        await new Promise(res => setTimeout(res, 5000));
    });

    it('Check "check dependencies" action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;

        const bottomBar: BottomBarPanel = new BottomBarPanel();
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const checkDependenciesAction: ViewPanelAction | undefined = await npmExplorerSection.getAction('Check Dependencies');
        await checkDependenciesAction?.click();
        await new Promise(res => setTimeout(res, 3000));

        expect(await bottomBar.isDisplayed()).to.be.true;
        expect(await bottomBar.getText()).to.has.string('npm outdated - Task');

        await bottomBar.toggle(false);
        // Wait for content to load
        await new Promise(res => setTimeout(res, 5000));
    });

    it('Check update all dependencies action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;

        const bottomBar: BottomBarPanel = new BottomBarPanel();
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const updateAllDependencies: ViewPanelAction | undefined = await npmExplorerSection.getAction('Update All Dependencies');
        await updateAllDependencies?.click();
        await new Promise(res => setTimeout(res, 500));

        const notifications: Notification[] = await new Workbench().getNotifications();
        const notification: Notification = notifications[0];
        expect(await notification.getMessage()).to.is.string('Are you sure?');
        await notification.takeAction('Yes');
        await new Promise(res => setTimeout(res, 3000));

        expect(await bottomBar.isDisplayed()).to.be.true;
        expect(await bottomBar.getText()).to.has.string('npm update - Task');

        await bottomBar.toggle(false);
        // Wait for content to load
        await new Promise(res => setTimeout(res, 5000));
    });

    it('Check update all dependencies action is aborted on "No"', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;

        const bottomBar: BottomBarPanel = new BottomBarPanel();
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const updateAllDependencies: ViewPanelAction | undefined = await npmExplorerSection.getAction('Update All Dependencies');
        await updateAllDependencies?.click();
        await new Promise(res => setTimeout(res, 500));

        const notifications: Notification[] = await new Workbench().getNotifications();
        const notification: Notification = notifications[0];
        expect(await notification.getMessage()).to.is.string('Are you sure?');
        await notification.takeAction('No');
        await new Promise(res => setTimeout(res, 1000));

        expect(await bottomBar.isDisplayed()).to.be.false;
        // Wait for content to load
        await new Promise(res => setTimeout(res, 5000));
    });

    it('Check run task action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;

        const bottomBar: BottomBarPanel = new BottomBarPanel();
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const printTask: ViewItem  | undefined = await npmExplorerSection.findItem('print');
        await printTask?.click();
        await printTask?.findElement(By.css('[title="Run"]'))?.click();
        await new Promise(res => setTimeout(res, 3000));

        expect(await bottomBar.isDisplayed()).to.be.true;
        expect(await bottomBar.getText()).to.has.string('print - Task');

        await bottomBar.toggle(false);
        // Wait for content to load
        await new Promise(res => setTimeout(res, 5000));
    });

    it('Check update dependency action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;

        const bottomBar: BottomBarPanel = new BottomBarPanel();
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const eslintDependency: ViewItem  | undefined = await npmExplorerSection.findItem('eslint');
        await eslintDependency?.click();
        await eslintDependency?.findElement(By.css('[title="Update"]'))?.click();
        await new Promise(res => setTimeout(res, 3000));

        expect(await bottomBar.isDisplayed()).to.be.true;
        expect(await bottomBar.getText()).to.has.string('npm update eslint - Task');

        await bottomBar.toggle(false);

        // Wait for content to load
        await new Promise(res => setTimeout(res, 5000));
    });

    it('Check uninstall dependency action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;

        const bottomBar: BottomBarPanel = new BottomBarPanel();
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const eslintDependency: ViewItem  | undefined = await npmExplorerSection.findItem('eslint');
        await eslintDependency?.click();
        await eslintDependency?.findElement(By.css('[title="Uninstall"]'))?.click();
        await new Promise(res => setTimeout(res, 3000));

        expect(await bottomBar.isDisplayed()).to.be.true;
        expect(await bottomBar.getText()).to.has.string('npm uninstall eslint - Task');

        // Wait for content to load
        await new Promise(res => setTimeout(res, 6000));

        // Focus the view so actions are interactable
        await npmExplorerSection.click();
        const eslintDependencyNew: ViewItem  | undefined = await npmExplorerSection.findItem('eslint');
        expect(eslintDependencyNew).to.be.undefined;

        await bottomBar.toggle(false);
    });

    it('Check select package action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const selectPackageAction: ViewPanelAction | undefined = await npmExplorerSection.getAction('Select package.json');
        await selectPackageAction?.click();
        await new Promise(res => setTimeout(res, 500));
        const prompt: InputBox = new InputBox();
        await prompt.setText('config/package.json');
        await prompt.confirm();
        // Wait for content to load
        await new Promise(res => setTimeout(res, 3000));

        // Check tree sections show as expected after new package.json is selected
        const tasks: ViewItem  | undefined = await npmExplorerSection.findItem('Tasks');
        expect(await tasks?.isDisplayed()).to.be.true;
        const devDependencies: ViewItem  | undefined = await npmExplorerSection.findItem('Dev Dependencies');
        expect(await devDependencies?.isDisplayed()).to.be.true;

        // Check tree items show as expected after new package.json is selected
        const items: WebElement[] = await npmExplorerSection.findElements(By.className('monaco-highlighted-label'));
        expect(await items[1].getText()).to.is.string('print-two');
        expect(await items[3].getText()).to.is.string('mocha');

        await selectPackageAction?.click();
        await new Promise(res => setTimeout(res, 500));
        const promptNew: InputBox = new InputBox();
        await promptNew.confirm();
        // Wait for content to load
        await new Promise(res => setTimeout(res, 5000));
    });

    it('Check open npm registry action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;

        const bottomBar: BottomBarPanel = new BottomBarPanel();
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const openNpmRegistryAction: ViewPanelAction | undefined = await npmExplorerSection.getAction('Open Npm Registry');
        await openNpmRegistryAction?.click();
        await new Promise(res => setTimeout(res, 3000));

        const view: WebView = new WebView();
        await view.switchToFrame();

        const title: string = await view.getDriver().getTitle();
        expect(title).is.string(webViewTitle);

        await view.switchBack();
        await new EditorView().closeAllEditors();
    });
});