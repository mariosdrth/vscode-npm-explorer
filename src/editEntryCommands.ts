import {Position, Range, Selection, TextDocument, TextEditor, window} from 'vscode';
import {Dependency, getPackageJsonDocument, NpmTask} from './activityBarView';

export const editTask: (task: NpmTask) => Promise<void> = async (task) => {
    const document: TextDocument | null = await getPackageJsonDocument();

    if (!document) {
        return;
    }

    const textEditor: TextEditor = await window.showTextDocument(document);
    const match: RegExpExecArray | null = new RegExp(`"scripts":\\s*{.*"${task.label}":\\s*"`, 'gms').exec(document.getText());

    if (!match) {
        return;
    }

    const index: number = match.index + match[0].length;
    const position: Position = textEditor.document.positionAt(index);

    textEditor.revealRange(new Range(position, position));
    textEditor.selection = new Selection(position, new Position(position.line, position.character + task.script.length));
};

export const editDependency: (dependency: Dependency) => Promise<void> = async (dependency) => {
    const document: TextDocument | null = await getPackageJsonDocument();

    if (!document) {
        return;
    }
    
    const textEditor: TextEditor = await window.showTextDocument(document);
    const keyword: string = dependency.isDev ? 'devDependencies' : 'dependencies';
    const match: RegExpExecArray | null = new RegExp(`"${keyword}":\\s*{.*"${dependency.name}":\\s*"`, 'gms').exec(document.getText());

    if (!match) {
        return;
    }

    const index: number = match.index + match[0].length;
    const position: Position = textEditor.document.positionAt(index);

    textEditor.revealRange(new Range(position, position));
    textEditor.selection = new Selection(position, new Position(position.line, position.character + dependency.version.length));
};
