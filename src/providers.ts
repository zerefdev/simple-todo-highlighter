import {
    EventEmitter,
    GlobPattern,
    ThemeIcon,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    Uri,
    workspace
} from 'vscode';
import { COMMANDS, EXCLUDE, INCLUDE, MAX_RESULTS } from './constants';
import { Decoration } from './decoration';
import { keywords } from './extension';

export class TodoTreeListProvider implements TreeDataProvider<Todo> {
    private _onDidChangeTreeData = new EventEmitter<Todo | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    getTreeItem(element: Todo): TreeItem {
        return element;
    }

    async getChildren(element?: Todo): Promise<Todo[]> {
        if (!element) return Promise.resolve(await this.getTodoList());

        return Promise.resolve(element.children ?? []);
    }

    private async getTodoList(): Promise<Todo[]> {
        const regex = new RegExp(keywords.join('|'), 'g');
        const arr1: Todo[] = [];
        const files = await workspace.findFiles(
            pattern(Decoration.include(), INCLUDE),
            pattern(Decoration.exclude(), EXCLUDE),
            MAX_RESULTS
        );

        if (files.length) {
            for (let i = 0; i < files.length; i++) {
                const arr2: Todo[] = [];
                const file = files[i];
                const doc = await workspace.openTextDocument(file);
                const docUri = doc.uri;
                const fileName = doc.fileName.replace(/\\/g, '/').split('/').pop() ?? 'unknown';

                for (let j = 0; j < doc.lineCount; j++) {
                    const text = doc.lineAt(j).text;
                    const match = text.match(regex);

                    if (match && match.length) {
                        const keyword = match[0];
                        const todoText = text.slice(text.indexOf(keyword), text.length);

                        if (todoText) {
                            arr2.push(new Todo(`${todoText}`, undefined, docUri, j));
                        }
                    }
                }

                if (arr2.length) arr1.push(new Todo(fileName, arr2, docUri));
            }
        }

        // TODO: find a better way
        return arr1.sort(({ label: label1 }, { label: label2 }) => {
            const l1 = label1.toLowerCase();
            const l2 = label2.toLowerCase();

            if (l1 < l2) return -1;

            if (l1 > l2) return 1;

            return 0;
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

class Todo extends TreeItem {
    label: string;
    children: Todo[] | undefined;

    constructor(label: string, children?: Todo[], path?: Uri, col?: number) {
        super(label, children ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None);
        this.label = label;
        this.children = children;
        this.iconPath = children ? new ThemeIcon('file') : undefined;
        this.resourceUri = children ? path : undefined;
        this.description = !!children;
        this.command = !children
            ? { command: COMMANDS.OPEN_FILE, title: 'Open file', arguments: [path, col] }
            : undefined;
    }
}

function pattern(glob: string[], def: string[]): GlobPattern {
    if (Array.isArray(glob) && glob.length) {
        return '{' + glob.join(',') + '}';
    }

    return '{' + def.join(',') + '}';
}
