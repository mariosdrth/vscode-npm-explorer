import {Task, tasks} from 'vscode';
import {NpmTask} from './activityBarView';

export const runTask: (npmTask: NpmTask) => Promise<void> = async (npmTask) => {
    const allTasks: Task[] = await tasks.fetchTasks();
    const task: Task = allTasks.filter(_task => _task.definition.script === npmTask.label)[0];

    if (!task) {
        return;
    }
    
    await tasks.executeTask(task);
};