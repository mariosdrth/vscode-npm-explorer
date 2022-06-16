import {ActivityBar, BottomBarPanel, By, CustomTreeSection, EditorView, InputBox, Notification, SideBarView, TerminalView, TextEditor, ViewItem, ViewPanelAction, VSBrowser, WebElement, WebView, Workbench} from 'vscode-extension-tester';
import {expect} from 'chai';
import * as path from 'path';
import {setNpmExplorerSetting, waitForEditor, waitForNotificationCenter, waitForTerminal, waitForTerminalBasedOnContent, waitForTerminalProgress, waitForTreeProgress, waitForWebview} from './testUtils';

const npmExplorerTitle: string = 'Npm Explorer';
const webViewTitle: string = 'Npm Registry';
let bottomBar: BottomBarPanel;

enum TerminalContentMatchingMethod {
    EXACT_STRING,
    CONTAINED_STRING,
    PATTERN
}

interface TerminalContentMatch<T, K> {
    expected: T;
    type: K;
}

type AllowedTerminalContentMatch = TerminalContentMatch<string, TerminalContentMatchingMethod.CONTAINED_STRING | TerminalContentMatchingMethod.EXACT_STRING>
                                    | TerminalContentMatch<RegExp, TerminalContentMatchingMethod.PATTERN>;

describe('Npm Explorer View Tests', () => {
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
        bottomBar = new BottomBarPanel();

        await npmExplorerSection.expand();
        await waitForTreeProgress(npmExplorerSection);
    });

    it('Check section is there', async () => {
        expect(await npmExplorerSection.getTitle()).to.be.string(npmExplorerTitle);
    });

    it('Check section opens and the content of package.json loads', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        const contentItems: ViewItem[] = await npmExplorerSection.getVisibleItems();
        expect(contentItems.length).to.be.greaterThan(0);

        // Check view actions show as expected
        const actions: ViewPanelAction[] = await npmExplorerSection.getActions();
        expect(await actions[0].getLabel()).to.be.string('Open Npm Registry');
        expect(await actions[1].getLabel()).to.be.string('Update All Dependencies');
        expect(await actions[2].getLabel()).to.be.string('Npm Install');
        expect(await actions[3].getLabel()).to.be.string('Check Dependencies');
        expect(await actions[4].getLabel()).to.be.string('Refresh');
        expect(await actions[5].getLabel()).to.be.string('Select package.json');

        // Check tree sections show as expected
        const tasks: ViewItem  | undefined = await npmExplorerSection.findItem('Tasks');
        expect(await tasks?.isDisplayed()).to.be.true;
        const dependencies: ViewItem  | undefined = await npmExplorerSection.findItem('Dependencies');
        expect(await dependencies?.isDisplayed()).to.be.true;
        const devDependencies: ViewItem  | undefined = await npmExplorerSection.findItem('Dev Dependencies');
        expect(await devDependencies?.isDisplayed()).to.be.true;

        // Check tree items show as expected
        const items: WebElement[] = await npmExplorerSection.findElements(By.className('monaco-highlighted-label'));
        expect(await items[1].getText()).to.be.string('print');
        expect(await items[3].getText()).to.be.string('eslint');
        expect(await items[4].getText()).to.be.string('rimraf');
        expect(await items[5].getText()).to.be.string('lodash');
        expect(await items[7].getText()).to.be.string('mocha');
        expect(await items[8].getText()).to.be.string('chai');
        expect(await items[9].getText()).to.be.string('glob');
        
        // Check item actions show as expected
        const mochaDependency: ViewItem  | undefined = await npmExplorerSection.findItem('mocha');
        await mochaDependency?.click();
        expect(await (await mochaDependency?.findElement(By.className('label-description')))?.getText()).to.have.string('Current version:');
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

    it ('Check dependencies are indicated as outdated if needed',async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const eslintDependency: ViewItem  | undefined = await npmExplorerSection.findItem('eslint');
        await eslintDependency?.click();
        const eslistDependencyIcon: WebElement | undefined = await eslintDependency?.findElement(By.className('custom-view-tree-node-item-icon'));
        expect(await eslistDependencyIcon?.getAttribute('style')).to.have.string('dependency_outdated.svg');
        expect(await (await eslintDependency?.findElement(By.className('label-description')))?.getText()).to.have.string('Newer version');

        const mochaDependency: ViewItem  | undefined = await npmExplorerSection.findItem('mocha');
        await mochaDependency?.click();
        const mochaDependencyIcon: WebElement | undefined = await mochaDependency?.findElement(By.className('custom-view-tree-node-item-icon'));
        expect(await mochaDependencyIcon?.getAttribute('style')).to.have.string('dependency.svg');
        expect(await (await mochaDependency?.findElement(By.className('label-description')))?.getText()).to.not.have.string('Newer version');
    });

    it('Check refresh action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();
        const momentDependency: ViewItem  | undefined = await npmExplorerSection.findItem('moment');
        expect(momentDependency).to.be.undefined;

        await bottomBar.toggle(true);
        await waitForTerminal(bottomBar);
        const terminal: TerminalView = await bottomBar.openTerminalView();
        await terminal.executeCommand('npm install moment');
        await waitForTerminalBasedOnContent(terminal, bottomBar, undefined, 500);
        await waitForTreeProgress(npmExplorerSection, 500);

        await npmExplorerSection.click();
        const refreshAction: ViewPanelAction | undefined = await npmExplorerSection.getAction('Refresh');
        await refreshAction?.click();
        await waitForTreeProgress(npmExplorerSection, 1000);

        await npmExplorerSection.click();
        const momentDependencyNew: ViewItem  | undefined = await npmExplorerSection.findItem('moment');
        expect(momentDependencyNew).to.exist;

        await terminal.killTerminal();
        await new Promise(res => setTimeout(res, 1000));
    });

    it('Check npm install action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const npmInstallAction: ViewPanelAction | undefined = await npmExplorerSection.getAction('Npm Install');
        await npmInstallAction?.click();
        await waitForTerminalProgress(bottomBar);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm install <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await bottomBar.toggle(false);
        await waitForTreeProgress(npmExplorerSection);
    });

    it('Check npm install action with arguments', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        await setNpmExplorerSetting('Install Command Arguments', '--save-dev');

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const npmInstallAction: ViewPanelAction | undefined = await npmExplorerSection.getAction('Npm Install');
        await npmInstallAction?.click();
        await waitForTerminalProgress(bottomBar);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm install --save-dev <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await bottomBar.toggle(false);
        await waitForTreeProgress(npmExplorerSection);
    });

    it('Check "check dependencies" action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const checkDependenciesAction: ViewPanelAction | undefined = await npmExplorerSection.getAction('Check Dependencies');
        await checkDependenciesAction?.click();
        await waitForTerminalProgress(bottomBar);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: /> Executing task: npm outdated <.*Package.*Current.*Wanted.*Latest.*Location.*Depended by/gmsi,
            type: TerminalContentMatchingMethod.PATTERN
        });

        await bottomBar.toggle(false);
        await waitForTreeProgress(npmExplorerSection);
    });

    it('Check update all dependencies action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const updateAllDependencies: ViewPanelAction | undefined = await npmExplorerSection.getAction('Update All Dependencies');
        await updateAllDependencies?.click();
        await waitForNotificationCenter();

        const notifications: Notification[] = await new Workbench().getNotifications();
        const notification: Notification = notifications[0];
        expect(await notification.getMessage()).to.be.string('Are you sure?');
        await notification.takeAction('Yes');
        await waitForTerminalProgress(bottomBar);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm update <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await bottomBar.toggle(false);
        await waitForTreeProgress(npmExplorerSection);
    });

    it('Check update all dependencies action is aborted on "No"', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const updateAllDependencies: ViewPanelAction | undefined = await npmExplorerSection.getAction('Update All Dependencies');
        await updateAllDependencies?.click();
        await waitForNotificationCenter();

        const notifications: Notification[] = await new Workbench().getNotifications();
        const notification: Notification = notifications[0];
        expect(await notification.getMessage()).to.be.string('Are you sure?');
        await notification.takeAction('No');

        expect(await bottomBar.isDisplayed()).to.be.false;
        await waitForTreeProgress(npmExplorerSection);
    });

    it('Check run task action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const printTask: ViewItem  | undefined = await npmExplorerSection.findItem('print');
        await printTask?.click();
        await printTask?.findElement(By.css('[title="Run"]'))?.click();
        await waitForTerminalProgress(bottomBar, 3000);

        expect(await bottomBar.isDisplayed()).to.be.true;

        const text: string = await bottomBar.getText();
        expect(text).to.have.string('print - Task');

        await bottomBar.toggle(false);
        await waitForTreeProgress(npmExplorerSection);
    });

    it('Check update dependency action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const eslintDependency: ViewItem  | undefined = await npmExplorerSection.findItem('eslint');
        await eslintDependency?.click();
        await eslintDependency?.findElement(By.css('[title="Update"]'))?.click();
        
        await waitForTerminalProgress(bottomBar);
        await waitForTreeProgress(npmExplorerSection);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm update eslint <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await bottomBar.toggle(false);
    });

    it('Check update dependency action with arguments', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        await setNpmExplorerSetting('Update Dependency Command Arguments', '--save');

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const eslintDependency: ViewItem  | undefined = await npmExplorerSection.findItem('eslint');
        await eslintDependency?.click();
        await eslintDependency?.findElement(By.css('[title="Update"]'))?.click();
        
        await waitForTerminalProgress(bottomBar);
        await waitForTreeProgress(npmExplorerSection);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm update --save eslint <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await bottomBar.toggle(false);
    });

    it('Check update dev dependency action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const globDependency: ViewItem  | undefined = await npmExplorerSection.findItem('glob');
        await globDependency?.click();
        await globDependency?.findElement(By.css('[title="Update"]'))?.click();
        
        await waitForTerminalProgress(bottomBar);
        await waitForTreeProgress(npmExplorerSection);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm update --save-dev glob <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await bottomBar.toggle(false);
    });

    it('Check update dev dependency action with arguments', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        await setNpmExplorerSetting('Update Dev Dependency Command Arguments', '--save');

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const globDependency: ViewItem  | undefined = await npmExplorerSection.findItem('glob');
        await globDependency?.click();
        await globDependency?.findElement(By.css('[title="Update"]'))?.click();
        
        await waitForTerminalProgress(bottomBar);
        await waitForTreeProgress(npmExplorerSection);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm update --save glob <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await bottomBar.toggle(false);
    });


    it('Check uninstall dependency action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const eslintDependency: ViewItem  | undefined = await npmExplorerSection.findItem('eslint');
        await eslintDependency?.click();
        await eslintDependency?.findElement(By.css('[title="Uninstall"]'))?.click();
        await waitForTerminalProgress(bottomBar);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm uninstall eslint <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await waitForTreeProgress(npmExplorerSection, 500);

        // Focus the view so actions are interactable
        await npmExplorerSection.click();
        const eslintDependencyNew: ViewItem  | undefined = await npmExplorerSection.findItem('eslint');
        expect(eslintDependencyNew).to.be.undefined;

        await bottomBar.toggle(false);
    });

    it('Check uninstall dependency action with arguments', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        await setNpmExplorerSetting('Uninstall Dependency Command Arguments', '--save');

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const lodashDependency: ViewItem  | undefined = await npmExplorerSection.findItem('lodash');
        await lodashDependency?.click();
        await lodashDependency?.findElement(By.css('[title="Uninstall"]'))?.click();
        await waitForTerminalProgress(bottomBar);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm uninstall --save lodash <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await waitForTreeProgress(npmExplorerSection, 500);

        // Focus the view so actions are interactable
        await npmExplorerSection.click();
        const lodashDependencyNew: ViewItem  | undefined = await npmExplorerSection.findItem('lodash');
        expect(lodashDependencyNew).to.be.undefined;

        await bottomBar.toggle(false);
    });

    it('Check uninstall dev dependency action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const globDependency: ViewItem  | undefined = await npmExplorerSection.findItem('glob');
        await globDependency?.click();
        await globDependency?.findElement(By.css('[title="Uninstall"]'))?.click();
        await waitForTerminalProgress(bottomBar);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm uninstall --save-dev glob <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await waitForTreeProgress(npmExplorerSection, 500);

        // Focus the view so actions are interactable
        await npmExplorerSection.click();
        const globDependencyNew: ViewItem  | undefined = await npmExplorerSection.findItem('glob');
        expect(globDependencyNew).to.be.undefined;

        await bottomBar.toggle(false);
    });

    it('Check uninstall dev dependency action with arguments', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        expect(await bottomBar.isDisplayed()).to.be.false;

        await setNpmExplorerSetting('Uninstall Dev Dependency Command Arguments', '--save');

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const chaiDependency: ViewItem  | undefined = await npmExplorerSection.findItem('chai');
        await chaiDependency?.click();
        await chaiDependency?.findElement(By.css('[title="Uninstall"]'))?.click();
        await waitForTerminalProgress(bottomBar);

        expect(await bottomBar.isDisplayed()).to.be.true;

        await assertTerminalContent({
            expected: '> Executing task: npm uninstall --save chai <',
            type: TerminalContentMatchingMethod.CONTAINED_STRING
        });

        await waitForTreeProgress(npmExplorerSection, 500);

        // Focus the view so actions are interactable
        await npmExplorerSection.click();
        const chaiDependencyNew: ViewItem  | undefined = await npmExplorerSection.findItem('chai');
        expect(chaiDependencyNew).to.be.undefined;

        await bottomBar.toggle(false);
    });

    it('Check edit task action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        await new Workbench().getEditorView().closeAllEditors();
        // Focus the view so actions are interactable
        await npmExplorerSection.click();
        
        const printTask: ViewItem  | undefined = await npmExplorerSection.findItem('print');
        await printTask?.click();
        await printTask?.findElement(By.css('[title="Edit"]'))?.click();
        await waitForEditor();

        const editor: TextEditor = new TextEditor();
        await new Promise(res => setTimeout(res, 500));
        
        expect(await editor.getTitle()).to.be.string('package.json');
        expect(await editor.getSelection()).to.exist;
    });

    it('Check delete task action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        await new Workbench().getEditorView().closeAllEditors();
        // Focus the view so actions are interactable
        await npmExplorerSection.click();
        
        const printTask: ViewItem  | undefined = await npmExplorerSection.findItem('print');
        await printTask?.click();
        await printTask?.findElement(By.css('[title="Delete"]'))?.click();
        await waitForTreeProgress(npmExplorerSection, 500);
        await waitForEditor();

        const editor: TextEditor = new TextEditor();
        await new Promise(res => setTimeout(res, 500));
        
        expect(await editor.getTitle()).to.be.string('package.json');
        expect(await editor.getText()).to.not.have.string('print');
    });

    it('Check edit dependency action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        await new Workbench().getEditorView().closeAllEditors();
        // Focus the view so actions are interactable
        await npmExplorerSection.click();
        
        const dependency: ViewItem  | undefined = await npmExplorerSection.findItem('rimraf');
        await dependency?.click();
        await dependency?.findElement(By.css('[title="Edit"]'))?.click();
        await waitForTreeProgress(npmExplorerSection, 2000);
        await waitForEditor();

        const editor: TextEditor = new TextEditor();
        await new Promise(res => setTimeout(res, 1000));
        
        expect(await editor.getTitle()).to.be.string('package.json');
        expect(await editor.getSelection()).to.exist;
    });

    it('Check delete dependency action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;
        await new Workbench().getEditorView().closeAllEditors();
        // Focus the view so actions are interactable
        await npmExplorerSection.click();
        
        const dependency: ViewItem  | undefined = await npmExplorerSection.findItem('rimraf');
        await dependency?.click();
        await dependency?.findElement(By.css('[title="Delete"]'))?.click();
        await waitForTreeProgress(npmExplorerSection, 2000);
        await waitForEditor();

        const editor: TextEditor = new TextEditor();
        await new Promise(res => setTimeout(res, 1000));
        
        expect(await editor.getTitle()).to.be.string('package.json');
        expect(await editor.getText(), await editor.getText()).to.not.have.string('rimraf');
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
        
        await waitForTreeProgress(npmExplorerSection, 1000);

        // Check tree sections show as expected after new package.json is selected
        const tasks: ViewItem  | undefined = await npmExplorerSection.findItem('Tasks');
        expect(await tasks?.isDisplayed()).to.be.true;
        const devDependencies: ViewItem  | undefined = await npmExplorerSection.findItem('Dev Dependencies');
        expect(await devDependencies?.isDisplayed()).to.be.true;

        // Check tree items show as expected after new package.json is selected
        const items: WebElement[] = await npmExplorerSection.findElements(By.className('monaco-highlighted-label'));
        expect(await items[1].getText()).to.be.string('print-two');
        expect(await items[3].getText()).to.be.string('mocha');

        await selectPackageAction?.click();
        await new Promise(res => setTimeout(res, 500));
        const promptNew: InputBox = new InputBox();
        await promptNew.confirm();
        
        await waitForTreeProgress(npmExplorerSection, 1000);
    });

    it('Check open npm registry action works', async () => {
        expect(await npmExplorerSection.isExpanded()).to.be.true;

        // Focus the view so actions are interactable
        await npmExplorerSection.click();

        const openNpmRegistryAction: ViewPanelAction | undefined = await npmExplorerSection.getAction('Open Npm Registry');
        await openNpmRegistryAction?.click();
        await waitForWebview();

        const view: WebView = new WebView();
        await view.switchToFrame();

        const title: string = await view.getDriver().getTitle();
        expect(title).is.string(webViewTitle);

        await view.switchBack();
        await new EditorView().closeAllEditors();
    });
});

const assertTerminalContent: (match: AllowedTerminalContentMatch) => Promise<void> = async (match) => {
    await waitForTerminal(bottomBar);
    const terminalText: string = await new TerminalView(bottomBar).getText();
    switch (match.type) {
        case TerminalContentMatchingMethod.CONTAINED_STRING:
            expect(terminalText).to.have.string(match.expected);
            break;
        case TerminalContentMatchingMethod.EXACT_STRING:
            expect(terminalText).to.be.string(match.expected);
            break;
        case TerminalContentMatchingMethod.PATTERN:
            expect(terminalText).to.match(match.expected);
            break;
    }
    expect(terminalText).to.have.string('Terminal will be reused by tasks, press any key to close it.');
};
