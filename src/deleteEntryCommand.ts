import * as _ from 'lodash';
import {Range, TextDocument, TextEditor, window} from 'vscode';
import {Dependency, getPackageJsonDocument, NpmTask} from './activityBarView';


export const deleteDependency: (dependency: Dependency) => Promise<void> = async (dependency) => {
    const document: TextDocument | null = await getPackageJsonDocument();

    if (!document) {
        return;
    }

    const maxRange: Range = new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
    const textEditor: TextEditor = await window.showTextDocument(document);
    const packageJsonContent: any = JSON.parse(textEditor.document.getText());
    if (dependency.isDev) {
        packageJsonContent.devDependencies = _.omit(packageJsonContent.devDependencies, dependency.name);
    } else {
        packageJsonContent.dependencies = _.omit(packageJsonContent.dependencies, dependency.name);
    }

    await textEditor.edit((edit) => edit.replace(maxRange, JSON.stringify(packageJsonContent, null, '\t')));
    await textEditor.document.save();
};

export const deleteTask: (task: NpmTask) => Promise<void> = async (task) => {
    const document: TextDocument | null = await getPackageJsonDocument();

    if (!document) {
        return;
    }

    const maxRange: Range = new Range(0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
    const textEditor: TextEditor = await window.showTextDocument(document);
    const packageJsonContent: any = JSON.parse(textEditor.document.getText());
    packageJsonContent.scripts = _.omit(packageJsonContent.scripts, task.label as string);

    await textEditor.edit((edit) => edit.replace(maxRange, JSON.stringify(packageJsonContent, null, '\t')));
    await textEditor.document.save();
};
