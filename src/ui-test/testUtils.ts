import {BottomBarPanel, By, CustomTreeSection, Setting, SettingsEditor, TerminalView, WebElement, Workbench} from 'vscode-extension-tester';

export const waitForTerminalProgress: (bottomBar?: BottomBarPanel, delay?: number) => Promise<void> = async (bottomBar, delay) => {
    if (delay) {
        await new Promise(res => setTimeout(res, delay));
    }
    if (!bottomBar) {
        bottomBar = new BottomBarPanel();
    }
    // Wait to be sure the terminal is shown
    await waitForTerminal(bottomBar);
    // If not "loading" there is no task running, return
    const loading: WebElement[] = await bottomBar.findElements(By.css('.codicon.codicon-loading.codicon-modifier-spin'));
    if (loading.length === 0) {
        return;
    }
    // Wait and call self
    await new Promise(res => setTimeout(res, 1000));
    await waitForTerminalProgress(bottomBar);
};

export const waitForTerminalBasedOnContent: (terminal: TerminalView, bottomBar?: BottomBarPanel, previousText?: string, delay?: number) => Promise<void> = async (terminal, bottomBar, previousText, delay) => {
    if (delay) {
        await new Promise(res => setTimeout(res, delay));
    }
    if (!bottomBar) {
        bottomBar = new BottomBarPanel();
    }
    // Wait to be sure the terminal is shown
    await waitForTerminal(bottomBar);
    const text: string = await terminal.getText();
    if (text === previousText) {
        return;
    }
    // Wait and call self
    await new Promise(res => setTimeout(res, 1000));
    await waitForTerminalBasedOnContent(terminal, bottomBar, text);
};

export const waitForTreeProgress: (treeSection: CustomTreeSection, delay?: number) => Promise<void> = async (treeSection, delay) => {
    if (delay) {
        await new Promise(res => setTimeout(res, delay));
    }
    // If "done" there is no progress, return
    const done: WebElement[] = await treeSection.findElements(By.css('.monaco-progress-container.done'));
    if (done.length > 0 && done[0]) {
        return;
    }
    // Wait and call self
    await new Promise(res => setTimeout(res, 1000));
    await waitForTreeProgress(treeSection);
};

export const waitForNotificationCenter: (delay?: number) => Promise<void> = async (delay) => {
    if (delay) {
        await new Promise(res => setTimeout(res, delay));
    }
    const notifications: WebElement[] = await new Workbench().findElements(By.css('.notifications-toasts.visible'));
    if (notifications.length > 0 && notifications[0]) {
        return;
    }
    // Wait and call self
    await new Promise(res => setTimeout(res, 1000));
    await waitForNotificationCenter();
};

export const waitForWebview: (delay?: number) => Promise<void> = async (delay) => {
    if (delay) {
        await new Promise(res => setTimeout(res, delay));
    }
    const webView: WebElement[] = await new Workbench().findElements(By.css('div[id^="webview"]'));
    if (webView.length > 0 && webView[0]) {
        return;
    }
    // Wait and call self
    await new Promise(res => setTimeout(res, 1000));
    await waitForWebview();
};

export const waitForTerminal: (bottomBar: BottomBarPanel, delay?: number) => Promise<void> = async (bottomBar, delay) => {
    if (delay) {
        await new Promise(res => setTimeout(res, delay));
    }
    const terminal: WebElement[] = await bottomBar.findElements(By.id('terminal'));
    if (terminal.length > 0 && terminal[0]) {
        return;
    }
    await new Promise(res => setTimeout(res, 1000));
    await waitForTerminal(bottomBar);
};

export const waitForEditor: (delay?: number) => Promise<void> = async (delay) => {
    if (delay) {
        await new Promise(res => setTimeout(res, delay));
    }
    const editor: WebElement = await new Workbench().findElement(By.id('workbench.parts.editor'));
    const editorContent: WebElement[] = await editor.findElements(By.css('.content.empty'));
    if (editorContent.length === 0) {
        return;
    }
    await new Promise(res => setTimeout(res, 1000));
    await waitForEditor();
};

export const setNpmExplorerSetting: (settingTitle: string, value: string) => Promise<void> = async (settingTitle, value) => {
    const settingsEditor: SettingsEditor = await new Workbench().openSettings();
    const setting: Setting = await settingsEditor.findSetting(settingTitle, 'Npm Explorer');
    await setting.setValue(value);
    await waitForSettingSaved(settingTitle);
    await new Workbench().getEditorView().closeEditor('Settings');
};

const waitForSettingSaved: (settingTitle: string, delay?: number) => Promise<void> = async (settingTitle, delay) => {
    if (delay) {
        await new Promise(res => setTimeout(res, delay));
    }
    const baseElement: WebElement = await new Workbench().findElement(By.css(`div[aria-label*="${settingTitle}"]`));
    const settingConfigured: WebElement[] = await baseElement.findElements(By.css('.setting-item-contents.settings-row-inner-container.is-configured'));
    if (settingConfigured.length > 0 && settingConfigured[0]) {
        return;
    }
    await new Promise(res => setTimeout(res, 1000));
    await waitForSettingSaved(settingTitle);
};
