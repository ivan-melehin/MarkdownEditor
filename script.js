(function () {
    const textarea = document.getElementById('markdownInput');
    const preview = document.getElementById('preview');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const stats = document.getElementById('stats');
    const themeToggle = document.getElementById('themeToggle');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    // === UNDO / REDO ===
    class HistoryManager {
        constructor(maxHistory = 100) {
            this.undoStack = [];
            this.redoStack = [];
            this.maxHistory = maxHistory;
            this.isUndoRedo = false;
        }

        push(state) {
            if (this.isUndoRedo) {
                this.isUndoRedo = false;
                return;
            }
            this.undoStack.push(state);
            if (this.undoStack.length > this.maxHistory) {
                this.undoStack.shift();
            }
            this.redoStack = [];
        }

        undo(currentState) {
            if (this.undoStack.length === 0) return null;
            this.redoStack.push(currentState);
            this.isUndoRedo = true;
            return this.undoStack.pop();
        }

        redo(currentState) {
            if (this.redoStack.length === 0) return null;
            this.undoStack.push(currentState);
            this.isUndoRedo = true;
            return this.redoStack.pop();
        }

        clear() {
            this.undoStack = [];
            this.redoStack = [];
        }

        canUndo() { return this.undoStack.length > 0; }
        canRedo() { return this.redoStack.length > 0; }
    }

    const history = new HistoryManager();
    let lastSavedState = textarea.value;

    function saveHistory() {
        const currentState = textarea.value;
        if (currentState !== lastSavedState) {
            history.push(lastSavedState);
            lastSavedState = currentState;
        }
    }

    function performUndo() {
        const state = history.undo(textarea.value);
        if (state !== null) {
            textarea.value = state;
            lastSavedState = state;
            updatePreview();
            updateUndoRedoButtons();
        }
    }

    function performRedo() {
        const state = history.redo(textarea.value);
        if (state !== null) {
            textarea.value = state;
            lastSavedState = state;
            updatePreview();
            updateUndoRedoButtons();
        }
    }

    function updateUndoRedoButtons() {
        undoBtn.style.opacity = history.canUndo() ? '1' : '0.4';
        redoBtn.style.opacity = history.canRedo() ? '1' : '0.4';
    }

    // === Рендеринг Markdown ===
    function renderMarkdown(text) {
        let html = text;
        html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
        });
        html = html.replace(/`([^`]+)`/g, (match, code) => {
            return `<code>${escapeHtml(code)}</code>`;
        });
        html = html.replace(/^###### (.*$)/gm, '<h6>$1</h6>');
        html = html.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
        html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        html = html.replace(/^- \[x\] (.*$)/gm, '<div><input type="checkbox" checked disabled> $1</div>');
        html = html.replace(/^- \[ \] (.*$)/gm, '<div><input type="checkbox" disabled> $1</div>');
        html = html.replace(/^---$/gm, '<hr>');
        html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
        html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        html = html.replace(/__(.*?)__/g, '<b>$1</b>');
        html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
        html = html.replace(/_(.*?)_/g, '<i>$1</i>');
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<b><i>$1</i></b>');
        html = html.replace(/___(.*?)___/g, '<b><i>$1</i></b>');
        html = html.replace(/~~(.*?)~~/g, '<s>$1</s>');
        html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
        html = html.replace(/^\* (.*$)/gm, '<li>$1</li>');
        html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        // Таблицы
        const lines = html.split('\n');
        let inTable = false;
        let tableHtml = '';
        let newLines = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.includes('|') && !line.startsWith('<')) {
                if (!inTable) {
                    tableHtml = '<table>';
                    inTable = true;
                }
                let cells = line.split('|').filter(c => c.trim() !== '');
                if (cells.length > 0 && cells.every(c => /^-+$/.test(c.trim()))) {
                    continue;
                }
                tableHtml += '<tr>';
                cells.forEach(cell => {
                    tableHtml += `<td>${cell.trim()}</td>`;
                });
                tableHtml += '</tr>';
            } else {
                if (inTable) {
                    tableHtml += '</table>';
                    newLines.push(tableHtml);
                    inTable = false;
                }
                newLines.push(line);
            }
        }
        if (inTable) {
            tableHtml += '</table>';
            newLines.push(tableHtml);
        }
        html = newLines.join('\n');

        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        html = html.replace(/<p><pre>/g, '<pre>');
        html = html.replace(/<\/pre><\/p>/g, '</pre>');
        html = html.replace(/<p><ul>/g, '<ul>');
        html = html.replace(/<\/ul><\/p>/g, '</ul>');
        html = html.replace(/<p><ol>/g, '<ol>');
        html = html.replace(/<\/ol><\/p>/g, '</ol>');
        html = html.replace(/<p><blockquote>/g, '<blockquote>');
        html = html.replace(/<\/blockquote><\/p>/g, '</blockquote>');
        html = html.replace(/<p><h/g, '<h');
        html = html.replace(/<\/h\d><\/p>/g, (match) => match.replace('</p>', ''));
        html = html.replace(/<p><hr><\/p>/g, '<hr>');
        html = html.replace(/<p><div/g, '<div');
        html = html.replace(/<\/div><\/p>/g, '</div>');
        return html;
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    function updatePreview() {
        const text = textarea.value;
        const rendered = renderMarkdown(text);
        preview.innerHTML = rendered;
        const chars = text.length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        stats.innerHTML = `Символов: ${chars} &nbsp; Слов: ${words}`;
        localStorage.setItem('markdownEditorContent', text);
        saveHistory();
        updateUndoRedoButtons();
    }

    function wrapSelection(prefix, suffix, template) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end);
        let newText = '';
        let cursorPos = 0;

        if (selected.length > 0) {
            newText = prefix + selected + suffix;
            cursorPos = start + newText.length;
        } else {
            newText = template;
            cursorPos = start + prefix.length;
        }

        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        textarea.value = before + newText + after;
        textarea.focus();
        if (selected.length > 0) {
            textarea.selectionStart = start;
            textarea.selectionEnd = start + newText.length;
        } else {
            textarea.selectionStart = cursorPos;
            textarea.selectionEnd = cursorPos;
        }
        updatePreview();
    }

    function handleAction(action) {
        switch (action) {
            case 'h1': wrapSelection('# ', '', '# текст'); break;
            case 'h2': wrapSelection('## ', '', '## текст'); break;
            case 'h3': wrapSelection('### ', '', '### текст'); break;
            case 'bold': wrapSelection('**', '**', '**жирный**'); break;
            case 'italic': wrapSelection('*', '*', '*курсив*'); break;
            case 'bolditalic': wrapSelection('***', '***', '***жирный курсив***'); break;
            case 'strike': wrapSelection('~~', '~~', '~~зачеркнутый~~'); break;
            case 'code': wrapSelection('`', '`', '`код`'); break;
            case 'codeblock': wrapSelection('```\n', '\n```', '```\nблок кода\n```'); break;
            case 'link': wrapSelection('[', '](https://)', '[ссылка](https://)'); break;
            case 'image': wrapSelection('![', '](https://)', '![alt](https://)'); break;
            case 'checkbox': wrapSelection('- [ ] ', '', '- [ ] задача'); break;
            case 'ol': wrapSelection('1. ', '', '1. пункт'); break;
            case 'ul': wrapSelection('- ', '', '- пункт'); break;
            case 'quote': wrapSelection('> ', '', '> цитата'); break;
            case 'hr': wrapSelection('\n---\n', '', '---'); break;
            case 'table': wrapSelection('\n| заголовок | заголовок |\n| --- | --- |\n| ячейка | ячейка |\n', '', '| заголовок | заголовок |\n| --- | --- |\n| ячейка | ячейка |\n'); break;
            default: break;
        }
    }

    // === События ===
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            handleAction(action);
        });
    });

    // Undo / Redo кнопки
    undoBtn.addEventListener('click', performUndo);
    redoBtn.addEventListener('click', performRedo);

    copyBtn.addEventListener('click', async () => {
        const text = textarea.value;
        try {
            await navigator.clipboard.writeText(text);
            copyBtn.classList.add('copy-feedback');
            copyBtn.textContent = '✅ Готово!';
            setTimeout(() => {
                copyBtn.classList.remove('copy-feedback');
                copyBtn.innerHTML = '📋 Копировать';
            }, 1500);
        } catch {
            textarea.select();
            document.execCommand('copy');
            copyBtn.textContent = '✅ Скопировано';
            setTimeout(() => { copyBtn.innerHTML = '📋 Копировать'; }, 1500);
        }
    });

    clearBtn.addEventListener('click', () => {
        if (confirm('Очистить весь текст?')) {
            textarea.value = '';
            history.clear();
            lastSavedState = '';
            updatePreview();
        }
    });

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        themeToggle.textContent = isDark ? '☀️' : '🌙';
    });

    textarea.addEventListener('input', updatePreview);

    // Горячие клавиши
    textarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b': e.preventDefault(); handleAction('bold'); break;
                case 'i': e.preventDefault(); handleAction('italic'); break;
                case 'k': e.preventDefault(); handleAction('link'); break;
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        performRedo();
                    } else {
                        performUndo();
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    performRedo();
                    break;
                default: break;
            }
        }
    });

    // === Инициализация ===
    const saved = localStorage.getItem('markdownEditorContent');
    if (saved !== null) {
        textarea.value = saved;
    } else {
        textarea.value = `# Заголовок H1
## Заголовок H2
### Заголовок H3

**Выделите текст** и нажмите кнопку, чтобы применить форматирование.

- Маркированный список
- [x] Чекбокс

> Цитата отлично работает.

\`\`\`
блок кода
\`\`\`

[Ссылка на GitHub](https://github.com)`;
    }

    lastSavedState = textarea.value;
    history.push(lastSavedState);
    updatePreview();
    updateUndoRedoButtons();

    // Экспорт в .md по двойному клику на статус-бар
    const statusBar = document.querySelector('.status-bar');
    statusBar.addEventListener('dblclick', () => {
        const blob = new Blob([textarea.value], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.md';
        a.click();
        URL.revokeObjectURL(url);
    });
    const exportHint = document.createElement('span');
    exportHint.textContent = ' ⬇️ двойной клик для экспорта .md';
    exportHint.style.cursor = 'pointer';
    statusBar.querySelector('span:last-child').appendChild(exportHint);
})();

function openFeedback() { document.getElementById('feedbackModal').classList.add('show'); }
function closeFeedback() { document.getElementById('feedbackModal').classList.remove('show'); }
document.getElementById('feedbackModal').onclick = e => { if (e.target.id === 'feedbackModal') closeFeedback(); }
